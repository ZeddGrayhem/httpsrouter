const express = require('express')
const vhost = require('vhost')
const app = express();
const https = require('https')
const log4js = require("log4js")
const proxy = require('http-proxy').createProxyServer()
const watch = require('node-watch')
const tls = require('tls')
const path = require('path')
const fs = require('fs')
const async = require('async')

const { validateDomain, getContext, getDomain } = require('./utilities.js')
const config = require('./config.json')

//Setting up logging
log4js.configure({
    appenders: { 
        debug: { type:"file", filename: "logs/debug.log", maxLogSize: `${config.debugLogMax}M`},
        connections: { type:"file", filename: "logs/connections.log", maxLogSize: `${config.connectionLogMax}M`}
    },
    categories: { default: { appenders: ["debug"], level: "ALL" }, connections: { appenders: ["connections"], level: "ALL"}}
})

const debug = log4js.getLogger("debug");
const connections = log4js.getLogger("connections");

debug.log("Application started")
console.log(`\n\x1b[95mStarting httpsrouter \x1b[0m`)

debug.log('Current config:', config)
console.log('Current config:', config)

//Catch errors from http proxy
proxy.on('error', (err) =>  debug.error('Failed to proxy request:', err))

var dynamicMiddleware = new Array();
var activeDomains = new Array();

const getMiddleware = (host) => dynamicMiddleware.findIndex(middleware => middleware.options.host == host)

const addMiddleware = ({type, options}) => {
    debug.log('Added middleware', options)
    dynamicMiddleware.push(new types[type](options))
}

const refreshMiddleware = ({options, middleware, type}) => {
    console.log('Refreshed middleware', options)
    middleware.unload()
    dynamicMiddleware.splice(getMiddleware(options.host), 1, new types[type](options))
}

const removeMiddleware = ({middleware}) => {
    debug.log('Removed middleware', middleware.options)
    middleware.unload()
    dynamicMiddleware.splice(getMiddleware(middleware.options.host), 1)
}


const SNICallback = (hostname, callback) => {
    if(!activeDomains.includes(getDomain(hostname))) return false
    
    const context = getContext(getDomain(hostname))
    const secure_context = new tls.createSecureContext(context)
	callback(null, secure_context);
}


class customMiddleware {
    constructor(options){
        this.options = options
        this.middleware = this.create(options)
    }

    create(){ }
    unload(){}
}

class reverseProxy extends customMiddleware {
    create({host, port}){
        console.log(`\n\x1b[33m✔ ${host}: \x1b[0m Proxying to port: ${port}`)
        return vhost(host, express().all("*", (req, res) => {
            proxy.web(req, res, {target: `http://localhost:${port}`})
        }))
    }
}

class serveExpress extends customMiddleware {
    create({host, location, refresh}){
        console.log(`\n\x1b[33m✔ ${host}: \x1b[0m Serving ${location}`)
    
        //Refresh on update
        if(refresh) this.watch = watch(path.dirname(location), { recursive: true }, this.refresh)

        return vhost(host, require(location).app)
    }

    refresh(){
        console.log(`\n\x1b[95mFile change event\x1b[0m`)
        console.log(`\n\x1b[33m✔ ${host}: \x1b[0m Restarting ${location}`)
        delete require.cache[require.resolve(this.options.location)]
        this.middleware = vhost(host, require(this.options.location).app)  
    }
    
    unload(){
        delete require.cache[require.resolve(this.options.location)]
        this.watch?.close()
    }
}

const types = { reverseProxy, serveExpress }

const updateConfig = () => {
    debug.log('Config was refreshed')
    var configuration
    try { configuration = JSON.parse(fs.readFileSync('router.json'))}
    catch(err){
        console.error(`Error: Couldn't parse config`)
        console.error(err)
        return
    }

    const configs = Object.values(configuration).flat()
    //Validate config
    var encountered_hosts = []
    configs.forEach(config => {
        if(!validateDomain(config.host)){
            console.error(`Error: Invalid hostname`, config.host)
            return false
        }
        if(!getContext(getDomain(config.host))){
            console.error(`Error: Couldn't find certificates for host`, config.host)
            return false
        }
        if(encountered_hosts.includes(config.host)){
            console.error(`Error: Duplicate host`, config.host)
            return false
        }

        encountered_hosts.push(config.host)
    })

    Object.keys(types).forEach(type => {
        console.log(`\n\x1b[95mReloaded ${type} configs\x1b[0m`)
        dynamicMiddleware
            .filter(middleware => !configs.some(options => options.host == middleware.options.host))
            .forEach(middleware => {
                try {
                    removeMiddleware({middleware})
                }
                catch{
                    debug.error(`Couldn't remove config option: `, middleware.options)
                }
            })
    
        configuration
            [type]
            .filter(options => !dynamicMiddleware.some(middleware => JSON.stringify(middleware.options) == JSON.stringify(options)))
            .forEach(options => {
                try{
                    const middleware = dynamicMiddleware[getMiddleware(options.host)]
                    if(middleware) refreshMiddleware({options, middleware, type})
                    else addMiddleware({type, options})
                }
                catch{
                    debug.error('Couldnt refresh ', options)
                }
                
            })
    })

    activeDomains = encountered_hosts.map(host => getDomain(host))
    //Sort by priority
    dynamicMiddleware = dynamicMiddleware.sort((a, b) => a.options.priority - b.options.priority)

}

updateConfig()
watch('router.json', updateConfig)

if(config.logConnections) {
    app.use((req, res, next) => {
        connections.log(`(${req.ip?.split(':')[3]}) -> ${req.hostname}${req.url}`)
        next();
    })
}

app
.use((req, res, next) => {
    if(activeDomains.includes(getDomain(req.hostname))) return next();
    res.send(';) invalid domain')
})

//Use dynamic middleware
.use((req, res, next) => {
    async.eachSeries(
        dynamicMiddleware,
        ({middleware}, callback) => middleware(req, res, callback),
        (err) => err ? debug.log(err) : next()
    )
})

server = https.Server({SNICallback: SNICallback}, app)
    .listen(config.httpsPort, () => console.log(`\n\x1b[95mStarted serving over https \x1b[0m`))

if(config.redirectHttp){
    express()
        .all("*", (req, res) => res.redirect(`https://${req.hostname}:443${req.url}`))    
        .listen(config.httpPort, () => console.log(`\n\x1b[95mStarted redirecting http traffic \x1b[0m`))
}
# httpsrouter
> | Reverse Proxy | Express virtual hosts with https | Serve multiple applications over https

Uses node.js, express and vhost to serve multiple applications on the same port through https, includes a reverse proxy to serve none express applications over https too.

* 🌐 Easy to use, install and secure
* 🎃 Configuration auto syncs, and only modifies changed applications
* 🔃 Automatically reload express applications on changes during development
* 📦 Extensible add global middleware, custom logging etc.
* 🔐 From nothing to any project over https in a few minutes
* 🤖 Supports Certbot out of the box
## Installation
Git clone the project, enter it and install it with npm

```bash
git clone https://github.com/ZeddGrayhem/httpsrouter
cd httpsrouter
npm install
```
Now make a router.json file to configure the router.
> Check out examples, it's quick and easy

Next run the application
```bash
node httpsrouter.js
```
Note: Use something like PM2 if you intend to run it persistently.

## Certificates
Configured by default to use certbot for certificate locations
https://certbot.eff.org/

> To add your own custom certificate method simply modify the functions in config.js

# Configuration
Check configuration examples for a template
* Automatically pushes new config changes
* Priority decides which routes come first
* Configuration on general router behaviour is handled by config.js

## Serve Express
Serves an express app directly.
* Host: Which hostname should access this application, uses vhost under the hood
* Location: Location to a node.js application exporting an express app, see examples
* Refresh: If set to true will reload (only) the app when changes are made to its home directory similar to Nodemon

## Reverse proxy
Opens a reverse proxy through https
* Host: Which hostname should access this application, uses vhost under the hood
* Port: Which local port to forward to

# Examples

Example compatible node.js application
```js
const express = require('express')
const app = express()

app.get('/', (req, res) => res.send('Success'))
module.exports = { app }
```

Example configuration
```json
{
    "serveExpress": [
        {
            "host": "example.domain",
            "location": "/foo/bar",
            "refresh": true,
            "priority": 1
        },
    ],
    "reverseProxy": [
        {
            "host": "example2.domain",
            "port": 4390,
            "priority": 2
        }
    ]
}
```
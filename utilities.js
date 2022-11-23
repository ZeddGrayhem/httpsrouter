const fs = require('fs');

const validateDomain = (domain) => domain.match(new RegExp(/^((?:(?:(?:\w[\.\-\+]?)*)\w)+)((?:(?:(?:\w[\.\-\+]?){0,62})\w)+)\.(\w{2,6})$/));

const getDomain = (url) =>{
    const name_split = url.split('.')
    if(name_split.length > 2){
        const [TLD, domain] = name_split.reverse()
        return `${domain}.${TLD}`
    }
    else return `${name_split[0]}.${name_split[1]}`
}

//Modify this function if you don't use certbot
const getContext = (name) =>{
    try {
    	const key = fs.readFileSync(`/etc/letsencrypt/live/${name}/privkey.pem`)
        const cert = fs.readFileSync(`/etc/letsencrypt/live/${name}/fullchain.pem`)
	    if(key && cert)  return { key, cert}
    	return false
    } catch { return false }
}

module.exports = { validateDomain, getContext, getDomain}
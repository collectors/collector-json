'use strict'

const PassThrough = require('readable-stream/passthrough')
const proxyaddr = require('proxy-addr')
const typer = require('media-typer')
const rawBody = require('raw-body')
const Cookies = require('cookies')
const typeis = require('type-is')
const uid = require('uid-safe')

module.exports = Collector

function Collector(options) {
  if (!(this instanceof Collector)) return new Collector(options)

  options = options || {}

  // cookie options
  this.key = options.key || 'acid'
  this.length = options.byteLength || 16
  this.maxAge = options.maxAge || 365 * 24 * 60 * 60 * 1000

  // ip options
  this.trust = options.trust || alwaysTrue

  // body options
  this.limit = options.limit || '10kb'

  // stream
  this.stream = new PassThrough({
    objectMode: true,
  }).on('error', /* istanbul ignore next */ function (err) {
    console.error(err.stack)
  })
}

/**
 * Optionally create a callback.
 */

Collector.prototype.callback = function () {
  const self = this
  return function (req, res) {
    return self.call(null, req, res)
  }
}

/**
 * Call the collector on a request.
 * Pretends to be a `fn.call(this)` options.
 */

Collector.prototype.call = function (SELF, req, res) {
  const headers = req.headers
  const origin = headers.origin
  const stream = this.stream
  const obj = {
    headers: headers,
    acid: this.getACID(req, res),
    ip: proxyaddr(req, this.trust),
    received_at: new Date(),
  }

  if (origin) res.setHeader('Access-Control-Allow-Origin', '*')

  switch (req.method) {
    case 'POST': break
    case 'OPTIONS':
      if (origin) {
        const method = headers['access-control-request-method']
        if (!method || method.trim() !== 'POST') {
          res.statusCode = 405
          res.end()
          return
        }
        res.setHeader('Access-Control-Allow-Methods', 'POST')
        res.setHeader('Access-Control-Max-Age', '1728000')
      }
      res.setHeader('Allow', 'POST, OPTIONS')
      res.statusCode = 204
      res.end()
      return
    default:
      res.setHeader('Allow', 'POST, OPTIONS')
      res.statusCode = 405
      res.end()
      return
  }

  // we allow text so you could get around CORS
  if (!typeis(req, ['json', 'text'])) {
    stream.write(obj)
    res.statusCode = 415
    res.end()
    return
  }

  rawBody(req, {
    length: headers['content-length'],
    limit: this.limit,
    encoding: typer.parse(headers['content-type']).parameters.charset,
  }, function (err, string) {
    /* istanbul ignore if */
    if (err) {
      console.log(JSON.stringify(err.stack))
      stream.write(obj)
      res.statusCode = err.status || 415
      res.end()
      return
    }

    const json = parseJSON(string)
    if (typeof json === 'number') res.statusCode = json
    else obj.data = json

    stream.write(obj)
    res.end()
  })
}

/**
 * Pipe the collector to another stream.
 */

Collector.prototype.pipe = function (dest, opts) {
  return this.stream.pipe(dest, opts)
}

/**
 * Create and set an anonymous cookie ID.
 */

Collector.prototype.getACID = function (req, res) {
  const cookies = Cookies(req, res)
  const acid = cookies.get(this.key) || uid.sync(this.length)
  cookies.set(this.key, acid, {
    expires: new Date(Date.now() + this.maxAge),
    httpOnly: true,
  })
  return acid
}

/**
 * Only accept JSON objects as body.
 */

function parseJSON(string) {
  if (!/^\s*\{.*\}\s*$/.test(string)) return 422
  try {
    return JSON.parse(string)
  } catch (err) {
    return 400
  }
}

/* istanbul ignore next */
function alwaysTrue() {
  return true
}

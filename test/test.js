'use strict'

const PassThrough = require('readable-stream/passthrough')
const request = require('supertest')
const assert = require('assert')

const Collector = require('..')

describe('JSON Collector', function () {
  const collector = Collector()
  const fn = collector.callback()

  it('should pass data', function (done) {
    collector.stream.once('data', function (obj) {
      assert.equal(obj.data.event, 'asdf')
      done()
    })

    request(fn)
    .post('/')
    .send({
      event: 'asdf'
    })
    .expect(200, function (err) {
      if (err) return done(err)
    })
  })

  it('should 422 on non-object JSON', function (done) {
    request(fn)
    .post('/')
    .send([1, 2, 3])
    .expect(422, done)
  })

  it('should 400 on invalid JSON', function (done) {
    request(fn)
    .post('/')
    .type('json')
    .send('{a:1}')
    .expect(400, done)
  })

  it('should accept JSON as text/plain', function (done) {
    collector.stream.once('data', function (obj) {
      assert.equal(obj.data.event, 'asdf')
      done()
    })

    request(fn)
    .post('/')
    .type('text')
    .send(JSON.stringify({
      event: 'asdf'
    }))
    .expect(200, function (err) {
      if (err) return done(err)
    })
  })

  it('should 415 on non-JSON and non-text', function (done) {
    request(fn)
    .post('/')
    .type('form')
    .send('a=1')
    .expect(415, done)
  })

  it('should support .pipe()', function (done) {
    collector.pipe(new PassThrough({
      objectMode: true,
    })).once('data', function (obj) {
      assert.equal(obj.data.event, 'asdf')
      done()
    })

    request(fn)
    .post('/')
    .type('text')
    .send(JSON.stringify({
      event: 'asdf'
    }))
    .expect(200, function (err) {
      if (err) return done(err)
    })
  })

  it('should pass headers', function (done) {
    collector.stream.once('data', function (obj) {
      assert.equal(obj.data.event, 'asdf')
      assert.equal(obj.headers['user-agent'], 'useragent')
      assert.equal(obj.headers.referrer || obj.headers.referer, 'https://google.com')
      done()
    })

    request(fn)
    .post('/')
    .type('text')
    .set('user-agent', 'useragent')
    .set('referrer', 'https://google.com')
    .send(JSON.stringify({
      event: 'asdf'
    }))
    .expect(200, function (err) {
      if (err) return done(err)
    })
  })

  it('should get and set .acid', function (done) {
    let acid
    collector.stream.once('data', function (obj) {
      acid = obj.acid
      assert.equal(typeof acid, 'string')
    })

    request(fn)
    .post('/')
    .send({
      event: 'asdf'
    })
    .expect(200, function (err, res) {
      if (err) return done(err)

      collector.stream.once('data', function (obj) {
        assert.equal(obj.acid, acid)
        done()
      })

      request(fn)
      .post('/')
      .set('Cookie', res.headers['set-cookie'].join(';'))
      .send({
        event: 'klajsdf'
      }).expect(200, function (err) {
        if (err) return done(err)
      })
    })
  })

  it('should 405 on GET', function (done) {
    request(fn)
    .get('/')
    .expect(405, done)
  })

  it('should support OPTIONS', function (done) {
    request(fn)
    .options('/')
    .expect(204, done)
  })

  it('should support CORS OPTIONS w/ POST', function (done) {
    request(fn)
    .options('/')
    .set('Origin', 'https://google.com')
    .set('Access-Control-Request-Method', 'POST')
    .expect('Access-Control-Allow-Methods', 'POST')
    .expect('Access-Control-Allow-Origin', '*')
    .expect(204, done)
  })

  it('should support not CORS OPTIONS w/ GET', function (done) {
    request(fn)
    .options('/')
    .set('Origin', 'https://google.com')
    .set('Access-Control-Request-Method', 'GET')
    .expect('Access-Control-Allow-Origin', '*')
    .expect(405, done)
  })
})

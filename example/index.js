const Koa = require('koa')
const Router = require('@koa/router')
const { KASHelper } = require('..') // @keeer/kas-helper

const tokens = {}
const users = {}

const kas = new KASHelper({
  base: 'https://account.keeer.net/',
  get: token => token in tokens ? JSON.parse(tokens[token]) : null,
  upsert: async user => {
    const serialized = JSON.stringify(user)
    tokens[user.token] = serialized
    if (user.kiuid) users[user.kiuid] = serialized
    await new Promise(resolve => setTimeout(resolve, 2000)) // database writing is slowwwwww
  },
  token: process.env.KAS_SERVICE_TOKEN, // '12345678-90ab-cdef-1234-567890abcdef'
})

const app = new Koa()
const router = new Router()
app.use(kas.authenticate()).use(router.routes()).use(router.allowedMethods()).listen(8080)

const esc = str => str.replace(/</g, '&lt;').replace(/>/g, '&gt;')

router.get('/', ctx => {
  ctx.body = `
    <h1>Hello ${ctx.state.user ? esc(ctx.state.user.nickname || 'new user') : 'anonymous user'}!</h1>
    <a href="/nickname">Require login</a>,
    <a href="/bad-keeer-id">Require KEEER ID (bad implementation)</a>,
    <a href="/keeer-id">Require KEEER ID</a>,
    <a href="/bad-kiuid">Require KIUID (bad implementation)</a>,
    <a href="/kiuid">Require KIUID</a>,
    <form action="/costly" method="POST" style="display: inline"><button type="submit">Click here to spend 0.01 Kredit</button></form>.
  `
})
const requireLogin = kas.requireLogin(ctx => ctx.body = '<h1>Not Logged In</h1>')
router.get('/nickname', requireLogin, ctx => ctx.body = esc(ctx.state.user.nickname || 'new user'))
router.get('/bad-keeer-id', kas.requireKeeerId(ctx => ctx.body = '<h1>No KEEER ID</h1>'), ctx => ctx.body = esc(ctx.state.user.keeerId))
router.get('/keeer-id', requireLogin, kas.requireKeeerId(ctx => ctx.body = '<h1>No KEEER ID</h1>'), ctx => ctx.body = esc(ctx.state.user.keeerId))
// Note: kiuid is meant for INTERNAL USE ONLY. Do not expose this ID to frontend or anywhere out of this server in production.
router.get('/bad-kiuid', kas.requireKiuid(), ctx => ctx.body = ctx.state.user.kiuid)
router.get('/kiuid', requireLogin, kas.requireKiuid(), ctx => ctx.body = ctx.state.user.kiuid)
// Note: please use a CSRF token for this scanerio.
router.post('/costly', requireLogin, async ctx => {
  const paymentState = await ctx.state.user.pay(1) // 1 cent, 0.01 kredit
  if (!paymentState) return ctx.body = 'Insufficient balance, please recharge.'
  return ctx.body = 'Super secret message that you would spend 0.01 kredit to see'
})

const KASClient = require('@keeer/kas-client')

// internal symbols
const kOptions = Symbol('options'), kHelper = Symbol('helper'), kHasToken = Symbol('hasToken'), kClient = Symbol('client'), kFetchingKiuid = Symbol('fetchingKiuid')

// helper functions
const ENOT_LOGGED_IN = 'ENOT_LOGGED_IN'
const serviceTokenRequired = () => {
  const err = new Error('Service token required')
  err.code = 'EUNAUTHORIZED'
  throw err
}
const notLoggedIn = () => {
  const err = new Error('Not logged in yet.')
  err.code = ENOT_LOGGED_IN
  throw err
}

/** A user with a token. */
class KASUser {
  /**
   * Creates a user instance.
   * @private
   */
  constructor (options) { this[kOptions] = { ...options } }
  get kiuid () {
    if (!this[kHelper][kHasToken]) serviceTokenRequired()
    return this[kOptions].kiuid
  }
  /**
   * Fetches kiuid and returns it.
   * @async
   * @returns {string} kiuid
   */
  async fetchKiuid () {
    if (this.kiuid) return this.kiuid
    if (this[kFetchingKiuid]) return await this[kFetchingKiuid]
    return await (this[kFetchingKiuid] = new Promise((resolve, reject) => {
      this[kHelper][kClient].getKiuid(this.token).catch(reject).then(async kiuid => {
        this[kOptions].kiuid = kiuid
        delete this[kFetchingKiuid]
        await this.save()
        resolve(kiuid)
      })
    }))
  }
  /**
   * Saves this user.
   * @async
   */
  async save () { await this[kHelper][kOptions].upsert(this) }
  /**
   * Let the user pay for something.
   * This function will use KEEER ID to pay if it presents, or else it will use kiuid.
   * @param {number} amount Amount of centi-kredits to pay
   * @returns {boolean} true for success, false for insufficient kredit
   * @throws on other exceptions
   */
  async pay (amount) {
    if (!this[kHelper][kHasToken]) serviceTokenRequired()
    const [ type, ident ] = this.keeerId ? [ 'keeer-id', this.keeerId ] : [ 'kiuid', await this.fetchKiuid() ]
    try {
      await this[kHelper][kClient].pay(type, ident, amount)
      return true
    } catch (e) {
      if (e.code === 'EINSUFFICIENT_KREDIT') return false
      throw e
    }
  }
  valueOf () {
    if (this[kHelper][kHasToken]) {
      const { token, avatar, nickname, keeerId, kredit, kiuid } = this
      return { token, avatar, nickname, keeerId, kredit, kiuid }
    } else {
      const { token, avatar, nickname, keeerId, kredit } = this
      return { token, avatar, nickname, keeerId, kredit }
    }
  }
  toJSON () { return this.valueOf() }
}
for (const key of [ 'token', 'avatar', 'nickname', 'keeerId', 'kredit', kHelper ]) {
  Object.defineProperty(KASUser.prototype, key, { get () { return this[kOptions][key] } })
}

class KASHelper {
  /**
   * Creates a helper object. For accurate typings see the ts definition.
   * @param {string} options.base KAS base URL
   * @param {function} options.upsert the callback to upsert a user, signature: async KASUser => any
   * @param {function} options.get the callback to get a user, signature: async (token: string) => KASUser
   * @param {string} [options.token] the service token for KAS, you need it if you want kiuid
   */
  constructor ({ base, token, upsert, get }) {
    this.base = base
    if (token !== undefined) this[kClient] = new KASClient({ base, token })
    else this[kClient] = new KASClient({ base })
    this[kOptions] = { upsert, get }
    this[kHasToken] = token !== undefined
  }
  /**
   * Gets the user from a given context.
   * @param {any} ctx koa context
   * @param {boolean} [kiuid=false] should we fetch the KEEER ID?
   * @returns {KASUser|null} returns null if not logged in
   */
  async userFromContext (ctx, kiuid = false) {
    if (kiuid && !this[kHasToken]) serviceTokenRequired()
    const token = ctx.cookies.get('kas-account-token')
    if (!token) return null
    return await this.userFromToken(token, kiuid)
  }
  /**
   * Gets the user from a given token.
   * @param {string} token KAS account token
   * @param {boolean} [kiuid=false] should we fetch the KEEER ID?
   * @returns {KASUser|null} returns null if not logged in
   */
  async userFromToken (token, kiuid = false) {
    if (kiuid && !this[kHasToken]) serviceTokenRequired()
    const cachedUserOptions = await this[kOptions].get(token)
    if (cachedUserOptions) return new KASUser({ token, ...cachedUserOptions, [kHelper]: this })
    try {
      const user = new KASUser({ token, ...await this[kClient].getInformation(token), [kHelper]: this })
      if (kiuid) await user.fetchKiuid()
      await user.save()
      return user
    } catch (e) {
      if (e.code === ENOT_LOGGED_IN) return null
      throw e
    }
  }
  /** @typedef {function} KoaMiddleware */
  /**
   * Returns an authentication middleware, will set the user at `ctx.state.user`.
   * @param {boolean} [kiuid=false] should we fetch the KEEER ID?
   * @returns {KoaMiddleware}
   */
  authenticate (kiuid = false) {
    if (kiuid && !this[kHasToken]) serviceTokenRequired()
    return async (ctx, next) => {
      ctx.state.user = await this.userFromContext(ctx, kiuid)
      return await next()
    }
  }
  /**
   * Returns an middleware to call the callback if not logged in or next otherwise.
   * @param {function} [unauthorizedCallback] the function to call if unauthorized, defaults to set the status to 400
   * @returns {KoaMiddleware}
   */
  requireLogin (unauthorizedCallback = ctx => ctx.status = 400) {
    return async (ctx, next) => {
      if (!ctx.state.user) await unauthorizedCallback(ctx, next)
      else await next()
    }
  }
  /**
   * Returns an middleware to call the callback if KEEER ID is not set in or next otherwise.
   * Note: this middleware asserts that the user is already logged in. Failure of this assumption will lead to an error.
   * @param {function} [unauthorizedCallback] the function to call if no KEEER ID is set, defaults to redirect to the set KEEER ID page
   * @returns {KoaMiddleware}
   */
  requireKeeerId (unauthorizedCallback = ctx => ctx.redirect(new URL('/set-keeer-id', this.base))) {
    return async (ctx, next) => {
      const { user } = ctx.state
      if (!user) notLoggedIn()
      if (!user.keeerId) return unauthorizedCallback(ctx, next)
      return await next()
    }
  }
  /**
   * Returns an middleware to ensure that kiuid is set.
   * Note: this middleware asserts that the user is already logged in. Failure of this assumption will lead to an error.
   * @returns {KoaMiddleware}
   */
  requireKiuid () {
    if (!this[kHasToken]) serviceTokenRequired()
    return async (ctx, next) => {
      const { user } = ctx.state
      if (!user) notLoggedIn()
      if (!user.kiuid) await user.fetchKiuid()
      return await next()
    }
  }
}

module.exports = exports = { KASHelper, KASUser }

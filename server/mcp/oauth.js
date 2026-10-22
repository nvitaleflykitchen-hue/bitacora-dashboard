import { createHash, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { InvalidGrantError, InvalidTokenError, InvalidScopeError, InvalidClientMetadataError, InvalidTargetError } from '@modelcontextprotocol/sdk/server/auth/errors.js'

export const MCP_SCOPE = 'mcp:read'
export const digest = value => createHash('sha256').update(value).digest('hex')
const random = () => randomBytes(32).toString('base64url')
const expires = seconds => new Date(Date.now() + seconds * 1000).toISOString()
const alive = date => typeof date === 'string' && Date.parse(date) > Date.now()

export function oauthConfig(env, config) {
  const owners = (env.MCP_OAUTH_OWNER_IDS ?? '').split(',').map(s => s.trim())
  const key = Buffer.from(env.MCP_OAUTH_ENCRYPTION_KEY ?? '', 'base64')
  if (key.length !== 32 || owners.some(s => !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(s))) throw new Error('OAuth configuration incomplete')
  return { ...config, owners, encryptionKey: key }
}
export function encryptClient(client, key) {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv)
  const bytes = Buffer.concat([cipher.update(JSON.stringify(client)), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), bytes]).toString('base64')
}
export function decryptClient(value, key) {
  const data = Buffer.from(value, 'base64'), cipher = createDecipheriv('aes-256-gcm', key, data.subarray(0, 12))
  cipher.setAuthTag(data.subarray(12, 28))
  return JSON.parse(Buffer.concat([cipher.update(data.subarray(28)), cipher.final()]).toString())
}

// Separate persistence client: only this module writes its own OAuth tables.
// Application data tools retain the GET/HEAD-only client in handler.js.
export function createOAuthStore(config) {
  const client = createClient('https://mixyhfdlzjarvszinytk.supabase.co', config.secret, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(10000), redirect: 'error' }) } })
  const table = name => client.schema('bitacora').from(`mcp_oauth_${name}`)
  const execute = async q => { const { data, error } = await q; if (error) throw new Error('OAuth storage unavailable'); return data }
  return {
    getClient: id => execute(table('clients').select('encrypted_metadata').eq('id', id).maybeSingle()),
    putClient: row => execute(table('clients').insert(row)),
    async recentClients() { const { count, error } = await table('clients').select('id', { count: 'exact', head: true }).gte('created_at', new Date(Date.now() - 86400000).toISOString()); if (error) throw new Error('OAuth storage unavailable'); return count },
    insertGrant: row => execute(table('grants').insert(row)),
    find: (column, hash) => execute(table('grants').select('*').eq(column, hash).is('revoked_at', null).maybeSingle()),
    // Postgres reevaluates these predicates after concurrent row locks: codes and
    // rotating refresh tokens can be consumed at most once, across all instances.
    consume: (column, hash, patch, expiryColumn, clientId) => {
      let q = table('grants').update(patch).eq(column, hash).is('revoked_at', null).gt(expiryColumn, new Date().toISOString())
      if (clientId) q = q.eq('client_id', clientId)
      return execute(q.select('*').maybeSingle())
    },
    revoke: (column, hash, clientId) => execute(table('grants').update({ revoked_at: new Date().toISOString() }).eq(column, hash).eq('client_id', clientId)),
    async user(token) { const { data, error } = await client.auth.getUser(token); if (error) return null; return data.user },
  }
}

export function createOAuthProvider(config, store = createOAuthStore(config)) {
  const resource = config.url.href
  function assertResource(value) { if (value && String(value) !== resource) throw new InvalidTargetError('Unknown MCP resource') }
  function assertScopes(scopes) { if (scopes?.some(s => s !== MCP_SCOPE)) throw new InvalidScopeError('Only mcp:read is supported') }
  function allowed(row) { return row && config.owners.includes(row.owner_id) && Array.isArray(row.sedes) && row.sedes.some(s => config.sedes.includes(s)) }
  async function pending(handle) {
    if (typeof handle !== 'string' || !/^[\w-]{43}$/.test(handle)) throw new InvalidGrantError('Invalid authorization request')
    const row = await store.find('request_hash', digest(handle))
    if (!row || !alive(row.request_expires_at)) throw new InvalidGrantError('Authorization request expired')
    return row
  }
  function issue() {
    const access = random(), refresh = random()
    return { tokens: { access_token: access, token_type: 'Bearer', expires_in: 900, refresh_token: refresh, scope: MCP_SCOPE }, patch: { access_hash: digest(access), refresh_hash: digest(refresh), access_expires_at: expires(900), refresh_expires_at: expires(30 * 86400) } }
  }
  const provider = {
    clientsStore: {
      async getClient(id) { const row = await store.getClient(id); return row ? decryptClient(row.encrypted_metadata, config.encryptionKey) : undefined },
      async registerClient(client) {
        if (!client.redirect_uris?.length || client.redirect_uris.length > 5 || client.redirect_uris.some(uri => { const u = new URL(uri); return u.protocol !== 'https:' || u.hash || u.username || u.password })) throw new InvalidClientMetadataError('HTTPS redirect URIs required')
        assertScopes(client.scope?.split(' ').filter(Boolean))
        if (await store.recentClients() >= 100) throw new InvalidClientMetadataError('Daily client registration limit reached')
        // Never retrieve client logos/URLs or trust client names as an identity.
        const registered = { ...client, client_name: (client.client_name || 'Cliente MCP').slice(0, 120), scope: MCP_SCOPE }
        await store.putClient({ id: registered.client_id, encrypted_metadata: encryptClient(registered, config.encryptionKey) })
        return registered
      },
    },
    async authorize(client, params, res) {
      assertResource(params.resource); assertScopes(params.scopes)
      const handle = random()
      await store.insertGrant({ request_hash: digest(handle), request_expires_at: expires(600), client_id: client.client_id, redirect_uri: params.redirectUri, challenge: params.codeChallenge, state: params.state ?? null, resource, sedes: config.sedes })
      const consent = new URL('/mcp/connect', config.url); consent.searchParams.set('request', handle)
      res.redirect(consent.href)
    },
    async consentDetails(handle) {
      const row = await pending(handle), client = await provider.clientsStore.getClient(row.client_id)
      return { client_name: client?.client_name ?? 'Cliente MCP', redirect_origin: new URL(row.redirect_uri).origin, scope: MCP_SCOPE, sede_ids: row.sedes.filter(id => config.sedes.includes(id)) }
    },
    async consent(handle, userToken, approve) {
      const user = await store.user(userToken)
      if (!user || !config.owners.includes(user.id)) throw new InvalidTokenError('Esta cuenta no está autorizada para vincular MCP')
      const row = await pending(handle), code = random()
      const consumed = await store.consume('request_hash', digest(handle), { request_hash: null, owner_id: user.id, ...(approve ? { code_hash: digest(code), code_expires_at: expires(120) } : { revoked_at: new Date().toISOString() }) }, 'request_expires_at')
      if (!consumed) throw new InvalidGrantError('Authorization already used')
      const target = new URL(row.redirect_uri)
      target.searchParams.set(approve ? 'code' : 'error', approve ? code : 'access_denied')
      if (row.state !== null) target.searchParams.set('state', row.state)
      return { redirect_url: target.href }
    },
    async challengeForAuthorizationCode(client, code) {
      const row = await store.find('code_hash', digest(code))
      if (!allowed(row) || row.client_id !== client.client_id || !alive(row.code_expires_at)) throw new InvalidGrantError('Invalid authorization code')
      return row.challenge
    },
    async exchangeAuthorizationCode(client, code, verifier, redirectUri, requestedResource) {
      assertResource(requestedResource)
      const row = await store.find('code_hash', digest(code))
      if (!allowed(row) || row.client_id !== client.client_id || row.redirect_uri !== redirectUri || !alive(row.code_expires_at)) throw new InvalidGrantError('Invalid authorization code')
      const issued = issue()
      const consumed = await store.consume('code_hash', digest(code), { ...issued.patch, code_hash: null }, 'code_expires_at', client.client_id)
      if (!consumed) throw new InvalidGrantError('Authorization code already used')
      return issued.tokens
    },
    async exchangeRefreshToken(client, token, scopes, requestedResource) {
      assertResource(requestedResource); assertScopes(scopes)
      const row = await store.find('refresh_hash', digest(token))
      if (!allowed(row) || row.client_id !== client.client_id || !alive(row.refresh_expires_at)) throw new InvalidGrantError('Invalid refresh token')
      const issued = issue()
      // Absolute grant lifetime remains 30 days from the original authorization.
      issued.patch.refresh_expires_at = row.refresh_expires_at
      const consumed = await store.consume('refresh_hash', digest(token), issued.patch, 'refresh_expires_at', client.client_id)
      if (!consumed) throw new InvalidGrantError('Refresh token already used')
      return issued.tokens
    },
    async verifyAccessToken(token) {
      if (typeof token !== 'string' || !/^[\w-]{43}$/.test(token)) throw new InvalidTokenError('Invalid access token')
      const row = await store.find('access_hash', digest(token))
      if (!allowed(row) || !alive(row.access_expires_at) || row.resource !== resource) throw new InvalidTokenError('Invalid access token')
      return { token, clientId: row.client_id, scopes: [MCP_SCOPE], expiresAt: Date.parse(row.access_expires_at) / 1000, resource: new URL(resource), extra: { sedes: row.sedes.filter(id => config.sedes.includes(id)) } }
    },
    async revokeToken(client, request) {
      await store.revoke('access_hash', digest(request.token), client.client_id)
      await store.revoke('refresh_hash', digest(request.token), client.client_id)
    },
  }
  return provider
}

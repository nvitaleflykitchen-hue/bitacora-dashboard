import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createOAuthApp } from '../server/mcp/oauth-app.js'
import { createOAuthProvider, oauthConfig, encryptClient, decryptClient } from '../server/mcp/oauth.js'
import { readConfig, createHandler } from '../server/mcp/handler.js'
import { PGlite } from '@electric-sql/pglite'

const owner = '11111111-1111-4111-8111-111111111111'
const environment = { SUPABASE_URL: 'https://mixyhfdlzjarvszinytk.supabase.co', SUPABASE_SECRET_KEY: 'fixture', MCP_AUTH_TOKEN: 'fixture-token-at-least-32-characters-long', MCP_ALLOWED_SEDE_IDS: '19,21', MCP_PUBLIC_URL: 'http://127.0.0.1:3001/api/mcp', MCP_OAUTH_ENABLED: 'true', MCP_OAUTH_OWNER_IDS: owner, MCP_OAUTH_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString('base64') }
function memoryStore() {
  const clients = new Map(), grants = []
  return {
    clients, grants,
    getClient: async id => clients.get(id), putClient: async row => clients.set(row.id, row), recentClients: async () => clients.size,
    insertGrant: async row => grants.push(structuredClone(row)),
    find: async (column, hash) => structuredClone(grants.find(row => row[column] === hash && !row.revoked_at) ?? null),
    consume: async (column, hash, patch, expiryColumn, clientId) => {
      const row = grants.find(r => r[column] === hash && !r.revoked_at && Date.parse(r[expiryColumn]) > Date.now() && (!clientId || r.client_id === clientId))
      if (!row) return null
      Object.assign(row, patch); return structuredClone(row)
    },
    revoke: async (column, hash, clientId) => { for (const row of grants) if (row[column] === hash && row.client_id === clientId) row.revoked_at = new Date().toISOString() },
    user: async token => token === 'fixture-fly-session' ? { id: owner } : { id: 'unapproved-user' },
  }
}

test('OAuth HTTP: discovery, registration, consent, PKCE, audience, one-use codes, refresh and revocation', async t => {
  const env = { ...environment }, store = memoryStore()
  let app, handler
  const server = createServer((req, res) => req.url === '/api/mcp' ? handler(req, res) : app(req, res))
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const origin = `http://127.0.0.1:${server.address().port}`; env.MCP_PUBLIC_URL = `${origin}/api/mcp`
  const config = oauthConfig(env, readConfig(env)), provider = createOAuthProvider(config, store)
  app = createOAuthApp(env, provider)
  handler = createHandler({ env, oauthProviderFactory: () => createOAuthProvider(config, store), clientFactory: () => ({}) })
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) })
  const jsonPost = (path, data, headers = {}) => fetch(`${origin}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(data), redirect: 'manual' })
  const tokenPost = data => fetch(`${origin}/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(data), redirect: 'manual' })
  const unauthorized = await fetch(`${origin}/api/mcp`)
  assert.equal(unauthorized.status, 401)
  assert.match(unauthorized.headers.get('www-authenticate'), /resource_metadata=/)
  const metadata = await (await fetch(`${origin}/.well-known/oauth-authorization-server`)).json()
  assert.equal(metadata.authorization_endpoint, `${origin}/authorize`)
  assert.equal(metadata.registration_endpoint, `${origin}/register`)
  const prm = await (await fetch(`${origin}/.well-known/oauth-protected-resource/api/mcp`)).json()
  assert.equal(prm.resource, env.MCP_PUBLIC_URL)
  assert.equal((await jsonPost('/register', { redirect_uris: ['http://evil.example/callback'] })).status, 400)
  const registration = await jsonPost('/register', { client_name: 'Gemini test fixture', redirect_uris: ['https://gemini.google.com/test-callback'], token_endpoint_auth_method: 'client_secret_post', grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'], scope: 'mcp:read' })
  assert.equal(registration.status, 201)
  const client = await registration.json()
  assert.ok(client.client_secret)
  assert.ok(!JSON.stringify([...store.clients.values()]).includes(client.client_secret))
  const verifier = 'a'.repeat(64), challenge = createHash('sha256').update(verifier).digest('base64url')
  const params = { client_id: client.client_id, redirect_uri: client.redirect_uris[0], response_type: 'code', code_challenge: challenge, code_challenge_method: 'S256', state: 'original-state', resource: env.MCP_PUBLIC_URL, scope: 'mcp:read' }
  const authorize = extra => fetch(`${origin}/authorize?${new URLSearchParams({ ...params, ...extra })}`, { redirect: 'manual' })
  assert.equal((await authorize({ redirect_uri: 'https://evil.example/callback' })).status, 400)
  const wrongResource = await authorize({ resource: 'https://another.example/mcp' })
  assert.equal(new URL(wrongResource.headers.get('location')).searchParams.get('error'), 'invalid_target')
  const auth = await authorize({})
  assert.equal(auth.status, 302)
  const handle = new URL(auth.headers.get('location')).searchParams.get('request')
  const details = await (await fetch(`${origin}/api/mcp-consent?request=${handle}`)).json()
  assert.deepEqual(details.sede_ids, [19, 21])
  assert.equal((await jsonPost('/api/mcp-consent', { request: handle, approve: true }, { Origin: 'https://evil.example', Authorization: 'Bearer fixture-fly-session' })).status, 403)
  assert.equal((await jsonPost('/api/mcp-consent', { request: handle, approve: true }, { Origin: origin, Authorization: 'Bearer other-user' })).status, 400)
  const consent = await jsonPost('/api/mcp-consent', { request: handle, approve: true }, { Origin: origin, Authorization: 'Bearer fixture-fly-session' })
  assert.equal(consent.status, 200)
  const callback = new URL((await consent.json()).redirect_url), code = callback.searchParams.get('code')
  assert.equal(callback.searchParams.get('state'), 'original-state')
  assert.equal((await jsonPost('/api/mcp-consent', { request: handle, approve: true }, { Origin: origin, Authorization: 'Bearer fixture-fly-session' })).status, 400)
  const exchange = { grant_type: 'authorization_code', client_id: client.client_id, client_secret: client.client_secret, code, redirect_uri: params.redirect_uri, code_verifier: verifier, resource: env.MCP_PUBLIC_URL }
  assert.equal((await tokenPost({ ...exchange, code_verifier: 'wrong' })).status, 400)
  assert.equal((await tokenPost({ ...exchange, redirect_uri: 'https://evil.example/callback' })).status, 400)
  const attempts = await Promise.all([tokenPost(exchange), tokenPost(exchange)])
  assert.deepEqual(attempts.map(r => r.status).sort(), [200, 400])
  const tokens = await attempts.find(r => r.status === 200).json()
  assert.ok(!JSON.stringify(store.grants).includes(tokens.access_token))
  assert.ok(!JSON.stringify(store.grants).includes(tokens.refresh_token))
  const initialize = await jsonPost('/api/mcp', { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'gemini-fixture', version: '1' } } }, { Authorization: `Bearer ${tokens.access_token}`, Accept: 'application/json, text/event-stream' })
  assert.equal(initialize.status, 200)
  assert.equal((await initialize.json()).result.serverInfo.name, 'fly-gestion')
  assert.deepEqual((await createOAuthProvider({ ...config, sedes: [19] }, store).verifyAccessToken(tokens.access_token)).extra.sedes, [19])
  await assert.rejects(() => createOAuthProvider({ ...config, owners: [] }, store).verifyAccessToken(tokens.access_token))
  const refresh = { grant_type: 'refresh_token', client_id: client.client_id, client_secret: client.client_secret, refresh_token: tokens.refresh_token, resource: env.MCP_PUBLIC_URL }
  assert.equal((await tokenPost({ ...refresh, scope: 'write' })).status, 400)
  const refreshed = await (await tokenPost(refresh)).json()
  assert.ok(refreshed.access_token)
  assert.equal((await tokenPost(refresh)).status, 400)
  await assert.rejects(() => provider.verifyAccessToken(tokens.access_token))
  assert.ok(await provider.verifyAccessToken(refreshed.access_token))
  const revoked = await fetch(`${origin}/revoke`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: client.client_id, client_secret: client.client_secret, token: refreshed.refresh_token }) })
  assert.equal(revoked.status, 200)
  await assert.rejects(() => provider.verifyAccessToken(refreshed.access_token))
  const deniedAuth = await authorize({}), deniedHandle = new URL(deniedAuth.headers.get('location')).searchParams.get('request')
  const denied = await jsonPost('/api/mcp-consent', { request: deniedHandle, approve: false }, { Origin: origin, Authorization: 'Bearer fixture-fly-session' })
  assert.equal(new URL((await denied.json()).redirect_url).searchParams.get('error'), 'access_denied')
})

test('OAuth metadata encryption detects tampering and missing owner configuration', () => {
  const config = oauthConfig(environment, readConfig(environment))
  const encrypted = encryptClient({ client_secret: 'sensitive' }, config.encryptionKey)
  assert.equal(decryptClient(encrypted, config.encryptionKey).client_secret, 'sensitive')
  assert.throws(() => decryptClient(encrypted, Buffer.alloc(32, 2)))
  assert.throws(() => oauthConfig({ ...environment, MCP_OAUTH_OWNER_IDS: '' }, readConfig(environment)))
})

test('proposed OAuth SQL: only service_role can read/write state; conditional consumption is one-use', async () => {
  const db = new PGlite()
  try {
    await db.exec('create schema bitacora; create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema bitacora to anon, authenticated, service_role;')
    await db.exec(await readFile(new URL('../docs/mcp-oauth-setup.sql', import.meta.url), 'utf8'))
    await db.exec(`set role service_role; insert into bitacora.mcp_oauth_clients(id, encrypted_metadata) values ('${owner}', 'ciphertext'); insert into bitacora.mcp_oauth_grants(client_id, request_expires_at, redirect_uri, challenge, resource, sedes, code_hash, code_expires_at) values ('${owner}', now()+interval '10 minutes','https://example.com/callback','challenge','https://example.com/api/mcp',array[19], 'code',now()+interval '2 minutes'); reset role;`)
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`)
      await assert.rejects(() => db.query('select * from bitacora.mcp_oauth_clients'), /permission denied/)
      await assert.rejects(() => db.query('select * from bitacora.mcp_oauth_grants'), /permission denied/)
      await db.exec('reset role')
    }
    await db.exec('set role service_role')
    const consume = () => db.query("update bitacora.mcp_oauth_grants set code_hash=null, access_hash='access' where code_hash='code' and revoked_at is null and code_expires_at>now() returning id")
    assert.equal((await consume()).rows.length, 1)
    assert.equal((await consume()).rows.length, 0)
  } finally { await db.close() }
})

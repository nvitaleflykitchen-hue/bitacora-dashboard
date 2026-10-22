import { timingSafeEqual } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { createMcpServer } from './tools.js'

const projectUrl = 'https://mixyhfdlzjarvszinytk.supabase.co'
export function readConfig(env) {
  if (env.SUPABASE_URL !== projectUrl || !env.SUPABASE_SECRET_KEY || (env.MCP_AUTH_TOKEN?.length ?? 0) < 32) throw new Error('Missing backend configuration')
  const ids = (env.MCP_ALLOWED_SEDE_IDS ?? '').split(',').map(s => s.trim())
  if (!ids.length || ids.some(s => !/^[1-9]\d*$/.test(s) || !Number.isSafeInteger(Number(s)))) throw new Error('Explicit sede scope required')
  const url = new URL(env.MCP_PUBLIC_URL)
  if (url.pathname !== '/api/mcp' || url.search || url.hash || url.username || url.password || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))) throw new Error('Invalid public URL')
  return { url, token: env.MCP_AUTH_TOKEN, secret: env.SUPABASE_SECRET_KEY, sedes: [...new Set(ids.map(Number))] }
}
export function readOnlyFetch(fetchImpl = globalThis.fetch) {
  return (input, init) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url)
    const method = (init?.method ?? input?.method ?? 'GET').toUpperCase()
    if (url.origin !== projectUrl || !url.pathname.startsWith('/rest/v1/') || !['GET', 'HEAD'].includes(method)) throw new Error('Read-only backend')
    return fetchImpl(input, { ...init, redirect: 'error' })
  }
}
const respond = (res, status, message) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: message })) }
export function createHandler({ env = process.env, clientFactory = config => createClient(projectUrl, config.secret, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: readOnlyFetch() } }) } = {}) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    let config
    try { config = readConfig(env) } catch { return respond(res, 503, 'MCP backend not configured') }
    if (req.headers.host !== config.url.host || (req.headers.origin && req.headers.origin !== config.url.origin)) return respond(res, 403, 'Invalid host or origin')
    const provided = Buffer.from(req.headers.authorization ?? ''), expected = Buffer.from(`Bearer ${config.token}`)
    if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) { res.setHeader('WWW-Authenticate', 'Bearer'); return respond(res, 401, 'Unauthorized') }
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return respond(res, 405, 'Use Streamable HTTP POST; standalone SSE is not supported') }
    if (!(req.headers['content-type'] ?? '').toLowerCase().startsWith('application/json')) return respond(res, 415, 'Expected application/json')
    let body
    try {
      if (req.body !== undefined) {
        const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
        if (Buffer.byteLength(raw) > 32768) return respond(res, 413, 'Request too large')
        body = JSON.parse(raw)
      } else {
        const chunks = []; let size = 0
        for await (const chunk of req) { size += chunk.length; if (size > 32768) return respond(res, 413, 'Request too large'); chunks.push(chunk) }
        body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
      }
    } catch { return respond(res, 400, 'Invalid JSON') }
    let server
    try {
      server = createMcpServer(clientFactory(config), config.sedes)
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
      res.on('close', () => { void server.close().catch(() => {}) })
      await server.connect(transport)
      await transport.handleRequest(req, res, body)
    } catch { if (!res.headersSent) respond(res, 500, 'MCP request failed'); else res.end(); if (server) await server.close().catch(() => {}) }
  }
}

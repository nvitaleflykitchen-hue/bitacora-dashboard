import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { createClient } from '@supabase/supabase-js'
import { createHandler, readConfig, readOnlyFetch } from '../server/mcp/handler.js'

const env = { SUPABASE_URL: 'https://mixyhfdlzjarvszinytk.supabase.co', SUPABASE_SECRET_KEY: 'fixture-secret', MCP_AUTH_TOKEN: 'fixture-token-at-least-32-characters-long', MCP_ALLOWED_SEDE_IDS: '19,21', MCP_PUBLIC_URL: 'http://127.0.0.1:3001/api/mcp' }
test('configuration fails closed and write guard blocks mutations/other hosts', async () => {
  for (const patch of [{ MCP_ALLOWED_SEDE_IDS: '' }, { MCP_AUTH_TOKEN: 'short' }, { SUPABASE_URL: 'https://other.supabase.co' }, { MCP_PUBLIC_URL: 'http://example.com/api/mcp' }]) assert.throws(() => readConfig({ ...env, ...patch }))
  const fetch = readOnlyFetch(() => { throw new Error('must not fetch') })
  for (const method of ['POST', 'PATCH', 'DELETE', 'PUT']) assert.throws(() => fetch(`${env.SUPABASE_URL}/rest/v1/capa`, { method }), /Read-only/)
  assert.throws(() => fetch('https://other.supabase.co/rest/v1/capa'), /Read-only/)
})

test('actual MCP HTTP lifecycle, filters, pagination, scoping and errors (no network DB)', async t => {
  const requests = []; let fail = false; let empty = false
  const fixtures = {
    auditorias_internas: [{ id: 'a', sede_id: 19, codigo: 'AUD-1' }, { id: 'b', sede_id: 19 }],
    capa: [{ id: 1, sede_id: 19, estado: 'Completada' }],
    registros: [{ id: 1, sede_id: 19, detalle_b: 'Cámara: novedad' }],
    checklists: [{ id: 1, sede_id: 19, tipo: 'apertura', fecha: '2026-10-21', items_ok: 3, items_total: 4 }],
  }
  const db = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: readOnlyFetch(async (input, init) => {
    const url = new URL(input); requests.push({ url, init })
    assert.equal(init.method, 'GET')
    assert.equal(new Headers(init.headers).get('accept-profile'), 'bitacora')
    assert.match(url.searchParams.get('sede_id'), /^in\.\((19|19,21)\)$/)
    return new Response(JSON.stringify(fail ? { message: 'PRIVATE SQL SECRET' } : empty ? [] : fixtures[url.pathname.split('/').pop()]), { status: fail ? 403 : 200, headers: { 'Content-Type': 'application/json' } })
  }) } })
  const runtimeEnv = { ...env }
  const handler = createHandler({ env: runtimeEnv, clientFactory: () => db })
  const server = createServer(handler)
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const url = `http://127.0.0.1:${server.address().port}/api/mcp`; runtimeEnv.MCP_PUBLIC_URL = url
  const headers = { Authorization: `Bearer ${env.MCP_AUTH_TOKEN}`, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' }
  const client = new Client({ name: 'test', version: '1.0' })
  t.after(async () => { await client.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) })
  assert.equal((await fetch(url, { method: 'POST', body: '{}' })).status, 401)
  assert.equal((await fetch(url, { method: 'POST', headers: { ...headers, Origin: 'https://evil.example' }, body: '{}' })).status, 403)
  assert.equal((await fetch(url, { headers })).status, 405)
  assert.equal((await fetch(url, { method: 'POST', headers, body: '{' })).status, 400)
  assert.equal((await fetch(url, { method: 'POST', headers, body: JSON.stringify({ huge: 'x'.repeat(33000) }) })).status, 413)
  await client.connect(new StreamableHTTPClientTransport(new URL(url), { requestInit: { headers } }))
  assert.equal((await client.listTools()).tools.length, 4)
  const concurrent = await Promise.all([client.listTools(), client.listTools()])
  assert.ok(concurrent.every(r => r.tools.length === 4))
  const call = (name, args = {}) => client.callTool({ name, arguments: args })
  const audit = await call('get_auditorias', { escala_id: 19, limite: 1, desde: '2026-10-01', hasta: '2026-10-22', estado: 'Finalizada' })
  assert.equal(audit.isError, undefined); assert.equal(audit.structuredContent.has_more, true); assert.equal(audit.structuredContent.next_offset, 1)
  assert.equal(requests.at(-1).url.searchParams.get('fecha_auditoria'), 'gte.2026-10-01')
  assert.deepEqual(requests.at(-1).url.searchParams.getAll('fecha_auditoria'), ['gte.2026-10-01', 'lt.2026-10-23'])
  assert.equal(requests.at(-1).url.searchParams.get('estado'), 'eq.Finalizada')
  await call('get_capa_acciones', { estado: 'Cerrado' })
  assert.equal(requests.at(-1).url.searchParams.get('estado'), 'in.(Completada,Verificada)')
  assert.equal(requests.at(-1).url.searchParams.get('tipo'), 'in.(Correctiva,Preventiva)')
  const temp = await call('get_registros_temperatura', { camara: 'A%_1' })
  assert.equal(temp.structuredContent.mediciones_estructuradas_disponibles, false)
  assert.ok(requests.at(-1).url.searchParams.getAll('detalle_b').includes('ilike.%A\\%\\_1%'))
  const checklist = await call('get_checklists', { periodo: 'semanal' })
  assert.equal(checklist.structuredContent.resumen_pagina[0].porcentaje, 75)
  assert.equal(checklist.structuredContent.resumen_pagina[0].inicio, '2026-10-19')
  empty = true
  assert.deepEqual((await call('get_checklists')).structuredContent.resumen_pagina, [])
  const count = requests.length
  for (const args of [{ escala_id: 999 }, { limite: 1000 }, { desde: '2026-02-30' }, { desde: '2026-10-22', hasta: '2026-10-01' }, { sql: 'delete from capa' }]) assert.equal((await call('get_auditorias', args)).isError, true)
  assert.equal(requests.length, count)
  fail = true
  const failure = await call('get_auditorias')
  assert.equal(failure.isError, true); assert.ok(!JSON.stringify(failure).includes('PRIVATE'))
})

test('Node serverless adapter accepts already parsed req.body', async t => {
  const runtimeEnv = { ...env }
  const handler = createHandler({ env: runtimeEnv, clientFactory: () => ({}) })
  const server = createServer(async (req, res) => {
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    req.body = JSON.parse(Buffer.concat(chunks).toString())
    await handler(req, res)
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  runtimeEnv.MCP_PUBLIC_URL = `http://127.0.0.1:${server.address().port}/api/mcp`
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) })
  const response = await fetch(runtimeEnv.MCP_PUBLIC_URL, {
    method: 'POST', headers: { Authorization: `Bearer ${env.MCP_AUTH_TOKEN}`, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'serverless-test', version: '1' } } }),
  })
  assert.equal(response.status, 200)
  assert.equal((await response.json()).result.serverInfo.name, 'fly-gestion')
})

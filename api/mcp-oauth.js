import { createOAuthApp } from '../server/mcp/oauth-app.js'

let app
export default function handler(req, res) {
  // The rewrite supplies a fixed internal path; never accept arbitrary routing.
  const query = new URL(req.url, 'http://localhost').searchParams
  const route = req.query?.mcp_route ?? query.get('mcp_route')
  const routes = new Set(['/authorize', '/token', '/register', '/revoke', '/api/mcp-consent', '/.well-known/oauth-authorization-server', '/.well-known/oauth-protected-resource', '/.well-known/oauth-protected-resource/api/mcp'])
  if (!routes.has(route)) { res.writeHead(404).end(); return }
  query.delete('mcp_route')
  req.url = `${route}${query.size ? `?${query}` : ''}`
  try { app ??= createOAuthApp(); return app(req, res) }
  catch { res.writeHead(503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify({ error: 'OAuth backend not configured' })) }
}

import { createServer } from 'node:http'
import { createHandler, readConfig } from '../server/mcp/handler.js'
import { createOAuthApp } from '../server/mcp/oauth-app.js'

const config = readConfig(process.env)
if (!['localhost', '127.0.0.1'].includes(config.url.hostname) || config.url.protocol !== 'http:') throw new Error('Local runner requires an HTTP localhost MCP_PUBLIC_URL')
const oauth = process.env.MCP_OAUTH_ENABLED === 'true' ? createOAuthApp() : null
const server = createServer((req, res) => {
  if (req.url !== '/api/mcp') { if (oauth) return oauth(req, res); res.writeHead(404).end(); return }
  void createHandler()(req, res)
})
server.listen(Number(config.url.port || 80), '127.0.0.1', () => console.log(`MCP: ${config.url.href}`))

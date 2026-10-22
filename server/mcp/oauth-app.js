import express from 'express'
import { mcpAuthRouter } from '@modelcontextprotocol/sdk/server/auth/router.js'
import { OAuthError } from '@modelcontextprotocol/sdk/server/auth/errors.js'
import { createOAuthProvider, oauthConfig, MCP_SCOPE } from './oauth.js'
import { readConfig } from './handler.js'

export function createOAuthApp(env = process.env, injectedProvider) {
  const config = oauthConfig(env, readConfig(env))
  if (env.MCP_OAUTH_ENABLED !== 'true') throw new Error('OAuth disabled')
  const provider = injectedProvider ?? createOAuthProvider(config), app = express()
  app.disable('x-powered-by')
  app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('Referrer-Policy', 'no-referrer')
    res.setHeader('X-Frame-Options', 'DENY')
    if (req.headers.host !== config.url.host) return res.status(403).json({ error: 'invalid_host' })
    if (Number(req.headers['content-length'] || 0) > 32768) return res.status(413).json({ error: 'request_too_large' })
    next()
  })
  app.use(express.json({ limit: '32kb' }), express.urlencoded({ extended: false, limit: '32kb' }))
  app.get('/api/mcp-consent', async (req, res) => {
    try { res.json(await provider.consentDetails(req.query.request)) }
    catch { res.status(400).json({ error: 'Solicitud vencida o no disponible. Volvé a iniciar la conexión desde Gemini.' }) }
  })
  app.post('/api/mcp-consent', async (req, res) => {
    if (req.headers.origin !== config.url.origin || typeof req.body?.approve !== 'boolean') return res.status(403).json({ error: 'Solicitud no permitida' })
    const token = /^Bearer (\S+)$/.exec(req.headers.authorization ?? '')?.[1]
    if (!token) return res.status(401).json({ error: 'Iniciá sesión en Fly Gestión' })
    try { res.json(await provider.consent(req.body.request, token, req.body.approve)) }
    catch (error) { res.status(400).json({ error: error instanceof OAuthError ? error.message : 'No se pudo completar la autorización' }) }
  })
  app.use(mcpAuthRouter({ provider, issuerUrl: new URL(config.url.origin), resourceServerUrl: config.url, resourceName: 'Fly Gestión — consultas operativas', scopesSupported: [MCP_SCOPE], clientRegistrationOptions: { clientSecretExpirySeconds: 0 } }))
  // Compatibility for clients trying the root protected-resource URL first.
  app.get('/.well-known/oauth-protected-resource', (req, res) => res.redirect(307, '/.well-known/oauth-protected-resource/api/mcp'))
  app.use((error, req, res, next) => { if (res.headersSent) return next(error); res.status(error.status === 413 ? 413 : 500).json({ error: 'oauth_request_failed' }) })
  return app
}

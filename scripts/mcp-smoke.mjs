import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

const client = new Client({ name: 'fly-mcp-smoke', version: '1.0.0' })
try {
  await client.connect(new StreamableHTTPClientTransport(new URL(process.env.MCP_PUBLIC_URL), { requestInit: { headers: { Authorization: `Bearer ${process.env.MCP_AUTH_TOKEN}` } } }))
  const { tools } = await client.listTools()
  console.log('initialize OK; tools/list:', tools.map(t => t.name).join(', '))
  for (const tool of tools) {
    const response = await client.callTool({ name: tool.name, arguments: { limite: 1 } })
    if (response.isError) throw new Error(`${tool.name}: failed (check backend config/schema)`)
    console.log(`${tool.name}: OK`)
  }
} finally { await client.close() }

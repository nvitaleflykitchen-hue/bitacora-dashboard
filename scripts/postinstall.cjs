// Shim for @supabase/phoenix — the package ships without phoenix.mjs in some versions
const fs = require('fs')
const path = require('path')

const shimPath = path.resolve(__dirname, '../node_modules/@supabase/phoenix/priv/static/phoenix.mjs')
const shimContent = `export * from "./phoenix.cjs.js";\nexport { default } from "./phoenix.cjs.js";\n`

if (!fs.existsSync(shimPath)) {
  const dir = path.dirname(shimPath)
  if (fs.existsSync(dir)) {
    fs.writeFileSync(shimPath, shimContent)
    console.log('✓ phoenix.mjs shim created')
  } else {
    console.log('⚠ @supabase/phoenix not found, skipping shim')
  }
} else {
  console.log('✓ phoenix.mjs already exists')
}

import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins:[react()],
  // Valores ficticios: permiten importar el cliente en tests unitarios sin
  // copiar secretos ni conectarse a ningún proyecto Supabase real.
  define:{
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://tests.invalid.supabase.co'),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify('test-anon-key'),
  },
  test:{
    environment:'jsdom',
    setupFiles:['./src/test/setup.js'],
    include:['src/**/*.test.{js,jsx}'],
  },
})

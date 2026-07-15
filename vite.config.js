import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    // true (default): limpia builds viejos. Con false, dist acumuló 1383
    // archivos (38 MB) que se subían enteros a Vercel en cada deploy.
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('/react/') || id.includes('/react-dom/')) return 'vendor'
          if (id.includes('/@supabase/')) return 'supabase'
          if (id.includes('/recharts/')) return 'charts'
          return undefined
        },
      },
    },
  },
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',          // 🔑 THIS FIXES THE BLANK PAGE
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
})

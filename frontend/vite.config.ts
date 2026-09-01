import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import Icons from 'unplugin-icons/vite';

export default defineConfig({
  plugins: [
    react(),
    // Solar icons are compiled to inline SVG components at build time: no
    // runtime fetch, and only the icons actually imported end up in the bundle.
    Icons({ compiler: 'jsx', jsx: 'react', autoInstall: false }),
  ],
  resolve: {
    alias: { '@': new URL('./src', import.meta.url).pathname },
  },
  server: {
    port: 3000,
    // Fail loudly instead of drifting to the next free port — a silent port
    // change leaves the browser and the API proxy pointing at nothing.
    strictPort: true,
    proxy: {
      // Dev-only: keeps the browser same-origin so there's no CORS dance.
      '/api': { target: 'http://localhost:8000', changeOrigin: true },
    },
  },
});

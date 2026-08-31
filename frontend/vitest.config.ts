import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import Icons from 'unplugin-icons/vite';

export default defineConfig({
  // The same plugins the app builds with: components import `~icons/...`, which
  // only resolves through unplugin-icons.
  plugins: [react(), Icons({ compiler: 'jsx', jsx: 'react', autoInstall: false })],
  resolve: {
    alias: { '@': new URL('./src', import.meta.url).pathname },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});

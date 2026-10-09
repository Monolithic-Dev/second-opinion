import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// In development the Vite server proxies the API to the simulator (npm run demo); in production the simulator serves dist/.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': 'http://127.0.0.1:3000', '/healthz': 'http://127.0.0.1:3000' },
  },
  build: { outDir: 'dist', sourcemap: true, target: 'es2022' },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
    css: false,
  },
});

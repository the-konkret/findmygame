import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load ALL variables from .env (not only VITE_ ones). RAWG_API_KEY is used here, on your
  // computer, and is never put into the files sent to the browser.
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    server: {
      host: '127.0.0.1',
      port: 5173,
      strictPort: true,
      // Local stand-in for worker/index.ts: the browser calls /api/rawg/...,
      // and this adds the key and forwards the request to RAWG.
      proxy: {
        '/api/rawg': {
          target: 'https://api.rawg.io',
          changeOrigin: true,
          rewrite: (path) => {
            const [pathname, query = ''] = path.split('?');
            const params = new URLSearchParams(query);
            params.set('key', env.RAWG_API_KEY ?? '');
            return `${pathname.replace(/^\/api\/rawg/, '/api')}?${params}`;
          },
        },
      },
    },
  };
});

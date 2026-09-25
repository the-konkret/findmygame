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
        // The AI search needs Cloudflare's AI, which only exists on Cloudflare, so on your computer
        // these requests go to the live site (works once the AI search has been pushed and deployed).
        '/api/describe': {
          target: 'https://findmygame.mktestbb.workers.dev',
          changeOrigin: true,
        },
        // Finishing half-typed words ("killz" → "killzone") is also done by the live site's Worker.
        '/api/complete': {
          target: 'https://findmygame.mktestbb.workers.dev',
          changeOrigin: true,
        },
        // News from Steam (worker/news.ts): also from the live site.
        '/api/news': {
          target: 'https://findmygame.mktestbb.workers.dev',
          changeOrigin: true,
        },
        '/api/steamnews': {
          target: 'https://findmygame.mktestbb.workers.dev',
          changeOrigin: true,
        },
        // Rankings → Most played: on the live site the Worker fetches SteamSpy; locally we go straight there.
        '/api/steamspy': {
          target: 'https://steamspy.com',
          changeOrigin: true,
          rewrite: (path) => `/api.php?request=${path.replace(/^\/api\/steamspy\//, '')}`,
        },
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

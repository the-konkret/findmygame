// Cloudflare Worker: runs on Cloudflare's servers, not in the visitor's browser.
//
// - Requests to /api/rawg/... are handled here: the secret RAWG key is added and the request goes to RAWG.
// - POST /api/describe is the "Describe a game" AI search (worker/describe.ts, Cloudflare Workers AI).
// - Everything else (the website itself) is served straight from the built files in dist/,
//   configured in wrangler.jsonc, without running this code.
//
// The key is stored in Cloudflare (Worker → Settings → Variables and Secrets → RAWG_API_KEY, type Secret),
// never in the code.

import { handleDescribe, type AiBinding } from './describe';

interface Env {
  RAWG_API_KEY?: string;
  AI?: AiBinding;
  ASSETS: { fetch(request: Request): Promise<Response> };
}

// Only the endpoints the app uses, so this can't be used as an open door to the whole RAWG API.
const ALLOWED = /^games(\/[\w-]+(\/(stores|game-series))?)?$/;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/rawg/')) {
      return proxyRawg(url, request, env);
    }
    if (url.pathname === '/api/describe') {
      return handleDescribe(request, env);
    }
    if (url.pathname.startsWith('/api/')) {
      return json({ error: 'Not found' }, 404);
    }
    return env.ASSETS.fetch(request);
  },
};

async function proxyRawg(url: URL, request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
  if (!env.RAWG_API_KEY) return json({ error: 'RAWG_API_KEY is not configured on the server.' }, 500);

  const path = url.pathname.slice('/api/rawg/'.length).replace(/\/$/, '');
  if (!ALLOWED.test(path)) return json({ error: 'Not found' }, 404);

  const target = new URL(`https://api.rawg.io/api/${path}`);
  url.searchParams.forEach((value, name) => {
    if (name !== 'key') target.searchParams.set(name, value);
  });
  target.searchParams.set('key', env.RAWG_API_KEY);

  const upstream = await fetch(target.toString(), {
    headers: { 'User-Agent': 'FindMyGame (+https://github.com/the-konkret/findmygame)' },
  });

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      // Let browsers reuse answers for 5 minutes; saves RAWG requests.
      'Cache-Control': upstream.ok ? 'public, max-age=300' : 'no-store',
    },
  });
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

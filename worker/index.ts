// Cloudflare Worker: runs on Cloudflare's servers, not in the visitor's browser.
//
// - Requests to /api/rawg/... are handled here: the secret RAWG key is added and the request goes to RAWG.
// - POST /api/describe is the "Describe a game" AI search (worker/describe.ts, Cloudflare Workers AI).
// - Every 3 hours Cloudflare runs `scheduled` below: the price check for everyone's price alerts
//   (worker/priceCheck.ts). POST /api/alerts/run with the ALERT_RUN_KEY secret runs it on demand.
// - Everything else (the website itself) is served straight from the built files in dist/,
//   configured in wrangler.jsonc, without running this code.
//
// The key is stored in Cloudflare (Worker → Settings → Variables and Secrets → RAWG_API_KEY, type Secret),
// never in the code.

import { handleDescribe, type AiBinding } from './describe';
import { runPriceCheck, type PriceCheckEnv } from './priceCheck';

interface Env extends PriceCheckEnv {
  RAWG_API_KEY?: string;
  ALERT_RUN_KEY?: string;
  AI?: AiBinding;
  ASSETS: { fetch(request: Request): Promise<Response> };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

// Only the endpoints the app uses, so this can't be used as an open door to the whole RAWG API.
const ALLOWED = /^games(\/[\w-]+(\/(stores|game-series))?)?$/;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/rawg/')) {
      return proxyRawg(url, request, env);
    }
    if (url.pathname === '/api/alerts/run') {
      return runPriceCheckNow(request, env);
    }
    if (url.pathname === '/api/describe') {
      return handleDescribe(request, env);
    }
    if (url.pathname.startsWith('/api/')) {
      return json({ error: 'Not found' }, 404);
    }
    return env.ASSETS.fetch(request);
  },

  // Called by Cloudflare on the schedule in wrangler.jsonc ("triggers" → "crons").
  async scheduled(_event: unknown, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      runPriceCheck(env).then(
        (summary) => console.log('Price check:', JSON.stringify(summary)),
        (err: Error) => console.error('Price check failed:', err.message),
      ),
    );
  },
};

/** Runs the price check right now (for testing). Needs the header  Authorization: Bearer <ALERT_RUN_KEY>. */
async function runPriceCheckNow(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const given = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  if (!env.ALERT_RUN_KEY || !sameText(given, env.ALERT_RUN_KEY)) return json({ error: 'Not allowed' }, 401);
  try {
    return json(await runPriceCheck(env), 200);
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
}

/** Compares two strings without leaking, by timing, how much of a guess was right. */
function sameText(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

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

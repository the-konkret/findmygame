// Cloudflare Pages Function: runs on Cloudflare's servers, not in the visitor's browser.
// It handles every request to /api/rawg/..., adds the secret RAWG key, and passes the request to RAWG.
// The key is set in Cloudflare (Settings → Variables and Secrets → RAWG_API_KEY), never in the code.

interface Env {
  RAWG_API_KEY?: string;
}

interface Context {
  request: Request;
  env: Env;
  params: { path?: string | string[] };
}

// Only the endpoints the app uses, so the function can't be used as an open door to the whole RAWG API.
const ALLOWED = /^games(\/[\w-]+(\/stores)?)?$/;

export async function onRequestGet({ request, env, params }: Context): Promise<Response> {
  if (!env.RAWG_API_KEY) {
    return json({ error: 'RAWG_API_KEY is not configured on the server.' }, 500);
  }

  const path = Array.isArray(params.path) ? params.path.join('/') : (params.path ?? '');
  if (!ALLOWED.test(path)) {
    return json({ error: 'Not found' }, 404);
  }

  const incoming = new URL(request.url);
  const target = new URL(`https://api.rawg.io/api/${path}`);
  incoming.searchParams.forEach((value, name) => {
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

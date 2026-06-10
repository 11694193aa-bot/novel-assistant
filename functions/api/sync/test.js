export async function onRequest({ request }) {
  if (request.method === 'OPTIONS') return new Response(null, {
    headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' }
  });
  try {
    const { url, username, password } = await request.json();
    const target = url.replace(/\/$/, '');
    const auth = 'Basic ' + btoa(`${username}:${password}`);

    // resolveOverride 绕过 Cloudflare-to-Cloudflare 死循环
    const resp = await fetch(target, {
      method: 'GET',
      headers: { Authorization: auth },
      cf: { resolveOverride: new URL(target).hostname }
    });
    return Response.json({ ok: resp.ok || resp.status === 401, status: resp.status });
  } catch (e) {
    return Response.json({ ok: false, error: e.message });
  }
}

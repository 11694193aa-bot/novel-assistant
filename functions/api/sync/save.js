export async function onRequest({ request, env }) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };
  if (request.method === 'OPTIONS') return new Response(null, { headers });
  try {
    const { data, icons } = await request.json();
    const ts = Date.now();

    const tasks = [];

    if (icons) {
      for (const [name, src] of Object.entries(icons)) {
        tasks.push(src ? env.SYNC.put(`icon_${name}`, src) : env.SYNC.delete(`icon_${name}`));
      }
    }

    tasks.push(env.SYNC.put('data', JSON.stringify(data)));
    tasks.push(env.SYNC.put(`history_${ts}`, JSON.stringify(data)));

    await Promise.all(tasks);

    const allKeys = (await env.SYNC.list({ prefix: 'history_' })).keys.map(k => k.name);
    const sorted = allKeys.sort((a, b) => {
      const ta = parseInt(a.replace('history_', ''), 10);
      const tb = parseInt(b.replace('history_', ''), 10);
      return tb - ta;
    });
    const toDelete = sorted.slice(20);
    if (toDelete.length > 0) {
      await Promise.all(toDelete.map(key => env.SYNC.delete(key)));
    }

    return new Response(JSON.stringify({ ok: true }), { headers });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 500, headers });
  }
}

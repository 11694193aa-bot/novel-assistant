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

    // 保护：空数据不覆盖云端已有数据
    if (!data.books?.length && !data.readingBooks?.length && !data.inspirationCards?.length) {
      const existing = await env.SYNC.get('data');
      if (existing) {
        try {
          const old = JSON.parse(existing);
          if (old.books?.length || old.readingBooks?.length || old.inspirationCards?.length) {
            return new Response(JSON.stringify({ ok: false, error: 'refused: empty overwrite' }), { status: 409, headers });
          }
        } catch(_) {}
      }
    }

    tasks.push(env.SYNC.put('data', JSON.stringify(data)));
    tasks.push(env.SYNC.put(`history_${ts}`, JSON.stringify(data)));

    await Promise.all(tasks);

    // 清理超出上限的旧版本（处理 KV list() 翻页）
    const MAX_HISTORY = 20;
    let allHistoryKeys = [];
    let cursor;
    do {
      const result = await env.SYNC.list({ prefix: 'history_', cursor });
      allHistoryKeys.push(...result.keys.map(k => k.name));
      cursor = result.list_complete ? null : result.cursor;
    } while (cursor);

    const sorted = allHistoryKeys.sort((a, b) => {
      const ta = parseInt(a.replace('history_', ''), 10);
      const tb = parseInt(b.replace('history_', ''), 10);
      return tb - ta;
    });
    const toDelete = sorted.slice(MAX_HISTORY);
    if (toDelete.length > 0) {
      await Promise.all(toDelete.map(key => env.SYNC.delete(key)));
    }

    return new Response(JSON.stringify({ ok: true }), { headers });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 500, headers });
  }
}

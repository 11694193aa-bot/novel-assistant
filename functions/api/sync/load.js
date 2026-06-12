export async function onRequest({ request, env }) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };
  if (request.method === 'OPTIONS') return new Response(null, { headers });
  try {
    let body = {};
    try { body = await request.json(); } catch (_) {}

    if (body.action === 'list') {
      const list = await env.SYNC.list({ prefix: 'history_' });
      const versions = list.keys.map(k => ({
        key: k.name,
        ts: parseInt(k.name.replace('history_', ''), 10),
        label: new Date(parseInt(k.name.replace('history_', ''), 10)).toLocaleString('zh-CN'),
      })).sort((a, b) => b.ts - a.ts);
      return new Response(JSON.stringify({ ok: true, versions }), { headers });
    }

    if (body.action === 'get' && body.key) {
      const raw = await env.SYNC.get(body.key);
      return new Response(JSON.stringify({ ok: true, data: raw ? JSON.parse(raw) : null }), { headers });
    }

    // [SPLIT] 拉取书籍 content
    if (body.action === 'getContent' && body.bookId) {
      const content = await env.SYNC.get(`content_${body.bookId}`);
      return new Response(JSON.stringify({ ok: true, content: content || null }), { headers });
    }

    // 从历史备份恢复数据
    if (body.action === 'restore' && body.key) {
      const raw = await env.SYNC.get(body.key);
      if (!raw) return new Response(JSON.stringify({ ok: false, error: 'backup not found' }), { headers });
      await env.SYNC.put('data', raw);
      return new Response(JSON.stringify({ ok: true, restored: true }), { headers });
    }

    const [raw, iconList] = await Promise.all([
      env.SYNC.get('data'),
      env.SYNC.list({ prefix: 'icon_' }),
    ]);

    const icons = {};
    if (iconList.keys.length > 0) {
      const iconEntries = await Promise.all(
        iconList.keys.map(async (k) => {
          try { return [k.name.replace('icon_', ''), await env.SYNC.get(k.name)]; }
          catch (_) { return null; }
        })
      );
      for (const entry of iconEntries) {
        if (entry) icons[entry[0]] = entry[1];
      }
    }

    const data = raw ? JSON.parse(raw) : null;
    if (data) {
      data.settings = { ...(data.settings || {}), customIcons: icons };
    }
    return new Response(JSON.stringify({ ok: true, data }), { headers });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 500, headers });
  }
}
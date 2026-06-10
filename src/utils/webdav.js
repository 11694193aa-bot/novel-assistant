// Cloudflare KV 云同步 — 同域零跨域

export function getWebDAVConfig() { return null; }  // 不再需要坚果云配置
export function saveWebDAVConfig() {}
export function testConnection() { return { ok: true }; }  // 始终可用

async function apiPost(endpoint, body) {
  const res = await fetch(`/api/sync/${endpoint}`, body ? {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  } : { method: 'POST' });
  if (!res.ok) throw new Error(`${endpoint}: ${res.status}`);
  return res.json();
}

export async function cloudSave(data) {
  try {
    const result = await apiPost('save', { data });
    console.log('☁️ cloudSave OK:', result);
    return result.ok;
  } catch (err) {
    console.error('☁️ cloudSave FAIL:', err.message, err);
    return false;
  }
}

export async function cloudLoad() {
  try {
    const result = await apiPost('load');
    console.log('☁️ cloudLoad OK:', result.data ? `books:${result.data.books?.length||0}` : 'empty');
    return result.data || null;
  } catch (err) {
    console.error('☁️ cloudLoad FAIL:', err.message);
    return null;
  }
}

export async function cloudListHistory() { return []; }
export async function cloudLoadHistory() { return null; }

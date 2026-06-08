// 坚果云云同步
// 优先走本地 API（dev模式），不可用时走 CORS 代理直连

const CORS_PROXY = 'https://corsproxy.io/?';

export function getWebDAVConfig() {
  try { return JSON.parse(localStorage.getItem('novel_webdav_config')); } catch { return null; }
}
export function saveWebDAVConfig(config) {
  localStorage.setItem('novel_webdav_config', JSON.stringify(config));
}

function isConfigured() {
  const c = getWebDAVConfig();
  return c && c.url && c.username && c.password;
}

// 带认证的 WebDAV 请求（通过 CORS 代理）
async function davRequest({ method = 'GET', path, body }) {
  const config = getWebDAVConfig();
  const auth = btoa(`${config.username}:${config.password}`);
  const targetUrl = `${config.url.replace(/\/$/, '')}/${path}`;

  try {
    // 先尝试本地 API（dev模式）
    const localRes = await fetch(`/api/sync/req`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method, url: targetUrl, username: config.username, password: config.password, body }),
    });
    if (localRes.ok) return localRes;
  } catch {}

  // 降级：CORS 代理直连
  const proxyUrl = CORS_PROXY + encodeURIComponent(targetUrl);
  const res = await fetch(proxyUrl, {
    method,
    headers: {
      'Authorization': 'Basic ' + auth,
      'X-Requested-With': 'XMLHttpRequest',
      ...(body ? { 'Content-Type': 'application/octet-stream' } : {}),
    },
    ...(body ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}),
  });
  return res;
}

// ===== 公开 API =====

export async function testConnection(config) {
  try {
    const proxyUrl = CORS_PROXY + encodeURIComponent(config.url.replace(/\/$/, ''));
    const auth = btoa(`${config.username}:${config.password}`);
    const res = await fetch(proxyUrl, {
      headers: { 'Authorization': 'Basic ' + auth, 'X-Requested-With': 'XMLHttpRequest' },
    });
    if (res.status === 401) return { ok: false, error: '应用密码错误' };
    return { ok: res.ok };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export async function cloudSave(data) {
  if (!isConfigured()) return false;
  try {
    const config = getWebDAVConfig();
    const base = config.url.replace(/\/$/, '');
    const auth = btoa(`${config.username}:${config.password}`);
    const body = JSON.stringify(data);

    // 确保目录
    await fetch(CORS_PROXY + encodeURIComponent(`${base}/novel-assistant`), {
      method: 'MKCOL',
      headers: { 'Authorization': 'Basic ' + auth, 'X-Requested-With': 'XMLHttpRequest' },
    }).catch(() => {});

    // 保存
    const res = await fetch(CORS_PROXY + encodeURIComponent(`${base}/novel-assistant/data.json`), {
      method: 'PUT',
      headers: {
        'Authorization': 'Basic ' + auth,
        'Content-Type': 'application/octet-stream',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body,
    });
    return res.ok || res.status === 201;
  } catch { return false; }
}

export async function cloudLoad() {
  if (!isConfigured()) return null;
  try {
    const config = getWebDAVConfig();
    const base = config.url.replace(/\/$/, '');
    const auth = btoa(`${config.username}:${config.password}`);
    const res = await fetch(CORS_PROXY + encodeURIComponent(`${base}/novel-assistant/data.json`), {
      headers: { 'Authorization': 'Basic ' + auth, 'X-Requested-With': 'XMLHttpRequest' },
    });
    if (res.status === 404) return null;
    return await res.json();
  } catch { return null; }
}

export async function cloudListHistory() { return []; }
export async function cloudLoadHistory() { return null; }

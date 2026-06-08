// Vite 插件：服务端代理坚果云 WebDAV，彻底避开浏览器 CORS
import https from 'https';
import http from 'http';

function davRequest({ url, username, password, method = 'GET', body, headers = {} }) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const isHttps = u.protocol === 'https:';
    const mod = isHttps ? https : http;
    const auth = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');

    const opts = {
      hostname: u.hostname,
      port: u.port || (isHttps ? 443 : 80),
      path: u.pathname + u.search,
      method,
      headers: { Authorization: auth, ...headers },
      rejectUnauthorized: false,
    };

    const req = mod.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ status: res.statusCode, data, headers: res.headers });
      });
    });

    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('timeout')); });
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

export default function syncPlugin() {
  return {
    name: 'nutstore-sync',
    configureServer(server) {
      // POST /api/sync/save — 保存数据到坚果云
      server.middlewares.use('/api/sync/save', async (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
        try {
          const body = await readBody(req);
          const { url, username, password, data } = JSON.parse(body);
          const key = 'novel-assistant/data.json';

          // 确保目录存在
          await davRequest({ url: `${url}/novel-assistant`, username, password, method: 'MKCOL' }).catch(() => {});
          // 保存数据
          await davRequest({
            url: `${url}/${key}`, username, password, method: 'PUT',
            body: JSON.stringify(data),
            headers: { 'Content-Type': 'application/octet-stream' },
          });
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true }));
        } catch (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ ok: false, error: err.message }));
        }
      });

      // POST /api/sync/load — 从坚果云加载数据
      server.middlewares.use('/api/sync/load', async (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
        try {
          const body = await readBody(req);
          const { url, username, password } = JSON.parse(body);
          const key = 'novel-assistant/data.json';
          const result = await davRequest({ url: `${url}/${key}`, username, password, method: 'GET' });
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true, data: JSON.parse(result.data) }));
        } catch (err) {
          if (err.message?.includes('404')) {
            res.end(JSON.stringify({ ok: true, data: null }));
            return;
          }
          res.statusCode = 500;
          res.end(JSON.stringify({ ok: false, error: err.message }));
        }
      });

      // POST /api/sync/test — 测试连接
      server.middlewares.use('/api/sync/test', async (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
        try {
          const body = await readBody(req);
          const { url, username, password } = JSON.parse(body);
          const result = await davRequest({ url, username, password, method: 'GET' });
          res.setHeader('Content-Type', 'application/json');
          if (result.status === 401) {
            res.end(JSON.stringify({ ok: false, error: '应用密码错误' }));
          } else {
            res.end(JSON.stringify({ ok: true }));
          }
        } catch (err) {
          res.end(JSON.stringify({ ok: false, error: err.message }));
        }
      });
    },
  };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => data += chunk);
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

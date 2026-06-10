// Vite 插件：本地文件 + WebDAV 双模云同步
import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCAL_DB = path.join(__dirname, 'cloud-data.json');

function readLocalDB() {
  try { if (fs.existsSync(LOCAL_DB)) return JSON.parse(fs.readFileSync(LOCAL_DB, 'utf-8')); } catch (_) {}
  return null;
}
function writeLocalDB(data) {
  try { fs.writeFileSync(LOCAL_DB, JSON.stringify(data), 'utf-8'); return true; } catch (_) { return false; }
}

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
      // POST /api/sync/save — 保存数据
      server.middlewares.use('/api/sync/save', async (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
        try {
          const body = await readBody(req);
          const payload = JSON.parse(body);
          const data = payload.data || {};

          // 模式1：WebDAV（有 url/username/password）
          if (payload.url && payload.username && payload.password) {
            const key = 'novel-assistant/data.json';
            await davRequest({ url: `${payload.url}/novel-assistant`, username: payload.username, password: payload.password, method: 'MKCOL' }).catch(() => {});
            await davRequest({
              url: `${payload.url}/${key}`, username: payload.username, password: payload.password, method: 'PUT',
              body: JSON.stringify(payload.data || data),
              headers: { 'Content-Type': 'application/octet-stream' },
            });
          }

          // 模式2：本地文件存储（开发模式 / Cloudflare KV 格式）
          // 写之前先备份旧文件（保留最近 10 个版本）
          const oldData = readLocalDB();
          if (oldData) {
            const backupDir = path.join(__dirname, '.backups');
            if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
            const ts = new Date().toISOString().replace(/[:.]/g, '-');
            fs.writeFileSync(path.join(backupDir, `cloud-data-${ts}.json`), JSON.stringify(oldData), 'utf-8');
            // 只保留最近 10 个备份
            const files = fs.readdirSync(backupDir).filter(f => f.startsWith('cloud-data-')).sort();
            files.slice(0, Math.max(0, files.length - 10)).forEach(f => fs.unlinkSync(path.join(backupDir, f)));
          }
          // 始终写本地文件，确保开发模式下数据不丢失
          writeLocalDB(data);

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true }));
        } catch (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ ok: false, error: err.message }));
        }
      });

      // POST /api/sync/load — 加载数据
      server.middlewares.use('/api/sync/load', async (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
        try {
          const body = await readBody(req);
          let payload = {};
          try { payload = JSON.parse(body); } catch (_) {}

          let remoteData = null;

          // 模式1：WebDAV
          if (payload.url && payload.username && payload.password) {
            try {
              const key = 'novel-assistant/data.json';
              const result = await davRequest({ url: `${payload.url}/${key}`, username: payload.username, password: payload.password, method: 'GET' });
              remoteData = JSON.parse(result.data);
            } catch (err) {
              if (!err.message?.includes('404')) console.error('WebDAV load error:', err.message);
            }
          }

          // 模式2：本地文件（优先于远程，因为是最近一次 save 的结果）
          const localData = readLocalDB();
          const result = remoteData || localData;

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true, data: result }));
        } catch (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ ok: false, error: err.message }));
        }
      });

      // POST /api/sync/test — 测试连接
      server.middlewares.use('/api/sync/test', async (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
        try {
          const body = await readBody(req);
          const payload = JSON.parse(body);
          if (payload.url && payload.username && payload.password) {
            const result = await davRequest({ url: payload.url, username: payload.username, password: payload.password, method: 'GET' });
            res.setHeader('Content-Type', 'application/json');
            if (result.status === 401) {
              res.end(JSON.stringify({ ok: false, error: '应用密码错误' }));
            } else {
              res.end(JSON.stringify({ ok: true }));
            }
          } else {
            // 本地模式始终可用
            res.end(JSON.stringify({ ok: true }));
          }
        } catch (err) {
          res.end(JSON.stringify({ ok: false, error: err.message }));
        }
      });

      // POST /api/sync/save-key — 保存 API Key
      server.middlewares.use('/api/sync/save-key', async (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
        try {
          const body = await readBody(req);
          const payload = JSON.parse(body);
          const db = readLocalDB() || {};
          db._apiKey = payload.value || payload.apiKey || '';
          writeLocalDB(db);
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true }));
        } catch (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ ok: false, error: err.message }));
        }
      });

      // POST /api/chat — AI 对话（本地开发模式，复用 cloud-data.json 中的 API Key）
      server.middlewares.use('/api/chat', async (req, res) => {
        if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }
        if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
        try {
          const body = await readBody(req);
          const { messages, chapterContent } = JSON.parse(body);
          const db = readLocalDB() || {};
          const apiKey = db._apiKey;
          if (!apiKey) {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: '请先在 AI 对话页面配置 API Key' }));
            return;
          }

          const systemPrompt = chapterContent
            ? `你是一个有洞察力的写作伙伴。以下是用户正在写作的章节内容：\n---\n${chapterContent.substring(0, 80000)}\n---\n请基于以上内容进行深度对话，讨论情节发展、人设塑造、文笔技巧等。使用中文回复，语气温暖友善。`
            : '你是一个有洞察力的写作伙伴。帮助作者激发灵感，讨论情节、人设、文笔等。使用中文回复，语气温暖友善。';

          if (!messages || messages.length === 0) {
            const userMsg = chapterContent
              ? '请基于以上章节内容，生成3-5个有深度的问题来激发作者的思考和创作灵感。每个问题单独一行，以"Q: "开头。'
              : '请生成3-5个通用写作思考问题，帮助作者激发灵感。每个问题单独一行，以"Q: "开头。';
            const resp = await fetch('https://api.deepseek.com/chat/completions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
              body: JSON.stringify({
                model: 'deepseek-chat',
                max_tokens: 1024,
                messages: [
                  { role: 'system', content: systemPrompt },
                  { role: 'user', content: userMsg },
                ],
              }),
            });
            const data = await resp.json();
            if (data.error || !data.choices) throw new Error(data.error?.message || 'API 错误');
            const text = data.choices[0].message.content;
            const questions = text.split('\n').filter(l => l.trim().startsWith('Q:') || l.trim().startsWith('Q：')).map(l => l.replace(/^Q[：:]\s*/, '').trim());
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ role: 'assistant', content: text, questions }));
            return;
          }

          const apiMessages = [
            { role: 'system', content: systemPrompt },
            ...messages.map(m => ({ role: m.role, content: m.content })),
          ];
          const resp = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
            body: JSON.stringify({
              model: 'deepseek-chat',
              max_tokens: 4096,
              messages: apiMessages,
            }),
          });
          const data = await resp.json();
          if (data.error || !data.choices) throw new Error(data.error?.message || 'API 错误');
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ role: 'assistant', content: data.choices[0].message.content, questions: [] }));
        } catch (err) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'AI 调用失败: ' + err.message }));
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

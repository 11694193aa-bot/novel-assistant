const https = require('https');
const fs = require('fs');
const path = require('path');

const AUTH = 'Basic ' + Buffer.from('11694193@qq.com:a6k3j5k7vbhqeep7').toString('base64');
const BASE = '/dav/novel-app';

function request(method, urlPath, body) {
  return new Promise((resolve) => {
    const opts = {
      hostname: 'dav.jianguoyun.com', path: BASE + urlPath, method,
      headers: { Authorization: AUTH },
      rejectUnauthorized: false,
    };
    if (body) {
      opts.headers['Content-Type'] = 'application/octet-stream';
      opts.headers['Content-Length'] = Buffer.byteLength(body);
    }
    const req = https.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', e => { console.error('ERR:', e.message); resolve({ status: 0 }); });
    if (body) req.write(body);
    req.end();
  });
}

async function main() {
  // 建目录
  await request('MKCOL', '');
  await request('MKCOL', '/assets');

  // 上传文件
  const files = [
    ['/index.html', 'dist/index.html'],
    ['/manifest.json', 'dist/manifest.json'],
    ['/sw.js', 'dist/sw.js'],
  ];

  // assets
  const assetsDir = fs.readdirSync('dist/assets');
  for (const f of assetsDir) {
    files.push(['/assets/' + f, 'dist/assets/' + f]);
  }

  for (const [remote, local] of files) {
    const content = fs.readFileSync(local);
    const r = await request('PUT', remote, content);
    console.log(r.status === 201 || r.status === 200 ? 'OK' : 'FAIL', remote);
  }

  console.log('\nDONE! Open: https://dav.jianguoyun.com/dav/novel-app/index.html');
  console.log('Login with: 11694193@qq.com / your app password');
}
main();

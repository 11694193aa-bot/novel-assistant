/**
 * Edge TTS 代理 — 免费高质量中文语音
 * 浏览器调用：POST /api/tts  { text, voice, rate }
 * 返回：audio/mpeg 二进制流
 */

// Edge TTS 公网端点
const EDGE_TTS_URL = 'https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1';

// 生成 TrustedClientToken（每次请求不同）
function buildToken() {
  const d = Date.now();
  return `${d}${'0'.repeat(12)}${d % 1000000}`.slice(0, 32);
}

function buildSSML(text, voice, rate) {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" xml:lang="zh-CN">
  <voice name="${voice}">
    <prosody rate="${rate}" pitch="+0Hz">
      ${escaped}
    </prosody>
  </voice>
</speak>`;
}

export async function onRequest({ request }) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers });
  }

  try {
    const { text, voice, rate } = await request.json();
    if (!text || !text.trim()) {
      return new Response(JSON.stringify({ error: 'empty text' }), { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } });
    }

    const ssml = buildSSML(text.trim(), voice || 'zh-CN-XiaoxiaoNeural', rate || 1.0);
    const token = buildToken();

    const res = await fetch(`${EDGE_TTS_URL}?TrustedClientToken=${token}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/ssml+xml',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Origin': 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
        'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
      },
      body: ssml,
    });

    if (!res.ok) {
      const errText = await res.text();
      return new Response(JSON.stringify({ error: `Edge TTS ${res.status}: ${errText.slice(0, 200)}` }), {
        status: 502,
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
    }

    const audioBuf = await res.arrayBuffer();
    return new Response(audioBuf, {
      headers: {
        ...headers,
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  }
}

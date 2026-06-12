/**
 * TTS 代理
 * 优先 Edge TTS（多语音），失败则 Google TTS（兜底）
 * POST /api/tts  { text, voice, rate }
 */

// Edge TTS 端点（可能需特定网络环境）
const EDGE_URL = 'https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1';

function buildEdgeSSML(text, voice, rate) {
  const safe = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" xml:lang="zh-CN">
<voice name="${voice}"><prosody rate="${rate}" pitch="+0Hz">${safe}</prosody></voice></speak>`;
}

async function tryEdgeTTS(text, voice, rate) {
  const token = `${Date.now()}${'0'.repeat(16)}`.slice(0,32);
  const res = await fetch(`${EDGE_URL}?TrustedClientToken=${token}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/ssml+xml',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
      'Origin': 'https://www.bing.com',
      'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
    },
    body: buildEdgeSSML(text, voice || 'zh-CN-XiaoxiaoNeural', rate || 1),
  });
  if (!res.ok) throw new Error(`Edge ${res.status}`);
  return res.arrayBuffer();
}

async function tryGoogleTTS(text) {
  // Google TTS 单次限制约 200 字
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text.slice(0,180))}&tl=zh-CN&client=tw-ob`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
  });
  if (!res.ok) throw new Error(`Google ${res.status}`);
  return res.arrayBuffer();
}

export async function onRequest({ request }) {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

  try {
    const { text, voice, rate } = await request.json();
    if (!text?.trim()) return new Response(JSON.stringify({error:'empty'}), {status:400, headers:{...cors,'Content-Type':'application/json'}});

    let buf;
    try {
      buf = await tryEdgeTTS(text.trim(), voice, rate);
    } catch (e) {
      console.log('Edge TTS failed, fallback Google:', e.message);
      try {
        buf = await tryGoogleTTS(text.trim());
      } catch (e2) {
        return new Response(JSON.stringify({error:'both TTS failed'}), {status:502, headers:{...cors,'Content-Type':'application/json'}});
      }
    }

    return new Response(buf, {
      headers: { ...cors, 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-cache' },
    });
  } catch (e) {
    return new Response(JSON.stringify({error:e.message}), {status:500, headers:{...cors,'Content-Type':'application/json'}});
  }
}

/**
 * TTS 代理 — Edge TTS 优先，Google 兜底
 * POST /api/tts  { text, rate }
 */

// ── Edge TTS ────────────────────────────────────────────
async function tryEdgeTTS(text, rate) {
  const safe = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" xml:lang="zh-CN"><voice name="zh-CN-XiaoxiaoNeural"><prosody rate="${rate || 1}" pitch="+0Hz">${safe}</prosody></voice></speak>`;
  const token = Date.now().toString(36) + Math.random().toString(36).slice(2,10);

  const res = await fetch(`https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${token}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/ssml+xml',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
      'Origin': 'https://www.bing.com',
      'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
    },
    body: ssml,
  });
  if (!res.ok) throw new Error(`Edge ${res.status}`);
  const buf = await res.arrayBuffer();
  if (buf.byteLength < 500) throw new Error('Edge too small');
  return buf;
}

// ── Google TTS ───────────────────────────────────────────
async function tryGoogleTTS(text, rate) {
  // Google 单次限制约 200 字
  const t = text.slice(0, 180);
  const speed = Math.round((rate || 1) * 1); // Google speed: 0.5-2, default 1
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(t)}&tl=zh-CN&client=tw-ob&ttsspeed=${speed}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
  });
  if (!res.ok) throw new Error(`Google ${res.status}`);
  const buf = await res.arrayBuffer();
  if (buf.byteLength < 200) throw new Error('Google too small');
  return buf;
}

export async function onRequest({ request }) {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

  try {
    const { text, rate } = await request.json();
    if (!text?.trim()) return new Response(JSON.stringify({error:'empty'}), {status:400, headers:{...cors,'Content-Type':'application/json'}});

    let buf;
    try {
      buf = await tryEdgeTTS(text.trim(), rate || 1);
    } catch (e1) {
      console.log('Edge failed, try Google:', e1.message);
      try {
        buf = await tryGoogleTTS(text.trim(), rate || 1);
      } catch (e2) {
        return new Response(JSON.stringify({error:'TTS failed: '+e2.message}), {status:502, headers:{...cors,'Content-Type':'application/json'}});
      }
    }

    return new Response(buf, {
      headers: { ...cors, 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-cache' },
    });
  } catch (e) {
    return new Response(JSON.stringify({error:e.message}), {status:500, headers:{...cors,'Content-Type':'application/json'}});
  }
}

/**
 * TTS 代理 — Google Translate TTS（免费稳定）
 * POST /api/tts  { text, voice?, rate? }
 * 返回 audio/mpeg
 */

// Google TTS 各语言映射
const LANG_MAP = {
  'zh-CN': 'zh-CN',
  'zh-TW': 'zh-TW',
};

function getLang(voice) {
  // Edge TTS voice name → Google lang code
  if (!voice) return 'zh-CN';
  if (voice.startsWith('zh-CN')) return 'zh-CN';
  if (voice.startsWith('zh-TW')) return 'zh-TW';
  if (voice.startsWith('zh-HK')) return 'zh-CN';
  return 'zh-CN';
}

function splitLongText(text, maxLen = 180) {
  // Google TTS 有长度限制，拆分长文本
  if (text.length <= maxLen) return [text];
  const parts = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      parts.push(remaining);
      break;
    }
    // 在标点处断开
    let cut = maxLen;
    for (let i = maxLen - 1; i > maxLen / 2; i--) {
      if (/[。！？，、；：\n]/.test(remaining[i])) {
        cut = i + 1;
        break;
      }
    }
    parts.push(remaining.slice(0, cut));
    remaining = remaining.slice(cut);
  }
  return parts;
}

async function fetchTTSPart(text, lang) {
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${lang}&client=tw-ob&ttsspeed=1`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  });
  if (!res.ok) throw new Error(`Google TTS ${res.status}`);
  return res.arrayBuffer();
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
    const { text, voice } = await request.json();
    if (!text || !text.trim()) {
      return new Response(JSON.stringify({ error: 'empty text' }), {
        status: 400,
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
    }

    const lang = getLang(voice);
    const parts = splitLongText(text.trim());

    // 合并多段音频
    const buffers = [];
    for (const part of parts) {
      try {
        const buf = await fetchTTSPart(part, lang);
        buffers.push(new Uint8Array(buf));
      } catch (e) {
        // 某段失败则跳过
        console.error('TTS part failed:', e.message);
      }
    }

    if (buffers.length === 0) {
      return new Response(JSON.stringify({ error: 'all parts failed' }), {
        status: 502,
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
    }

    // 拼接所有 buffer
    const totalLen = buffers.reduce((s, b) => s + b.length, 0);
    const merged = new Uint8Array(totalLen);
    let offset = 0;
    for (const buf of buffers) {
      merged.set(buf, offset);
      offset += buf.length;
    }

    return new Response(merged, {
      headers: {
        ...headers,
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  }
}

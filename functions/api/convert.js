// Cloudflare Function: docx → 纯文本
import mammoth from 'mammoth';
import JSZip from 'jszip';

export async function onRequest({ request }) {
  if (request.method === 'OPTIONS') return new Response(null, {
    headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' }
  });
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    if (!file) return Response.json({ ok: false, error: 'no file' });

    const buf = await file.arrayBuffer();
    let text = '';

    // mammoth
    try {
      const result = await mammoth.extractRawText({ arrayBuffer: buf });
      text = (result.value || '').trim();
    } catch {}

    // JSZip fallback
    if (!text) {
      try {
        const zip = await JSZip.loadAsync(buf);
        const docXml = await zip.file('word/document.xml')?.async('string');
        if (docXml) {
          text = docXml
            .split(/<\/w:p>/)
            .map(p => {
              const matches = p.match(/<w:t[^>]*>([^<]*)<\/w:t>/g);
              return matches ? matches.map(m => m.replace(/<[^>]+>/g, '')).join('') : '';
            })
            .filter(Boolean)
            .join('\n\n');
        }
      } catch {}
    }

    if (text) return Response.json({ ok: true, text });
    return Response.json({ ok: false, error: '无法解析' });
  } catch (e) {
    return Response.json({ ok: false, error: e.message });
  }
}

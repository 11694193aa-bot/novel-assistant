/**
 * 阅读书籍导入工具 — 支持 EPUB / TXT / PDF → 纯文本
 * EPUB：复用 JSZip 解压 → DOMParser 提取文字
 * TXT：FileReader 直接读取
 * PDF：pdfjs-dist 逐页提取文字
 */
import JSZip from 'jszip';
import * as pdfjsLib from 'pdfjs-dist';

// 设置 PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs';

// ─── TXT 解析 ─────────────────────────────────────────────
// [FIX] GBK 编码自动检测——大量国内小说 TXT 是 GBK 编码
export async function parseTXT(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result || '';
      // GBK 乱码通常包含 � 替换字符
      if (text.includes('�')) {
        const r2 = new FileReader();
        r2.onload = () => resolve(r2.result || '');
        r2.onerror = () => reject(new Error('TXT 读取失败'));
        try { r2.readAsText(file, 'gbk'); } catch (_) { r2.readAsText(file, 'gb2312'); }
      } else {
        resolve(text);
      }
    };
    reader.onerror = () => reject(new Error('TXT 读取失败'));
    reader.readAsText(file, 'utf-8');
  });
}

// ─── EPUB 解析 ─────────────────────────────────────────────
export async function parseEPUB(file) {
  const zip = await JSZip.loadAsync(file);

  // 1. 定位 container.xml → 获取 rootfile 路径
  const containerXML = await zip.file('META-INF/container.xml')?.async('string');
  if (!containerXML) throw new Error('无效的 EPUB 文件：缺少 container.xml');

  const rootfileMatch = containerXML.match(/full-path="([^"]+)"/);
  if (!rootfileMatch) throw new Error('无法解析 EPUB：未找到 rootfile');
  const opfPath = rootfileMatch[1];

  // 2. 解析 content.opf → metadata + spine
  const opfXML = await zip.file(opfPath)?.async('string');
  if (!opfXML) throw new Error('无法解析 EPUB：未找到 OPF 文件');

  const opfDir = opfPath.includes('/') ? opfPath.replace(/\/[^/]+$/, '') : '';

  // 提取元数据
  const titleMatch = opfXML.match(/<dc:title[^>]*>([^<]+)<\/dc:title>/);
  const authorMatch = opfXML.match(/<dc:creator[^>]*>([^<]+)<\/dc:creator>/);
  const title = titleMatch ? titleMatch[1].trim() : file.name.replace(/\.epub$/i, '');
  const author = authorMatch ? authorMatch[1].trim() : '';

  // 提取 spine 顺序
  const spineMatches = [...opfXML.matchAll(/<itemref[^>]*idref="([^"]+)"/g)];
  const spineIds = spineMatches.map(m => m[1]);

  // 提取 manifest: id → href 映射
  const manifestMap = {};
  const itemRegex = /<item[^>]*id="([^"]+)"[^>]*href="([^"]+)"[^>]*media-type="([^"]+)"/g;
  let itemMatch;
  while ((itemMatch = itemRegex.exec(opfXML)) !== null) {
    manifestMap[itemMatch[1]] = { href: itemMatch[2], type: itemMatch[3] };
  }

  // 提取封面图片（可选）
  let cover = null;
  const coverMeta = opfXML.match(/<meta[^>]*name="cover"[^>]*content="([^"]+)"/);
  const coverId = coverMeta ? coverMeta[1] : null;
  if (coverId && manifestMap[coverId]) {
    try {
      let coverPath = manifestMap[coverId].href;
      if (opfDir && !coverPath.startsWith('/')) coverPath = opfDir + '/' + coverPath;
      coverPath = coverPath.replace(/^\.\//, '');
      const coverFile = zip.file(coverPath);
      if (coverFile) {
        const coverBuf = await coverFile.async('arraybuffer');
        const mime = manifestMap[coverId].type || 'image/jpeg';
        // [FIX-3] 分块转 base64，避免大封面栈溢出
        const bytes = new Uint8Array(coverBuf);
        let binary = '';
        const chunkSize = 8192;
        for (let i = 0; i < bytes.length; i += chunkSize) {
          binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
        }
        const base64 = btoa(binary);
        cover = `data:${mime};base64,${base64}`;
      }
    } catch (_) { /* 封面提取失败忽略 */ }
  }

  // 3. 按 spine 顺序读取各章节 XHTML → 提取纯文本
  const parts = [];
  for (const id of spineIds) {
    const item = manifestMap[id];
    if (!item) continue;
    // 只处理 xhtml/html 类型
    if (!/(xhtml|html|xml)/.test(item.type || '')) continue;

    let href = item.href;
    if (opfDir && !href.startsWith('/')) href = opfDir + '/' + href;
    href = href.replace(/^\.\//, '');

    try {
      const htmlStr = await zip.file(href)?.async('string');
      if (!htmlStr) continue;
      const text = extractTextFromHTML(htmlStr);
      if (text.trim()) parts.push(text);
    } catch (_) {
      // 尝试 URL decode 路径
      try {
        const decoded = decodeURIComponent(href);
        const htmlStr = await zip.file(decoded)?.async('string');
        if (htmlStr) {
          const text = extractTextFromHTML(htmlStr);
          if (text.trim()) parts.push(text);
        }
      } catch (_2) { /* 跳过 */ }
    }
  }

  const text = parts.join('\n\n');
  return { title, author, text, cover };
}

// ─── PDF 解析 ─────────────────────────────────────────────
export async function parsePDF(file) {
  const arrayBuf = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('PDF 读取失败'));
    reader.readAsArrayBuffer(file);
  });

  // [FIX-6] 并发提取所有页面文字
  const pdf = await pdfjsLib.getDocument({ data: arrayBuf }).promise;
  const pagePromises = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    pagePromises.push(
      pdf.getPage(i).then(page => page.getTextContent()).then(content => {
        // [FIX] 判断相邻item间距，需要时补空格
        const text = content.items.map((item, i, arr) => {
          const next = arr[i + 1];
          const needSpace = next && item.transform[4] + item.width < next.transform[4] - 1;
          return item.str + (needSpace ? ' ' : '');
        }).join('');
        return text.trim() ? text.trim() : null;
      })
    );
  }
  const results = await Promise.all(pagePromises);
  return results.filter(Boolean).join('\n\n');
}

// ─── HTML → 纯文本 ─────────────────────────────────────────
function extractTextFromHTML(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');

  // [FIX] EPUB样式保留：加粗→** 斜体→*
  doc.querySelectorAll('b, strong').forEach(el => { el.insertAdjacentText('beforebegin', '**'); el.insertAdjacentText('afterend', '**'); });
  doc.querySelectorAll('i, em').forEach(el => { el.insertAdjacentText('beforebegin', '*'); el.insertAdjacentText('afterend', '*'); });
  // 移除不需要的元素
  doc.querySelectorAll('script, style, head, nav, [role="navigation"]').forEach(el => el.remove());

  // 在块级元素后插入换行
  doc.querySelectorAll('p, div, li, h1, h2, h3, h4, h5, h6, br, tr, section, article, blockquote, pre').forEach(el => {
    el.insertAdjacentText('afterend', '\n');
  });

  // [FIX] 标题前加章节分隔标记
  doc.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(el => {
    el.insertAdjacentText('beforebegin', '\n【' + (el.textContent?.trim() || '章节') + '】\n');
  });

  let text = doc.body?.textContent || doc.body?.innerText || '';
  // 清理多余空行
  text = text.replace(/\n{3,}/g, '\n\n').trim();
  return text;
}

// ─── 统一入口 ─────────────────────────────────────────────
/**
 * 根据文件扩展名自动选择解析器
 * @returns {{ title, author, content, sourceFormat, sourceFileName, cover }}
 */
export async function importBookFile(file) {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  let title = file.name.replace(/\.(epub|txt|pdf)$/i, '');
  let author = '';
  let content = '';
  let cover = null;

  if (ext === 'txt') {
    content = await parseTXT(file);
  } else if (ext === 'epub') {
    const result = await parseEPUB(file);
    title = result.title || title;
    author = result.author || '';
    content = result.text || '';
    cover = result.cover || null;
  } else if (ext === 'pdf') {
    content = await parsePDF(file);
  } else {
    throw new Error(`不支持的格式: .${ext}（支持 .epub / .txt / .pdf）`);
  }

  if (!content.trim()) {
    throw new Error('未能从文件中提取到文字内容');
  }

  return {
    title,
    author,
    content,
    sourceFormat: ext,
    sourceFileName: file.name,
    cover,
  };
}

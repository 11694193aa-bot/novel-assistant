import React, { useState, useRef, useCallback, useEffect } from 'react';
import useStore from '../store';
import mammoth from 'mammoth';

const INDENT = '　　';

export default function ChapterEditor({ bookId, chapter, books, onCalendarClick }) {
  const { updateChapterContent, addInspirationCard, addDailyCount, dailyCounts, initialized } = useStore();
  const textareaRef = useRef(null);
  const prevCountRef = useRef(0);
  const [selectedText, setSelectedText] = useState('');
  const [showExtractPopup, setShowExtractPopup] = useState(false);
  const [popupPos, setPopupPos] = useState({ x: 0, y: 0 });
  const [showFind, setShowFind] = useState(false);
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [findResults, setFindResults] = useState([]);
  const [currentFindIdx, setCurrentFindIdx] = useState(-1);
  const [formatBrush, setFormatBrush] = useState(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef(null);
  const indentDoneRef = useRef(null); // 记录已处理的章节ID

  const content = chapter.content || '';

  // ==== 章节加载后自动首行缩进 ====
  useEffect(() => {
    // 等store初始化完成 + 新章节 + 内容就绪
    if (!initialized) return;
    if (indentDoneRef.current === chapter.id) return;
    if (content === undefined || content === null) return;

    // 空章节也标记处理，但给一个初始缩进
    if (content === '') {
      updateChapterContent(bookId, chapter.id, INDENT);
      indentDoneRef.current = chapter.id;
      return;
    }

    const lines = content.split('\n');
    const needsIndent = lines.some(line => {
      const t = line.trim();
      return t.length > 0 && !line.startsWith(INDENT);
    });

    if (needsIndent) {
      const fixed = lines.map(line => {
        if (line.trim().length === 0) return line;
        if (line.startsWith(INDENT)) return line;
        return INDENT + line.replace(/^\s*/, '');
      }).join('\n');
      updateChapterContent(bookId, chapter.id, fixed);
    }
    indentDoneRef.current = chapter.id;
  }, [initialized, chapter.id, content]);

  // ==== 查找 ====
  const doFind = useCallback((search) => {
    if (!search) { setFindResults([]); setCurrentFindIdx(-1); return; }
    const results = [];
    let idx = content.indexOf(search);
    while (idx !== -1) { results.push(idx); idx = content.indexOf(search, idx + 1); }
    setFindResults(results);
    setCurrentFindIdx(results.length > 0 ? 0 : -1);
    if (results.length > 0) jumpToMatch(0, results, search);
  }, [content]);

  const jumpToMatch = (idx, results, search) => {
    const ta = textareaRef.current;
    if (!ta || !results.length) return;
    const pos = results[idx];
    ta.focus();
    ta.setSelectionRange(pos, pos + (search || findText).length);
    ta.scrollTop = Math.max(0, (content.slice(0, pos).split('\n').length - 5) * 28);
  };

  // ==== 切换当前段落缩进 ====
  const handleToggleIndent = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const before = content.slice(0, start);
    const lastNL = before.lastIndexOf('\n');
    const lineStart = lastNL + 1;
    const lineEnd = content.indexOf('\n', start) === -1 ? content.length : content.indexOf('\n', start);
    const line = content.slice(lineStart, lineEnd);
    if (line.startsWith(INDENT)) {
      updateChapterContent(bookId, chapter.id, content.slice(0, lineStart) + line.slice(2) + content.slice(lineEnd));
    } else if (line.trim()) {
      updateChapterContent(bookId, chapter.id, content.slice(0, lineStart) + INDENT + line.replace(/^\s*/, '') + content.slice(lineEnd));
    }
  };

  // ==== 全文切换缩进 ====
  const handleToggleAllIndent = () => {
    const lines = content.split('\n');
    const allHave = lines.filter(l => l.trim()).every(l => l.startsWith(INDENT));
    const result = lines.map(line => {
      if (!line.trim()) return line;
      return allHave ? line.slice(2) : (line.startsWith(INDENT) ? line : INDENT + line.replace(/^\s*/, ''));
    }).join('\n');
    updateChapterContent(bookId, chapter.id, result);
  };

  // ==== 替换 ====
  const handleReplaceAll = () => {
    if (!findText) return;
    updateChapterContent(bookId, chapter.id, content.split(findText).join(replaceText));
    setFindResults([]); setCurrentFindIdx(-1);
  };

  const handleReplaceOne = () => {
    if (!findText || currentFindIdx < 0 || currentFindIdx >= findResults.length) return;
    const pos = findResults[currentFindIdx];
    const nc = content.slice(0, pos) + replaceText + content.slice(pos + findText.length);
    updateChapterContent(bookId, chapter.id, nc);
    const diff = replaceText.length - findText.length;
    const adj = findResults.map(p => p > pos ? p + diff : p).filter(p => p !== pos);
    setFindResults(adj);
    setCurrentFindIdx(Math.min(currentFindIdx, adj.length - 1));
  };

  // ==== 格式刷 ====
  const handleFormatBrush = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const before = content.slice(0, start);
    const lastNL = before.lastIndexOf('\n');
    const lineStart = lastNL + 1;
    const lineEnd = content.indexOf('\n', start) === -1 ? content.length : content.indexOf('\n', start);
    setFormatBrush(content.slice(lineStart, lineEnd).match(/^(\s*)/)[1]);
  };

  const handleApplyBrush = () => {
    if (formatBrush === null) return;
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    if (start !== end) {
      const before = content.slice(0, start);
      const sel = content.slice(start, end);
      const after = content.slice(end);
      const fmt = sel.split('\n').map(l => l.trim() ? formatBrush + l.replace(/^\s*/, '') : l).join('\n');
      updateChapterContent(bookId, chapter.id, before + fmt + after);
    }
    setFormatBrush(null);
  };

  // ==== 键盘 ====
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const ta = textareaRef.current;
      if (!ta) return;
      const start = ta.selectionStart;
      const before = content.slice(0, start);
      const lastNL = before.lastIndexOf('\n');
      const curLine = content.slice(lastNL + 1, start);
      const leading = curLine.match(/^(\s*)/)[1];
      // 如果上一行有前导空格就继承；如果是正文段落（非空且以缩进开头）默认加缩进
      const useIndent = leading.length > 0 ? leading
        : (curLine.trim() && curLine.startsWith(INDENT) ? INDENT : '');
      const after = content.slice(start);
      updateChapterContent(bookId, chapter.id, before + '\n' + useIndent + after);
      setTimeout(() => { ta.selectionStart = ta.selectionEnd = start + 1 + useIndent.length; }, 0);
      return;
    }
    if (e.key === 'Escape') { setShowExtractPopup(false); setShowFind(false); setFormatBrush(null); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') { e.preventDefault(); setShowFind(true); setTimeout(() => document.getElementById('find-input')?.focus(), 50); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'h') { e.preventDefault(); setShowFind(true); setTimeout(() => document.getElementById('replace-input')?.focus(), 50); }
  };

  const handleMouseUp = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    const s = ta.value.slice(ta.selectionStart, ta.selectionEnd).trim();
    // 至少选5个字才弹出提取窗，避免单击误触
    if (s.length >= 5) {
      setSelectedText(s);
      const rect = ta.getBoundingClientRect();
      setPopupPos({ x: rect.left + rect.width / 2, y: rect.top - 60 });
      setShowExtractPopup(true);
    }
  };

  const handleExtract = (targetBookId) => {
    addInspirationCard({
      title: `摘录: ${chapter.title}`, content: selectedText,
      category: '章节笔记', source: 'extract', gachaQuestion: '', bookId: targetBookId || bookId,
    });
    setShowExtractPopup(false); setSelectedText('');
  };

  // ==== 导入文件到章节 ====
  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      let text = '';
      const ext = file.name.split('.').pop().toLowerCase();
      if (ext === 'docx') {
        const buf = await file.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer: buf });
        const div = document.createElement('div');
        div.innerHTML = result.value;
        text = Array.from(div.querySelectorAll('p,h1,h2,h3,h4,h5,h6,li'))
          .map(p => p.textContent.trim()).filter(Boolean).join('\n');
        if (!text) text = div.textContent.trim();
      } else if (ext === 'html' || ext === 'htm') {
        const div = document.createElement('div');
        div.innerHTML = await file.text();
        text = div.textContent.trim();
      } else {
        text = await file.text();
      }
      const lines = text.split('\n').map(line => {
        const t = line.trim();
        return t ? INDENT + t : '';
      }).join('\n');
      updateChapterContent(bookId, chapter.id, lines);
      indentDoneRef.current = chapter.id;
    } catch (err) {
      alert('导入失败: ' + err.message);
    }
    setImporting(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const wordCount = content.replace(/\s/g, '').length;
  const today = new Date().toISOString().slice(0, 10);
  const todayCount = dailyCounts[today] || 0;

  // 追踪字数变化
  const handleContentChange = (newContent) => {
    const prev = prevCountRef.current;
    const next = newContent.replace(/\s/g, '').length;
    const delta = next - prev;
    if (delta !== 0) {
      addDailyCount(delta);
      prevCountRef.current = next;
    }
    updateChapterContent(bookId, chapter.id, newContent);
  };

  // 章节切换时更新基准字数
  useEffect(() => {
    prevCountRef.current = wordCount;
  }, [chapter.id]);

  return (
    <div className="chapter-editor">
      {/* 工具栏 */}
      <div className="editor-toolbar">
        <div className="toolbar-group">
          <button className="tb-btn" onClick={handleToggleIndent}>↦ 缩进</button>
          <button className="tb-btn" onClick={handleToggleAllIndent}>📐 全局</button>
          <span className="tb-divider" />
          <button className={`tb-btn ${formatBrush !== null ? 'active' : ''}`} onClick={handleFormatBrush}>🖌 取格式</button>
          <button className="tb-btn" onClick={handleApplyBrush} disabled={formatBrush === null}>🎨 刷格式</button>
          <span className="tb-divider" />
          <button className="tb-btn" onClick={() => setShowFind(!showFind)}>🔍 查找替换</button>
          <span className="tb-divider" />
          <button className="tb-btn" onClick={() => fileRef.current?.click()} disabled={importing}>
            {importing ? '⏳' : '📥'} 导入
          </button>
        </div>
        <div className="toolbar-info">
          本章:{wordCount}字 ·
          <span className="today-count" onClick={onCalendarClick} title="点击查看字数日历">
            📅 今日:{todayCount}字
          </span>
          {formatBrush !== null && <span className="brush-indicator"> 🖌 已复制</span>}
        </div>
      </div>

      {showFind && (
        <div className="find-bar">
          <div className="find-row">
            <input id="find-input" placeholder="查找..." value={findText}
              onChange={e => { setFindText(e.target.value); doFind(e.target.value); }}
              onKeyDown={e => { if (e.key === 'Enter' && findResults.length > 0) { const n = (currentFindIdx + 1) % findResults.length; setCurrentFindIdx(n); jumpToMatch(n, findResults, findText); }}} />
            <span className="find-count">{findText ? `${currentFindIdx + 1}/${findResults.length}` : '-'}</span>
            <button className="tb-btn-sm" onClick={() => { if (findResults.length > 0) { const p = (currentFindIdx - 1 + findResults.length) % findResults.length; setCurrentFindIdx(p); jumpToMatch(p, findResults, findText); }}}>▲</button>
            <button className="tb-btn-sm" onClick={() => { if (findResults.length > 0) { const n = (currentFindIdx + 1) % findResults.length; setCurrentFindIdx(n); jumpToMatch(n, findResults, findText); }}}>▼</button>
          </div>
          <div className="replace-row">
            <input id="replace-input" placeholder="替换为..." value={replaceText} onChange={e => setReplaceText(e.target.value)} />
            <button className="tb-btn-sm" onClick={handleReplaceOne}>替换</button>
            <button className="tb-btn-sm" onClick={handleReplaceAll}>全部</button>
          </div>
          <button className="find-close" onClick={() => { setShowFind(false); setFindResults([]); setFindText(''); }}>✕</button>
        </div>
      )}

      <div className="editor-header">
        <div className="editor-title-area">
          <span className="editor-icon">📝</span>
          <h2 className="editor-title">{chapter.title}</h2>
          {chapter.parentId && <span className="editor-breadcrumb">← 子章节</span>}
        </div>
      </div>

      <div className="editor-body">
        <textarea
          ref={textareaRef}
          className="editor-textarea"
          value={content}
          onChange={(e) => handleContentChange(e.target.value)}
          onMouseUp={handleMouseUp}
          onKeyDown={handleKeyDown}
          placeholder={INDENT + '( ﾟ∀ﾟ)b 在这里开始创作吧...'}
          spellCheck={false}
        />
      </div>

      <input ref={fileRef} type="file" accept=".docx,.html,.htm,.txt" style={{display:'none'}} onChange={handleImportFile} />

      {showExtractPopup && selectedText && (
        <div className="extract-popup" style={{ left: popupPos.x, top: popupPos.y }}>
          <div className="extract-popup-header">
            <span>提取到灵感卡片</span>
            <button onClick={() => setShowExtractPopup(false)}>✕</button>
          </div>
          <div className="extract-preview">{selectedText.slice(0, 100)}{selectedText.length > 100 ? '...' : ''}</div>
          <div className="extract-actions">
            <button onClick={() => handleExtract(bookId)}>📚 当前书籍</button>
            <button onClick={() => handleExtract(null)}>💡 通用灵感</button>
            {books.filter(b => b.id !== bookId).map(b => (
              <button key={b.id} onClick={() => handleExtract(b.id)}>📘 {b.title}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

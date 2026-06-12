import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import useStore from '../store';
import CatIcon from './CatIcon';

// ─── 标注颜色 ─────────────────────────────────────────────
const ANNOTATION_COLORS = [
  { name: '红色', value: '#e74c3c' },
  { name: '蓝色', value: '#3498db' },
  { name: '绿色', value: '#2ecc71' },
  { name: '金色', value: '#f39c12' },
  { name: '紫色', value: '#9b59b6' },
  { name: '橙色', value: '#e67e22' },
];

// ─── 线型 ─────────────────────────────────────────────────
const LINE_STYLES = [
  { key: 'wavy', label: '波浪线', icon: '〰' },
  { key: 'straight', label: '直线', icon: '—' },
  { key: 'highlighter', label: '荧光笔', icon: '🖍' },
];

// ─── 根据标注生成分段数据 ──────────────────────────────────
function buildSegments(text, annotations) {
  if (!annotations || annotations.length === 0) {
    return [{ text, annotation: null }];
  }
  const sorted = [...annotations].sort((a, b) => a.startOffset - b.startOffset);
  const merged = [];
  for (const ann of sorted) {
    if (merged.length === 0) {
      merged.push({ ...ann });
    } else {
      const last = merged[merged.length - 1];
      if (ann.startOffset <= last.endOffset) {
        last.endOffset = Math.max(last.endOffset, ann.endOffset);
        last.color = ann.color;
        last.lineStyle = ann.lineStyle;
        last.id = ann.id;
      } else {
        merged.push({ ...ann });
      }
    }
  }
  const segments = [];
  let cursor = 0;
  for (const ann of merged) {
    if (ann.startOffset > cursor) {
      segments.push({ text: text.slice(cursor, ann.startOffset), annotation: null });
    }
    segments.push({ text: text.slice(ann.startOffset, ann.endOffset), annotation: ann });
    cursor = ann.endOffset;
  }
  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), annotation: null });
  }
  return segments;
}

// ─── 获取选中文字在容器内的字符偏移 ─────────────────────────
function getSelectionOffsets(containerEl) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || !sel.toString().trim()) return null;
  const range = sel.getRangeAt(0);
  if (!containerEl.contains(range.commonAncestorContainer)) return null;

  const getOffset = (node, offset) => {
    let total = 0;
    const walker = document.createTreeWalker(containerEl, NodeFilter.SHOW_TEXT, null, false);
    let cur;
    while ((cur = walker.nextNode())) {
      if (cur === node) return total + offset;
      total += cur.textContent.length;
    }
    return total;
  };
  const start = getOffset(range.startContainer, range.startOffset);
  const end = getOffset(range.endContainer, range.endOffset);
  if (start >= end) return null;
  return { start, end, text: sel.toString() };
}

// ─── 按句子拆分文字（用于 TTS 逐句高亮） ──────────────────────
function splitSentences(text) {
  // 按中文标点 + 换行拆分，保留标点在句尾
  const parts = text.split(/(?<=[。！？；\n])|(?<=[，、])/g);
  const sentences = [];
  let buf = '';
  for (const p of parts) {
    buf += p;
    if (/[。！？\n]$/.test(p) || buf.length > 80) {
      sentences.push(buf);
      buf = '';
    }
  }
  if (buf.trim()) sentences.push(buf);
  return sentences.filter(s => s.trim());
}

// ─── 组件 ─────────────────────────────────────────────────
export default function ReaderView({ bookId, onBack, isMobile }) {
  const { readingBooks, addAnnotation, removeAnnotation, updateReadingProgress, persist } = useStore();
  const book = readingBooks.find(b => b.id === bookId);

  const contentRef = useRef(null);
  const ttsChunksRef = useRef([]);
  const ttsIdxRef = useRef(0);
  const isSpeakingRef = useRef(false);

  const [showToolbar, setShowToolbar] = useState(false);
  const [toolbarPos, setToolbarPos] = useState({ x: 0, y: 0 });
  const [selectedColor, setSelectedColor] = useState(ANNOTATION_COLORS[0].value);
  const [selectedStyle, setSelectedStyle] = useState('wavy');
  const [pendingRange, setPendingRange] = useState(null);
  const [flashId, setFlashId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null); // 待删除标注 id
  const [ttsState, setTtsState] = useState('idle'); // idle | playing | paused
  const [ttsSpeed, setTtsSpeed] = useState(1);
  const ttsSpeedRef = useRef(1);
  useEffect(() => { ttsSpeedRef.current = ttsSpeed; }, [ttsSpeed]);
  const [ttsVoice, setTtsVoice] = useState(null);
  const ttsVoiceRef = useRef(null);
  // [FIX-2] 标记用户是否手动选过语音，防止 voiceschanged 重置
  const userHasSelectedVoiceRef = useRef(false);
  const [sysVoices, setSysVoices] = useState([]);
  const sysVoicesRef = useRef([]);
  const [currentSentence, setCurrentSentence] = useState(-1);
  const [currentChunkText, setCurrentChunkText] = useState('');
  // [FIX] 记录当前 chunk 在全文的起始偏移，用于限制高亮范围
  const [currentChunkOffset, setCurrentChunkOffset] = useState(0);
  // [FIX] onboundary 追踪的当前句全文偏移范围
  const [highlightRange, setHighlightRange] = useState({ start: 0, end: 0 });
  const progressRestored = useRef(false);

  useEffect(() => { progressRestored.current = false; }, [bookId]);
  useEffect(() => { ttsVoiceRef.current = ttsVoice; }, [ttsVoice]);

  // 切换书籍时停止朗读
  useEffect(() => {
    return () => { isSpeakingRef.current = false; setTtsState('idle'); };
  }, [bookId]);

  // ── 滚动时保存进度（节流 2 秒）──
  const scrollTimerRef = useRef(null);
  const saveProgress = useCallback(() => {
    if (scrollTimerRef.current) return;
    scrollTimerRef.current = setTimeout(() => {
      scrollTimerRef.current = null;
      if (!contentRef.current || !book) return;
      const el = contentRef.current;
      const scrollRatio = el.scrollTop / (el.scrollHeight - el.clientHeight || 1);
      const approxOffset = Math.floor(scrollRatio * (book.content || '').length);
      updateReadingProgress(bookId, Math.max(book.readingProgress || 0, approxOffset));
    }, 2000);
  }, [book, bookId, updateReadingProgress]);

  // ── 恢复阅读位置 ──
  const restoreReadingProgress = useCallback((el) => {
    if (!el || !book?.readingProgress || progressRestored.current) return;
    progressRestored.current = true;
    const ratio = Math.min(1, book.readingProgress / (book.content?.length || 1));
    setTimeout(() => { el.scrollTop = ratio * (el.scrollHeight - el.clientHeight); }, 300);
  }, [book?.readingProgress, book?.content]);

  // ── 工具栏触发：选区稳定 500ms 后弹出 ──
  const selTimerRef = useRef(null);
  const prevSelTextRef = useRef('');

  const tryShowToolbar = useCallback(() => {
    clearTimeout(selTimerRef.current);
    selTimerRef.current = setTimeout(() => {
      const offsets = getSelectionOffsets(contentRef.current);
      const curText = (offsets && offsets.text.trim()) || '';

      if (curText && curText !== prevSelTextRef.current) {
        prevSelTextRef.current = curText;
        setPendingRange(offsets);
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          const rect = sel.getRangeAt(0).getBoundingClientRect();
          setToolbarPos({
            x: Math.min(rect.left + rect.width / 2, window.innerWidth - 200),
            y: Math.max(rect.top - 80, 20),
          });
        }
        setShowToolbar(true);
      } else if (!curText) {
        setShowToolbar(false);
        setPendingRange(null);
        prevSelTextRef.current = '';
      }
    }, 500);
  }, []);

  // [FIX-2] 同时监听 selectionchange / mouseup / touchend，兼容移动端
  useEffect(() => {
    const onSelectionChange = () => tryShowToolbar();
    const onPointerUp = () => tryShowToolbar();
    const onClickOutside = (e) => {
      if (e.target.closest('.annotation-toolbar, .reader-overlay, .reader-modal-overlay')) return;
      if (contentRef.current?.contains(e.target)) return;
      setShowToolbar(false);
      setPendingRange(null);
    };
    document.addEventListener('selectionchange', onSelectionChange);
    ['mouseup', 'touchend'].forEach(evt =>
      document.addEventListener(evt, onPointerUp)
    );
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('touchstart', onClickOutside, { passive: true });
    return () => {
      document.removeEventListener('selectionchange', onSelectionChange);
      ['mouseup', 'touchend'].forEach(evt =>
        document.removeEventListener(evt, onPointerUp)
      );
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('touchstart', onClickOutside);
      clearTimeout(selTimerRef.current);
    };
  }, [tryShowToolbar]);

  // ── Esc 关闭 ──
  useEffect(() => {
    if (isMobile) return;
    const h = (e) => {
      if (e.key === 'Escape') {
        setShowToolbar(false);
        setPendingRange(null);
        window.getSelection()?.removeAllRanges();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [isMobile]);

  // ── TTS 引擎：桌面用系统语音 / 手机用云端 ──────────────
  const ttsAudioRef = useRef(null);
  const ttsAbortRef = useRef(null);
  const ttsGenRef = useRef(0);     // generation 防竞态
  const scrollRAF = useRef(null);  // 持续滚动动画帧

  // ── 桌面端：加载系统语音 ──
  useEffect(() => {
    if (isMobile) return;
    const load = () => {
      const all = window.speechSynthesis.getVoices();
      const zh = all.filter(v => v.lang.startsWith('zh'));
      // [FIX-2] 仅首次且用户从未手动选择时才设默认语音
      if (zh.length > 0) {
        setSysVoices(zh);
        sysVoicesRef.current = zh;
        if (!ttsVoiceRef.current && !userHasSelectedVoiceRef.current) {
          const yun = zh.find(v => /yunyang|云扬/i.test(v.name)) || zh[0];
          setTtsVoice(yun.name);
          ttsVoiceRef.current = yun.name;
        }
      }
    };
    load();
    window.speechSynthesis.addEventListener('voiceschanged', load);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', load);
  }, [isMobile]);

  // ── 持续平滑滚动 ──
  const stopAutoScroll = useCallback(() => {
    if (scrollRAF.current) { cancelAnimationFrame(scrollRAF.current); scrollRAF.current = null; }
  }, []);

  const startAutoScroll = useCallback(() => {
    stopAutoScroll();
    const el = contentRef.current;
    if (!el) return;
    const totalH = el.scrollHeight - el.clientHeight;
    if (totalH <= 0) return;
    // 按 ~80ms/字实际语速计算，每帧少量滚动
    let last = performance.now();
    const tick = (now) => {
      if (!isSpeakingRef.current) { scrollRAF.current = null; return; }
      const dt = Math.min(now - last, 100); // 防止 tab 切后台后一跳到底
      last = now;
      const msPerChar = 80 / (ttsSpeedRef.current || 1);
      const totalMs = (ttsChunksRef.current.reduce((s,t)=>s+t.length,0) || 1) * msPerChar;
      const pxPerMs = totalH / totalMs;
      el.scrollTop += pxPerMs * dt;
      scrollRAF.current = requestAnimationFrame(tick);
    };
    scrollRAF.current = requestAnimationFrame(tick);
  }, [stopAutoScroll]);

  const stopTTS = useCallback(() => {
    isSpeakingRef.current = false;
    ttsGenRef.current++;
    stopAutoScroll();
    ttsAbortRef.current?.abort();
    ttsAudioRef.current?.pause();
    ttsAudioRef.current = null;
    window.speechSynthesis?.cancel();
    setTtsState('idle');
    setCurrentSentence(-1);
    setHighlightRange({ start: 0, end: 0 });
  }, [stopAutoScroll]);

  // ── 桌面端：chunk 朗读 + onboundary 逐句追踪 ──
  const speakLocal = useCallback((idx, gen) => {
    if (gen !== undefined && gen !== ttsGenRef.current) return;
    const chunks = ttsChunksRef.current;
    if (idx >= chunks.length || !isSpeakingRef.current) { stopTTS(); return; }
    ttsIdxRef.current = idx;
    const chunk = chunks[idx];
    setCurrentSentence(idx);
    setCurrentChunkText(chunk);

    // 计算当前 chunk 在全文的起始偏移
    let chunkStart = 0;
    for (let j = 0; j < idx; j++) chunkStart += chunks[j].length;
    setCurrentChunkOffset(chunkStart);

    // [FIX] onboundary 降级标记：2秒内未触发则高亮整个 chunk
    let boundaryFired = false;
    const fallbackTimer = setTimeout(() => {
      if (!boundaryFired) {
        setHighlightRange({ start: chunkStart, end: chunkStart + chunk.length });
      }
    }, 2000);

    const curGen = ttsGenRef.current;
    const u = new SpeechSynthesisUtterance(chunk);
    u.lang = 'zh-CN'; u.rate = ttsSpeed; u.volume = 1;
    const v = sysVoicesRef.current.find(v => v.name === ttsVoiceRef.current) || sysVoicesRef.current[0];
    if (v) u.voice = v;

    // [FIX] onboundary：每次读到新词时触发，精确定位当前句
    u.onboundary = (e) => {
      if (e.name !== 'word' && e.name !== 'sentence') return;
      boundaryFired = true;
      clearTimeout(fallbackTimer);
      const ci = e.charIndex;
      // 往前找最近句号 → 当前句起始
      let s = 0;
      for (let i = ci - 1; i >= 0; i--) {
        if (/[。！？\n]/.test(chunk[i])) { s = i + 1; break; }
      }
      // 往后找最近句号 → 当前句结束
      let e2 = chunk.length;
      for (let i = ci; i < chunk.length; i++) {
        if (/[。！？\n]/.test(chunk[i])) { e2 = i + 1; break; }
      }
      setHighlightRange({ start: chunkStart + s, end: chunkStart + e2 });
      requestAnimationFrame(() => {
        const el = document.querySelector('.tts-highlight');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    };

    u.onend = () => { clearTimeout(fallbackTimer); if (isSpeakingRef.current && ttsGenRef.current === curGen) speakLocal(idx + 1, curGen); };
    u.onerror = (e) => { clearTimeout(fallbackTimer); if (e.error !== 'interrupted' && isSpeakingRef.current && ttsGenRef.current === curGen) speakLocal(idx + 1, curGen); };
    window.speechSynthesis.speak(u);
  }, [ttsSpeed, stopTTS]);

  // ── 手机端：云端 TTS fetch Audio ──
  const playCloud = useCallback(async (idx, gen) => {
    if (gen !== undefined && gen !== ttsGenRef.current) return;
    const chunks = ttsChunksRef.current;
    if (idx >= chunks.length || !isSpeakingRef.current) { stopTTS(); return; }
    ttsIdxRef.current = idx; setCurrentSentence(idx);
    let cc = 0; for (let j = 0; j < idx; j++) cc += chunks[j].length;
    // [FIX] 同步记录 chunk 文本和全文偏移
    setCurrentChunkText(chunks[idx]);
    setCurrentChunkOffset(cc);
    // [FIX-1] rAF 滚动到当前高亮句
    requestAnimationFrame(() => {
      const el = document.querySelector('.tts-highlight');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });

    const abort = new AbortController(); ttsAbortRef.current = abort;
    const curGen = ttsGenRef.current;
    try {
      const res = await fetch('/api/tts', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({text:chunks[idx],rate:ttsSpeed}), signal:abort.signal });
      if (!res.ok) throw new Error('fail');
      const blob = await res.blob();
      if (!isSpeakingRef.current || abort.signal.aborted || ttsGenRef.current !== curGen) return;
      const url = URL.createObjectURL(blob);
      const a = new Audio(url);
      a.onended = () => { URL.revokeObjectURL(url); if (isSpeakingRef.current && ttsGenRef.current === curGen) playCloud(idx + 1, curGen); };
      a.onerror = () => { URL.revokeObjectURL(url); if (isSpeakingRef.current && ttsGenRef.current === curGen) playCloud(idx + 1, curGen); };
      ttsAudioRef.current = a;
      a.play().catch(() => { URL.revokeObjectURL(url); if (isSpeakingRef.current) playCloud(idx + 1, curGen); });
    } catch (e) {
      if (abort.signal.aborted || ttsGenRef.current !== curGen) return;
      if (isSpeakingRef.current) { await new Promise(r=>setTimeout(r,500)); if (isSpeakingRef.current && ttsGenRef.current === curGen) playCloud(idx, curGen); }
    }
  }, [ttsSpeed, stopTTS]);

  const startTTS = useCallback((fromIdx = 0) => {
    if (!book?.content) return;
    stopTTS();
    const chunks = [], raw = splitSentences(book.content);
    let buf = '';
    const limit = isMobile ? 180 : 300;
    for (const s of raw) { buf += s; if (buf.length >= limit) { chunks.push(buf); buf = ''; } }
    if (buf.trim()) chunks.push(buf);
    ttsChunksRef.current = chunks;
    isSpeakingRef.current = true;
    setTtsState('playing');
    // [FIX-1] rAF 确保 DOM 分句渲染完毕后再开始朗读
    const gen = ttsGenRef.current;
    const fn = isMobile ? playCloud : speakLocal;
    requestAnimationFrame(() => {
      fn(Math.min(fromIdx, chunks.length - 1), gen);
    });
  }, [book?.content, stopTTS, isMobile, speakLocal, playCloud]);

  const handleTTS = useCallback(() => {
    if (ttsState === 'playing') {
      if (isMobile) { ttsAbortRef.current?.abort(); ttsAudioRef.current?.pause(); }
      else { isSpeakingRef.current = false; window.speechSynthesis?.pause(); }
      setTtsState('paused');
    } else if (ttsState === 'paused') {
      isSpeakingRef.current = true; setTtsState('playing');
      if (isMobile) ttsAudioRef.current?.play().catch(()=>{});
      else window.speechSynthesis?.resume();
    } else startTTS(0);
  }, [ttsState, startTTS, isMobile]);

  const handleTTSStop = useCallback(() => stopTTS(), [stopTTS]);

  // [FIX-2] 标记用户已手动选语音，防止 voiceschanged 重置
  const handleVoiceChange = useCallback((name) => {
    setTtsVoice(name);
    ttsVoiceRef.current = name;
    userHasSelectedVoiceRef.current = true;
  }, []);

  const handleSpeedChange = useCallback((newSpeed) => {
    setTtsSpeed(newSpeed);
    if (!isSpeakingRef.current) return;
    const cur = ttsIdxRef.current;
    stopTTS();
    setTimeout(() => { if (!isSpeakingRef.current) return; isSpeakingRef.current = true; setTtsState('playing'); startTTS(cur); }, 100);
  }, [stopTTS, startTTS]);

  useEffect(() => () => { isSpeakingRef.current = false; window.speechSynthesis?.cancel(); ttsAbortRef.current?.abort(); }, []);

  // [FIX-2] 标注后立即持久化到 IndexedDB，不等 auto-save
  const handleConfirmAnnotation = () => {
    if (!pendingRange || !bookId) return;
    addAnnotation(bookId, {
      startOffset: pendingRange.start,
      endOffset: pendingRange.end,
      color: selectedColor,
      lineStyle: selectedStyle,
      selectedText: pendingRange.text,
      note: '',
    });
    // [FIX-1] 直接使用组件顶层解构的 persist，不再跨组件调用 getState
    persist(true);
    setFlashId(Date.now());
    setShowToolbar(false);
    setPendingRange(null);
    window.getSelection()?.removeAllRanges();
  };

  const handleCancelAnnotation = () => {
    setShowToolbar(false);
    setPendingRange(null);
    window.getSelection()?.removeAllRanges();
  };

  const handleAnnotationClick = (annotationId, e) => {
    e.stopPropagation();
    e.preventDefault();
    setShowToolbar(false);
    setDeleteTarget(annotationId);
  };

  const confirmDeleteAnnotation = () => {
    if (deleteTarget) removeAnnotation(bookId, deleteTarget);
    setDeleteTarget(null);
  };

  // [FIX-2] 根据字符偏移量重建分段，不依赖 flashId（不再通过改 key 触发重渲染）
  const segments = useMemo(() => {
    if (!book) return [];
    return buildSegments(book.content, book.annotations || []);
  }, [book?.content, book?.annotations]);

  if (!book) {
    return (
      <div className="reader-empty">
        <CatIcon name="reading" size={48} />
        <p>书籍未找到</p>
        <button className="reader-back-btn" onClick={onBack}>返回书房</button>
      </div>
    );
  }

  return (
    <div className={`reader-container${isMobile ? ' reader-mobile' : ''}${showToolbar ? ' reader-masked' : ''}`}>
      {/* 极简顶栏 */}
      <div className="reader-topbar">
        <button className="reader-back-btn" onClick={onBack}>‹ 书房</button>
        <span className="reader-title">{book.title}</span>

        {/* TTS 控制区 */}
        <div className="reader-tts-group">
          {/* 桌面端语音选择器 */}
          {!isMobile && sysVoices.length > 0 && (
            <select className="tts-voice-select" value={ttsVoice || ''} onChange={(e) => handleVoiceChange(e.target.value)} title="选择语音">
              {sysVoices.map(v => (
                <option key={v.name} value={v.name}>{v.name.replace(/Microsoft\s*/i,'').replace(/\(.*\)/,'').trim()}</option>
              ))}
            </select>
          )}
          {ttsState !== 'idle' && (
            <>
              <select
                className="tts-speed-select"
                value={ttsSpeed}
                onChange={(e) => { handleSpeedChange(Number(e.target.value)); }}
                title="朗读速度"
              >
                <option value={0.7}>0.7x</option>
                <option value={0.85}>0.85x</option>
                <option value={1}>1x</option>
                <option value={1.25}>1.25x</option>
                <option value={1.5}>1.5x</option>
              </select>
              <button className="tts-btn tts-stop-btn" onClick={handleTTSStop} title="停止">■</button>
            </>
          )}
          <button
            className={`tts-btn${ttsState === 'playing' ? ' tts-active' : ''}`}
            onClick={handleTTS}
            title={ttsState === 'playing' ? '暂停' : ttsState === 'paused' ? '继续' : 'AI 朗读'}
          >
            {ttsState === 'playing' ? '⏸' : ttsState === 'paused' ? '▶' : '🔊'}
          </button>
        </div>

        <span className="reader-progress">
          {book.annotations?.length > 0 && `${book.annotations.length}条笔记 · `}
          {book.totalChars >= 10000
            ? (book.totalChars / 10000).toFixed(1) + '万字'
            : book.totalChars + '字'}
        </span>
      </div>

      {/* 正文区 */}
      <div
        ref={(el) => { contentRef.current = el; restoreReadingProgress(el); }}
        className="reader-content"
        onScroll={saveProgress}
      >
        <div className="reader-text" key="reader-text-stable">
          {(() => {
            const curChunk = currentChunkText;
            const isPlaying = ttsState === 'playing' && curChunk;
            // [FIX] 用 onboundary 的 highlightRange 精准定位当前句
            const { start: hlStart, end: hlEnd } = highlightRange;
            const splitBySentence = (text, segStart, segEnd) => {
              if (!isPlaying || hlEnd <= hlStart) return [{ text, match: false }];
              // 段和高亮范围无重叠
              if (segEnd <= hlStart || segStart >= hlEnd) return [{ text, match: false }];
              // 拆句，每句和高亮范围有重叠即匹配
              const parts = text.split(/(?<=[。！？\n])/g);
              let cursor = segStart;
              return parts.map(p => {
                const s = cursor;
                const e = cursor + p.length;
                cursor = e;
                const match = s < hlEnd && e > hlStart && p.trim().length > 4 && /[一-鿿]/.test(p);
                return { text: p, match };
              });
            };
            let charPos = 0;
            return segments.map((seg, i) => {
              const segStart = charPos;
              const segEnd = charPos + seg.text.length;
              charPos = segEnd;
              const subSpans = splitBySentence(seg.text, segStart, segEnd);
              if (!seg.annotation) {
                return (
                  <span key={i}>
                    {subSpans.map((s, j) =>
                      <span key={j} className={s.match ? 'tts-highlight' : ''}>{s.text}</span>
                    )}
                  </span>
                );
              }
            const ann = seg.annotation;
            const color = ann.color;
            // 内联样式 — 不走 CSS 变量，确保标注一定显示
            let annStyle = { cursor: 'pointer' };
            if (ann.lineStyle === 'wavy') {
              annStyle.textDecoration = `underline wavy ${color}`;
              annStyle.textUnderlineOffset = '4px';
              annStyle.textDecorationThickness = '2px';
            } else if (ann.lineStyle === 'straight') {
              annStyle.textDecoration = `underline ${color}`;
              annStyle.textUnderlineOffset = '4px';
              annStyle.textDecorationThickness = '2px';
            } else if (ann.lineStyle === 'highlighter') {
              annStyle.background = `linear-gradient(transparent 55%, ${color}40 55%)`;
            }
            // 标注段：保留标注样式，内层按句拆分做 TTS 高亮
            return (
              <span
                key={i}
                className="annotation-mark"
                style={annStyle}
                onClick={(e) => handleAnnotationClick(ann.id, e)}
                title={`${LINE_STYLES.find(s => s.key === ann.lineStyle)?.label || ''} · 点击删除`}
              >
                {subSpans.map((s, j) =>
                  <span key={j} className={s.match ? 'tts-highlight' : ''}>{s.text}</span>
                )}
              </span>
            );
          })})()}
        </div>
      </div>

      {/* 标注时的遮罩层 */}
      {showToolbar && <div className="reader-overlay" onClick={handleCancelAnnotation} />}

      {/* 标注工具栏 */}
      {showToolbar && (
        <div
          className="annotation-toolbar"
          style={{
            left: isMobile ? '50%' : toolbarPos.x,
            top: isMobile ? 'auto' : toolbarPos.y,
            bottom: isMobile ? '100px' : 'auto',
            transform: isMobile ? 'translateX(-50%)' : 'none',
          }}
        >
          <div className="ann-colors">
            {ANNOTATION_COLORS.map(c => (
              <button
                key={c.value}
                className={`ann-color-btn${selectedColor === c.value ? ' active' : ''}`}
                style={{ background: c.value }}
                title={c.name}
                onClick={() => setSelectedColor(c.value)}
              />
            ))}
          </div>
          <div className="ann-styles">
            {LINE_STYLES.map(s => (
              <button
                key={s.key}
                className={`ann-style-btn${selectedStyle === s.key ? ' active' : ''}`}
                onClick={() => setSelectedStyle(s.key)}
                title={s.label}
              >
                <span className="ann-style-icon">{s.icon}</span>
                <span className="ann-style-label">{s.label}</span>
              </button>
            ))}
          </div>
          <div className="ann-actions">
            <button className="ann-confirm-btn" onClick={handleConfirmAnnotation}>✓ 标记</button>
            <button className="ann-cancel-btn" onClick={handleCancelAnnotation}>✕</button>
          </div>
        </div>
      )}

      {/* 删除标注确认弹窗 */}
      {deleteTarget && (
        <div className="reader-modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="reader-modal" onClick={e => e.stopPropagation()}>
            <div className="reader-modal-icon">🗑</div>
            <p className="reader-modal-text">确定删除这条标注？</p>
            <p className="reader-modal-sub">删除后不可恢复</p>
            <div className="reader-modal-actions">
              <button className="reader-modal-btn reader-modal-btn-del" onClick={confirmDeleteAnnotation}>删除</button>
              <button className="reader-modal-btn reader-modal-btn-cancel" onClick={() => setDeleteTarget(null)}>取消</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

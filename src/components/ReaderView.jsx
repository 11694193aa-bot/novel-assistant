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
  const { readingBooks, addAnnotation, removeAnnotation, updateReadingProgress } = useStore();
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
  const [currentSentence, setCurrentSentence] = useState(-1);
  const progressRestored = useRef(false);

  useEffect(() => { progressRestored.current = false; }, [bookId]);

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

  useEffect(() => {
    const onSelectionChange = () => tryShowToolbar();
    const onClickOutside = (e) => {
      // 点工具栏/遮罩/弹窗 → 不关
      if (e.target.closest('.annotation-toolbar, .reader-overlay, .reader-modal-overlay')) return;
      // 点阅读内容区内 → 不关（让 selectionchange 处理）
      if (contentRef.current?.contains(e.target)) return;
      // 点外面 → 关
      setShowToolbar(false);
      setPendingRange(null);
    };
    document.addEventListener('selectionchange', onSelectionChange);
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('touchstart', onClickOutside, { passive: true });
    return () => {
      document.removeEventListener('selectionchange', onSelectionChange);
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

  // ── TTS：云端 Google TTS（fetch Audio，不依赖手机 TTS 引擎）──
  const ttsAudioRef = useRef(null);
  const ttsAbortRef = useRef(null);

  const stopTTS = useCallback(() => {
    ttsAbortRef.current?.abort();
    ttsAudioRef.current?.pause();
    ttsAudioRef.current = null;
    isSpeakingRef.current = false;
    setTtsState('idle');
    setCurrentSentence(-1);
  }, []);

  const playChunk = useCallback(async (idx) => {
    const chunks = ttsChunksRef.current;
    if (idx >= chunks.length || !isSpeakingRef.current) { stopTTS(); return; }
    ttsIdxRef.current = idx;
    setCurrentSentence(idx);

    let cc = 0; for (let j = 0; j < idx; j++) cc += chunks[j].length;
    const total = chunks.reduce((s, t) => s + t.length, 0);
    const el = contentRef.current;
    if (el) el.scrollTop = (cc / (total || 1)) * (el.scrollHeight - el.clientHeight);

    const abort = new AbortController();
    ttsAbortRef.current = abort;
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: chunks[idx], rate: ttsSpeed }),
        signal: abort.signal,
      });
      if (!res.ok) throw new Error('TTS fail');
      const blob = await res.blob();
      if (!isSpeakingRef.current || abort.signal.aborted) return;
      const url = URL.createObjectURL(blob);
      const a = new Audio(url);
      a.onended = () => { URL.revokeObjectURL(url); if (isSpeakingRef.current) playChunk(idx + 1); };
      a.onerror = () => { URL.revokeObjectURL(url); if (isSpeakingRef.current) playChunk(idx + 1); };
      ttsAudioRef.current = a;
      a.play().catch(() => { URL.revokeObjectURL(url); if (isSpeakingRef.current) playChunk(idx + 1); });
    } catch (e) {
      if (abort.signal.aborted) return;
      // 网络失败等 500ms 重试
      if (isSpeakingRef.current) {
        await new Promise(r => setTimeout(r, 500));
        if (isSpeakingRef.current) playChunk(idx);
      }
    }
  }, [ttsSpeed, stopTTS]);

  const startTTS = useCallback((fromIdx = 0) => {
    if (!book?.content) return;
    stopTTS();
    const chunks = [];
    const raw = splitSentences(book.content);
    let buf = '';
    for (const s of raw) { buf += s; if (buf.length >= 180) { chunks.push(buf); buf = ''; } }
    if (buf.trim()) chunks.push(buf);
    ttsChunksRef.current = chunks;
    isSpeakingRef.current = true;
    setTtsState('playing');
    playChunk(Math.min(fromIdx, chunks.length - 1));
  }, [book?.content, stopTTS, playChunk]);

  const handleTTS = useCallback(() => {
    if (ttsState === 'playing') {
      ttsAbortRef.current?.abort();
      ttsAudioRef.current?.pause();
      setTtsState('paused');
      isSpeakingRef.current = false;
    } else if (ttsState === 'paused') {
      isSpeakingRef.current = true;
      setTtsState('playing');
      ttsAudioRef.current?.play().catch(() => {});
    } else {
      startTTS(0);
    }
  }, [ttsState, startTTS]);

  const handleTTSStop = useCallback(() => stopTTS(), [stopTTS]);

  const handleSpeedChange = useCallback((newSpeed) => {
    setTtsSpeed(newSpeed);
    if (!isSpeakingRef.current) return;
    const cur = ttsIdxRef.current;
    stopTTS();
    setTimeout(() => { if (isSpeakingRef.current) startTTS(cur); }, 100);
  }, [stopTTS, startTTS]);

  useEffect(() => () => stopTTS(), [stopTTS]);

  // ── 确认标注 ──
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

  // ── 构建分段 ──
  const segments = useMemo(() => {
    if (!book) return [];
    return buildSegments(book.content, book.annotations || []);
  }, [book?.content, book?.annotations, flashId]);

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
        <div className="reader-text" key={flashId || '0'}>
          {segments.map((seg, i) => {
            const curChunk = ttsIdxRef.current;
            const isCurrentTTS = currentSentence >= 0 && ttsState === 'playing' && seg.text === ttsChunksRef.current[currentSentence];
            if (!seg.annotation) {
              return <span key={i} className={isCurrentTTS ? 'tts-highlight' : ''}>{seg.text}</span>;
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
            return (
              <span
                key={i}
                className={`annotation-mark${isCurrentTTS ? ' tts-highlight' : ''}`}
                style={annStyle}
                onClick={(e) => handleAnnotationClick(ann.id, e)}
                title={`${LINE_STYLES.find(s => s.key === ann.lineStyle)?.label || ''} · 点击删除`}
              >
                {seg.text}
              </span>
            );
          })}
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

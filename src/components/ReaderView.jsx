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
  const ttsRef = useRef(null);        // SpeechSynthesisUtterance 实例
  const sentIdxRef = useRef(0);       // 当前句子索引
  const sentencesRef = useRef([]);    // 句子列表
  const isSpeakingRef = useRef(false);

  const [showToolbar, setShowToolbar] = useState(false);
  const [toolbarPos, setToolbarPos] = useState({ x: 0, y: 0 });
  const [selectedColor, setSelectedColor] = useState(ANNOTATION_COLORS[0].value);
  const [selectedStyle, setSelectedStyle] = useState('wavy');
  const [pendingRange, setPendingRange] = useState(null);
  const [flashId, setFlashId] = useState(null);
  const [ttsState, setTtsState] = useState('idle'); // idle | playing | paused
  const [ttsSpeed, setTtsSpeed] = useState(1);
  const [currentSentence, setCurrentSentence] = useState(-1);
  const progressRestored = useRef(false);

  useEffect(() => { progressRestored.current = false; }, [bookId]);

  // 切换书籍时停止朗读
  useEffect(() => {
    return () => { window.speechSynthesis?.cancel(); setTtsState('idle'); };
  }, [bookId]);

  // ── 滚动时保存进度 ──
  const saveProgress = useCallback(() => {
    if (!contentRef.current || !book) return;
    const el = contentRef.current;
    const scrollRatio = el.scrollTop / (el.scrollHeight - el.clientHeight || 1);
    const approxOffset = Math.floor(scrollRatio * (book.content || '').length);
    updateReadingProgress(bookId, Math.max(book.readingProgress || 0, approxOffset));
  }, [book, bookId, updateReadingProgress]);

  // ── 恢复阅读位置 ──
  const restoreReadingProgress = useCallback((el) => {
    if (!el || !book?.readingProgress || progressRestored.current) return;
    progressRestored.current = true;
    const ratio = Math.min(1, book.readingProgress / (book.content?.length || 1));
    setTimeout(() => { el.scrollTop = ratio * (el.scrollHeight - el.clientHeight); }, 300);
  }, [book?.readingProgress, book?.content]);

  // ── selectionchange 驱动工具栏（防抖避免闪烁）──
  const selTimerRef = useRef(null);
  const prevSelTextRef = useRef('');
  useEffect(() => {
    const onSelectionChange = () => {
      clearTimeout(selTimerRef.current);
      selTimerRef.current = setTimeout(() => {
        const offsets = getSelectionOffsets(contentRef.current);
        const curText = (offsets && offsets.text.trim()) || '';
        const prevText = prevSelTextRef.current;
        // 只有选区文字真正变化时才更新状态
        if (curText === prevText) return;
        prevSelTextRef.current = curText;

        if (curText) {
          setPendingRange(offsets);
          const sel = window.getSelection();
          if (sel && sel.rangeCount > 0) {
            const rect = sel.getRangeAt(0).getBoundingClientRect();
            setToolbarPos({
              x: Math.min(rect.left + rect.width / 2, window.innerWidth - 200),
              y: Math.max(rect.top - 56, 20),
            });
          }
          setShowToolbar(true);
        } else {
          setShowToolbar(false);
          setPendingRange(null);
        }
      }, 150); // 150ms 防抖
    };
    document.addEventListener('selectionchange', onSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', onSelectionChange);
      clearTimeout(selTimerRef.current);
    };
  }, []);

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

  // ── TTS：朗读功能 ──────────────────────────────────────
  const scrollToSentence = useCallback((idx) => {
    const el = contentRef.current;
    if (!el) return;
    const sentences = sentencesRef.current;
    if (sentences.length === 0) return;
    // 估算句子在全文中的位置比例
    let charCount = 0;
    for (let i = 0; i < idx; i++) charCount += sentences[i].length;
    const totalChars = sentences.reduce((s, t) => s + t.length, 0);
    const ratio = charCount / (totalChars || 1);
    el.scrollTop = ratio * (el.scrollHeight - el.clientHeight);
  }, []);

  const speakSentence = useCallback((idx) => {
    const sentences = sentencesRef.current;
    if (idx >= sentences.length) {
      window.speechSynthesis.cancel();
      setTtsState('idle');
      setCurrentSentence(-1);
      isSpeakingRef.current = false;
      return;
    }
    sentIdxRef.current = idx;
    setCurrentSentence(idx);
    scrollToSentence(idx);

    const utter = new SpeechSynthesisUtterance(sentences[idx]);
    utter.lang = 'zh-CN';
    utter.rate = ttsSpeed;
    utter.volume = 0.9;
    // 尝试选中文语音
    const voices = window.speechSynthesis.getVoices();
    const zhVoice = voices.find(v => v.lang.startsWith('zh')) || voices[0];
    if (zhVoice) utter.voice = zhVoice;

    utter.onend = () => {
      if (isSpeakingRef.current) speakSentence(idx + 1);
    };
    utter.onerror = () => {
      if (isSpeakingRef.current) speakSentence(idx + 1);
    };
    ttsRef.current = utter;
    window.speechSynthesis.speak(utter);
  }, [ttsSpeed, scrollToSentence]);

  const handleTTS = useCallback(() => {
    const synth = window.speechSynthesis;
    if (!synth) { alert('浏览器不支持语音朗读'); return; }

    if (ttsState === 'playing') {
      // 暂停
      synth.pause();
      setTtsState('paused');
      isSpeakingRef.current = false;
    } else if (ttsState === 'paused') {
      // 继续
      synth.resume();
      setTtsState('playing');
      isSpeakingRef.current = true;
    } else {
      // 开始朗读
      if (!book?.content) return;
      synth.cancel();
      const sentences = splitSentences(book.content);
      sentencesRef.current = sentences;
      isSpeakingRef.current = true;
      setTtsState('playing');
      // 确保 voices 加载
      if (synth.getVoices().length === 0) {
        synth.addEventListener('voiceschanged', () => speakSentence(0), { once: true });
      } else {
        speakSentence(0);
      }
    }
  }, [ttsState, book?.content, speakSentence]);

  const handleTTSStop = useCallback(() => {
    window.speechSynthesis.cancel();
    setTtsState('idle');
    setCurrentSentence(-1);
    isSpeakingRef.current = false;
  }, []);

  // cleanup on unmount
  useEffect(() => {
    return () => { window.speechSynthesis?.cancel(); };
  }, []);

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
    if (confirm('删除这条标注？')) {
      removeAnnotation(bookId, annotationId);
    }
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
                onChange={(e) => { setTtsSpeed(Number(e.target.value)); }}
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
        <div className="reader-text">
          {segments.map((seg, i) => {
            const isCurrentTTS = currentSentence >= 0 && seg.text === sentencesRef.current[currentSentence];
            return seg.annotation ? (
              <span
                key={i}
                className={`annotation-mark annotation-${seg.annotation.lineStyle}${isCurrentTTS ? ' tts-highlight' : ''}`}
                style={{ '--ann-color': seg.annotation.color }}
                onClick={(e) => handleAnnotationClick(seg.annotation.id, e)}
                title={`${LINE_STYLES.find(s => s.key === seg.annotation.lineStyle)?.label || ''} · 点击删除`}
              >
                {seg.text}
              </span>
            ) : (
              <span key={i} className={isCurrentTTS ? 'tts-highlight' : ''}>{seg.text}</span>
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
    </div>
  );
}

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
  const [deleteTarget, setDeleteTarget] = useState(null); // 待删除标注 id
  const [ttsState, setTtsState] = useState('idle'); // idle | playing | paused
  const [ttsSpeed, setTtsSpeed] = useState(1);
  const [ttsVoice, setTtsVoice] = useState(null);   // 选中的语音名
  const ttsVoiceRef = useRef(null);                   // ref 版，保证 speakSentence 闭包里是最新值
  const [availableVoices, setAvailableVoices] = useState([]);
  const [currentSentence, setCurrentSentence] = useState(-1);
  const progressRestored = useRef(false);

  useEffect(() => { progressRestored.current = false; }, [bookId]);
  useEffect(() => { ttsVoiceRef.current = ttsVoice; }, [ttsVoice]);

  // 切换书籍时停止朗读
  useEffect(() => {
    return () => { window.speechSynthesis?.cancel(); setTtsState('idle'); };
  }, [bookId]);

  // ── 加载可用语音列表 ──
  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        setAvailableVoices(voices);
        // 默认选中第一个中文语音
        const zh = voices.find(v => v.lang.startsWith('zh'));
        if (zh && !ttsVoice) setTtsVoice(zh.name);
      }
    };
    loadVoices();
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
  }, []);

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

  // ── TTS：健壮朗读引擎 ──────────────────────────────────
  const ttsIdxRef = useRef(0);
  const ttsChunksRef = useRef([]);
  const ttsWatchdogRef = useRef(null);
  const ttsKeepAliveRef = useRef(null);
  const ttsLastStartRef = useRef(0);

  // 清除所有 TTS 定时器
  const clearTTSTimers = useCallback(() => {
    clearTimeout(ttsWatchdogRef.current);
    clearInterval(ttsKeepAliveRef.current);
  }, []);

  // 停止朗读
  const stopTTS = useCallback(() => {
    clearTTSTimers();
    window.speechSynthesis?.cancel();
    isSpeakingRef.current = false;
    setTtsState('idle');
    setCurrentSentence(-1);
  }, [clearTTSTimers]);

  // 播放指定块
  const speakChunk = useCallback((idx) => {
    const chunks = ttsChunksRef.current;
    if (idx >= chunks.length) { stopTTS(); return; }

    const synth = window.speechSynthesis;
    ttsIdxRef.current = idx;
    const utter = new SpeechSynthesisUtterance(chunks[idx]);
    utter.lang = 'zh-CN';
    utter.rate = ttsSpeed;
    utter.volume = 1.0;

    const voices = synth.getVoices();
    const picked = voices.find(v => v.name === ttsVoiceRef.current);
    const zhVoice = picked || voices.find(v => v.lang.startsWith('zh'));
    if (zhVoice) utter.voice = zhVoice;

    utter.onstart = () => {
      ttsLastStartRef.current = Date.now();
      setCurrentSentence(idx);
      // 滚动跟随
      let cc = 0;
      for (let j = 0; j < idx; j++) cc += chunks[j].length;
      const total = chunks.reduce((s, t) => s + t.length, 0);
      const el = contentRef.current;
      if (el) el.scrollTop = (cc / (total || 1)) * (el.scrollHeight - el.clientHeight);
    };

    utter.onend = () => {
      if (isSpeakingRef.current) speakChunk(idx + 1);
    };

    utter.onerror = (e) => {
      // Chrome 偶尔报错但实际在播，忽略；如果确实停了 watchdog 会兜底
      if (e.error === 'canceled' || e.error === 'interrupted') return;
      if (isSpeakingRef.current) speakChunk(idx + 1);
    };

    // 看门狗：如果 15 秒没听到 onstart，说明卡死了，重启
    clearTimeout(ttsWatchdogRef.current);
    ttsWatchdogRef.current = setTimeout(() => {
      if (!isSpeakingRef.current) return;
      const elapsed = Date.now() - ttsLastStartRef.current;
      if (elapsed > 12000) {
        // 卡死了 → cancel 后从当前位置重启
        synth.cancel();
        setTimeout(() => { if (isSpeakingRef.current) speakChunk(ttsIdxRef.current); }, 200);
      }
    }, 15000);

    synth.speak(utter);
  }, [ttsSpeed, stopTTS]);

  // 开始/继续朗读
  const startTTS = useCallback(() => {
    if (!book?.content) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    clearTTSTimers();

    const chunks = [];
    const raw = splitSentences(book.content);
    let buf = '';
    for (const s of raw) {
      buf += s;
      if (buf.length >= 300) { chunks.push(buf); buf = ''; }
    }
    if (buf.trim()) chunks.push(buf);
    ttsChunksRef.current = chunks;

    isSpeakingRef.current = true;
    setTtsState('playing');

    // Chrome 保活：每 8 秒 resume 一次防止浏览器杀掉语音
    ttsKeepAliveRef.current = setInterval(() => {
      if (isSpeakingRef.current && synth.paused) synth.resume();
    }, 8000);

    // 等 voices 就绪
    const doStart = () => speakChunk(ttsIdxRef.current || 0);
    if (synth.getVoices().length === 0) {
      synth.addEventListener('voiceschanged', doStart, { once: true });
    } else {
      doStart();
    }
  }, [book?.content, clearTTSTimers, speakChunk]);

  const handleTTS = useCallback(() => {
    const synth = window.speechSynthesis;
    if (!synth) { alert('浏览器不支持语音朗读'); return; }

    if (ttsState === 'playing') {
      synth.pause();
      clearTTSTimers();
      setTtsState('paused');
      isSpeakingRef.current = false;
    } else if (ttsState === 'paused') {
      synth.resume();
      isSpeakingRef.current = true;
      setTtsState('playing');
      // 重启看门狗
      ttsWatchdogRef.current = setTimeout(() => {
        if (!isSpeakingRef.current) return;
        if (Date.now() - ttsLastStartRef.current > 12000) {
          synth.cancel();
          setTimeout(() => { if (isSpeakingRef.current) speakChunk(ttsIdxRef.current); }, 200);
        }
      }, 15000);
    } else {
      ttsIdxRef.current = 0;
      startTTS();
    }
  }, [ttsState, startTTS, clearTTSTimers, speakChunk]);

  const handleTTSStop = useCallback(() => {
    stopTTS();
  }, [stopTTS]);

  // 语音切换时如果正在播放，自动用新语音重读当前块
  const prevVoiceRef = useRef(ttsVoice);
  useEffect(() => {
    if (!isSpeakingRef.current) { prevVoiceRef.current = ttsVoice; return; }
    if (ttsVoice !== prevVoiceRef.current) {
      prevVoiceRef.current = ttsVoice;
      // 取消当前队列，从当前位置用新语音重启
      window.speechSynthesis.cancel();
      setTimeout(() => { if (isSpeakingRef.current) speakChunk(ttsIdxRef.current); }, 150);
    }
  }, [ttsVoice, speakChunk]);

  // 卸载时清理
  useEffect(() => {
    return () => {
      clearTTSTimers();
      window.speechSynthesis?.cancel();
    };
  }, [clearTTSTimers]);

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
          {/* 语音选择器（始终可见） */}
          {availableVoices.length > 0 && (
            <select
              className="tts-voice-select"
              value={ttsVoice || ''}
              onChange={(e) => setTtsVoice(e.target.value)}
              title="选择语音"
            >
              {availableVoices
                .filter(v => v.lang.startsWith('zh'))
                .map(v => (
                  <option key={v.name} value={v.name}>{v.name.replace(/Microsoft\s*/i,'').replace(/\(.*\)/,'').trim()}</option>
                ))}
              {availableVoices.some(v => !v.lang.startsWith('zh')) && (
                <optgroup label="其他语言">
                  {availableVoices.filter(v => !v.lang.startsWith('zh')).map(v => (
                    <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>
                  ))}
                </optgroup>
              )}
            </select>
          )}
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

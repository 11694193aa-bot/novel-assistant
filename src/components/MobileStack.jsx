import React, { useState, useRef, useCallback, useEffect, lazy, Suspense } from 'react';
import useStore from '../store';
import Icon, { getBookCat, BookCoverImg } from './Icon';
import CatIcon, { CatIconButton } from './CatIcon';

const GachaMachine = lazy(() => import('./GachaMachine'));
const QuickNotes = lazy(() => import('./QuickNotes'));
const CalendarView = lazy(() => import('./CalendarView'));
const TrashView = lazy(() => import('./TrashView'));

const INDENT = '　　';

const bottomTabs = [
  { key: 'books', icon: 'books', label: '书架' },
  { key: 'mindmap', icon: 'mindmap', label: '导图' },
  { key: 'inspiration', icon: 'inspiration', label: '灵感' },
  { key: 'aichat', icon: 'aichat', label: 'AI' },
  { key: 'fun', icon: 'fun', label: '乐趣' },
  { key: 'settings', icon: 'settings', label: '设置' },
];

const funMenuItems = [
  { icon: 'quicknote', label: '速记阁', key: 'quicknote' },
  { icon: 'filmnote', label: '拉片室', key: 'filmnote' },
  { icon: 'gacha', label: '扭蛋屋', key: 'gacha' },
  { icon: 'calendar', label: '日历记', key: 'calendar' },
  { icon: 'trash', label: '清理站', key: 'trash' },
];

function FunMenu({ onClose, onAction }) {
  return (
    <div className="ms-fun-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ms-fun-sheet">
        <div className="ms-fun-handle" />
        <div className="ms-fun-header">
          <CatIcon name="paw" size={18} />
          <h3 className="ms-fun-title">乐趣栏</h3>
          <button className="ms-fun-close-btn" onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="ms-fun-grid">
          {funMenuItems.map((item) => (
            <button key={item.key} className="ms-fun-card" onClick={() => onAction(item.key)}>
              <span className="ms-fun-card-icon"><CatIcon name={item.icon} size={28} /></span>
              <span className="ms-fun-card-label">{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function MobileStack({
  onTabChange, onGachaClick, onQuickNote, onFilmNote,
  onCalendarClick, onTrashClick, activeMainTab,
}) {
  const { books, addBook, deleteBook, renameBook, addChapter, updateChapterContent,
    addDailyCount, dailyCounts, addInspirationCard, setBookCover, deleteChapter, reorderChapters, persist, dirty } = useStore();
  const [editingBookId, setEditingBookId] = useState(null);
  const [bookBatchMode, setBookBatchMode] = useState(false);
  const [selectedBooks, setSelectedBooks] = useState(new Set());

  // 导航栈: 'books' | 'chapters' | 'editor'
  const [page, setPage] = useState('books');
  const [pageHistory, setPageHistory] = useState([]);
  const [selectedBookId, setSelectedBookId] = useState(null);
  const [selectedChapterId, setSelectedChapterId] = useState(null);
  const [animating, setAnimating] = useState(false);
  const [animDir, setAnimDir] = useState('forward'); // 'forward' | 'back'

  // 子页面弹窗
  const [showFunMenu, setShowFunMenu] = useState(false);
  const [gachaOpen, setGachaOpen] = useState(false);
  const [quickNoteOpen, setQuickNoteOpen] = useState(false);
  const [filmNoteOpen, setFilmNoteOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);

  // 编辑器状态
  const [editorContent, setEditorContent] = useState('');
  const textareaRef = useRef(null);
  const prevCountRef = useRef(0);
  const [showFind, setShowFind] = useState(false);
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [findResults, setFindResults] = useState([]);
  const [currentFindIdx, setCurrentFindIdx] = useState(-1);
  const [focusMode, setFocusMode] = useState(false);
  const [batchMode, setBatchMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  // 滑动相关
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  const book = books.find(b => b.id === selectedBookId);
  const chapters = book?.chapters || [];
  const chapter = chapters.find(c => c.id === selectedChapterId);

  // 离开编辑器时自动保存
  const prevPageRef = useRef(page);
  useEffect(() => {
    if (prevPageRef.current === 'editor' && page !== 'editor' && dirty) {
      persist();
    }
    prevPageRef.current = page;
  }, [page]);

  // 是否正在处理 popstate（避免重复 push）
  const handlingPop = useRef(false);

  // 导航方法
  const pushPage = useCallback((newPage) => {
    if (animating) return;
    setAnimDir('forward');
    setAnimating(true);
    setPageHistory(prev => [...prev, page]);
    setPage(newPage);
    if (!handlingPop.current) {
      history.pushState({ msPage: newPage }, '');
    }
    setTimeout(() => setAnimating(false), 300);
  }, [page, animating]);

  const popPage = useCallback(() => {
    if (animating || pageHistory.length === 0) return;
    setAnimDir('back');
    setAnimating(true);
    const prev = pageHistory[pageHistory.length - 1];
    setPageHistory(prev => prev.slice(0, -1));
    setPage(prev);
    setTimeout(() => setAnimating(false), 300);
  }, [animating, pageHistory]);

  // 监听系统返回键/右划：回退 MobileStack 内部页面
  useEffect(() => {
    const onPop = (e) => {
      if (e.state?.msPage && pageHistory.length > 0) {
        handlingPop.current = true;
        popPage();
        setTimeout(() => { handlingPop.current = false; }, 100);
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [pageHistory.length, popPage]);

  // 手机端禁用长按菜单（避免和拖拽冲突）
  useEffect(() => {
    const prevent = (e) => e.preventDefault();
    document.addEventListener('contextmenu', prevent);
    return () => document.removeEventListener('contextmenu', prevent);
  }, []);

  // 触摸手势
  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };
  const handleTouchEnd = (e) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    // 右滑 > 80px 且水平为主方向
    if (dx > 80 && Math.abs(dx) > Math.abs(dy) * 1.5 && pageHistory.length > 0) {
      popPage();
    }
  };

  // ==== 书籍操作 ====
  const handleAddBook = () => {
    const b = addBook('新书籍');
    setSelectedBookId(b.id);
    pushPage('chapters');
  };

  const handleSelectBook = (bookId) => {
    setSelectedBookId(bookId);
    pushPage('chapters');
  };

  // ==== 章节操作 ====
  const handleAddChapter = (parentId = null) => {
    if (!selectedBookId) return;
    const ch = addChapter(selectedBookId, '', parentId);
    setSelectedChapterId(ch.id);
    setEditorContent(ch.content || INDENT);
    prevCountRef.current = (ch.content || '').replace(/\s/g, '').length;
    pushPage('editor');
  };

  const handleSelectChapter = (chapterId) => {
    setSelectedChapterId(chapterId);
    const ch = chapters.find(c => c.id === chapterId);
    setEditorContent(ch?.content || INDENT);
    prevCountRef.current = (ch?.content || '').replace(/\s/g, '').length;
    pushPage('editor');
  };

  // ==== 编辑器操作 ====
  const handleContentChange = (newContent) => {
    const prev = prevCountRef.current;
    const next = newContent.replace(/\s/g, '').length;
    const delta = next - prev;
    if (delta !== 0) addDailyCount(delta);
    prevCountRef.current = next;
    setEditorContent(newContent);
    if (selectedBookId && selectedChapterId) {
      updateChapterContent(selectedBookId, selectedChapterId, newContent);
    }
  };

  const wordCount = (editorContent || '').replace(/\s/g, '').length;
  const today = new Date().toISOString().slice(0, 10);
  const todayCount = dailyCounts[today] || 0;

  // 查找替换
  const doFind = (search) => {
    if (!search) { setFindResults([]); setCurrentFindIdx(-1); return; }
    const results = [];
    let idx = editorContent.indexOf(search);
    while (idx !== -1) { results.push(idx); idx = editorContent.indexOf(search, idx + 1); }
    setFindResults(results);
    setCurrentFindIdx(results.length > 0 ? 0 : -1);
  };

  const handleReplaceAll = () => {
    if (!findText) return;
    handleContentChange(editorContent.split(findText).join(replaceText));
    setFindResults([]); setCurrentFindIdx(-1);
  };

  const handleBottomTab = (tabKey) => {
    if (tabKey === 'fun') {
      setShowFunMenu(true);
    } else if (tabKey === 'books') {
      setPage('books'); setPageHistory([]);
      setSelectedChapterId(null);
    } else {
      onTabChange(tabKey);
    }
  };

  const handleFunAction = useCallback((key) => {
    setShowFunMenu(false);
    if (key === 'quicknote') setQuickNoteOpen(true);
    else if (key === 'filmnote') setFilmNoteOpen(true);
    else if (key === 'gacha') setGachaOpen(true);
    else if (key === 'calendar') setCalendarOpen(true);
    else if (key === 'trash') setTrashOpen(true);
  }, []);

  // 按 parentId 排序章节树
  const topChapters = chapters.filter(c => !c.parentId).sort((a, b) => a.order - b.order);
  const getChildren = (parentId) => chapters.filter(c => c.parentId === parentId).sort((a, b) => a.order - b.order);

  const renderChapterRows = (parentId = null, depth = 0) => {
    const list = parentId ? getChildren(parentId) : topChapters;
    return list.map(ch => (
      <div key={ch.id}>
        <div
          data-cid={ch.id}
          className={`ms-chapter-row ${selectedChapterId === ch.id ? 'active' : ''}`}
          style={{ paddingLeft: 16 + depth * 20 }}
          onClick={() => {
            if (batchMode) {
              setSelectedIds(prev => {
                const next = new Set(prev);
                next.has(ch.id) ? next.delete(ch.id) : next.add(ch.id);
                return next;
              });
            } else {
              handleSelectChapter(ch.id);
            }
          }}
        >
          {batchMode && <input type="checkbox" checked={selectedIds.has(ch.id)} readOnly
            style={{width:18,height:18,accentColor:'var(--pink)',flexShrink:0}} />}
          <span className="ms-chapter-title">{ch.title}</span>
          <span className="ms-chapter-count">{(ch.content || '').replace(/\s/g, '').length}字</span>
          {!batchMode && (
          <span style={{flexShrink:0,fontSize:18,color:'var(--text3)',cursor:'grab',padding:'0 4px',userSelect:'none',touchAction:'none'}}
            onTouchStart={(e) => {
              e.stopPropagation(); e.preventDefault();
              const el = e.currentTarget.closest('.ms-chapter-row');
              if (!el) return;
              el.style.opacity = '0.5'; el.style.background = 'var(--pink3)';
              const startY = e.touches[0].clientY;
              const ghost = document.createElement('div');
              ghost.className = 'touch-ghost';
              ghost.textContent = ch.title;
              ghost.style.left = '10px'; ghost.style.top = startY + 'px';
              document.body.appendChild(ghost);
              const move = (ev) => {
                ghost.style.top = ev.touches[0].clientY + 'px';
                const rows = [...document.querySelectorAll('.ms-chapter-row')];
                rows.forEach(r => { r.style.borderTop = ''; r.style.borderBottom = ''; });
                const midY = ev.touches[0].clientY;
                let target = null;
                for (const r of rows) {
                  const rect = r.getBoundingClientRect();
                  if (midY > rect.top && midY < rect.bottom) { target = r; break; }
                }
                if (target && target !== el) target.style.borderTop = '2px solid var(--pink)';
              };
              const end = (ev) => {
                document.removeEventListener('touchmove', move);
                document.removeEventListener('touchend', end);
                el.style.opacity = ''; el.style.background = '';
                ghost.remove();
                document.querySelectorAll('.ms-chapter-row').forEach(r => { r.style.borderTop = ''; });
                const endY = ev.changedTouches[0].clientY;
                const allRows = [...document.querySelectorAll('.ms-chapter-row')];
                let targetIdx = -1;
                for (let i = 0; i < allRows.length; i++) {
                  const rect = allRows[i].getBoundingClientRect();
                  if (endY > rect.top && endY < rect.bottom) { targetIdx = i; break; }
                }
                if (targetIdx < 0 || allRows[targetIdx] === el) return;
                const targetEl = allRows[targetIdx];
                const targetId = targetEl.getAttribute('data-cid');
                if (!targetId || targetId === ch.id) return;
                const siblings = chapters.filter(c => c.parentId === ch.parentId).sort((a,b) => a.order - b.order);
                const ids = siblings.map(c => c.id);
                const fromIdx = ids.indexOf(ch.id);
                const toIdx = ids.indexOf(targetId);
                if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return;
                ids.splice(fromIdx, 1);
                ids.splice(toIdx, 0, ch.id);
                reorderChapters(selectedBookId, ids);
              };
              document.addEventListener('touchmove', move, {passive: false});
              document.addEventListener('touchend', end);
            }}>⋮⋮</span>
          )}
        </div>
        {getChildren(ch.id).length > 0 && renderChapterRows(ch.id, depth + 1)}
      </div>
    ));
  };

  // ======== 渲染每个页面 ========
  const renderPage = () => {
    switch (page) {
      case 'books':
        return (
          <div className="ms-page" key="books">
            <div className="ms-header">
              <h1 className="ms-header-title"><CatIcon name="books" size={20} /> 我的书架</h1>
              <button className="ms-header-btn" onClick={() => { setBookBatchMode(!bookBatchMode); setSelectedBooks(new Set()); }}
                style={{background:bookBatchMode?'var(--pink)':'var(--pink3)',color:bookBatchMode?'#fff':'var(--text)',fontWeight:800,fontSize:bookBatchMode?16:20}}>
                {bookBatchMode ? '✕' : '☰'}
              </button>
              {!bookBatchMode && <button className="ms-header-btn" onClick={handleAddBook} style={{fontSize:22}}>
                ＋
              </button>}
            </div>

            {/* 书籍批量操作栏 */}
            {bookBatchMode && (
              <div className="batch-bar" style={{padding:'6px 12px',gap:6,flexWrap:'wrap'}}>
                <button className="tb-btn" onClick={() => {
                  if (selectedBooks.size === books.length) setSelectedBooks(new Set());
                  else setSelectedBooks(new Set(books.map(b => b.id)));
                }}>全选</button>
                <button className="tb-btn" onClick={() => setSelectedBooks(new Set())}>清空</button>
                {selectedBooks.size > 0 && (
                  <button className="tb-btn" style={{color:'#d44'}} onClick={() => {
                    if (confirm(`删除选中的 ${selectedBooks.size} 本书？`)) {
                      selectedBooks.forEach(id => deleteBook(id));
                      setSelectedBooks(new Set());
                      setBookBatchMode(false);
                    }
                  }}>🗑 删除 ({selectedBooks.size})</button>
                )}
              </div>
            )}

            <div className="ms-book-list">
              {books.length === 0 ? (
                <div className="ms-empty">
                  <span style={{fontSize:48}}>📭</span>
                  <p>还没有书籍呢~</p>
                  <p className="ms-hint">点击右上角 + 创建第一本书</p>
                </div>
              ) : (
                books.map(b => (
                  <div key={b.id} className="ms-book-card"
                    onClick={() => { if (bookBatchMode) { setSelectedBooks(prev => { const next = new Set(prev); if (next.has(b.id)) next.delete(b.id); else next.add(b.id); return next; }); } else if (!editingBookId) handleSelectBook(b.id); }}
                    onContextMenu={(e) => { e.preventDefault(); setEditingBookId(b.id); }}
                    onTouchStart={(e) => {
                      const timer = setTimeout(() => { setEditingBookId(b.id); }, 600);
                      e.currentTarget._longPress = timer;
                    }}
                    onTouchEnd={(e) => { clearTimeout(e.currentTarget._longPress); }}
                    onTouchMove={(e) => { clearTimeout(e.currentTarget._longPress); }}
                  >
                    {bookBatchMode && (
                      <input type="checkbox" className="card-check" checked={selectedBooks.has(b.id)} readOnly style={{flexShrink:0,width:20,height:20,accentColor:'var(--pink)'}} />
                    )}
                    <div className="ms-book-cover" onClick={e => { e.stopPropagation(); document.getElementById(`ms-cover-${b.id}`)?.click(); }} title="点击换封面">
                      <BookCoverImg bookId={b.id} cover={b.cover} size={44} />
                      <input id={`ms-cover-${b.id}`} type="file" accept="image/*" style={{display:'none'}}
                        onChange={e => {
                          const file = e.target.files[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = () => setBookCover(b.id, reader.result);
                          reader.readAsDataURL(file);
                        }} />
                    </div>
                    <div className="ms-book-info">
                      {editingBookId === b.id ? (
                        <input className="dir-inline-edit" defaultValue={b.title} autoFocus
                          onBlur={e => { renameBook(b.id, e.target.value || b.title); setEditingBookId(null); }}
                          onKeyDown={e => { if (e.key === 'Enter') { renameBook(b.id, e.target.value || b.title); setEditingBookId(null); }}}
                          onClick={e => e.stopPropagation()} style={{flex:1}} />
                      ) : (
                        <div className="ms-book-title">
                          {b.title}
                        </div>
                      )}
                      <div className="ms-book-meta">{(b.chapters || []).length} 章 · 创建于 {new Date(b.createdAt).toLocaleDateString('zh-CN')}</div>
                    </div>
                    <span className="ms-book-arrow">›</span>
                  </div>
                ))
              )}
            </div>
          </div>
        );

      case 'chapters':
        return (
          <div className="ms-page" key="chapters">
            <div className="ms-header">
              <button className="ms-back-btn" onClick={popPage}>‹ 书架</button>
              <h1 className="ms-header-title">{book?.title || ''}</h1>
              <button className="ms-header-btn" onClick={() => { setBatchMode(!batchMode); setSelectedIds(new Set()); }}
                style={{background:batchMode?'var(--pink)':'var(--pink3)',color:batchMode?'#fff':'var(--text)',fontWeight:800,fontSize:batchMode?16:20}}>
                {batchMode ? '✕' : '☰'}
              </button>
              {!batchMode && <button className="ms-header-btn" onClick={() => handleAddChapter()} style={{fontSize:22}}>
                ＋
              </button>}
            </div>

            {/* 批量操作栏 */}
            {batchMode && (
              <div className="batch-bar" style={{padding:'6px 12px',gap:6,flexWrap:'wrap'}}>
                <button className="tb-btn" onClick={() => {
                  chapters.forEach(c => setSelectedIds(prev => new Set([...prev, c.id])));
                }}>全选</button>
                <button className="tb-btn" onClick={() => setSelectedIds(new Set())}>清空</button>
                <button className="tb-btn" style={{color:'#d44'}} onClick={() => {
                  if (selectedIds.size === 0) return;
                  if (!confirm(`删除选中的 ${selectedIds.size} 个章节？`)) return;
                  selectedIds.forEach(id => deleteChapter(selectedBookId, id));
                  setSelectedIds(new Set());
                  setBatchMode(false);
                }}>🗑 删 {selectedIds.size}</button>
                <button className="tb-btn" onClick={() => {
                  const sel = chapters.filter(c => selectedIds.has(c.id));
                  if (sel.length === 0) return alert('请先选中章节');
                  let t = '';
                  sel.sort((a,b)=>a.order-b.order).forEach(c => {
                    t += `\n第${c.order+1}章 ${c.title}\n${'─'.repeat(16)}\n${c.content||''}\n`;
                  });
                  const b = new Blob(['﻿'+t],{type:'text/plain;charset=utf-8'});
                  const a = document.createElement('a');
                  a.href = URL.createObjectURL(b);
                  a.download = `${book?.title||'导出'}_${sel.length}章.txt`;
                  a.click();
                }}>📥 导出选中</button>
                <button className="tb-btn" style={{fontWeight:700}} onClick={() => {
                  if (!book) return;
                  let t = `《${book.title}》\n${'='.repeat(30)}\n`;
                  chapters.sort((a,b)=>a.order-b.order).forEach(c => {
                    t += `\n第${c.order+1}章 ${c.title}\n${'─'.repeat(16)}\n${c.content||''}\n`;
                  });
                  const b = new Blob(['﻿'+t],{type:'text/plain;charset=utf-8'});
                  const a = document.createElement('a');
                  a.href = URL.createObjectURL(b);
                  a.download = `${book.title}.txt`;
                  a.click();
                }}>📖 导出本书</button>
              </div>
            )}

            <div className="ms-chapter-list">
              {chapters.length === 0 ? (
                <div className="ms-empty">
                  <span style={{fontSize:40}}>📝</span>
                  <p>还没有章节~</p>
                  <p className="ms-hint">点击右上角 ＋ 创建第一章</p>
                </div>
              ) : (
                renderChapterRows()
              )}
            </div>
          </div>
        );

      case 'editor':
        return (
          <div className={`ms-page ms-editor-page${focusMode ? ' focus-mode' : ''}`} key="editor">
            {focusMode && <button className="focus-exit-btn" style={{top:4,right:8,fontSize:11,zIndex:20}} onClick={() => setFocusMode(false)}>✕ 退出</button>}
            <div className="ms-editor-topbar">
              <button className="ms-back-btn" onClick={popPage}>‹ 章节</button>
              <span className="ms-editor-title">{chapter?.title || ''}</span>
              <button className="ms-editor-find-btn" onClick={() => setShowFind(!showFind)}>
                {showFind ? '✕' : '🔍'}
              </button>
            </div>

            {showFind && (
              <div className="ms-find-bar">
                <input placeholder="查找..." value={findText}
                  onChange={e => { setFindText(e.target.value); doFind(e.target.value); }} />
                <span className="ms-find-count">{findText ? `${currentFindIdx + 1}/${findResults.length}` : '-'}</span>
                <input placeholder="替换为..." value={replaceText}
                  onChange={e => setReplaceText(e.target.value)} />
                <button className="ms-btn-sm" onClick={handleReplaceAll}>全部替换</button>
              </div>
            )}

            <textarea
              ref={textareaRef}
              className="ms-editor-textarea"
              value={editorContent}
              onChange={e => handleContentChange(e.target.value)}
              placeholder={INDENT + '( ﾟ∀ﾟ)b 开始创作...'}
              spellCheck={false}
            />

            <div className="ms-editor-footer">
              <span className="ms-word-count">本章 {wordCount} 字</span>
              <span className="ms-word-count ms-today-count">今日 {todayCount} 字</span>
              <button className="ms-fab-btn" onClick={() => setFocusMode(!focusMode)}><CatIcon name="focus" size={18} /></button>
              <button className="ms-fab-btn" onClick={() => setShowFunMenu(true)}>⋯</button>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="mobile-stack" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      {/* 页面容器 */}
      <div className={`ms-page-container ms-dir-${animDir}`}>
        {renderPage()}
      </div>

      {/* 底部标签栏（编辑页不显示完整栏） */}
      {page !== 'editor' && (
        <div className="ms-bottom-bar">
          {bottomTabs.map(tab => (
            <button
              key={tab.key}
              className={`ms-bottom-tab ${(tab.key === 'books' && (page === 'books' || page === 'chapters')) || activeMainTab === tab.key ? 'active' : ''}`}
              onClick={() => handleBottomTab(tab.key)}
            >
              <CatIconButton name={tab.icon} size={22} isActive={(tab.key === 'books' && (page === 'books' || page === 'chapters')) || activeMainTab === tab.key} />
              <span className="ms-bottom-label">{tab.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* 各种弹窗 */}
      {showFunMenu && <FunMenu onClose={() => setShowFunMenu(false)} onAction={handleFunAction} />}
      <Suspense fallback={null}>
        {gachaOpen && <GachaMachine books={books} onClose={() => setGachaOpen(false)} />}
        {quickNoteOpen && <QuickNotes mode="quick" books={books} onClose={() => setQuickNoteOpen(false)} />}
        {filmNoteOpen && <QuickNotes mode="film" books={books} onClose={() => setFilmNoteOpen(false)} />}
        {calendarOpen && (
          <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setCalendarOpen(false)}>
            <div className="cal-modal">
              <button className="modal-close" onClick={() => setCalendarOpen(false)}>✕</button>
              <CalendarView />
            </div>
          </div>
        )}
        {trashOpen && <TrashView onClose={() => setTrashOpen(false)} />}
      </Suspense>
    </div>
  );
}

import React, { useState, useRef } from 'react';
import useStore from '../store';
import ChapterEditor from './ChapterEditor';
import FloatingWindow from './FloatingWindow';
import Icon, { getBookCat, BookCoverImg } from './Icon';
export default function DirectoryView({ selectedBookId, selectedChapterId, onSelectBook, onSelectChapter, onCalendarClick }) {
  const { books, addBook, deleteBook, renameBook, addChapter, deleteChapter, renameChapter, setBookCover, reorderChapters } = useStore();
  const [expandedBooks, setExpandedBooks] = useState({});
  const [expandedChapters, setExpandedChapters] = useState({});
  const [editingBookId, setEditingBookId] = useState(null);
  const [editingChapterId, setEditingChapterId] = useState(null);
  const [floatingWindow, setFloatingWindow] = useState(null);
  const [collapsed, setCollapsed] = useState(false);
  const [selectedChapters, setSelectedChapters] = useState(new Set());
  const [bookBatchMode, setBookBatchMode] = useState(false);
  const [selectedBooks, setSelectedBooks] = useState(new Set());
  const [dragId, setDragId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const chapterRefs = useRef({});

  const book = books.find(b => b.id === selectedBookId);
  const chapters = book?.chapters || [];
  const chapter = chapters.find(c => c.id === selectedChapterId);

  const toggleBook = (bookId) => {
    setExpandedBooks(prev => ({ ...prev, [bookId]: !prev[bookId] }));
    onSelectBook(bookId);
  };

  const toggleChapter = (chapterId) => {
    setExpandedChapters(prev => ({ ...prev, [chapterId]: !prev[chapterId] }));
  };

  const handleAddBook = () => {
    const b = addBook('新书籍');
    setExpandedBooks(prev => ({ ...prev, [b.id]: true }));
    onSelectBook(b.id);
  };

  const handleAddChapter = (targetBookId, parentId = null) => {
    const ch = addChapter(targetBookId, '', parentId);
    setExpandedBooks(prev => ({ ...prev, [targetBookId]: true }));
    if (parentId) {
      setExpandedChapters(prev => ({ ...prev, [parentId]: true }));
    }
    onSelectChapter(ch.id);
  };

  const hasChildren = (chId) => chapters.some(c => c.parentId === chId);

  const renderChapterTree = (parentId = null, depth = 0) => {
    return chapters
      .filter(c => c.parentId === parentId)
      .sort((a, b) => a.order - b.order)
      .map(ch => {
        const hasKids = hasChildren(ch.id);
        const isExpanded = expandedChapters[ch.id] !== false;
        return (
          <div key={ch.id} style={{ paddingLeft: 4 + depth * 16 }}>
            <div
              ref={el => chapterRefs.current[ch.id] = el}
              className={`dir-chapter-row ${selectedChapterId === ch.id ? 'active' : ''} ${dragOverId === ch.id ? 'drag-over' : ''}`}
              draggable
              onDragStart={(e) => { e.dataTransfer.setData('text/plain', ch.id); setDragId(ch.id); }}
              onDragEnd={() => { setDragId(null); setDragOverId(null); }}
              onDragOver={(e) => { e.preventDefault(); setDragOverId(ch.id); }}
              onDragLeave={() => setDragOverId(null)}
              onDrop={(e) => {
                e.preventDefault(); setDragOverId(null);
                const fromId = e.dataTransfer.getData('text/plain');
                if (fromId === ch.id) return;
                const ordered = chapters.filter(c => !c.parentId).sort((a,b) => a.order - b.order).map(c => c.id);
                const fromIdx = ordered.indexOf(fromId);
                const toIdx = ordered.indexOf(ch.id);
                ordered.splice(fromIdx, 1);
                ordered.splice(toIdx, 0, fromId);
                reorderChapters(selectedBookId, ordered);
              }}
              onClick={() => onSelectChapter(ch.id)}
              onContextMenu={(e) => {
                e.preventDefault(); e.stopPropagation();
                onSelectChapter(ch.id);
                const rect = chapterRefs.current[ch.id]?.getBoundingClientRect();
                setFloatingWindow({
                  x: rect ? rect.right + 10 : e.clientX,
                  y: rect ? rect.top : e.clientY,
                  chapterId: ch.id, bookId: selectedBookId,
                });
              }}
            >
              <input type="checkbox" className="card-check" style={{width:14,height:14,flexShrink:0}}
                checked={selectedChapters.has(ch.id)}
                onChange={e => { e.stopPropagation();
                  const next = new Set(selectedChapters);
                  e.target.checked ? next.add(ch.id) : next.delete(ch.id);
                  setSelectedChapters(next);
                }}
                onClick={e => e.stopPropagation()}
              />
              <span className="dir-expand-icon" onClick={(e) => { e.stopPropagation(); toggleChapter(ch.id); }}>
                {hasKids ? (isExpanded ? '▼' : '▶') : '　'}
              </span>
              {editingChapterId === ch.id ? (
                <input className="dir-inline-edit" defaultValue={ch.title}
                  onBlur={(e) => { renameChapter(selectedBookId, ch.id, e.target.value || ch.title); setEditingChapterId(null); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { renameChapter(selectedBookId, ch.id, e.target.value || ch.title); setEditingChapterId(null); }}}
                  autoFocus onClick={e => e.stopPropagation()} />
              ) : (
                <span className="dir-chapter-title" onDoubleClick={(e) => { e.stopPropagation(); setEditingChapterId(ch.id); }}>
                  {ch.title}
                </span>
              )}
              <div className="dir-chapter-actions">
                {depth < 3 && (
                  <button className="dir-btn" title="子章节" onClick={(e) => { e.stopPropagation(); handleAddChapter(selectedBookId, ch.id); }}>+</button>
                )}
                <button className="dir-btn dir-btn-del" title="删除（移入回收站）" onClick={(e) => { e.stopPropagation(); deleteChapter(selectedBookId, ch.id); if (selectedChapterId === ch.id) onSelectChapter(null); }}>×</button>
              </div>
            </div>
            {hasKids && isExpanded && renderChapterTree(ch.id, depth + 1)}
          </div>
        );
      });
  };

  return (
    <div className="directory-view">
      <div className={`dir-sidebar ${collapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          <span style={{fontSize:14}}></span>
          <span>书籍</span>
          <div className="sidebar-header-actions">
            <button className="btn-icon" onClick={handleAddBook} title="新建书籍">+</button>
            <button className={`btn-icon ${bookBatchMode ? 'active' : ''}`} onClick={() => { setBookBatchMode(!bookBatchMode); setSelectedBooks(new Set()); }} title="批量管理">
              ☰
            </button>
            <button className="btn-icon" onClick={() => setCollapsed(!collapsed)} title={collapsed ? '展开' : '收起'}>
              {collapsed ? '▶' : '◀'}
            </button>
          </div>
        </div>

        {/* 书籍批量操作栏 */}
        {bookBatchMode && (
          <div className="batch-bar" style={{padding:'4px 10px',borderBottom:'1px solid var(--border)'}}>
            <button className="tb-btn" onClick={() => {
              if (selectedBooks.size === books.length) setSelectedBooks(new Set());
              else setSelectedBooks(new Set(books.map(b => b.id)));
            }}>{selectedBooks.size === books.length ? '取消全选' : '☑ 全选'}</button>
            {selectedBooks.size > 0 && (
              <button className="tb-btn" style={{color:'#d44'}} onClick={() => {
                if (confirm(`删除选中的 ${selectedBooks.size} 本书？\n（书籍及其中所有章节将永久删除）`)) {
                  selectedBooks.forEach(id => { deleteBook(id); if (selectedBookId === id) { onSelectBook(null); onSelectChapter(null); } });
                  setSelectedBooks(new Set());
                }
              }}>🗑 删除 ({selectedBooks.size})</button>
            )}
            <span className="tb-info">已选 {selectedBooks.size}/{books.length}</span>
          </div>
        )}

        {books.map(b => (
          <div key={b.id} className="dir-book-group">
            <div
              className={`dir-book-item ${selectedBookId === b.id ? 'active' : ''} ${expandedBooks[b.id] ? 'expanded' : ''}`}
              onClick={() => { if (bookBatchMode) { setSelectedBooks(prev => { const next = new Set(prev); if (next.has(b.id)) next.delete(b.id); else next.add(b.id); return next; }); } else toggleBook(b.id); }}
            >
              {bookBatchMode && (
                <input type="checkbox" className="card-check" checked={selectedBooks.has(b.id)} readOnly style={{marginRight:4}} />
              )}
              <span className="dir-expand-icon">{expandedBooks[b.id] ? '▼' : '▶'}</span>
              {editingBookId === b.id ? (
                <input className="dir-inline-edit" defaultValue={b.title}
                  onBlur={(e) => { renameBook(b.id, e.target.value || b.title); setEditingBookId(null); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { renameBook(b.id, e.target.value || b.title); setEditingBookId(null); }}}
                  autoFocus onClick={e => e.stopPropagation()} />
              ) : (
                <span className="dir-book-title" onDoubleClick={() => setEditingBookId(b.id)}>
                  <span className="dir-book-cover" onClick={e => { e.stopPropagation(); document.getElementById(`cover-input-${b.id}`)?.click(); }} title="点击更换封面">
                    <BookCoverImg bookId={b.id} cover={b.cover} size={26} />
                  </span>
                  {b.title}
                  <button className="dir-btn" style={{marginLeft:4}} onClick={e => { e.stopPropagation(); setEditingBookId(b.id); }} title="改名"></button>
                  <input id={`cover-input-${b.id}`} type="file" accept="image/*" style={{display:'none'}}
                    onChange={e => {
                      const file = e.target.files[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => setBookCover(b.id, reader.result);
                      reader.readAsDataURL(file);
                    }} />
                </span>
              )}
              <span className="dir-book-count">{(b.chapters || []).length}</span>
              {b === book && expandedBooks[b.id] && (
                <div className="dir-book-inline-actions">
                  <button className="dir-btn dir-btn-add" title="新章节" onClick={(e) => { e.stopPropagation(); handleAddChapter(b.id); }}>+</button>
                  {chapters.length > 0 && (
                    <button className="dir-btn" title={selectedChapters.size === chapters.length ? '取消全选' : '全选章节'}
                      onClick={(e) => { e.stopPropagation();
                        if (selectedChapters.size === chapters.length) setSelectedChapters(new Set());
                        else setSelectedChapters(new Set(chapters.map(c => c.id)));
                      }}>{selectedChapters.size === chapters.length ? '☑' : '☐'}</button>
                  )}
                  {selectedChapters.size > 0 && (
                    <button className="dir-btn dir-btn-del" title={`删除选中(${selectedChapters.size})`}
                      onClick={(e) => { e.stopPropagation();
                        if (confirm(`删除 ${selectedChapters.size} 个章节？`)) {
                          selectedChapters.forEach(id => deleteChapter(b.id, id));
                          setSelectedChapters(new Set());
                        }
                      }}>🗑{selectedChapters.size}</button>
                  )}
                </div>
              )}
              <button className="dir-btn dir-btn-del" title="删除" onClick={(e) => { e.stopPropagation(); if (confirm(`删除"${b.title}"？`)) { deleteBook(b.id); if (selectedBookId === b.id) { onSelectBook(null); onSelectChapter(null); }}}}>×</button>
            </div>

            {expandedBooks[b.id] && (
              <div className="dir-book-chapters">
                {b === book && renderChapterTree()}
                {b !== book && <div className="dir-chapter-placeholder" onClick={() => onSelectBook(b.id)}>点击展开查看章节</div>}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 侧栏折叠时显示展开按钮 */}
      {collapsed && (
        <button className="dir-toggle-btn" onClick={() => setCollapsed(false)} title="展开侧栏">▶</button>
      )}

      <div className="dir-editor">
        {chapter ? (
          <ChapterEditor bookId={selectedBookId} chapter={chapter} books={books} onCalendarClick={onCalendarClick} />
        ) : (
          <div className="empty-view">
            <span style={{fontSize:40}}></span>
            <p>( ﾟ 3ﾟ) 选择或创建一个章节开始写作吧~</p>
            <p className="hint">✧ 点击左侧 ▶ 展开书籍目录 ✧</p>
          </div>
        )}
      </div>

      {floatingWindow && (
        <FloatingWindow x={floatingWindow.x} y={floatingWindow.y} bookId={floatingWindow.bookId}
          chapterId={floatingWindow.chapterId} onClose={() => setFloatingWindow(null)} />
      )}
    </div>
  );
}

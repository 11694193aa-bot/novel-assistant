import React, { useState, useRef } from 'react';
import useStore from '../store';
import ChapterEditor from './ChapterEditor';
import FloatingWindow from './FloatingWindow';
export default function DirectoryView({ selectedBookId, selectedChapterId, onSelectBook, onSelectChapter, onCalendarClick }) {
  const { books, addBook, deleteBook, renameBook, addChapter, deleteChapter, renameChapter } = useStore();
  const [expandedBooks, setExpandedBooks] = useState({});
  const [expandedChapters, setExpandedChapters] = useState({});
  const [editingBookId, setEditingBookId] = useState(null);
  const [editingChapterId, setEditingChapterId] = useState(null);
  const [newBookTitle, setNewBookTitle] = useState('');
  const [showAddBook, setShowAddBook] = useState(false);
  const [floatingWindow, setFloatingWindow] = useState(null);
  const [collapsed, setCollapsed] = useState(false);
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
    if (newBookTitle.trim()) {
      const b = addBook(newBookTitle.trim());
      setNewBookTitle(''); setShowAddBook(false);
      setExpandedBooks(prev => ({ ...prev, [b.id]: true }));
      onSelectBook(b.id);
    }
  };

  const handleAddChapter = (targetBookId, parentId = null) => {
    // 直接创建，自动命名为"第N章"
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
              className={`dir-chapter-row ${selectedChapterId === ch.id ? 'active' : ''}`}
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
              <span className="dir-expand-icon" onClick={(e) => { e.stopPropagation(); toggleChapter(ch.id); }}>
                {hasKids ? (isExpanded ? '▼' : '▶') : '　'}
              </span>
              <span className="dir-icon">{depth === 0 ? '📖' : '📄'}</span>
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
          <span style={{fontSize:14}}>📚</span>
          <span>书籍</span>
          <div className="sidebar-header-actions">
            <button className="btn-icon" onClick={() => { setShowAddBook(true); setNewBookTitle(''); }} title="新建">+</button>
            <button className="btn-icon" onClick={() => setCollapsed(!collapsed)} title={collapsed ? '展开' : '收起'}>
              {collapsed ? '▶' : '◀'}
            </button>
          </div>
        </div>

        {showAddBook && (
          <div className="dir-add-form">
            <input placeholder="书名..." value={newBookTitle} onChange={e => setNewBookTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddBook()} autoFocus />
            <div className="dir-add-actions">
              <button onClick={handleAddBook}>✓</button>
              <button onClick={() => { setShowAddBook(false); setNewBookTitle(''); }}>✕</button>
            </div>
          </div>
        )}

        {books.map(b => (
          <div key={b.id} className="dir-book-group">
            <div
              className={`dir-book-item ${selectedBookId === b.id ? 'active' : ''} ${expandedBooks[b.id] ? 'expanded' : ''}`}
              onClick={() => toggleBook(b.id)}
            >
              <span className="dir-expand-icon">{expandedBooks[b.id] ? '▼' : '▶'}</span>
              {editingBookId === b.id ? (
                <input className="dir-inline-edit" defaultValue={b.title}
                  onBlur={(e) => { renameBook(b.id, e.target.value || b.title); setEditingBookId(null); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { renameBook(b.id, e.target.value || b.title); setEditingBookId(null); }}}
                  autoFocus onClick={e => e.stopPropagation()} />
              ) : (
                <span className="dir-book-title" onDoubleClick={() => setEditingBookId(b.id)}>📘 {b.title}</span>
              )}
              <span className="dir-book-count">{(b.chapters || []).length}</span>
              <button className="dir-btn dir-btn-del" title="删除" onClick={(e) => { e.stopPropagation(); if (confirm(`删除"${b.title}"？`)) { deleteBook(b.id); if (selectedBookId === b.id) { onSelectBook(null); onSelectChapter(null); }}}}>×</button>
            </div>

            {expandedBooks[b.id] && (
              <div className="dir-book-chapters">
                {b === book && (
                  <div className="dir-chapter-toolbar">
                    <button className="btn-add-chapter-sm" onClick={() => handleAddChapter(b.id)}>+ 新章节</button>
                  </div>
                )}
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
            <span style={{fontSize:40}}>📚</span>
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

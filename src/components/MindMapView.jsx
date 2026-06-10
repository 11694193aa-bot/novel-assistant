import React, { useState, useEffect, useRef } from 'react';
import useStore, { uid } from '../store';
import mammoth from 'mammoth';
import Icon, { getBookCat, BookCoverImg } from './Icon';

export default function MindMapView({ books, selectedBookId, onSelectBook, focusCardId, onFocusCard, isMobile, focusMode: extFocus, onSetFocus }) {
  const { addBook, renameBook, deleteBook, addMindMapCard, deleteMindMapCard, updateMindMapCard, moveMindMapCard, addMindMapCards, setBookCover } = useStore();
  const [collapsed, setCollapsed] = useState(false);
  const [innerFocus, setInnerFocus] = useState(false);
  const focusMode = extFocus !== undefined ? extFocus : innerFocus;
  const setFocus = onSetFocus || ((v) => setInnerFocus(v));

  useEffect(() => {
    if (focusMode) document.body.classList.add('mindmap-focus');
    else document.body.classList.remove('mindmap-focus');
    return () => document.body.classList.remove('mindmap-focus');
  }, [focusMode]);
  const [dragOverId, setDragOverId] = useState(null);
  const [draggedId, setDraggedId] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [bookBatchMode, setBookBatchMode] = useState(false);
  const [selectedBooks, setSelectedBooks] = useState(new Set());
  const [editingBookId, setEditingBookId] = useState(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);
  const prevBookRef = useRef(null);
  // 触摸拖拽状态
  const [touchDragId, setTouchDragId] = useState(null);
  const [touchGhostPos, setTouchGhostPos] = useState(null);
  const touchStartRef = useRef(null);
  const touchDragRef = useRef(null);
  const touchSafetyRef = useRef(null);

  const book = books.find(b => b.id === selectedBookId);

  // 自动选中上次打开的书
  useEffect(() => {
    if (books.length > 0 && !selectedBookId) {
      if (prevBookRef.current && books.find(b => b.id === prevBookRef.current)) {
        onSelectBook(prevBookRef.current);
      } else {
        onSelectBook(books[0].id);
      }
    }
  }, [books, selectedBookId]);

  useEffect(() => {
    if (selectedBookId) prevBookRef.current = selectedBookId;
  }, [selectedBookId]);

  // ==== 书籍操作 ====
  const handleAddBook = () => {
    const b = addBook('新书籍');
    onSelectBook(b.id);
  };

  // ==== 卡片操作 ====
  const handleAddParent = () => {
    if (!selectedBookId) return;
    addMindMapCard(selectedBookId, '新卡片', '');
  };

  const handleAddChild = (parentId) => {
    if (!selectedBookId) return;
    addMindMapCard(selectedBookId, '', '', parentId);
  };

  const handleDelete = (cardId) => {
    deleteMindMapCard(selectedBookId, cardId); // 移入回收站，无需确认
  };

  // ==== 拖拽 ====
  const handleDragStart = (e, card) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ cardId: card.id }));
    setDraggedId(card.id);
  };
  const handleDragEnd = () => { setDraggedId(null); setDragOverId(null); };
  const handleDragOver = (e, card) => {
    e.preventDefault();
    if (draggedId && draggedId !== card.id) setDragOverId(card.id);
  };
  // 递归查找卡片
  const findCardById = (cards, id) => {
    for (const c of cards) {
      if (c.id === id) return c;
      const found = findCardById(c.children || [], id);
      if (found) return found;
    }
    return null;
  };
  // 检查 targetId 是否是 ancestorId 的子孙
  const isDescendantOf = (cards, ancestorId, targetId) => {
    const ancestor = findCardById(cards, ancestorId);
    if (!ancestor) return false;
    return !!findCardById(ancestor.children || [], targetId);
  };

  const handleDrop = (e, targetCard) => {
    e.preventDefault(); setDragOverId(null); setDraggedId(null);
    try {
      const { cardId } = JSON.parse(e.dataTransfer.getData('text/plain'));
      if (!cardId || cardId === targetCard.id) return;
      const allCards = book?.mindMapCards || [];
      if (isDescendantOf(allCards, cardId, targetCard.id)) return;
      moveMindMapCard(selectedBookId, cardId, targetCard.id);
    } catch (err) { /* ignore */ }
  };

  // ==== 触摸拖拽（手机端） ====
  const clearTouchDrag = () => {
    setTouchDragId(null);
    setTouchGhostPos(null);
    setDragOverId(null);
    touchStartRef.current = null;
    clearTimeout(touchDragRef.current);
    clearTimeout(touchSafetyRef.current);
  };

  const handleTouchDragStart = (e, card) => {
    e.stopPropagation();
    clearTouchDrag();
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, cardId: card.id };
    touchDragRef.current = setTimeout(() => {
      setTouchDragId(card.id);
      setTouchGhostPos({ x: e.touches[0].clientX, y: e.touches[0].clientY });
      // 安全超时：5秒后强制清除拖拽状态
      touchSafetyRef.current = setTimeout(clearTouchDrag, 5000);
    }, 400);
  };
  const handleTouchDragMove = (e) => {
    if (!touchDragId) return;
    setTouchGhostPos({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    // 检测手指下方元素
    const el = document.elementFromPoint(e.touches[0].clientX, e.touches[0].clientY);
    const cardEl = el?.closest('.mm-card');
    if (cardEl) {
      const cardId = cardEl.dataset?.cardId || cardEl.getAttribute('data-card-id');
      if (cardId) setDragOverId(cardId);
      else setDragOverId(null);
    } else {
      setDragOverId(null);
    }
  };
  const handleTouchDragEnd = (e) => {
    if (touchDragId && dragOverId && dragOverId !== touchDragId) {
      const allCards = book?.mindMapCards || [];
      if (!isDescendantOf(allCards, touchDragId, dragOverId)) {
        moveMindMapCard(selectedBookId, touchDragId, dragOverId);
      }
    }
    clearTouchDrag();
  };
  const handleTouchCancel = () => clearTouchDrag();

  // ==== 导入文件 ====
  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedBookId) return;
    setImporting(true);

    try {
      let html = '';
      const ext = file.name.split('.').pop().toLowerCase();

      if (ext === 'docx') {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        html = result.value;
      } else if (ext === 'html' || ext === 'htm') {
        html = await file.text();
      } else {
        // 纯文本
        const text = await file.text();
        html = textToHtml(text);
      }

      const cards = parseHtmlToCards(html);
      if (cards.length > 0) {
        cards.forEach(c => addMindMapCard(selectedBookId, c.title, c.content, c.parentId || null));
      }
    } catch (err) {
      alert('导入失败: ' + err.message);
    }

    setImporting(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // 纯文本→HTML
  const textToHtml = (text) => {
    const lines = text.split('\n');
    let html = '';
    for (const line of lines) {
      const t = line.trim();
      if (!t) continue;
      if (t.startsWith('# ')) html += `<h1>${t.slice(2)}</h1>`;
      else if (t.startsWith('## ')) html += `<h2>${t.slice(3)}</h2>`;
      else if (t.startsWith('### ')) html += `<h3>${t.slice(4)}</h3>`;
      else html += `<p>${t}</p>`;
    }
    return html;
  };

  // HTML→卡片结构
  const parseHtmlToCards = (html) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const cards = [];
    let currentParent = null;

    const walk = (node) => {
      for (const child of node.childNodes) {
        if (child.nodeType !== 1) continue; // skip text nodes
        const tag = child.tagName?.toLowerCase();

        if (['h1', 'h2', 'h3'].includes(tag)) {
          const title = child.textContent.trim();
          if (!title) continue;
          const parentCard = {
            id: uid(),
            title,
            content: '',
            children: [],
            createdAt: Date.now(),
          };
          cards.push(parentCard);
          currentParent = parentCard;
        } else if (['p', 'li', 'div'].includes(tag)) {
          const text = child.textContent.trim();
          if (!text) continue;
          if (currentParent) {
            currentParent.children.push({
              id: uid(),
              title: '',
              content: text,
              parentId: currentParent.id,
              children: [],
              createdAt: Date.now(),
            });
          } else {
            // 没有父卡片时作为独立母卡片
            const card = {
              id: uid(),
              title: text.slice(0, 30),
              content: text,
              children: [],
              createdAt: Date.now(),
            };
            cards.push(card);
          }
        } else {
          walk(child);
        }
      }
    };

    walk(doc.body);
    return cards;
  };

  // 显示卡片操作菜单
  const showCardMenu = (x, y, card, isParentCard) => {
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.visibility = 'hidden';
    menu.style.left = '0'; menu.style.top = '0';
    document.body.appendChild(menu);
    const childCount = card.children?.length || 0;
    menu.innerHTML = `
      <button class="ctx-item">📎 添加子卡片${childCount > 0 ? ' (' + childCount + ')' : ''}</button>
      <button class="ctx-item ctx-delete">🗑️ 删除</button>
    `;
    const mw = menu.offsetWidth, mh = menu.offsetHeight;
    const vw = window.innerWidth, vh = window.innerHeight;
    if (x + mw > vw) x = vw - mw - 10;
    if (y + mh > vh) y = vh - mh - 10;
    if (x < 5) x = 5; if (y < 5) y = 5;
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    menu.style.visibility = 'visible';
    const btns = menu.querySelectorAll('.ctx-item');
    btns.forEach((btn, i) => {
      btn.onclick = () => {
        menu.remove();
        if (i === 0) handleAddChild(card.id);
        if (i === 1) handleDelete(card.id);
      };
    });
    const close = (ev) => { if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener('mousedown', close); document.removeEventListener('touchstart', close); }};
    setTimeout(() => { document.addEventListener('mousedown', close); document.addEventListener('touchstart', close); }, 50);
  };
  // 长按菜单（手机端）
  const cardLongPressRef = useRef({});

  // ==== 渲染卡片 ====
  const renderCard = (card, depth = 0, isMobileView = false) => {
    const isParent = !card.parentId;
    const isDragOver = dragOverId === card.id;
    const isDragging = draggedId === card.id;

    const handleCardTitleClick = (e) => {
      if (isMobileView && isParent && onFocusCard) {
        e.stopPropagation();
        onFocusCard(card.id);
      }
    };

    return (
      <div key={card.id}>
        <div
          className={`mm-card ${isParent ? 'mm-parent' : 'mm-child'} ${isDragOver ? 'mm-dragover' : ''} ${isDragging ? 'mm-dragging' : ''}`}
          style={{ marginLeft: isMobileView ? Math.min(depth, 1) * 16 : Math.min(depth, 2) * 26 }}
          draggable={!isMobileView}
          onDragStart={(e) => !isMobileView && handleDragStart(e, card)}
          onDragEnd={handleDragEnd}
          onDragOver={(e) => {
            if (draggedId && draggedId !== card.id) {
              e.preventDefault();
              setDragOverId(card.id);
            }
          }}
          onDragLeave={() => setDragOverId(null)}
          onDrop={(e) => handleDrop(e, card, depth)}
          data-card-id={card.id}
          onTouchStart={(e) => {
            if (!isMobileView) { handleTouchDragStart(e, card); return; }
            cardLongPressRef.current[card.id] = setTimeout(() => {
              handleTouchDragStart(e, card);
            }, 500);
          }}
          onTouchMove={(e) => {
            if (!isMobileView) { handleTouchDragMove(e); return; }
            if (cardLongPressRef.current[card.id]) { clearTimeout(cardLongPressRef.current[card.id]); delete cardLongPressRef.current[card.id]; }
            if (touchDragId) handleTouchDragMove(e);
          }}
          onTouchEnd={(e) => {
            if (!isMobileView) { handleTouchDragEnd(e); return; }
            if (cardLongPressRef.current[card.id]) { clearTimeout(cardLongPressRef.current[card.id]); delete cardLongPressRef.current[card.id]; }
            handleTouchDragEnd(e);
          }}
          onContextMenu={(e) => { e.preventDefault(); showCardMenu(e.clientX, e.clientY, card, isParent); }}
        >
          {/* 复选框 + 母卡片标题 + 快捷添加 */}
          <div className="mm-card-top">
            <input type="checkbox" className="card-check"
              checked={selected.has(card.id)}
              onChange={e => {
                const next = new Set(selected);
                e.target.checked ? next.add(card.id) : next.delete(card.id);
                setSelected(next);
              }}
              onClick={e => e.stopPropagation()}
            />
            {isParent && (
              <div className="mm-parent-header" onClick={handleCardTitleClick} style={isMobileView ? {cursor:'pointer'} : {}}>
                <input
                  className="mm-title-input"
                  value={card.title}
                  onChange={(e) => updateMindMapCard(selectedBookId, card.id, { title: e.target.value })}
                  placeholder="母卡片标题"
                  onClick={e => isMobileView && e.stopPropagation()}
                />
                <button
                  className="mm-quick-add"
                  onClick={(e) => { e.stopPropagation(); handleAddChild(card.id); }}
                  title="快速添加子卡片"
                >+</button>
              </div>
            )}
          </div>
          {/* 内容 */}
          <textarea
            className="mm-content-input"
            value={card.content || ''}
            onChange={(e) => updateMindMapCard(selectedBookId, card.id, { content: e.target.value })}
            onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
            placeholder={isParent ? '内容...' : '子卡片内容...'}
            ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }}}
          />
          {/* 操作按钮 */}
          <span className="mm-drag-handle" title="操作"
            onClick={(e) => { e.stopPropagation(); showCardMenu(e.clientX, e.clientY, card, isParent); }}
            onTouchStart={(e) => { e.stopPropagation(); }}
            onTouchMove={(e) => { e.stopPropagation(); }}
            onTouchEnd={(e) => { e.stopPropagation(); e.preventDefault(); showCardMenu(e.changedTouches[0].clientX, e.changedTouches[0].clientY, card, isParent); }}>
            ⋮⋮
          </span>
        </div>

        {/* 子卡片组 */}
        {card.children?.length > 0 && (
          <div className="mm-children-group" style={{ marginLeft: isMobileView ? 0 : Math.min(depth + 1, 2) * 26 }}>
            <div className="mm-separator" />
            {card.children.map(child => renderCard(child, depth + 1, isMobileView))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`mindmap-view${focusMode ? ' focus-mode' : ''}`}>
      {focusMode && <button className="focus-float-exit" onClick={() => setFocus(false)}>✕ 退出专注</button>}
      {/* 书籍侧栏 */}
      <div className={`mindmap-sidebar ${collapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          <span>📚</span>
          <span>书籍</span>
          <div className="sidebar-header-actions">
            <button className="btn-icon" onClick={handleAddBook} title="新建书籍">+</button>
            <button className={`btn-icon ${bookBatchMode ? 'active' : ''}`} onClick={() => { setBookBatchMode(!bookBatchMode); setSelectedBooks(new Set()); }} title="批量管理">☰</button>
            <button className="btn-icon" onClick={() => setCollapsed(!collapsed)}>{collapsed ? '▶' : '◀'}</button>
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
                if (confirm(`删除选中的 ${selectedBooks.size} 本书？\n（书籍及其中所有思维导图将永久删除）`)) {
                  selectedBooks.forEach(id => { deleteBook(id); if (selectedBookId === id) onSelectBook(null); });
                  setSelectedBooks(new Set());
                }
              }}>🗑 删除 ({selectedBooks.size})</button>
            )}
            <span className="tb-info">已选 {selectedBooks.size}/{books.length}</span>
          </div>
        )}

        {books.map(b => (
          <div key={b.id} className={`dir-book-item ${selectedBookId === b.id ? 'active' : ''}`}
            onClick={() => { if (bookBatchMode) { setSelectedBooks(prev => { const next = new Set(prev); if (next.has(b.id)) next.delete(b.id); else next.add(b.id); return next; }); } else onSelectBook(b.id); }}>
            {bookBatchMode && (
              <input type="checkbox" className="card-check" checked={selectedBooks.has(b.id)} readOnly style={{marginRight:4,flexShrink:0}} />
            )}
            {editingBookId === b.id ? (
              <input className="dir-inline-edit" defaultValue={b.title}
                onBlur={e => { renameBook(b.id, e.target.value || b.title); setEditingBookId(null); }}
                onKeyDown={e => { if (e.key === 'Enter') { renameBook(b.id, e.target.value || b.title); setEditingBookId(null); }}}
                autoFocus onClick={e => e.stopPropagation()} />
            ) : (
              <span className="dir-book-title" onDoubleClick={(e) => { e.stopPropagation(); setEditingBookId(b.id); }}>
                <span className="dir-book-cover" onClick={e => { e.stopPropagation(); document.getElementById(`mm-cover-${b.id}`)?.click(); }} title="点击换封面">
                  <BookCoverImg bookId={b.id} cover={b.cover} size={20} />
                  <input id={`mm-cover-${b.id}`} type="file" accept="image/*" style={{display:'none'}}
                    onChange={e => {
                      const file = e.target.files[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => setBookCover(b.id, reader.result);
                      reader.readAsDataURL(file);
                    }} />
                </span>
                {' '}{b.title}
                <button className="dir-btn" style={{marginLeft:4}} onClick={e => { e.stopPropagation(); setEditingBookId(b.id); }} title="改名">✏️</button>
              </span>
            )}
            <span className="dir-book-count">{(b.mindMapCards || []).length}</span>
            <button className="dir-btn dir-btn-del" title="删除" onClick={(e) => {
              e.stopPropagation();
              if (confirm(`删除"${b.title}"？`)) {
                deleteBook(b.id);
                if (selectedBookId === b.id) onSelectBook(null);
              }
            }}>×</button>
          </div>
        ))}
      </div>

      {collapsed && <button className="mindmap-toggle-btn" onClick={() => setCollapsed(false)}>▶</button>}

      {/* 画布 */}
      <div className="mindmap-main">
        <div className="mindmap-toolbar">
          <span className="toolbar-title">
            {book ? `${book.title} · 思维导图` : '选择一本书'}
          </span>
          <div style={{display:'flex',gap:6}}>
            <button className="btn btn-import" onClick={() => setFocus(!focusMode)} style={{fontSize:14}}>
              🧘
            </button>
            <button className="btn btn-import" onClick={() => fileInputRef.current?.click()} disabled={!selectedBookId}>
              📥 导入
            </button>
            <button className="btn btn-add-card" onClick={handleAddParent} disabled={!selectedBookId}>
              + 母卡片
            </button>
          </div>
        </div>

        {/* 悬浮快捷栏 */}
        {book && (book.mindMapCards || []).length > 0 && (
          <div className="mm-float-bar">
            <button onClick={handleAddParent}>+ 母卡片</button>
            <span className="mm-float-div">·</span>
            <button onClick={() => fileInputRef.current?.click()}>📥 导入</button>
            <span className="mm-float-count">{book.mindMapCards.length} 卡片</span>
          </div>
        )}

        {/* 批量操作 */}
        {book && (() => {
          const flatten = (cards, out = []) => { cards.forEach(c => { out.push(c); if (c.children) flatten(c.children, out); }); return out; };
          const all = flatten(book.mindMapCards || []);
          return all.length > 0 ? (
            <div className="batch-bar" style={{margin:0,borderBottom:'1px solid var(--border)'}}>
              <button className="tb-btn" onClick={() => setSelected(selected.size === all.length ? new Set() : new Set(all.map(c => c.id)))}>
                {selected.size === all.length ? '☐ 取消全选' : '☑ 全选'}
              </button>
              {selected.size > 0 && (
                <button className="tb-btn" style={{color:'#d44'}} onClick={() => {
                  if (confirm(`删除选中的 ${selected.size} 张卡片？`)) {
                    selected.forEach(id => deleteMindMapCard(selectedBookId, id));
                    setSelected(new Set());
                  }
                }}>🗑 删除选中 ({selected.size})</button>
              )}
              <span className="tb-info">已选 {selected.size}/{all.length}</span>
            </div>
          ) : null;
        })()}

        <div className="mindmap-canvas">
          {importing && <div className="import-overlay">正在导入...</div>}

          {focusCardId ? (() => {
            const focusCard = findCardById(book?.mindMapCards || [], focusCardId);
            if (!focusCard) return <div className="empty-canvas"><p>卡片不存在</p></div>;
            return (
              <div className="mm-focus-view">
                {renderCard(focusCard)}
              </div>
            );
          })() : (
            book?.mindMapCards?.length > 0 ? (
              book.mindMapCards.map(card => renderCard(card, 0, isMobile))
            ) : (
              <div className="empty-canvas">
                <span style={{fontSize:36}}>🧠</span>
                <p>{book ? '( ﾟ∀。) 点击"+ 母卡片"创建思维导图' : '( ;´д`) 选择或创建一本书吧~'}</p>
                <p className="hint">✧ 导入 Word/HTML/TXT 自动生成卡片 ✧</p>
              </div>
            )
          )}
        </div>
      </div>

      {/* 触摸拖拽幽灵 */}
      {touchDragId && touchGhostPos && (
        <div className="touch-ghost" style={{ left: touchGhostPos.x - 40, top: touchGhostPos.y - 20 }}>
          🃏 拖拽中...
        </div>
      )}

      {/* 隐藏的文件输入 */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".docx,.html,.htm,.txt"
        style={{display:'none'}}
        onChange={handleImport}
      />
    </div>
  );
}

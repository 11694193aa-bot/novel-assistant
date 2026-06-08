import React, { useState, useEffect, useRef } from 'react';
import useStore, { uid } from '../store';
import mammoth from 'mammoth';

export default function MindMapView({ books, selectedBookId, onSelectBook }) {
  const { addBook, renameBook, deleteBook, addMindMapCard, deleteMindMapCard, updateMindMapCard, addMindMapCards } = useStore();
  const [collapsed, setCollapsed] = useState(false);
  const [dragOverId, setDragOverId] = useState(null);
  const [draggedId, setDraggedId] = useState(null);
  const [showAddBook, setShowAddBook] = useState(false);
  const [newBookName, setNewBookName] = useState('');
  const [editingBookId, setEditingBookId] = useState(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);
  const prevBookRef = useRef(null);

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
    if (!newBookName.trim()) return;
    const b = addBook(newBookName.trim());
    setNewBookName(''); setShowAddBook(false);
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
  const handleDrop = (e, targetCard) => {
    e.preventDefault(); setDragOverId(null); setDraggedId(null);
    try {
      const { cardId } = JSON.parse(e.dataTransfer.getData('text/plain'));
      if (cardId !== targetCard.id) {
        updateMindMapCard(selectedBookId, cardId, { parentId: targetCard.id });
      }
    } catch (err) { /* ignore */ }
  };

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
        const result = await mammoth.convertToHtml({ arrayBuffer });
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

  // ==== 渲染卡片 ====
  const renderCard = (card, depth = 0) => {
    const isParent = !card.parentId;
    const isDragOver = dragOverId === card.id;
    const isDragging = draggedId === card.id;

    return (
      <div key={card.id}>
        <div
          className={`mm-card ${isParent ? 'mm-parent' : 'mm-child'} ${isDragOver ? 'mm-dragover' : ''} ${isDragging ? 'mm-dragging' : ''}`}
          style={{ marginLeft: depth * 26 }}
          draggable={!isParent}
          onDragStart={(e) => !isParent && handleDragStart(e, card)}
          onDragEnd={handleDragEnd}
          onDragOver={(e) => !isParent ? handleDragOver(e, card) : null}
          onDragLeave={() => setDragOverId(null)}
          onDrop={(e) => !isParent ? handleDrop(e, card) : null}
          onContextMenu={(e) => {
            e.preventDefault();
            const menu = document.createElement('div');
            menu.className = 'context-menu';
            menu.style.left = e.clientX + 'px'; menu.style.top = e.clientY + 'px';
            const childCount = card.children?.length || 0;
            menu.innerHTML = `
              ${isParent ? `<button class="ctx-item">📎 添加子卡片${childCount > 0 ? ` (${childCount})` : ''}</button>` : ''}
              <button class="ctx-item ctx-delete">🗑️ 删除</button>
            `;
            document.body.appendChild(menu);
            const btns = menu.querySelectorAll('.ctx-item');
            btns.forEach((btn, i) => {
              btn.onclick = () => {
                menu.remove();
                if (isParent && i === 0) handleAddChild(card.id);
                if ((isParent && i === 1) || (!isParent && i === 0)) handleDelete(card.id);
              };
            });
            requestAnimationFrame(() => {
              const close = (ev) => { if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener('mousedown', close); }};
              document.addEventListener('mousedown', close);
            });
          }}
        >
          {/* 母卡片：显示标题 + 快捷添加子卡片按钮 */}
          {isParent && (
            <div className="mm-parent-header">
              <input
                className="mm-title-input"
                value={card.title}
                onChange={(e) => updateMindMapCard(selectedBookId, card.id, { title: e.target.value })}
                placeholder="母卡片标题"
              />
              <button
                className="mm-quick-add"
                onClick={(e) => { e.stopPropagation(); handleAddChild(card.id); }}
                title="快速添加子卡片"
              >+</button>
            </div>
          )}
          {/* 内容 */}
          <textarea
            className="mm-content-input"
            value={card.content || ''}
            onChange={(e) => updateMindMapCard(selectedBookId, card.id, { content: e.target.value })}
            placeholder={isParent ? '内容...' : '子卡片内容...'}
            rows={card.content ? Math.min(card.content.split('\n').length + 1, 5) : 1}
          />
          {!isParent && <span className="mm-drag-handle" title="拖拽">⋮⋮</span>}
        </div>

        {/* 子卡片组 */}
        {isParent && card.children?.length > 0 && (
          <div className="mm-children-group" style={{ marginLeft: (depth + 1) * 26 }}>
            <div className="mm-separator" />
            {card.children.map(child => renderCard(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="mindmap-view">
      {/* 书籍侧栏 */}
      <div className={`mindmap-sidebar ${collapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          <span>📚</span>
          <span>书籍</span>
          <div className="sidebar-header-actions">
            <button className="btn-icon" onClick={() => setShowAddBook(true)} title="新建书籍">+</button>
            <button className="btn-icon" onClick={() => setCollapsed(!collapsed)}>{collapsed ? '▶' : '◀'}</button>
          </div>
        </div>

        {showAddBook && (
          <div className="dir-add-form">
            <input placeholder="书名..." value={newBookName}
              onChange={e => setNewBookName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddBook()} autoFocus />
            <div className="dir-add-actions">
              <button onClick={handleAddBook}>✓</button>
              <button onClick={() => { setShowAddBook(false); setNewBookName(''); }}>✕</button>
            </div>
          </div>
        )}

        {books.map(b => (
          <div key={b.id} className={`dir-book-item ${selectedBookId === b.id ? 'active' : ''}`}
            onClick={() => onSelectBook(b.id)}>
            {editingBookId === b.id ? (
              <input className="dir-inline-edit" defaultValue={b.title}
                onBlur={e => { renameBook(b.id, e.target.value || b.title); setEditingBookId(null); }}
                onKeyDown={e => { if (e.key === 'Enter') { renameBook(b.id, e.target.value || b.title); setEditingBookId(null); }}}
                autoFocus onClick={e => e.stopPropagation()} />
            ) : (
              <span className="dir-book-title" onDoubleClick={(e) => { e.stopPropagation(); setEditingBookId(b.id); }}>
                📘 {b.title}
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

        <div className="mindmap-canvas">
          {importing && <div className="import-overlay">正在导入...</div>}

          {book?.mindMapCards?.length > 0 ? (
            book.mindMapCards.map(card => renderCard(card))
          ) : (
            <div className="empty-canvas">
              <span style={{fontSize:36}}>🧠</span>
              <p>{book ? '( ﾟ∀。) 点击"+ 母卡片"创建思维导图' : '( ;´д`) 选择或创建一本书吧~'}</p>
              <p className="hint">✧ 导入 Word/HTML/TXT 自动生成卡片 ✧</p>
            </div>
          )}
        </div>
      </div>

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

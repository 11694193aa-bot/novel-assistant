import React, { useState, useMemo } from 'react';
import useStore from '../store';
const CATEGORIES = ['全部', '人设思考', '情节构思', '世界观', '感情线', '文笔提升', '灵感火花', '章节笔记'];
const CREATE_CATEGORIES = ['人设思考', '情节构思', '世界观', '感情线', '文笔提升', '灵感火花', '章节笔记'];

export default function InspirationView({ books, onOpenHistory }) {
  const { inspirationCards, addInspirationCard, deleteInspirationCard, updateInspirationCard, moveInspirationToBook } = useStore();
  const [filterCat, setFilterCat] = useState('全部');
  const [filterBookId, setFilterBookId] = useState('all');
  const [editingId, setEditingId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newCat, setNewCat] = useState('灵感火花');
  const [newBookId, setNewBookId] = useState(null);

  const filtered = useMemo(() => {
    return inspirationCards.filter(c => {
      if (filterCat !== '全部' && c.category !== filterCat) return false;
      if (filterBookId !== 'all' && c.bookId !== filterBookId && !(filterBookId === 'none' && !c.bookId)) return false;
      return true;
    });
  }, [inspirationCards, filterCat, filterBookId]);

  const handleCreate = () => {
    if (!newTitle.trim()) return;
    addInspirationCard({
      title: newTitle.trim(),
      content: newContent.trim(),
      category: newCat,
      source: 'manual',
      bookId: newBookId,
    });
    setNewTitle('');
    setNewContent('');
    setShowCreate(false);
  };

  const handleEdit = (card) => {
    setEditingId(card.id);
  };

  return (
    <div className="inspiration-view">
      {/* 过滤栏 */}
      <div className="inspiration-filter">
        <div className="filter-row">
          <div className="filter-group">
            <span style={{fontSize:14}}>💡</span>
            {CATEGORIES.map(cat => (
              <button key={cat} className={`filter-btn ${filterCat === cat ? 'active' : ''}`}
                onClick={() => setFilterCat(cat)}>{cat}</button>
            ))}
          </div>
          <button className="btn btn-create-inspiration" onClick={() => setShowCreate(!showCreate)}>
            + 新建灵感卡片
          </button>
        </div>
        <div className="filter-group">
          <span className="filter-label">📚</span>
          <button className={`filter-btn ${filterBookId === 'all' ? 'active' : ''}`} onClick={() => setFilterBookId('all')}>全部</button>
          <button className={`filter-btn ${filterBookId === 'none' ? 'active' : ''}`} onClick={() => setFilterBookId('none')}>未分类</button>
          {books.map(b => (
            <button key={b.id} className={`filter-btn ${filterBookId === b.id ? 'active' : ''}`}
              onClick={() => setFilterBookId(b.id)}>{b.title}</button>
          ))}
        </div>
      </div>

      {/* 创建表单 */}
      {showCreate && (
        <div className="create-inspiration-form">
          <div className="create-form-header">
            <span style={{fontSize:16}}>💡</span>
            <span>新建灵感卡片</span>
            <button onClick={() => setShowCreate(false)}>✕</button>
          </div>
          <input
            placeholder="卡片标题..."
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            autoFocus
          />
          <textarea
            placeholder="卡片内容..."
            value={newContent}
            onChange={e => setNewContent(e.target.value)}
            rows={4}
          />
          <div className="create-form-row">
            <select value={newCat} onChange={e => setNewCat(e.target.value)}>
              {CREATE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={newBookId || ''} onChange={e => setNewBookId(e.target.value || null)}>
              <option value="">不关联书籍</option>
              {books.map(b => <option key={b.id} value={b.id}>{b.title}</option>)}
            </select>
            <button className="btn btn-save-create" onClick={handleCreate}>💾 创建</button>
          </div>
        </div>
      )}

      {/* 卡片网格 */}
      <div className="inspiration-grid">
        {filtered.length === 0 ? (
          <div className="empty-view">
            <span style={{fontSize:36}}>💡</span>
            <p>( ;´д`) 还没有灵感卡片呢~</p>
            <p className="empty-hint">✧ 点击"+ 新建灵感卡片"创建，或用扭蛋机获取灵感 ✧</p>
          </div>
        ) : (
          filtered.map(card => (
            <div
              key={card.id}
              className={`inspiration-card ${card.source === 'gacha' ? 'gacha-card' : ''} ${editingId === card.id ? 'editing' : ''}`}
              onContextMenu={(e) => {
                if (editingId === card.id) return;
                e.preventDefault();
                const menu = document.createElement('div');
                menu.className = 'context-menu';
                menu.style.left = e.clientX + 'px';
                menu.style.top = e.clientY + 'px';
                const bookOptions = books.map(b =>
                  `<button class="ctx-item" data-book="${b.id}">📚 归类: ${b.title}</button>`
                ).join('');
                menu.innerHTML = `
                  <button class="ctx-item">✏️ 编辑</button>
                  <button class="ctx-item">📜 查看历史</button>
                  <button class="ctx-item ctx-delete">🗑️ 删除</button>
                  <div class="ctx-divider"></div>
                  ${bookOptions}
                  ${card.bookId ? `<button class="ctx-item ctx-unlink">🔓 取消关联</button>` : ''}
                `;
                document.body.appendChild(menu);
                menu.querySelectorAll('.ctx-item').forEach(btn => {
                  btn.onclick = () => {
                    menu.remove();
                    const text = btn.textContent.trim();
                    if (text.startsWith('✏️')) handleEdit(card);
                    if (text.startsWith('📜')) onOpenHistory(card.id);
                    if (text.startsWith('🗑️')) deleteInspirationCard(card.id);
                    if (text.startsWith('📚')) moveInspirationToBook(card.id, btn.dataset.book);
                    if (text.startsWith('🔓')) moveInspirationToBook(card.id, null);
                  };
                });
                const close = (ev) => {
                  if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener('click', close); }
                };
                requestAnimationFrame(() => document.addEventListener('mousedown', close));
              }}
            >
              <div className="card-source-badge">
                {card.source === 'gacha' ? '🎰 扭蛋' : card.source === 'extract' ? '📝 摘录' : '✍️ 手动'}
              </div>
              {editingId === card.id ? (
                <div className="card-edit-mode">
                  <input
                    defaultValue={card.title}
                    onBlur={e => {
                      updateInspirationCard(card.id, { title: e.target.value || card.title });
                      setEditingId(null);
                    }}
                    onKeyDown={e => e.key === 'Enter' && setEditingId(null)}
                    autoFocus
                    placeholder="标题"
                  />
                  <textarea
                    defaultValue={card.content}
                    onBlur={e => updateInspirationCard(card.id, { content: e.target.value })}
                    placeholder="内容"
                    rows={5}
                  />
                  <div className="edit-actions">
                    <button onClick={() => setEditingId(null)}>✓ 完成</button>
                  </div>
                </div>
              ) : (
                <>
                  <h3 className="card-title" onClick={() => handleEdit(card)}>{card.title}</h3>
                  <p className="card-text">{card.content}</p>
                </>
              )}
              <div className="card-footer">
                <span className="card-cat-tag">{card.category}</span>
                {card.gachaQuestion && (
                  <span className="card-gacha-q" title={card.gachaQuestion}>🎱</span>
                )}
                {card.bookId && (
                  <span className="card-book-tag">📚 {books.find(b => b.id === card.bookId)?.title || ''}</span>
                )}
                <span className="card-date">{new Date(card.createdAt).toLocaleDateString('zh-CN')}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

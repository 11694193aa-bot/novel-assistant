import React, { useState, useEffect, useMemo, useRef } from 'react';
import useStore from '../store';
import CatIcon from './CatIcon';
const CATEGORIES = ['全部', '人设思考', '情节构思', '世界观', '感情线', '文笔提升', '灵感火花', '章节笔记'];
const CREATE_CATEGORIES = ['人设思考', '情节构思', '世界观', '感情线', '文笔提升', '灵感火花', '章节笔记'];

export default function InspirationView({ books, onOpenHistory, drillCardId, onBack, onDrillCard, isMobile, focusMode: extFocus, onSetFocus, onCountChange }) {
  const { inspirationCards, addInspirationCard, deleteInspirationCard, updateInspirationCard, moveInspirationToBook } = useStore();
  const [filterCat, setFilterCat] = useState('全部');
  const [filterBookId, setFilterBookId] = useState('all');
  const [editingId, setEditingId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newCat, setNewCat] = useState('灵感火花');
  const [newBookId, setNewBookId] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [editingCatId, setEditingCatId] = useState(null);
  const [innerFocus, setInnerFocus] = useState(false);
  const focusMode = extFocus !== undefined ? extFocus : innerFocus;
  const setFocus = onSetFocus || ((v) => setInnerFocus(v));

  // 毛玻璃模态框
  const [modalType, setModalType] = useState(null); // null | 'category' | 'book' | 'cards'
  const [modalClosing, setModalClosing] = useState(false);
  const [bookTargetCard, setBookTargetCard] = useState(null); // 卡片级书籍切换目标
  const closeTimer = useRef(null);

  useEffect(() => {
    if (focusMode) document.body.classList.add('insp-focus');
    else document.body.classList.remove('insp-focus');
    return () => document.body.classList.remove('insp-focus');
  }, [focusMode]);

  // 全局分类弹窗
  const [catPopupCard, setCatPopupCard] = useState(null);
  const openCatPopup = (card) => setCatPopupCard(card);
  const closeCatPopup = () => setCatPopupCard(null);
  const selectCat = (cat) => {
    if (catPopupCard) { updateInspirationCard(catPopupCard.id, { category: cat }); closeCatPopup(); }
  };

  const filtered = useMemo(() => {
    return inspirationCards.filter(c => {
      if (filterCat !== '全部' && c.category !== filterCat) return false;
      if (filterBookId !== 'all' && c.bookId !== filterBookId && !(filterBookId === 'none' && !c.bookId)) return false;
      return true;
    });
  }, [inspirationCards, filterCat, filterBookId]);

  useEffect(() => {
    if (onCountChange) onCountChange(filtered.length);
  }, [filtered.length, onCountChange]);

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

  // 毛玻璃模态框控制
  const openModal = (type, card) => {
    setModalType(type);
    setModalClosing(false);
    if (type === 'book' && card) setBookTargetCard(card);
    else setBookTargetCard(null);
  };
  const closeModal = () => {
    setModalClosing(true);
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => {
      setModalType(null);
      setModalClosing(false);
      setBookTargetCard(null);
    }, 280);
  };

  // 手机端翻页模式：只显示单张卡片全屏
  if (drillCardId) {
    const card = inspirationCards.find(c => c.id === drillCardId);
    if (!card) return <div className="inspiration-view"><div className="empty-view"><p>卡片不存在</p></div></div>;
    return (
      <div className="inspiration-view" style={{padding:16}}>
        <div className="inspiration-card editing" style={{flex:1,overflow:'auto'}}>
          <div className="card-edit-mode">
            <input defaultValue={card.title}
              onBlur={e => updateInspirationCard(card.id, { title: e.target.value || card.title })}
              placeholder="标题" style={{fontSize:18,fontWeight:700}} />
            <textarea defaultValue={card.content}
              onBlur={e => updateInspirationCard(card.id, { content: e.target.value })}
              placeholder="内容..." rows={15}
              style={{fontSize:16,lineHeight:1.8,flex:1,minHeight:200}} />
            <div className="card-footer" style={{marginTop:8}}>
              <span className="card-cat-tag" onClick={() => openCatPopup(card)}>
                {card.category} ▾
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`inspiration-view${focusMode ? ' focus-mode' : ''}`}>
      {focusMode && <button className="focus-float-exit" onClick={() => setFocus(false)}>✕ 退出专注</button>}
      {/* 创建表单 */}
      {showCreate && (
        <div className="create-inspiration-form">
          <div className="create-form-header">
            <span style={{fontSize:16}}></span>
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

      {/* 统一操作栏：筛选图标 + 操作按钮 */}
      <div className="batch-bar insp-toolbar">
        <button className="tb-btn" onClick={() => openModal('category')} title="全局分类">
          <CatIcon name="palette" size={14} /> 分类
        </button>
        <button className="tb-btn" onClick={() => openModal('book')} title="书籍标签">
          <CatIcon name="books" size={14} /> 书籍
        </button>
        <button className="tb-btn" onClick={() => openModal('cards')} title="卡片列表">
          <CatIcon name="cards" size={14} /> 列表
        </button>
        <span className="tb-divider" />
        <button className="tb-btn" onClick={() => setFocus(!focusMode)} title="专注模式">
          <CatIcon name="focus" size={14} />
        </button>
        {filtered.length > 0 && (
          <>
            <button className="tb-btn" onClick={() => {
              if (selected.size === filtered.length) setSelected(new Set());
              else setSelected(new Set(filtered.map(c => c.id)));
            }}>
              {selected.size === filtered.length ? '取消' : '全选'}
            </button>
            {selected.size > 0 ? (
              <button className="tb-btn" style={{color:'#d44'}} onClick={() => {
                if (confirm(`删除选中的 ${selected.size} 张卡片？`)) {
                  selected.forEach(id => deleteInspirationCard(id));
                  setSelected(new Set());
                }
              }}>
                <CatIcon name="trash" size={12} /> {selected.size}
              </button>
            ) : (
              <button className="tb-btn" style={{color:'#d44'}} onClick={() => {
                if (confirm(`删除当前筛选的全部 ${filtered.length} 张卡片？`)) {
                  filtered.forEach(c => deleteInspirationCard(c.id));
                }
              }}>
                <CatIcon name="trash" size={12} />
              </button>
            )}
          </>
        )}
        <span className="tb-info" style={{fontSize:10}}>{selected.size > 0 ? `${selected.size}/${filtered.length}` : ''}</span>
      </div>

      {/* 卡片网格 */}
      <div className="inspiration-grid">
        {filtered.length === 0 ? (
          <div className="empty-view">
            <span style={{fontSize:36}}></span>
            <p>( ;´д`) 还没有灵感卡片呢~</p>
            <p className="empty-hint">✧ 使用扭蛋机获取灵感，或在编辑器中摘录内容 ✧</p>
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
                  `<button class="ctx-item" data-book="${b.id}">归类: ${b.title}</button>`
                ).join('');
                menu.innerHTML = `
                  <button class="ctx-item">编辑</button>
                  <button class="ctx-item">查看历史</button>
                  <button class="ctx-item ctx-delete">删除</button>
                  <div class="ctx-divider"></div>
                  ${bookOptions}
                  ${card.bookId ? `<button class="ctx-item ctx-unlink">取消关联</button>` : ''}
                `;
                document.body.appendChild(menu);
                menu.querySelectorAll('.ctx-item').forEach(btn => {
                  btn.onclick = () => {
                    menu.remove();
                    const text = btn.textContent.trim();
                    if (text === '编辑') handleEdit(card);
                    if (text === '查看历史') onOpenHistory(card.id);
                    if (text === '删除') deleteInspirationCard(card.id);
                    if (text.startsWith('归类')) moveInspirationToBook(card.id, btn.dataset.book);
                    if (text === '取消关联') moveInspirationToBook(card.id, null);
                  };
                });
                const close = (ev) => {
                  if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener('click', close); }
                };
                requestAnimationFrame(() => document.addEventListener('mousedown', close));
              }}
            >
              <div className="card-top-row">
                <input type="checkbox" className="card-check"
                  checked={selected.has(card.id)}
                  onChange={e => {
                    const next = new Set(selected);
                    e.target.checked ? next.add(card.id) : next.delete(card.id);
                    setSelected(next);
                  }}
                  onClick={e => e.stopPropagation()}
                />
                <div className="card-source-badge">
                  {card.source === 'gacha' ? '扭蛋' : card.source === 'extract' ? '摘录' : '手动'}
                </div>
                <button className="card-copy-btn" onClick={e => {
                  e.stopPropagation();
                  navigator.clipboard.writeText(card.content).catch(() => {});
                }} title="复制内容">+</button>
              </div>
              {editingId === card.id ? (
                <div className="card-edit-mode">
                  <input
                    defaultValue={card.title}
                    onBlur={e => {
                      updateInspirationCard(card.id, { title: e.target.value || card.title });
                      setEditingId(null);
                    }}
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
                  <h3 className="card-title" onClick={() => isMobile && onDrillCard ? onDrillCard(card.id) : handleEdit(card)}>{card.title}</h3>
                  <p className="card-text" onClick={() => { if (!isMobile || !onDrillCard) handleEdit(card); else onDrillCard(card.id); }}>{card.content}</p>
                </>
              )}
              <div className="card-footer">
                <span className="card-cat-tag" onClick={e => { e.stopPropagation(); openCatPopup(card); }} title="点击修改分类">
                  {card.category} ▾
                </span>
                {card.gachaQuestion && (
                  <span className="card-gacha-q" title={card.gachaQuestion}>?</span>
                )}
                {card.bookId ? (
                  <span className="card-book-tag" onClick={e => { e.stopPropagation(); openModal('book'); }} title="点击切换书籍">
                    {books.find(b => b.id === card.bookId)?.title || ''} ▾
                  </span>
                ) : (
                  <span className="card-book-tag" onClick={e => { e.stopPropagation(); openModal('book'); }} style={{opacity:.5}} title="点击关联书籍">
                    +书籍
                  </span>
                )}
                <span className="card-date">{new Date(card.createdAt).toLocaleDateString('zh-CN')}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 全局分类弹窗（独立于卡片渲染，不闪动） */}
      {catPopupCard && (
        <div className="cat-popup-overlay" onClick={e => { e.stopPropagation(); closeCatPopup(); }}>
          <div className="cat-popup" onClick={e => e.stopPropagation()}>
            <div className="cat-popup-title">选择分类</div>
            {CREATE_CATEGORIES.map(cat => (
              <button key={cat} className={`cat-opt ${catPopupCard.category === cat ? 'active' : ''}`}
                onClick={e => { e.stopPropagation(); selectCat(cat); }}>
                {cat}
              </button>
            ))}
            <button className="cat-opt" style={{color:'var(--text3)'}} onClick={e => { e.stopPropagation(); closeCatPopup(); }}>取消</button>
          </div>
        </div>
      )}

      {/* 毛玻璃中心模态框（手机端选择器） */}
      {modalType && (
        <div
          className={`glass-overlay${modalClosing ? ' closing' : ''}`}
          onClick={closeModal}
        >
          <div
            className={`glass-modal${modalClosing ? ' closing' : ''}`}
            onClick={e => e.stopPropagation()}
          >
            <div className="glass-modal-title">
              {modalType === 'category' ? '全局分类' : modalType === 'book' ? (bookTargetCard ? '关联书籍' : '书籍标签') : '卡片列表'}
            </div>
            {modalType === 'category' && (
              <>
                <button className={`glass-opt ${filterCat === '全部' ? 'active' : ''}`}
                  onClick={() => { setFilterCat('全部'); closeModal(); }}>全部</button>
                {CATEGORIES.filter(c => c !== '全部').map(cat => (
                  <button key={cat} className={`glass-opt ${filterCat === cat ? 'active' : ''}`}
                    onClick={() => { setFilterCat(cat); closeModal(); }}>{cat}</button>
                ))}
              </>
            )}
            {modalType === 'book' && (
              <>
                {!bookTargetCard && (
                  <>
                    <button className={`glass-opt ${filterBookId === 'all' ? 'active' : ''}`}
                      onClick={() => { setFilterBookId('all'); closeModal(); }}>全部书籍</button>
                    <button className={`glass-opt ${filterBookId === 'none' ? 'active' : ''}`}
                      onClick={() => { setFilterBookId('none'); closeModal(); }}>未分类</button>
                  </>
                )}
                {bookTargetCard && (
                  <button className={`glass-opt`}
                    onClick={() => { moveInspirationToBook(bookTargetCard.id, null); closeModal(); }}>取消关联</button>
                )}
                {books.map(b => (
                  <button key={b.id} className={`glass-opt ${!bookTargetCard && filterBookId === b.id ? 'active' : ''}`}
                    onClick={() => {
                      if (bookTargetCard) { moveInspirationToBook(bookTargetCard.id, b.id); }
                      else { setFilterBookId(b.id); }
                      closeModal();
                    }}>{b.title}</button>
                ))}
              </>
            )}
            {modalType === 'cards' && (
              <>
                <div style={{textAlign:'center',padding:'16px 0',color:'var(--text2)',fontSize:'14px',fontWeight:600}}>
                  当前共 {filtered.length} 张卡片
                </div>
                <button className="glass-opt"
                  onClick={() => { setFilterCat('全部'); setFilterBookId('all'); closeModal(); }}>
                  🔄 重置全部筛选
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

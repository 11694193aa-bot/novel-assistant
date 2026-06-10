import React, { useState, useEffect, useMemo } from 'react';
import useStore from '../store';
import mammoth from 'mammoth';
import JSZip from 'jszip';
const CATEGORIES = ['全部', '人设思考', '情节构思', '世界观', '感情线', '文笔提升', '灵感火花', '章节笔记'];
const CREATE_CATEGORIES = ['人设思考', '情节构思', '世界观', '感情线', '文笔提升', '灵感火花', '章节笔记'];

export default function InspirationView({ books, onOpenHistory, drillCardId, onBack, onDrillCard, isMobile, focusMode: extFocus, onSetFocus }) {
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
  const [tabsCollapsed, setTabsCollapsed] = useState(false);
  const [innerFocus, setInnerFocus] = useState(false);
  const focusMode = extFocus !== undefined ? extFocus : innerFocus;
  const setFocus = onSetFocus || ((v) => setInnerFocus(v));

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
      {/* 手机端：书籍分类标签栏 */}
      {isMobile && (
        <div className={`insp-mobile-tabs ${tabsCollapsed ? 'collapsed' : ''}`}>
          {tabsCollapsed ? (
            <button className="insp-tab active" onClick={() => setTabsCollapsed(false)}>
              📚 {filterBookId === 'all' ? '全部书籍' : filterBookId === 'none' ? '未分类' : (books.find(b => b.id === filterBookId)?.title || '书籍')} ▾
            </button>
          ) : (
            <>
              <button className={`insp-tab ${filterBookId === 'all' ? 'active' : ''}`} onClick={() => { setFilterBookId('all'); setTabsCollapsed(true); }}>全部</button>
              <button className={`insp-tab ${filterBookId === 'none' ? 'active' : ''}`} onClick={() => { setFilterBookId('none'); setTabsCollapsed(true); }}>未分类</button>
              {books.map(b => (
                <button key={b.id} className={`insp-tab ${filterBookId === b.id ? 'active' : ''}`}
                  onClick={() => { setFilterBookId(b.id); setTabsCollapsed(true); }}>{b.title}</button>
              ))}
              <button className="insp-tab" style={{color:'var(--text3)'}} onClick={() => setTabsCollapsed(true)}>✕</button>
            </>
          )}
        </div>
      )}
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
          <button className="btn btn-create-inspiration" onClick={() => setFocus(!focusMode)} style={{fontSize:13}}>
            🧘
          </button>
          <button className="btn btn-create-inspiration" onClick={() => setShowCreate(!showCreate)}>
            + 新建灵感卡片
          </button>
          <button className="btn btn-create-inspiration" onClick={() => document.getElementById('insp-import-file').click()}>
            📥 导入文本
          </button>
          <input id="insp-import-file" type="file" accept=".txt,.html,.docx,.doc" style={{display:'none'}} onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;

            const extractText = (raw) => {
              // 用DOM解析提取纯文本（保留段落结构）
              const div = document.createElement('div');
              div.innerHTML = raw;
              // 块级元素后加换行
              div.querySelectorAll('p,div,li,h1,h2,h3,h4,h5,h6,br,tr,section,article').forEach(el => {
                el.insertAdjacentText('afterend', '\n');
              });
              const t = div.textContent || div.innerText || '';
              // 清理多余空行但保留段落间距
              return t.replace(/\n{3,}/g, '\n\n').trim();
            };

            try {
              let text = '';
              const ext = (file.name.split('.').pop() || '').toLowerCase();

              if (ext === 'docx' || ext === 'doc') {
                // 用 FileReader 读 ArrayBuffer（手机兼容性更好）
                const readBuf = () => new Promise((res, rej) => {
                  const r = new FileReader();
                  r.onload = () => res(r.result);
                  r.onerror = rej;
                  r.readAsArrayBuffer(file);
                });

                try {
                  const buf = await readBuf();
                  const result = await mammoth.extractRawText({ arrayBuffer: buf });
                  text = (result.value || '').trim();
                } catch {}
                if (!text) {
                  try {
                    const buf = await readBuf();
                    const zip = await JSZip.loadAsync(buf);
                    const xml = await zip.file('word/document.xml')?.async('string');
                    if (xml) text = xml.replace(/<[^>]+>/g, '\n').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/\n{3,}/g,'\n\n').trim();
                  } catch {}
                }
                if (!text) {
                  text = await new Promise(res => { const r = new FileReader(); r.onload = () => res(String(r.result||'')); r.onerror = () => res(''); r.readAsText(file); });
                }
              } else if (ext === 'html' || ext === 'htm') {
                text = extractText(await file.text());
              } else {
                text = await file.text();
              }

              if (!text.trim()) {
                alert('未能提取到文本内容，请确认文件格式');
                return;
              }

              // 按空行分段建卡片
              const parts = text.split(/\n{2,}/).filter(p => p.trim());
              if (parts.length === 0) parts.push(text.trim());

              // 问用户导入到哪本书
              let targetBookId = null;
              if (books.length > 0) {
                const bookNames = books.map((b,i) => `${i+1}. ${b.title}`).join('\n');
                const choice = prompt(`导入到哪本书？\n输入数字选择：\n0. 不关联书籍\n${bookNames}`, '0');
                if (choice && choice !== '0') {
                  const idx = parseInt(choice) - 1;
                  if (idx >= 0 && idx < books.length) targetBookId = books[idx].id;
                }
              }
              let count = 0;
              parts.forEach(p => {
                const content = p.trim();
                if (!content) return;
                const firstLine = content.split('\n')[0].trim().slice(0, 40);
                addInspirationCard({
                  title: firstLine || '导入段落',
                  content,
                  category: '灵感火花',
                  source: 'manual',
                  bookId: targetBookId,
                });
                count++;
              });
              if (count === 0) alert('未能提取到文本内容');
            } catch (err) {
              alert('导入失败: ' + (err.message || '未知错误'));
            }
            e.target.value = '';
          }} />
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

      {/* 批量操作栏 */}
      {filtered.length > 0 && (
        <div className="batch-bar">
          <button className="tb-btn" onClick={() => {
            if (selected.size === filtered.length) {
              setSelected(new Set());
            } else {
              setSelected(new Set(filtered.map(c => c.id)));
            }
          }}>
            {selected.size === filtered.length ? '取消全选' : '☑ 全选'}
          </button>
          {selected.size > 0 && (
            <button className="tb-btn" style={{color:'#fff',background:'#e74c3c',fontWeight:700}} onClick={() => {
              if (confirm(`删除选中的 ${selected.size} 张卡片？`)) {
                selected.forEach(id => deleteInspirationCard(id));
                setSelected(new Set());
              }
            }}>
              🗑 删除({selected.size})
            </button>
          )}
          {selected.size === 0 && (
            <button className="tb-btn" style={{color:'#d44'}} onClick={() => {
              if (confirm(`删除当前筛选的全部 ${filtered.length} 张卡片？`)) {
                filtered.forEach(c => deleteInspirationCard(c.id));
              }
            }}>
              🗑 全部删除
            </button>
          )}
          <span className="tb-info">{selected.size > 0 ? `已选 ${selected.size}/${filtered.length}` : `共 ${filtered.length} 张`}</span>
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
                  {card.source === 'gacha' ? '🎰 扭蛋' : card.source === 'extract' ? '📝 摘录' : '✍️ 手动'}
                </div>
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
                  <h3 className="card-title" onClick={() => isMobile && onDrillCard ? onDrillCard(card.id) : handleEdit(card)}>{card.title}</h3>
                  <p className="card-text">{card.content}</p>
                </>
              )}
              <div className="card-footer">
                <span className="card-cat-tag" onClick={e => { e.stopPropagation(); openCatPopup(card); }} title="点击修改分类">
                  {card.category} ▾
                </span>
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
    </div>
  );
}

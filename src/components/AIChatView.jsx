import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import useStore from '../store';

const CATEGORIES = ['人设思考', '情节构思', '世界观', '感情线', '文笔提升', '灵感火花', '章节笔记'];

export default function AIChatView({ chapterContent, chapterTitle }) {
  const { settings, updateSettings, persist, aiConversations, addAIConversation,
    updateAIConversation, deleteAIConversation, addInspirationCard, inspirationCards, books, moveInspirationToBook } = useStore();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [apiKey, setApiKey] = useState('');
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [activeConvId, setActiveConvId] = useState(null);
  const [bookContent, setBookContent] = useState(chapterContent || '');
  const [bookTitle, setBookTitle] = useState(chapterTitle || '');
  const [cardMode, setCardMode] = useState(false);
  const [selectedCards, setSelectedCards] = useState(new Set());
  const [uploading, setUploading] = useState(false);
  const [showConvList, setShowConvList] = useState(false);
  const [historyMode, setHistoryMode] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [archiveCard, setArchiveCard] = useState(null);
  const [archiveStep, setArchiveStep] = useState('cat'); // 'cat' | 'book'
  const [archiveCat, setArchiveCat] = useState(null);
  const messagesRef = useRef(null);
  const fileRef = useRef(null);
  // 已归档卡片 _cid 集合，用于渲染时精确过滤
  const archivedCids = useRef(new Set());
  // 归档防重入锁（手机端 touch 事件链会导致 onClick 触发多次）
  const archiving = useRef(false);

  useEffect(() => { if (!settings.apiKey) setShowKeyInput(true); }, []);

  // 初始化：从灵感卡片库还原已归档的 _cid 集合
  useEffect(() => {
    const set = new Set();
    const store = useStore.getState();
    // 新数据：直接有 _archivedCid
    for (const c of inspirationCards) {
      if (c.source === 'aichat' && c._archivedCid) {
        set.add(c._archivedCid);
      }
    }
    // 兼容旧数据：没有 _archivedCid 的旧归档卡片，遍历所有对话按内容匹配找 _cid
    const oldCards = inspirationCards.filter(c => c.source === 'aichat' && !c._archivedCid);
    if (oldCards.length > 0) {
      const oldContents = new Set(oldCards.map(c => c.content));
      for (const conv of store.aiConversations) {
        for (const m of (conv.messages || [])) {
          if (m.role === 'user' && m._cid && oldContents.has(m.content)) {
            set.add(m._cid);
          }
        }
      }
    }
    archivedCids.current = set;
  }, []);

  const scrollDown = () => {
    const el = messagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  };

  const callAI = async (msgs, content) => {
    setLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: msgs, chapterContent: content }),
      });
      const data = await res.json();
      if (data.error) { alert(data.error); setLoading(false); return null; }
      setLoading(false); return data;
    } catch (e) { alert('AI 调用失败: ' + e.message); setLoading(false); return null; }
  };

  const saveApiKey = async () => {
    if (!apiKey.trim()) return;
    try {
      const res = await fetch('/api/sync/save-key', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'api_key', value: apiKey.trim() }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || '保存失败');
      updateSettings({ apiKey: '••••' + apiKey.slice(-4) });
      await persist(); setShowKeyInput(false);
    } catch (e) { alert('保存失败: ' + e.message); }
  };

  const saveCurrentConv = useCallback(() => {
    if (messages.length === 0) return;
    if (activeConvId) {
      updateAIConversation(activeConvId, { messages, bookContent, bookTitle });
    } else {
      const title = messages.find(m => m.role === 'user')?.content?.slice(0, 30) || '新对话';
      const conv = addAIConversation({ title, messages, bookContent, bookTitle });
      setActiveConvId(conv.id);
    }
    // 立刻写入 IndexedDB + cloud-data.json，不依赖 8 秒定时器
    persist();
  }, [messages, activeConvId, bookContent, bookTitle, persist]);

  useEffect(() => { if (messages.length > 0 && messages.length % 2 === 0) saveCurrentConv(); }, [messages.length]);

  // 消息变化 / 从卡片/历史模式返回时，自动滚到底部
  useEffect(() => { scrollDown(); }, [messages, cardMode, historyMode]);

  const loadConv = (conv) => {
    saveCurrentConv();
    setActiveConvId(conv.id); setMessages(conv.messages || []);
    setBookContent(conv.bookContent || ''); setBookTitle(conv.bookTitle || '');
    setQuestions([]); setCardMode(false); setShowConvList(false);
  };

  const newConv = () => {
    saveCurrentConv();
    setActiveConvId(null); setMessages([]); setQuestions([]);
    setBookContent(chapterContent || ''); setBookTitle(chapterTitle || '');
    setCardMode(false);
  };

  const generateQuestions = async () => {
    const data = await callAI([], bookContent);
    if (data) { setMessages(prev => [...prev, { role: 'assistant', content: data.content }]); setQuestions(data.questions || []); }
  };

  const sendMessage = async () => {
    const text = input.trim(); if (!text || loading) return;
    setInput(''); setQuestions([]);
    const newMsgs = [...messages, { role: 'user', content: text, _cid: 'u' + Date.now() }];
    setMessages(newMsgs);
    const data = await callAI(newMsgs, bookContent);
    if (data) { setMessages(prev => [...prev, { role: 'assistant', content: data.content }]); setQuestions(data.questions || []); }
  };

  const sendQuick = (q) => { setInput(q); setTimeout(() => sendMessage(), 50); };

  const handleUploadBook = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    try {
      let text = ''; const ext = (file.name.split('.').pop() || '').toLowerCase();
      if (ext === 'txt') text = await file.text();
      else if (ext === 'docx' || ext === 'doc') {
        const buf = await file.arrayBuffer();
        const [{ default: mammoth }, { default: JSZip }] = await Promise.all([import('mammoth'), import('jszip')]);
        try { const r = await mammoth.extractRawText({ arrayBuffer: buf }); text = r.value || ''; } catch (_) { }
        if (!text) { try { const zip = await JSZip.loadAsync(buf); const xml = await zip.file('word/document.xml')?.async('string'); if (xml) text = xml.replace(/<[^>]+>/g, '\n').trim(); } catch (_) { } }
        if (!text) text = await file.text();
      } else text = await file.text();
      if (!text.trim()) { alert('未能提取文本'); setUploading(false); return; }
      setBookContent(text); setBookTitle(file.name.replace(/\.[^.]+$/, ''));
    } catch (err) { alert('导入失败: ' + err.message); }
    setUploading(false);
  };

  // 过滤掉已归档的卡片（通过 _cid 精确匹配）
  const userCards = messages.filter(m => m.role === 'user' && !archivedCids.current.has(m._cid));

  // 归档卡片到灵感卡片
  const startArchive = (cat) => {
    setArchiveCat(cat);
    setArchiveStep('book');
  };
  const finishArchive = (bookId = null) => {
    // 防重入：手机端 onClick 可能被 touch 事件链触发多次
    if (archiving.current || !archiveCard || !archiveCat) return;
    archiving.current = true;
    // 1. 把 _cid 记入灵感卡片，这样刷新后也能还原
    addInspirationCard({ title: archiveCard.content.slice(0, 30), content: archiveCard.content, category: archiveCat, source: 'aichat', bookId, _archivedCid: archiveCard.cid });
    // 2. 记入 ref，当前会话立即生效
    archivedCids.current.add(archiveCard.cid);
    // 3. 从消息中移除
    const newMsgs = messages.filter(m => m._cid !== archiveCard.cid);
    setMessages(newMsgs);
    // 4. 同步到 store 并立即持久化
    if (activeConvId) {
      updateAIConversation(activeConvId, { messages: newMsgs });
      persist();
    }
    setArchiveCard(null); setArchiveCat(null); setArchiveStep('cat');
    archiving.current = false;
  };

  // 导出
  const exportCards = () => {
    const cards = selectedCards.size > 0 ? userCards.filter(c => selectedCards.has(c._cid)) : userCards;
    if (cards.length === 0) { alert('没有可导出的卡片'); return; }
    const INDENT = '　　';
    const text = cards.map(c => INDENT + c.content).join('\n\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = (bookTitle || 'ai对话') + '_卡片导出.txt'; a.click();
  };

  // 删除选中卡片
  const deleteSelected = () => {
    if (selectedCards.size === 0) return;
    if (!confirm(`删除选中的 ${selectedCards.size} 张卡片？`)) return;
    const ids = new Set(selectedCards);
    const newMsgs = messages.filter(m => m.role !== 'user' || !ids.has(m._cid));
    setMessages(newMsgs); setSelectedCards(new Set());
    if (activeConvId) updateAIConversation(activeConvId, { messages: newMsgs });
  };

  if (showKeyInput) {
    return (
      <div className="chat-view">
        <div className="chat-key-setup">
          <h3>🤖 配置 AI 对话</h3>
          <p>请输入你的 DeepSeek API Key</p>
          <input type="password" placeholder="sk-..." value={apiKey} onChange={e => setApiKey(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveApiKey()} />
          <button onClick={saveApiKey} disabled={!apiKey.trim()}>💾 保存</button>
        </div>
      </div>
    );
  }

  // 卡片模式
  if (cardMode) {
    return (
      <div className="chat-view">
        <div className="chat-toolbar">
          <span className="chat-toolbar-title">🃏 灵感卡片 ({userCards.length})</span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button className="tb-btn" onClick={() => { if (selectedCards.size === userCards.length) setSelectedCards(new Set()); else setSelectedCards(new Set(userCards.map(c => c._cid))); }}>
              {selectedCards.size === userCards.length ? '取消全选' : '全选'}
            </button>
            {selectedCards.size > 0 && (
              <button className="tb-btn" style={{ color: '#fff', background: '#e74c3c', fontWeight: 700 }} onClick={deleteSelected}>
                🗑 删除({selectedCards.size})
              </button>
            )}
            <button className="tb-btn" onClick={exportCards}>📥 导出</button>
            <button className="tb-btn" onClick={() => setCardMode(false)}>💬 返回对话</button>
          </div>
        </div>
        <div className="chat-cards-grid" style={{ flex: 1, overflow: 'auto', padding: 12 }}>
          {userCards.map((card, i) => (
            <div key={card._cid || i} className={`inspiration-card ${selectedCards.has(card._cid) ? 'editing' : ''}`}
              onClick={() => { const next = new Set(selectedCards); next.has(card._cid) ? next.delete(card._cid) : next.add(card._cid); setSelectedCards(next); }}>
              <div className="card-top-row">
                <input type="checkbox" className="card-check" checked={selectedCards.has(card._cid)} readOnly />
                <span className="card-source-badge">💬 {i + 1}</span>
                <button className="dir-btn" style={{ marginLeft: 'auto' }} onClick={e => { e.stopPropagation(); setArchiveCard({ cid: card._cid, content: card.content }); }}>
                  📁 归档
                </button>
              </div>
              <p className="card-text">{card.content}</p>
            </div>
          ))}
          {userCards.length === 0 && <div className="empty-view" style={{ gridColumn: '1/-1' }}><span style={{ fontSize: 36 }}>🃏</span><p>还没有对话卡片</p></div>}
        </div>
        {/* 归档弹窗 — Portal 到 body，绕开 MobileFullPage 的 overflow:hidden */}
        {archiveCard && archiveStep === 'cat' && createPortal(
          <div className="cat-popup-overlay" onClick={e => { if (e.target === e.currentTarget) { setArchiveCard(null); setArchiveStep('cat'); }}}>
            <div className="cat-popup">
              <div className="cat-popup-title">选择分类</div>
              {CATEGORIES.map(cat => (
                <button key={cat} className="cat-opt" onClick={e => { e.stopPropagation(); startArchive(cat); }}>{cat}</button>
              ))}
              <button className="cat-opt" style={{color:'var(--text3)'}} onClick={e => { e.stopPropagation(); setArchiveCard(null); }}>取消</button>
            </div>
          </div>,
          document.body
        )}
        {archiveCard && archiveStep === 'book' && createPortal(
          <div className="cat-popup-overlay" onClick={e => { if (e.target === e.currentTarget) { setArchiveCard(null); setArchiveStep('cat'); }}}>
            <div className="cat-popup">
              <div className="cat-popup-title">关联书籍 · {archiveCat}</div>
              <button className="cat-opt" onClick={e => { e.stopPropagation(); finishArchive(null); }}>📌 不关联书籍</button>
              {books.map(b => (
                <button key={b.id} className="cat-opt" onClick={e => { e.stopPropagation(); finishArchive(b.id); }}>📘 {b.title}</button>
              ))}
              <button className="cat-opt" style={{color:'var(--text3)'}} onClick={e => { e.stopPropagation(); setArchiveStep('cat'); }}>← 返回选分类</button>
            </div>
          </div>,
          document.body
        )}
      </div>
    );
  }

  // 历史对话模式
  if (historyMode) {
    const filtered = historySearch.trim()
      ? aiConversations.filter(c => c.title.includes(historySearch.trim()) || (c.messages || []).some(m => m.role === 'user' && m.content.includes(historySearch.trim())))
      : aiConversations;
    const sorted = [...filtered].sort((a, b) => b.createdAt - a.createdAt);
    return (
      <div className="chat-view">
        <div className="chat-toolbar">
          <span className="chat-toolbar-title">📋 历史对话 ({aiConversations.length})</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {aiConversations.length > 1 && (
              <button className="tb-btn" style={{ color: '#e74c3c' }} onClick={() => {
                if (confirm(`确定删除全部 ${aiConversations.length} 条对话记录？此操作不可恢复。`)) {
                  const ids = aiConversations.map(c => c.id);
                  useStore.getState().deleteAIConversations(ids);
                  setActiveConvId(null); setMessages([]);
                }
              }}>🗑 清空</button>
            )}
            <button className="tb-btn" onClick={() => { setHistoryMode(false); setHistorySearch(''); }}>💬 返回对话</button>
          </div>
        </div>
        <div className="chat-history-search">
          <input className="chat-input" style={{ flex: 1, borderRadius: 16, padding: '6px 12px', fontSize: 13 }}
            placeholder="🔍 搜索对话..." value={historySearch}
            onChange={e => setHistorySearch(e.target.value)} />
          {historySearch && <button className="tb-btn" onClick={() => setHistorySearch('')}>✕ 清除</button>}
        </div>
        <div className="chat-history-list">
          {sorted.length === 0 ? (
            <div className="empty-view" style={{ padding: 40 }}>
              <span style={{ fontSize: 36 }}>📭</span>
              <p>{historySearch ? '没有匹配的对话' : '还没有历史对话'}</p>
              {historySearch && <button className="tb-btn" onClick={() => setHistorySearch('')}>清除搜索</button>}
            </div>
          ) : (
            sorted.map(conv => {
              const userMsgs = (conv.messages || []).filter(m => m.role === 'user');
              const lastUserMsg = userMsgs[userMsgs.length - 1]?.content || '';
              const preview = lastUserMsg.length > 80 ? lastUserMsg.slice(0, 80) + '...' : lastUserMsg;
              return (
                <div key={conv.id} className={`chat-history-card ${activeConvId === conv.id ? 'active' : ''}`}
                  onClick={() => { loadConv(conv); setHistoryMode(false); setHistorySearch(''); }}>
                  <div className="chat-history-card-main">
                    <div className="chat-history-card-header">
                      <span className="chat-history-card-title">{conv.title}</span>
                      <span className="chat-history-card-date">{new Date(conv.createdAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div className="chat-history-card-meta">
                      <span>💬 {userMsgs.length} 轮对话</span>
                      {conv.bookTitle && <span>📖 {conv.bookTitle}</span>}
                    </div>
                    {preview && <div className="chat-history-card-preview">{preview}</div>}
                  </div>
                  <button className="dir-btn dir-btn-del" onClick={e => {
                    e.stopPropagation();
                    if (confirm('删除这条对话？')) {
                      deleteAIConversation(conv.id);
                      if (activeConvId === conv.id) newConv();
                    }
                  }}>×</button>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  // 对话模式
  return (
    <div className="chat-view">
      {/* 顶部工具栏 */}
      <div className="chat-toolbar">
        <div className="toolbar-left">
          <span className="chat-toolbar-title">📖 {bookTitle || 'AI 写作伙伴'}</span>
          {bookContent && <span className="toolbar-wordcount">{bookContent.length} 字</span>}
        </div>
        <div className="toolbar-right">
          <button className="tool-btn" onClick={() => fileRef.current?.click()} disabled={uploading} title="上传书籍">
            {uploading ? '⏳' : '📁'}
          </button>
          {userCards.length > 0 && (
            <button className={`tool-btn ${cardMode ? 'active' : ''}`} onClick={() => setCardMode(true)} title="灵感卡片">
              🔖 <span className="tool-badge">{userCards.length}</span>
            </button>
          )}
          {aiConversations.length > 0 && (
            <button className="tool-btn" onClick={() => setHistoryMode(true)} title="历史记录">
              🕰️
            </button>
          )}
          <button className="tool-btn primary" onClick={newConv}>✨ 新对话</button>
        </div>
        <input ref={fileRef} type="file" accept=".txt,.docx,.doc,.html" style={{ display: 'none' }} onChange={handleUploadBook} />
      </div>

      {/* 对话列表下拉 */}
      {showConvList && (
        <div className="chat-conv-dropdown">
          {aiConversations.sort((a, b) => b.createdAt - a.createdAt).map(conv => (
            <div key={conv.id} className={`chat-conv-item ${activeConvId === conv.id ? 'active' : ''}`} onClick={() => loadConv(conv)}>
              <span className="chat-conv-title">{conv.title}</span>
              <span className="chat-conv-date">{new Date(conv.createdAt).toLocaleDateString('zh-CN')}</span>
              <button className="dir-btn dir-btn-del" onClick={e => { e.stopPropagation(); if (confirm('删除？')) { deleteAIConversation(conv.id); if (activeConvId === conv.id) newConv(); } }}>×</button>
            </div>
          ))}
        </div>
      )}

      {/* 书籍信息 */}
      {bookContent && (
        <div className="chat-book-bar">📖 {bookTitle || '已加载书籍'} ({bookContent.length}字)</div>
      )}

      {/* 消息 */}
      <div className="chat-messages" ref={messagesRef}>
        {messages.length === 0 ? (
          <div className="chat-empty">
            <span style={{ fontSize: 36 }}>💬</span>
            <p>AI 写作伙伴已就绪</p>
            <p className="chat-hint">上传一本书或点击下方按钮开始</p>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`chat-message ${m.role === 'user' ? 'is-user' : 'is-ai'}`}>
              <div className="chat-avatar">{m.role === 'user' ? '🙋' : '🤖'}</div>
              <div className="chat-bubble">{m.content}</div>
            </div>
          ))
        )}
        {loading && <div className="chat-message is-ai"><div className="chat-avatar">🤖</div><div className="chat-bubble thinking">思考中...</div></div>}
      </div>

      {questions.length > 0 && (
        <div className="chat-questions">{questions.map((q, i) => <button key={i} className="chat-q-btn" onClick={() => sendQuick(q)}>{q}</button>)}</div>
      )}
      {messages.length === 0 && questions.length === 0 && (
        <div className="chat-questions"><button className="chat-q-btn primary" onClick={generateQuestions} disabled={loading}>🤖 AI 生成思考问题</button></div>
      )}
      <div className="chat-input-row">
        <textarea className="chat-input" placeholder="输入你的想法..." value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }} rows={8} />
        <button className="chat-send" onClick={sendMessage} disabled={!input.trim() || loading}>➤</button>
      </div>
    </div>
  );
}

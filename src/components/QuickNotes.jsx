import React, { useState } from 'react';
import useStore from '../store';
import Icon from './Icon';

const MODES = {
  quick: {
    title: '⚡ 文字速记',
    desc: '快速记录一闪而过的想法',
    category: '灵感火花',
    placeholder: '✧ 写下你此刻的想法吧 ( ﾟ 3ﾟ) ✧',
  },
  film: {
    title: '🎬 拉片速记',
    desc: '记录镜头语言、场景调度、节奏分析',
    category: '拉片笔记',
    placeholder: '🎬 镜头/场景/调度/节奏... ･ﾟ( ﾉヮ´ )',
  },
};

export default function QuickNotes({ mode = 'quick', books, onClose }) {
  const { addInspirationCard } = useStore();
  const cfg = MODES[mode] || MODES.quick;
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [bookId, setBookId] = useState(null);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    if (!title.trim() && !content.trim()) return;
    addInspirationCard({
      title: title.trim() || cfg.title,
      content: content.trim(),
      category: cfg.category,
      source: mode === 'quick' ? 'manual' : 'manual',
      bookId,
    });
    setTitle('');
    setContent('');
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      handleSave();
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="quicknote-modal">
        <button className="modal-close" onClick={onClose}>✕</button>

        <div className="qn-header">
          <Icon name={mode === 'quick' ? 'quicknote' : 'film'} size={28} />
          <div>
            <span className="qn-title">{cfg.title}</span>
            <span className="qn-desc">{cfg.desc}</span>
          </div>
        </div>

        <div className="qn-body">
          <input
            className="qn-input"
            placeholder="标题（可选）"
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
          />
          <textarea
            className="qn-textarea"
            placeholder={cfg.placeholder}
            value={content}
            onChange={e => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={6}
          />
          <div className="qn-actions">
            <select value={bookId || ''} onChange={e => setBookId(e.target.value || null)}>
              <option value="">不关联书籍</option>
              {books.map(b => <option key={b.id} value={b.id}>{b.title}</option>)}
            </select>
            <button className="btn-save" onClick={handleSave}>
              💾 保存到灵感卡片
            </button>
          </div>
          {saved && <div className="save-confirm">✅ 已保存</div>}
        </div>
      </div>
    </div>
  );
}

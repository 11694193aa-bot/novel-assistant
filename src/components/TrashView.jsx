import React from 'react';
import useStore from '../store';

const TYPE_LABELS = {
  book: ' 书籍',
  chapter: '📄 章节',
  inspirationCard: ' 灵感卡片',
  mindMapCard: ' 思维导图卡片',
};

export default function TrashView({ onClose }) {
  const { trash, restoreFromTrash, permanentDelete, clearTrash } = useStore();

  const handleRestore = (id) => {
    restoreFromTrash(id);
  };

  const handleDelete = (id, label) => {
    if (confirm(`确定永久删除「${label}」？此操作不可撤销！`)) {
      permanentDelete(id);
    }
  };

  const handleClearAll = () => {
    if (trash.length === 0) return;
    if (confirm(`确定清空回收站？将永久删除全部 ${trash.length} 个项目！`)) {
      clearTrash();
    }
  };

  const getLabel = (entry) => {
    const { type, item } = entry;
    if (type === 'book') return item.title || '未命名书籍';
    if (type === 'chapter') return item.title || '未命名章节';
    if (type === 'inspirationCard') return item.title || '未命名卡片';
    if (type === 'mindMapCard') return item.title || '(无标题卡片)';
    return '未知';
  };

  const sorted = [...trash].sort((a, b) => b.deletedAt - a.deletedAt);

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="trash-modal">
        <button className="modal-close" onClick={onClose}>✕</button>

        <div className="trash-header">
          <h2>🗑️ 回收站</h2>
          <span className="trash-count">{trash.length} 个项目</span>
          {trash.length > 0 && (
            <button className="trash-clear-btn" onClick={handleClearAll}>清空回收站</button>
          )}
        </div>

        {sorted.length === 0 ? (
          <div className="trash-empty">
            <span style={{fontSize:40}}>📭</span>
            <p>( ﾟ∀。) 回收站空空如也~</p>
            <p className="hint">✧ 删除的内容会出现在这里 ✧</p>
          </div>
        ) : (
          <div className="trash-list">
            {sorted.map(entry => (
              <div key={entry.id} className="trash-item">
                <div className="trash-item-info">
                  <span className="trash-type">{TYPE_LABELS[entry.type] || entry.type}</span>
                  <span className="trash-label">{getLabel(entry)}</span>
                  <span className="trash-date">
                    {new Date(entry.deletedAt).toLocaleString('zh-CN')}
                  </span>
                </div>
                <div className="trash-item-actions">
                  <button className="trash-btn restore" onClick={() => handleRestore(entry.id)}>
                    ↩ 恢复
                  </button>
                  <button className="trash-btn delete" onClick={() => handleDelete(entry.id, getLabel(entry))}>
                    永久删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

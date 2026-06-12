import React from 'react';
import useStore from '../store';

export default function AnnotationSidebar({ bookId, onJump, onClose }) {
  const book = useStore(s => s.readingBooks.find(b => b.id === bookId));
  const annotations = book?.annotations || [];

  const handleJump = (ann) => {
    // 计算标注在全文中的比例位置
    const ratio = ann.startOffset / (book?.content?.length || 1);
    onJump(ratio);
  };

  const colorStyle = (c) => ({ background: c, width: 10, height: 10, borderRadius: '50%', display: 'inline-block', flexShrink: 0 });

  return (
    <div className="ann-sidebar">
      <div className="ann-sidebar-header">
        <span>标注笔记 ({annotations.length})</span>
        <button className="ann-sidebar-close" onClick={onClose}>✕</button>
      </div>
      {annotations.length === 0 ? (
        <div className="ann-sidebar-empty">暂无标注</div>
      ) : (
        <div className="ann-sidebar-list">
          {annotations.map(ann => (
            <div key={ann.id} className="ann-sidebar-item" onClick={() => handleJump(ann)}>
              <span style={colorStyle(ann.color)} />
              <div className="ann-sidebar-item-text">{ann.selectedText}</div>
              {ann.note && <div className="ann-sidebar-item-note">{ann.note}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

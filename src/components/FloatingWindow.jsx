import React, { useState, useEffect } from 'react';
import useStore from '../store';

export default function FloatingWindow({ x, y, bookId, chapterId, onClose }) {
  const { settings, books, addMindMapCard, addInspirationCard } = useStore();
  const [position, setPosition] = useState({ x, y });
  const [dragging, setDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(settings.windowOpacity || 0.9);

  const book = books.find(b => b.id === bookId);
  const chapter = book?.chapters?.find(c => c.id === chapterId);

  useEffect(() => {
    setOpacity(settings.windowOpacity || 0.9);
  }, [settings.windowOpacity]);

  const handleMouseDown = (e) => {
    if (e.target.classList.contains('float-header')) {
      setDragging(true);
      setDragOffset({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (dragging) {
        setPosition({ x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y });
      }
    };
    const handleMouseUp = () => setDragging(false);
    if (dragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, dragOffset]);

  const handleExtractToCard = () => {
    addMindMapCard(bookId, `${chapter?.title || '章节'} - 卡片`, chapter?.content?.slice(0, 200) || '', null);
  };

  const handleExtractToInspiration = () => {
    addInspirationCard({
      title: `提示: ${chapter?.title || '章节'}`,
      content: chapter?.content?.slice(0, 300) || '',
      category: '章节笔记',
      source: 'extract',
      bookId,
    });
  };

  return (
    <div
      className="floating-window"
      style={{
        left: position.x,
        top: position.y,
        opacity,
        cursor: dragging ? 'grabbing' : 'default',
      }}
      onMouseDown={handleMouseDown}
    >
      <div className="float-header" style={{ cursor: 'grab' }}>
        <span> 提示卡片</span>
        <div className="float-header-actions">
          <input
            type="range"
            min="0.3"
            max="1"
            step="0.05"
            value={opacity}
            onChange={(e) => setOpacity(parseFloat(e.target.value))}
            title="透明度"
            className="float-opacity-slider"
          />
          <button onClick={onClose}>✕</button>
        </div>
      </div>
      <div className="float-body">
        <div className="float-info">
          <strong>章节:</strong> {chapter?.title || '未知'}
        </div>
        <div className="float-actions">
          <button onClick={handleExtractToCard}>
            提取到思维导图
          </button>
          <button onClick={handleExtractToInspiration}>
             提取到灵感卡片
          </button>
        </div>
        <div className="float-preview">
          {chapter?.content ? chapter.content.slice(0, 200) + (chapter.content.length > 200 ? '...' : '') : '暂无内容'}
        </div>
      </div>
    </div>
  );
}

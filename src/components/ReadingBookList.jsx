import React, { useState, useRef } from 'react';
import useStore from '../store';
import CatIcon from './CatIcon';
import { importBookFile } from '../utils/importBook';

export default function ReadingBookList({ isMobile, onSelectBook, onOpenReader }) {
  const { readingBooks, addReadingBook, deleteReadingBook, renameReadingBook, markDirty, persist } = useStore();
  const [importing, setImporting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const fileRef = useRef(null);

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const bookData = await importBookFile(file);
      const book = addReadingBook(bookData);
      persist();
      // 导入完成后直接打开阅读
      if (onOpenReader) onOpenReader(book.id);
    } catch (err) {
      alert('导入失败：' + err.message);
    }
    setImporting(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleDelete = (id, title) => {
    if (confirm(`删除《${title}》？\n可在回收站恢复。`)) {
      deleteReadingBook(id);
    }
  };

  const formatDate = (ts) => {
    return new Date(ts).toLocaleDateString('zh-CN');
  };

  const formatLabel = (fmt) => {
    return { epub: 'EPUB', txt: 'TXT', pdf: 'PDF' }[fmt] || fmt.toUpperCase();
  };

  const formatCount = (len) => {
    if (len >= 10000) return (len / 10000).toFixed(1) + '万字';
    if (len >= 1000) return (len / 1000).toFixed(1) + '千字';
    return len + '字';
  };

  return (
    <div className="reading-book-list">
      {/* 顶部栏 */}
      <div className="rbl-header">
        <h1 className="rbl-title"><CatIcon name="reading" size={20} /> 我的书房</h1>
        <button
          className="rbl-import-btn"
          onClick={() => fileRef.current?.click()}
          disabled={importing}
          title="导入书籍（EPUB/TXT/PDF）"
        >
          {importing ? '⏳ 解析中...' : '📥 导入'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".epub,.txt,.pdf"
          style={{ display: 'none' }}
          onChange={handleImport}
        />
      </div>

      {/* 空状态 */}
      {readingBooks.length === 0 ? (
        <div className="reading-empty">
          <CatIcon name="reading" size={52} />
          <p>还没有导入书籍呢~</p>
          <p className="reading-empty-hint">点击「📥 导入」添加 EPUB / TXT / PDF</p>
        </div>
      ) : (
        <div className="reading-book-grid">
          {readingBooks.map(b => (
            <div
              key={b.id}
              className="reading-book-card"
              onClick={() => { if (!editingId && onOpenReader) onOpenReader(b.id); }}
              onContextMenu={(e) => { e.preventDefault(); setEditingId(b.id); }}
              onTouchStart={(e) => {
                const timer = setTimeout(() => setEditingId(b.id), 600);
                e.currentTarget._longPress = timer;
              }}
              onTouchEnd={(e) => { clearTimeout(e.currentTarget._longPress); }}
              onTouchMove={(e) => { clearTimeout(e.currentTarget._longPress); }}
            >
              {/* 封面 */}
              <div className="reading-book-cover">
                {b.cover ? (
                  <img src={b.cover} alt="" />
                ) : (
                  <span className="reading-book-cover-icon"><CatIcon name="reading" size={32} /></span>
                )}
              </div>

              {/* 信息 */}
              <div className="reading-book-info">
                {editingId === b.id ? (
                  <input
                    className="reading-inline-edit"
                    defaultValue={b.title}
                    autoFocus
                    onBlur={(e) => { renameReadingBook(b.id, e.target.value || b.title); setEditingId(null); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { renameReadingBook(b.id, e.target.value || b.title); setEditingId(null); } }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <>
                    <div className="reading-book-title">{b.title}</div>
                    {b.author && <div className="reading-book-author">{b.author}</div>}
                  </>
                )}
                <div className="reading-book-meta">
                  <span className="reading-book-badge">{formatLabel(b.sourceFormat)}</span>
                  <span>{formatCount(b.totalChars)}</span>
                  <span>·</span>
                  <span>{formatDate(b.createdAt)}</span>
                  {b.annotations?.length > 0 && (
                    <><span>·</span><span style={{color:'var(--pink)'}}>{b.annotations.length}条笔记</span></>
                  )}
                </div>
                {/* 进度条 */}
                {b.totalChars > 0 && (
                  <div className="reading-progress-bar">
                    <div className="reading-progress-fill" style={{
                      width: Math.min(100, ((b.readingProgress || 0) / b.totalChars) * 100) + '%'
                    }} />
                  </div>
                )}
              </div>

              {/* 操作 */}
              <div className="reading-book-actions">
                <button
                  className="reading-action-btn"
                  title="删除"
                  onClick={(e) => { e.stopPropagation(); handleDelete(b.id, b.title); }}
                >🗑</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

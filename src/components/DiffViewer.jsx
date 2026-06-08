import React, { useState, useEffect } from 'react';
import { listHistory, loadHistoryVersion } from '../utils/storage';

// 简易文本差异对比器
function computeDiff(oldText, newText) {
  const oldLines = (oldText || '').split('\n');
  const newLines = (newText || '').split('\n');
  const maxLen = Math.max(oldLines.length, newLines.length);
  const result = [];

  for (let i = 0; i < maxLen; i++) {
    const oldLine = oldLines[i] || '';
    const newLine = newLines[i] || '';
    if (oldLine === newLine) {
      result.push({ type: 'same', text: newLine, lineNum: i + 1 });
    } else if (!oldLine) {
      result.push({ type: 'added', text: newLine, lineNum: i + 1 });
    } else if (!newLine) {
      result.push({ type: 'removed', text: oldLine, lineNum: i + 1 });
    } else {
      // 逐字比较
      result.push({ type: 'same', text: '', lineNum: i + 1, _skip: true }); // 占位行号
      const charDiff = computeCharDiff(oldLine, newLine);
      result.push(...charDiff.map(d => ({ ...d, _sub: true })));
    }
  }
  return result;
}

function computeCharDiff(oldStr, newStr) {
  const result = [];
  const maxLen = Math.max(oldStr.length, newStr.length);

  // 找共同前缀
  let prefixEnd = 0;
  while (prefixEnd < maxLen && oldStr[prefixEnd] === newStr[prefixEnd]) prefixEnd++;

  // 找共同后缀
  let suffixStartOld = oldStr.length;
  let suffixStartNew = newStr.length;
  while (suffixStartOld > prefixEnd && suffixStartNew > prefixEnd &&
    oldStr[suffixStartOld - 1] === newStr[suffixStartNew - 1]) {
    suffixStartOld--;
    suffixStartNew--;
  }

  if (prefixEnd > 0) {
    result.push({ type: 'same', text: oldStr.slice(0, prefixEnd) });
  }
  if (suffixStartOld > prefixEnd) {
    result.push({ type: 'removed', text: oldStr.slice(prefixEnd, suffixStartOld) });
  }
  if (suffixStartNew > prefixEnd) {
    result.push({ type: 'added', text: newStr.slice(prefixEnd, suffixStartNew) });
  }
  if (suffixStartOld < oldStr.length) {
    result.push({ type: 'same', text: oldStr.slice(suffixStartOld) });
  }

  return result;
}

export default function DiffViewer({ books, inspirationCards, target, onClose }) {
  const [versions, setVersions] = useState([]);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [diffResult, setDiffResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState('chapter'); // chapter | inspiration
  const [selectedBookId, setSelectedBookId] = useState(null);
  const [selectedChapterId, setSelectedChapterId] = useState(null);

  useEffect(() => {
    loadVersions();
  }, [viewMode]);

  const loadVersions = async () => {
    setLoading(true);
    // 直接加载当前data作为版本来源
    const v = await listHistory('novel_app_data');
    setVersions(v);
    setLoading(false);
  };

  const handleCompare = async (version) => {
    setSelectedVersion(version);
    setLoading(true);
    const oldData = await loadHistoryVersion('novel_app_data', version.timestamp);
    if (!oldData) {
      setDiffResult(null);
      setLoading(false);
      return;
    }

    let oldText = '';
    let newText = '';

    if (viewMode === 'chapter' && selectedBookId && selectedChapterId) {
      const oldBook = (oldData.books || []).find(b => b.id === selectedBookId);
      const oldCh = oldBook?.chapters?.find(c => c.id === selectedChapterId);
      oldText = oldCh?.content || '';

      const newBook = books.find(b => b.id === selectedBookId);
      const newCh = newBook?.chapters?.find(c => c.id === selectedChapterId);
      newText = newCh?.content || '';
    } else if (viewMode === 'inspiration' && target?.cardId) {
      const oldCard = (oldData.inspirationCards || []).find(c => c.id === target.cardId);
      oldText = oldCard?.content || '';

      const newCard = inspirationCards.find(c => c.id === target.cardId);
      newText = newCard?.content || '';
    }

    setDiffResult(computeDiff(oldText, newText));
    setLoading(false);
  };

  return (
    <div className={`diff-viewer ${onClose ? 'modal-overlay' : ''}`} onClick={(e) => onClose && e.target === e.currentTarget && onClose()}>
      <div className={`diff-container ${onClose ? 'diff-modal' : ''}`}>
        {onClose && <button className="modal-close" onClick={onClose}>✕</button>}

        <div className="diff-header">
          <h2>📜 历史版本对比</h2>
          <div className="diff-tabs">
            <button
              className={`diff-tab ${viewMode === 'chapter' ? 'active' : ''}`}
              onClick={() => setViewMode('chapter')}
            >
              📖 章节对比
            </button>
            <button
              className={`diff-tab ${viewMode === 'inspiration' ? 'active' : ''}`}
              onClick={() => setViewMode('inspiration')}
            >
              💡 灵感对比
            </button>
          </div>
        </div>

        {viewMode === 'chapter' && (
          <div className="diff-selectors">
            <select value={selectedBookId || ''} onChange={e => { setSelectedBookId(e.target.value); setSelectedChapterId(null); }}>
              <option value="">选择书籍...</option>
              {books.map(b => <option key={b.id} value={b.id}>{b.title}</option>)}
            </select>
            {selectedBookId && (
              <select value={selectedChapterId || ''} onChange={e => setSelectedChapterId(e.target.value)}>
                <option value="">选择章节...</option>
                {(books.find(b => b.id === selectedBookId)?.chapters || []).map(c => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
            )}
          </div>
        )}

        <div className="diff-main">
          <div className="diff-version-list">
            <h3>历史版本 ({versions.length}/20)</h3>
            {versions.length === 0 ? (
              <p className="diff-empty">暂无历史版本，存档将在编辑时自动生成</p>
            ) : (
              versions.map(v => (
                <div
                  key={v.timestamp}
                  className={`diff-version-item ${selectedVersion?.timestamp === v.timestamp ? 'active' : ''}`}
                  onClick={() => handleCompare(v)}
                >
                  <span className="version-cat">🐱</span>
                  <span>{v.label}</span>
                </div>
              ))
            )}
          </div>

          <div className="diff-result">
            {loading ? (
              <div className="diff-loading">🐱 喵~ 正在加载对比...</div>
            ) : diffResult ? (
              <div className="diff-content">
                <div className="diff-legend">
                  <span className="diff-legend-added">🟢 新增内容（红字）</span>
                  <span className="diff-legend-removed">🔴 删除内容</span>
                  <span className="diff-legend-info">对比版本: {selectedVersion?.label}</span>
                </div>
                <div className="diff-lines">
                  {diffResult.filter(d => !d._skip).map((d, i) => (
                    <div key={i} className={`diff-line diff-${d.type} ${d._sub ? 'diff-sub' : ''}`}>
                      {!d._sub && <span className="diff-line-num">{d.lineNum}</span>}
                      <span className="diff-line-text">{d.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="diff-placeholder">
                <span className="empty-cat">🐱</span>
                <p>选择一个历史版本进行对比</p>
                <p className="hint">不同的文字将以红色标亮显示</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

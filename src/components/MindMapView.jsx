import React, { useState, useEffect, useRef } from 'react';
import useStore, { uid } from '../store';
import mammoth from 'mammoth';
import { BookCoverImg } from './Icon';
import CatIcon from './CatIcon';

export default function MindMapView({ books, selectedBookId, onSelectBook, focusCardId, onFocusCard, isMobile, focusMode: extFocus, onSetFocus }) {
  const { addBook, renameBook, deleteBook, addMindMapCard, deleteMindMapCard, updateMindMapCard, moveMindMapCard, reorderMindMapCard, addMindMapCards, setBookCover } = useStore();
  const [showBookPopover, setShowBookPopover] = useState(false);
  const [treeMode, setTreeMode] = useState(false);
  // 树状列表：折叠状态 & 拖拽状态
  const [collapsedNodes, setCollapsedNodes] = useState(new Set());
  const [treeDragId, setTreeDragId] = useState(null);
  const [treeDropTarget, setTreeDropTarget] = useState(null);
  const [editingNodeId, setEditingNodeId] = useState(null);
  const [treeLinesKey, setTreeLinesKey] = useState(0);
  const [displayScale, setDisplayScale] = useState(1);
  const [innerFocus, setInnerFocus] = useState(false);
  const focusMode = extFocus !== undefined ? extFocus : innerFocus;
  const setFocus = onSetFocus || ((v) => setInnerFocus(v));

  useEffect(() => {
    if (focusMode) document.body.classList.add('mindmap-focus');
    else document.body.classList.remove('mindmap-focus');
    return () => document.body.classList.remove('mindmap-focus');
  }, [focusMode]);
  const [dragOverId, setDragOverId] = useState(null);
  const [draggedId, setDraggedId] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [bookBatchMode, setBookBatchMode] = useState(false);
  const [selectedBooks, setSelectedBooks] = useState(new Set());
  const [editingBookId, setEditingBookId] = useState(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);
  const prevBookRef = useRef(null);
  // 触摸拖拽状态（卡片模式）
  const [touchDragId, setTouchDragId] = useState(null);
  const [touchGhostPos, setTouchGhostPos] = useState(null);
  const touchStartRef = useRef(null);
  const touchDragRef = useRef(null);
  const touchDragIdRef = useRef(null);
  // 树状图平移/缩放 — 纯 transform 方案
  const treeViewportRef = useRef(null);
  const scaleRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  const dragRef = useRef({ active: false, sx: 0, sy: 0, tx: 0, ty: 0 });

  const book = books.find(b => b.id === selectedBookId);

  // 自动选中上次打开的书
  useEffect(() => {
    if (books.length > 0 && !selectedBookId) {
      if (prevBookRef.current && books.find(b => b.id === prevBookRef.current)) {
        onSelectBook(prevBookRef.current);
      } else {
        onSelectBook(books[0].id);
      }
    }
  }, [books, selectedBookId]);

  useEffect(() => {
    if (selectedBookId) prevBookRef.current = selectedBookId;
  }, [selectedBookId]);

  // ==== 书籍操作 ====
  const handleAddBook = () => {
    const b = addBook('新书籍');
    onSelectBook(b.id);
  };

  // ==== 卡片操作 ====
  const handleAddParent = () => {
    if (!selectedBookId) return;
    addMindMapCard(selectedBookId, '新卡片', '');
  };

  const handleAddChild = (parentId) => {
    if (!selectedBookId) return;
    addMindMapCard(selectedBookId, '', '', parentId);
  };

  const handleDelete = (cardId) => {
    deleteMindMapCard(selectedBookId, cardId);
  };

  // ==== 树状列表拖拽 ====
  const toggleCollapse = (cardId) => {
    setCollapsedNodes(prev => {
      const next = new Set(prev);
      next.has(cardId) ? next.delete(cardId) : next.add(cardId);
      return next;
    });
  };

  // 获取drop位置：根据鼠标Y相对于目标行的位置判断 inside/before/after
  const getDropPos = (e, el) => {
    const rect = el.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const h = rect.height;
    if (y < h * 0.25) return 'before';
    if (y > h * 0.75) return 'after';
    return 'inside';
  };

  const handleTreeDragStart = (e, card) => {
    setTreeDragId(card.id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', card.id);
  };
  const handleTreeDragEnd = () => { setTreeDragId(null); setTreeDropTarget(null); };
  const handleTreeDragOver = (e, card) => {
    e.preventDefault();
    if (!treeDragId || treeDragId === card.id) return;
    const el = e.currentTarget;
    const pos = getDropPos(e, el);
    setTreeDropTarget({ id: card.id, pos });
  };
  const handleTreeDragLeave = () => { setTreeDropTarget(null); };
  const handleTreeDrop = (e, targetCard) => {
    e.preventDefault();
    if (!treeDragId || treeDragId === targetCard.id) { setTreeDragId(null); setTreeDropTarget(null); return; }
    const el = e.currentTarget;
    const pos = getDropPos(e, el);
    if (pos === 'inside') {
      moveMindMapCard(selectedBookId, treeDragId, targetCard.id);
      setCollapsedNodes(prev => { const next = new Set(prev); next.delete(targetCard.id); return next; });
    } else {
      reorderMindMapCard(selectedBookId, treeDragId, targetCard.id, pos === 'before');
    }
    setTreeDragId(null);
    setTreeDropTarget(null);
  };

  // ==== 触摸拖拽（树状列表）====
  const treeTouchRef = useRef(null);
  const treeTouchTimerRef = useRef(null);
  const treeTouchStartPos = useRef(null);
  const [touchGhost, setTouchGhost] = useState(null);

  const clearTreeTouchDrag = () => {
    clearTimeout(treeTouchTimerRef.current);
    treeTouchTimerRef.current = null;
    treeTouchRef.current = null;
    treeTouchStartPos.current = null;
    setTreeDragId(null);
    setTouchGhost(null);
    setTreeDropTarget(null);
  };

  const handleTreeTouchStart = (e, card) => {
    if (e.touches.length > 1) return;
    clearTreeTouchDrag();
    const touch = e.touches[0];
    treeTouchStartPos.current = { x: touch.clientX, y: touch.clientY };
    treeTouchTimerRef.current = setTimeout(() => {
      treeTouchRef.current = card.id;
      setTreeDragId(card.id);
      setTouchGhost({ x: touch.clientX, y: touch.clientY, title: card.title });
    }, 500);
  };
  const handleTreeTouchMove = (e) => {
    if (!treeTouchRef.current) {
      // 手指移动超过 10px 才取消长按（允许微动）
      if (treeTouchStartPos.current) {
        const dx = e.touches[0].clientX - treeTouchStartPos.current.x;
        const dy = e.touches[0].clientY - treeTouchStartPos.current.y;
        if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
          clearTimeout(treeTouchTimerRef.current);
          treeTouchTimerRef.current = null;
        }
      }
      return;
    }
    const touch = e.touches[0];
    setTouchGhost(prev => prev ? { ...prev, x: touch.clientX, y: touch.clientY } : null);
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    const node = el?.closest('.tree-node');
    if (node) {
      const targetId = node.dataset.cardId;
      if (targetId && targetId !== treeTouchRef.current) {
        const rect = node.getBoundingClientRect();
        const y = touch.clientY - rect.top;
        const h = rect.height;
        let pos = 'inside';
        if (y < h * 0.25) pos = 'before';
        else if (y > h * 0.75) pos = 'after';
        setTreeDropTarget({ id: targetId, pos });
      } else {
        setTreeDropTarget(null);
      }
    } else {
      setTreeDropTarget(null);
    }
  };
  const handleTreeTouchEnd = (e) => {
    clearTimeout(treeTouchTimerRef.current);
    treeTouchTimerRef.current = null;
    if (!treeTouchRef.current) { setTouchGhost(null); return; }
    const dragId = treeTouchRef.current;
    const touch = e.changedTouches[0];
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    const node = el?.closest('.tree-node');
    if (node) {
      const targetId = node.dataset.cardId;
      if (targetId && targetId !== dragId) {
        const rect = node.getBoundingClientRect();
        const y = touch.clientY - rect.top;
        const h = rect.height;
        let pos = 'inside';
        if (y < h * 0.25) pos = 'before';
        else if (y > h * 0.75) pos = 'after';
        if (pos === 'inside') {
          moveMindMapCard(selectedBookId, dragId, targetId);
          setCollapsedNodes(prev => { const next = new Set(prev); next.delete(targetId); return next; });
        } else {
          reorderMindMapCard(selectedBookId, dragId, targetId, pos === 'before');
        }
      }
    }
    clearTreeTouchDrag();
  };

  // document-level fallback: if touchend fires outside the tree node
  useEffect(() => {
    const onTouchEnd = () => {
      if (treeTouchRef.current) clearTreeTouchDrag();
      if (touchDragIdRef.current) clearTouchDrag();
    };
    document.addEventListener('touchcancel', onTouchEnd);
    return () => document.removeEventListener('touchcancel', onTouchEnd);
  }, []);

  // ==== 拖拽 ====
  const handleDragStart = (e, card) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ cardId: card.id }));
    setDraggedId(card.id);
  };
  const handleDragEnd = () => { setDraggedId(null); setDragOverId(null); };
  const handleDragOver = (e, card) => {
    e.preventDefault();
    if (draggedId && draggedId !== card.id) setDragOverId(card.id);
  };
  // 递归查找卡片
  const findCardById = (cards, id) => {
    for (const c of cards) {
      if (c.id === id) return c;
      const found = findCardById(c.children || [], id);
      if (found) return found;
    }
    return null;
  };
  // 检查 targetId 是否是 ancestorId 的子孙
  const isDescendantOf = (cards, ancestorId, targetId) => {
    const ancestor = findCardById(cards, ancestorId);
    if (!ancestor) return false;
    return !!findCardById(ancestor.children || [], targetId);
  };

  const handleDrop = (e, targetCard) => {
    e.preventDefault(); setDragOverId(null); setDraggedId(null);
    try {
      const { cardId } = JSON.parse(e.dataTransfer.getData('text/plain'));
      if (!cardId || cardId === targetCard.id) return;
      const allCards = book?.mindMapCards || [];
      if (isDescendantOf(allCards, cardId, targetCard.id)) return;
      moveMindMapCard(selectedBookId, cardId, targetCard.id);
    } catch (err) { /* ignore */ }
  };

  // ==== 触摸拖拽（卡片模式） ====
  const clearTouchDrag = () => {
    touchDragIdRef.current = null;
    setTouchDragId(null);
    setTouchGhostPos(null);
    setDragOverId(null);
    touchStartRef.current = null;
    clearTimeout(touchDragRef.current);
  };

  const handleTouchDragStart = (e, card) => {
    e.stopPropagation();
    if (e.touches.length > 1) return;
    clearTouchDrag();
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY, cardId: card.id };
    touchDragRef.current = setTimeout(() => {
      touchDragIdRef.current = card.id;
      setTouchDragId(card.id);
      setTouchGhostPos({ x: touch.clientX, y: touch.clientY });
    }, 400);
  };
  const handleTouchDragMove = (e) => {
    if (!touchDragIdRef.current) {
      // not dragging yet — if finger moved too far, cancel the long-press timer
      if (touchStartRef.current) {
        const dx = e.touches[0].clientX - touchStartRef.current.x;
        const dy = e.touches[0].clientY - touchStartRef.current.y;
        if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
          clearTimeout(touchDragRef.current);
          touchStartRef.current = null;
        }
      }
      return;
    }
    const touch = e.touches[0];
    setTouchGhostPos({ x: touch.clientX, y: touch.clientY });
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    const cardEl = el?.closest('.mm-card');
    if (cardEl) {
      const cardId = cardEl.dataset?.cardId || cardEl.getAttribute('data-card-id');
      if (cardId && cardId !== touchDragIdRef.current) setDragOverId(cardId);
      else setDragOverId(null);
    } else {
      setDragOverId(null);
    }
  };
  const handleTouchDragEnd = (e) => {
    clearTimeout(touchDragRef.current);
    const dragId = touchDragIdRef.current;
    if (dragId && dragOverId && dragOverId !== dragId) {
      const allCards = book?.mindMapCards || [];
      if (!isDescendantOf(allCards, dragId, dragOverId)) {
        moveMindMapCard(selectedBookId, dragId, dragOverId);
      }
    }
    clearTouchDrag();
  };
  const handleTouchCancel = () => clearTouchDrag();

  // ==== 直接操作 DOM transform，避免 React 每帧重渲染 ====
  const applyTransform = () => {
    const el = document.getElementById('treeZoomContainer');
    if (el) {
      el.style.transform = `translate(${panRef.current.x}px, ${panRef.current.y}px) scale(${scaleRef.current})`;
      el.style.transformOrigin = '0 0';
    }
  };

  // ==== document 级 pointer 监听（拖拽时不丢失事件）====
  useEffect(() => {
    const onMove = (e) => {
      if (!dragRef.current.active) return;
      panRef.current.x = dragRef.current.tx + (e.clientX - dragRef.current.sx);
      panRef.current.y = dragRef.current.ty + (e.clientY - dragRef.current.sy);
      applyTransform();
    };
    const onUp = () => {
      if (!dragRef.current.active) return;
      dragRef.current.active = false;
      treeViewportRef.current?.classList.remove('grabbing');
    };
    document.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerup', onUp);
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    };
  }, []);

  // ==== 拖拽起点（仅在空白处左键）====
  const handleTreePointerDown = (e) => {
    if (e.target.closest('.tree-node') || e.target.closest('input')
      || e.target.closest('textarea') || e.target.closest('button')) return;
    if (e.button !== 0) return;
    e.preventDefault();
    dragRef.current = {
      active: true,
      sx: e.clientX, sy: e.clientY,
      tx: panRef.current.x, ty: panRef.current.y,
    };
    treeViewportRef.current?.classList.add('grabbing');
  };

  // ==== 点击空白处退出编辑（仅在画布空白区生效）====
  const handleTreeClick = (e) => {
    // 必须在思维导图画布区域内
    if (!e.target.closest('.tree-viewport')) return;
    // 不能点在卡片、按钮、输入框等控件上
    if (e.target.closest('.tree-node, button, input, textarea, .tree-zoom-controls')) return;
    if (editingNodeRef.current) saveEdit();
  };

  // ==== 双指缩放（手机端）====
  const pinchRef = useRef(null);
  const handleTreeTouchStart2 = (e) => {
    if (e.touches.length === 2) {
      clearTreeTouchDrag();
      clearTouchDrag();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchRef.current = { dist: Math.hypot(dx, dy), scale: scaleRef.current };
    }
  };
  const handleTreeTouchMove2 = (e) => {
    if (e.touches.length === 2 && pinchRef.current) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const newDist = Math.hypot(dx, dy);
      const ratio = newDist / pinchRef.current.dist;
      const next = Math.min(3, Math.max(0.3, pinchRef.current.scale * ratio));
      scaleRef.current = next;
      applyTransform();
      setDisplayScale(next);
      scheduleLinesUpdate();
    }
  };
  const handleTreeTouchEnd2 = () => { pinchRef.current = null; };

  // ==== 滚轮缩放（以鼠标为中心）====
  const handleTreeWheel = (e) => {
    e.preventDefault();
    const old = scaleRef.current;
    const delta = e.deltaY > 0 ? -0.001 : 0.001;
    const next = Math.min(3, Math.max(0.3, old + delta * old * 5)); // 指数感
    if (Math.abs(next - old) < 0.001) return;

    scaleRef.current = next;
    // 鼠标中心补偿
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    panRef.current.x -= mx * (next / old - 1);
    panRef.current.y -= my * (next / old - 1);

    applyTransform();
    setDisplayScale(next);
    scheduleLinesUpdate();
  };

  // ==== 缩放按钮 ====
  const handleZoomIn = () => {
    const old = scaleRef.current;
    const next = Math.min(3, old + 0.15);
    if (next === old) return;
    scaleRef.current = next;
    applyTransform();
    setDisplayScale(next);
    scheduleLinesUpdate();
  };
  const handleZoomOut = () => {
    const old = scaleRef.current;
    const next = Math.max(0.3, old - 0.15);
    if (next === old) return;
    scaleRef.current = next;
    applyTransform();
    setDisplayScale(next);
    scheduleLinesUpdate();
  };
  const handleZoomReset = () => {
    scaleRef.current = 1;
    panRef.current = { x: 0, y: 0 };
    applyTransform();
    setDisplayScale(1);
    scheduleLinesUpdate();
  };

  // ==== 编辑状态管理 ====
  const editingNodeRef = useRef(null);
  useEffect(() => { editingNodeRef.current = editingNodeId; }, [editingNodeId]);

  const enterEdit = (card) => {
    setEditingNodeId(card.id);
  };

  // 立即保存（Ctrl+Enter 调用）
  const saveEditNow = () => {
    const nodeId = editingNodeRef.current;
    if (!nodeId || !selectedBookId) return;
    const el = document.querySelector(`.tree-node[data-card-id="${nodeId}"]`);
    if (!el) { setEditingNodeId(null); return; }
    const titleEl = el.querySelector('.tree-edit-title');
    const contentEl = el.querySelector('.tree-edit-content');
    const title = titleEl?.value ?? '';
    const content = contentEl?.value ?? '';
    updateMindMapCard(selectedBookId, nodeId, { title, content });
    setEditingNodeId(null);
    scheduleLinesUpdate();
  };

  // 失焦延迟保存（允许在 title/textarea 之间切换焦点）
  const saveEdit = () => {
    const nodeId = editingNodeRef.current;
    setTimeout(() => {
      if (!nodeId || !selectedBookId) return;
      if (editingNodeRef.current !== nodeId) return;
      const el = document.querySelector(`.tree-node[data-card-id="${nodeId}"]`);
      if (!el) { if (editingNodeRef.current === nodeId) setEditingNodeId(null); return; }
      // 焦点仍在卡片内（title↔textarea 切换）→ 不保存
      if (el.contains(document.activeElement)) return;
      const titleEl = el.querySelector('.tree-edit-title');
      const contentEl = el.querySelector('.tree-edit-content');
      const title = titleEl?.value ?? '';
      const content = contentEl?.value ?? '';
      updateMindMapCard(selectedBookId, nodeId, { title, content });
      setEditingNodeId(null);
      scheduleLinesUpdate();
    }, 150);
  };

  // textarea 自适应高度 + 保存快捷键
  const handleEditKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      saveEditNow();
    }
  };
  const handleTextareaInput = (e) => {
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';
  };
  const textareaInitRef = (el) => {
    if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }
  };

  // 延迟刷新 SVG 连线（等 DOM 更新后）
  const linesTimer = useRef(null);
  const scheduleLinesUpdate = () => {
    clearTimeout(linesTimer.current);
    linesTimer.current = setTimeout(() => setTreeLinesKey(k => k + 1), 120);
  };
  useEffect(() => { return () => clearTimeout(linesTimer.current); }, []);

  // ==== 递归渲染树节点（重构版：编辑模式 + 悬浮+按钮） ====
  const renderTreeNode = (card) => {
    const isEditing = editingNodeId === card.id;
    const hasKids = (card.children || []).length > 0;
    const expanded = !collapsedNodes.has(card.id);
    const hasTitle = card.title && card.title.trim().length > 0;
    const hasContent = card.content && card.content.trim().length > 0;
    const isRoot = !card.parentId;
    const nodeClass = isRoot ? 'tree-root-node'
      : (hasTitle && !hasKids ? 'tree-text-node' : 'tree-chapter-node');
    const isDragging = treeDragId === card.id;
    const dropInfo = treeDropTarget?.id === card.id ? treeDropTarget.pos : null;

    const handleAddClick = (e) => {
      e.stopPropagation();
      if (!selectedBookId) return;
      addMindMapCard(selectedBookId, '', '', card.id);
      scheduleLinesUpdate();
    };
    const handleDoubleClick = (e) => {
      e.stopPropagation();
      if (!isEditing) enterEdit(card);
    };
    const toggleNode = (e) => {
      e.stopPropagation();
      toggleCollapse(card.id);
      scheduleLinesUpdate();
    };
    const showMenu = (e) => {
      e.stopPropagation(); e.preventDefault();
      showCardMenu(e.clientX || e.touches?.[0]?.clientX || 0, e.clientY || e.touches?.[0]?.clientY || 0, card, !!card.parentId);
    };

    return (
      <li key={card.id}>
        <div
          className={`tree-node ${nodeClass}${isEditing ? ' editing' : ''}${isDragging ? ' drag-active' : ''}${dropInfo === 'inside' ? ' drag-over-inside' : ''}${dropInfo === 'before' ? ' drag-over-before' : ''}${dropInfo === 'after' ? ' drag-over-after' : ''}`}
          data-card-id={card.id}
          draggable
          onDragStart={(e) => { e.stopPropagation(); handleTreeDragStart(e, card); }}
          onDragEnd={handleTreeDragEnd}
          onDragOver={(e) => { e.stopPropagation(); e.preventDefault(); if (treeDragId && treeDragId !== card.id) handleTreeDragOver(e, card); }}
          onDragLeave={handleTreeDragLeave}
          onDrop={(e) => { e.stopPropagation(); handleTreeDrop(e, card); }}
          onTouchStart={(e) => handleTreeTouchStart(e, card)}
          onTouchEnd={handleTreeTouchEnd}
          onTouchMove={handleTreeTouchMove}
          onDoubleClick={handleDoubleClick}
          onContextMenu={showMenu}
        >
          {hasKids && (
            <button className="tree-collapse-btn" onClick={toggleNode} title={expanded ? '折叠' : '展开'}>
              {expanded ? '▼' : '▶'}
            </button>
          )}
          {!isEditing && (
            <div className="tree-node-add" onClick={handleAddClick} title="添加子卡片">+</div>
          )}
          <span className="tree-menu-handle"
            onClick={(e) => { e.stopPropagation(); showMenu(e); }}
            onTouchStart={(e) => { e.stopPropagation(); }}
            onTouchMove={(e) => { e.stopPropagation(); }}
            onTouchEnd={(e) => { e.stopPropagation(); e.preventDefault(); showMenu(e); }}
            title="菜单">⋯</span>
          {isEditing ? (
            <>
              <textarea className="tree-edit-content" defaultValue={card.content || ''} placeholder="输入内容..." autoFocus onKeyDown={handleEditKeyDown} onInput={handleTextareaInput} onBlur={saveEdit} ref={textareaInitRef} />
              <div className="tree-edit-hint">Ctrl+Enter 保存 · 点击外自动保存</div>
            </>
          ) : (
            <>
              {hasContent && <div className="tree-node-content" style={{whiteSpace:'pre-wrap'}}>{card.content}</div>}
              {!hasContent && (
                <div className="tree-node-empty">双击编辑 · 悬停+建子节点</div>
              )}
            </>
          )}
        </div>
        {hasKids && expanded && (
          <ul>{card.children.map(child => renderTreeNode(child))}</ul>
        )}
      </li>
    );
  };

  // ==== SVG 贝塞尔连线计算（需除以 scale：SVG在缩放容器内，坐标要转换）====
  const calcBezierPaths = (container, scale) => {
    const paths = [];
    if (!container || !scale) return paths;
    const nodes = container.querySelectorAll('.tree-node');
    const containerRect = container.getBoundingClientRect();
    const s = scale; // 缩放比例，getBoundingClientRect 返回视觉坐标，需 /s 转 SVG 坐标

    nodes.forEach(node => {
      const parentLi = node.closest('li');
      if (!parentLi) return;
      const childUl = parentLi.querySelector(':scope > ul');
      if (!childUl) return;

      const nodeRect = node.getBoundingClientRect();
      const px = (nodeRect.right - containerRect.left) / s;
      const py = ((nodeRect.top + nodeRect.bottom) / 2 - containerRect.top) / s;

      const childNodes = childUl.querySelectorAll(':scope > li > .tree-node');
      childNodes.forEach(child => {
        const cr = child.getBoundingClientRect();
        const cx = (cr.left - containerRect.left) / s;
        const cy = ((cr.top + cr.bottom) / 2 - containerRect.top) / s;
        const dx = cx - px;
        const cpx = px + Math.min(55, Math.max(22, dx * 0.38));
        const cpx2 = cx - Math.min(55, Math.max(22, dx * 0.38));

        paths.push({
          key: `${node.dataset.cardId || '?'}-${child.dataset.cardId || '?'}`,
          d: `M${px},${py} C${cpx},${py} ${cpx2},${cy} ${cx},${cy}`
        });
      });
    });
    return paths;
  };

  // ==== SVG 连线组件 ====
  const TreeLines = React.memo(({ zoomKey, scale }) => {
    const [paths, setPaths] = useState([]);
    const svgRef = useRef(null);
    const scaleRef = useRef(scale);
    scaleRef.current = scale;

    useEffect(() => {
      const update = () => {
        const el = svgRef.current?.closest('.tree-zoom-container');
        if (el) setPaths(calcBezierPaths(el, scaleRef.current));
      };
      update();
      const t1 = setTimeout(update, 80);
      const t2 = setTimeout(update, 300);
      window.addEventListener('resize', update);
      return () => { window.removeEventListener('resize', update); clearTimeout(t1); clearTimeout(t2); };
    }, [zoomKey, book]);

    return (
      <svg ref={svgRef} className="tree-lines-svg" width="100%" height="100%">
        {paths.map(p => (
          <path key={p.key} d={p.d} />
        ))}
      </svg>
    );
  });

  // ==== 构建树状视图（可拖拽 + SVG贝塞尔连线）====
  const renderTreeView = () => {
    const cards = book?.mindMapCards || [];
    if (!book) return <div className="empty-canvas"><p>请先选择一本书</p></div>;
    if (cards.length === 0) return <div className="empty-canvas"><p>还没有思维导图卡片</p><p className="hint">先在卡片模式创建一些卡片，再切换到树状视图~</p></div>;

    return (
      <div className="tree-viewport" ref={treeViewportRef}
        onPointerDown={handleTreePointerDown} onWheel={handleTreeWheel}
        onTouchStart={handleTreeTouchStart2} onTouchMove={handleTreeTouchMove2} onTouchEnd={handleTreeTouchEnd2}
        onContextMenu={e => e.preventDefault()}>
        <div className="tree-zoom-container" id="treeZoomContainer" onClick={handleTreeClick}>
          <TreeLines zoomKey={treeLinesKey} scale={scaleRef.current} />
          <ul className="tree">
            <li>
              <div className="tree-node tree-root-node" data-card-id="__root__">
                <div className="tree-node-title">{book?.title || ''}</div>
              </div>
              <ul>{cards.map(card => renderTreeNode(card))}</ul>
            </li>
          </ul>
        </div>
        <div className="tree-zoom-controls">
          <span className="tree-zoom-label" title="滚轮缩放·拖拽平移"></span>
          <button className="tree-zoom-btn" onClick={handleZoomOut} title="缩小">−</button>
          <span className="tree-zoom-pct" onClick={handleZoomReset} title="点击重置">{Math.round(displayScale * 100)}%</span>
          <button className="tree-zoom-btn" onClick={handleZoomIn} title="放大">＋</button>
        </div>
      </div>
    );
  };

  // ==== 导入文件 ====
  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedBookId) return;
    setImporting(true);

    try {
      let html = '';
      const ext = file.name.split('.').pop().toLowerCase();

      if (ext === 'docx') {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        html = result.value;
      } else if (ext === 'html' || ext === 'htm') {
        html = await file.text();
      } else {
        // 纯文本
        const text = await file.text();
        html = textToHtml(text);
      }

      const cards = parseHtmlToCards(html);
      if (cards.length > 0) {
        cards.forEach(c => addMindMapCard(selectedBookId, c.title, c.content, c.parentId || null));
      }
    } catch (err) {
      alert('导入失败: ' + err.message);
    }

    setImporting(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // 纯文本→HTML
  const textToHtml = (text) => {
    const lines = text.split('\n');
    let html = '';
    for (const line of lines) {
      const t = line.trim();
      if (!t) continue;
      if (t.startsWith('# ')) html += `<h1>${t.slice(2)}</h1>`;
      else if (t.startsWith('## ')) html += `<h2>${t.slice(3)}</h2>`;
      else if (t.startsWith('### ')) html += `<h3>${t.slice(4)}</h3>`;
      else html += `<p>${t}</p>`;
    }
    return html;
  };

  // HTML→卡片结构
  const parseHtmlToCards = (html) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const cards = [];
    let currentParent = null;

    const walk = (node) => {
      for (const child of node.childNodes) {
        if (child.nodeType !== 1) continue; // skip text nodes
        const tag = child.tagName?.toLowerCase();

        if (['h1', 'h2', 'h3'].includes(tag)) {
          const title = child.textContent.trim();
          if (!title) continue;
          const parentCard = {
            id: uid(),
            title,
            content: '',
            children: [],
            createdAt: Date.now(),
          };
          cards.push(parentCard);
          currentParent = parentCard;
        } else if (['p', 'li', 'div'].includes(tag)) {
          const text = child.textContent.trim();
          if (!text) continue;
          if (currentParent) {
            currentParent.children.push({
              id: uid(),
              title: '',
              content: text,
              parentId: currentParent.id,
              children: [],
              createdAt: Date.now(),
            });
          } else {
            // 没有父卡片时作为独立母卡片
            const card = {
              id: uid(),
              title: text.slice(0, 30),
              content: text,
              children: [],
              createdAt: Date.now(),
            };
            cards.push(card);
          }
        } else {
          walk(child);
        }
      }
    };

    walk(doc.body);
    return cards;
  };

  // 显示卡片操作菜单（右键/长按）
  const showCardMenu = (x, y, card, isParentCard) => {
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.visibility = 'hidden';
    menu.style.left = '0'; menu.style.top = '0';
    document.body.appendChild(menu);
    const childCount = card.children?.length || 0;
    menu.innerHTML = `
      <button class="ctx-item">添加子卡片${childCount > 0 ? ' (' + childCount + ')' : ''}</button>
      <button class="ctx-item">添加同级卡片</button>
      <button class="ctx-item ctx-delete">删除</button>
    `;
    const mw = menu.offsetWidth, mh = menu.offsetHeight;
    const vw = window.innerWidth, vh = window.innerHeight;
    if (isMobile) {
      // 手机端居中弹出
      x = (vw - mw) / 2;
      y = (vh - mh) / 2;
    } else {
      if (x + mw > vw) x = vw - mw - 10;
      if (y + mh > vh) y = vh - mh - 10;
      if (x < 5) x = 5; if (y < 5) y = 5;
    }
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    menu.style.visibility = 'visible';
    const btns = menu.querySelectorAll('.ctx-item');
    btns.forEach((btn, i) => {
      btn.onclick = () => {
        menu.remove();
        if (i === 0) handleAddChild(card.id);
        if (i === 1) { const sibling = addMindMapCard(selectedBookId, '', '', card.parentId || null); }
        if (i === 2) handleDelete(card.id);
      };
    });
    const close = (ev) => { if (!menu.contains(ev.target)) { menu.remove(); cleanup(); }};
    const cleanup = () => { document.removeEventListener('mousedown', close); document.removeEventListener('click', close); document.removeEventListener('touchstart', close); };
    setTimeout(() => { document.addEventListener('mousedown', close); document.addEventListener('click', close); document.addEventListener('touchstart', close); }, 100);
  };
  // 长按菜单（手机端）
  const cardLongPressRef = useRef({});

  // ==== 渲染卡片 ====
  const renderCard = (card, depth = 0, isMobileView = false) => {
    const isParent = !card.parentId;
    const isDragOver = dragOverId === card.id;
    const isDragging = draggedId === card.id;

    const handleCardTitleClick = (e) => {
      if (isMobileView && isParent && onFocusCard) {
        e.stopPropagation();
        onFocusCard(card.id);
      }
    };

    return (
      <div key={card.id}>
        <div
          className={`mm-card ${isParent ? 'mm-parent' : 'mm-child'} ${isDragOver ? 'mm-dragover' : ''} ${isDragging ? 'mm-dragging' : ''}`}
          style={{ marginLeft: isMobileView ? Math.min(depth, 1) * 16 : Math.min(depth, 2) * 26 }}
          draggable={!isMobileView}
          onDragStart={(e) => !isMobileView && handleDragStart(e, card)}
          onDragEnd={handleDragEnd}
          onDragOver={(e) => {
            if (draggedId && draggedId !== card.id) {
              e.preventDefault();
              setDragOverId(card.id);
            }
          }}
          onDragLeave={() => setDragOverId(null)}
          onDrop={(e) => handleDrop(e, card, depth)}
          data-card-id={card.id}
          onTouchStart={(e) => {
            if (!isMobileView) { handleTouchDragStart(e, card); return; }
            cardLongPressRef.current[card.id] = setTimeout(() => {
              handleTouchDragStart(e, card);
            }, 500);
          }}
          onTouchMove={(e) => {
            if (!isMobileView) { handleTouchDragMove(e); return; }
            if (cardLongPressRef.current[card.id]) { clearTimeout(cardLongPressRef.current[card.id]); delete cardLongPressRef.current[card.id]; }
            if (touchDragIdRef.current) handleTouchDragMove(e);
          }}
          onTouchEnd={(e) => {
            if (!isMobileView) { handleTouchDragEnd(e); return; }
            if (cardLongPressRef.current[card.id]) { clearTimeout(cardLongPressRef.current[card.id]); delete cardLongPressRef.current[card.id]; }
            handleTouchDragEnd(e);
          }}
          onContextMenu={(e) => { e.preventDefault(); showCardMenu(e.clientX, e.clientY, card, isParent); }}
        >
          {/* 复选框 + 母卡片标题 + 快捷添加 */}
          <div className="mm-card-top">
            <input type="checkbox" className="card-check"
              checked={selected.has(card.id)}
              onChange={e => {
                const next = new Set(selected);
                e.target.checked ? next.add(card.id) : next.delete(card.id);
                setSelected(next);
              }}
              onClick={e => e.stopPropagation()}
            />
            {isParent && (
              <div className="mm-parent-header" onClick={handleCardTitleClick} style={isMobileView ? {cursor:'pointer'} : {}}>
                <input
                  className="mm-title-input"
                  value={card.title}
                  onChange={(e) => updateMindMapCard(selectedBookId, card.id, { title: e.target.value })}
                  placeholder="母卡片标题"
                  onClick={e => isMobileView && e.stopPropagation()}
                />
                <button
                  className="mm-quick-add"
                  onClick={(e) => { e.stopPropagation(); handleAddChild(card.id); }}
                  title="快速添加子卡片"
                >+</button>
              </div>
            )}
          </div>
          {/* 内容 */}
          <textarea
            className="mm-content-input"
            value={card.content || ''}
            onChange={(e) => updateMindMapCard(selectedBookId, card.id, { content: e.target.value })}
            onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
            placeholder={isParent ? '内容...' : '子卡片内容...'}
            ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }}}
          />
          {/* 操作按钮 */}
          <span className="mm-drag-handle" title="操作"
            onClick={(e) => { e.stopPropagation(); showCardMenu(e.clientX, e.clientY, card, isParent); }}
            onTouchStart={(e) => { e.stopPropagation(); }}
            onTouchMove={(e) => { e.stopPropagation(); }}
            onTouchEnd={(e) => { e.stopPropagation(); e.preventDefault(); showCardMenu(e.changedTouches[0].clientX, e.changedTouches[0].clientY, card, isParent); }}>
            ⋮⋮
          </span>
        </div>

        {/* 子卡片组 — 卡片模式最多显示两层（母→子），不显示孙级 */}
        {card.children?.length > 0 && depth < 1 && (
          <div className="mm-children-group" style={{ marginLeft: isMobileView ? 0 : 26 }}>
            <div className="mm-separator" />
            {card.children.map(child => renderCard(child, depth + 1, isMobileView))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`mindmap-view${focusMode ? ' focus-mode' : ''}`}>
      {focusMode && <button className="focus-float-exit" onClick={() => setFocus(false)}>✕ 退出专注</button>}
      {/* 画布 */}
      <div className="mindmap-main">
        {/* 极简单行动作栏 */}
        <div className="mm-action-bar">
          <button className={`mm-action-btn current-book`}
            onClick={() => setShowBookPopover(!showBookPopover)} title="选择书籍">
            <span className="mm-action-icon"><CatIcon name="books" size={20} /></span>
            <span className="mm-action-label">{book ? book.title.slice(0,4) : '书籍'}</span>
          </button>
          <button className="mm-action-btn"
            onClick={() => setTreeMode(!treeMode)}
            title={treeMode ? '切换卡片模式' : '切换树状导图'}>
            <span className="mm-action-icon"><CatIcon name={treeMode ? 'cards' : 'tree'} size={20} /></span>
            <span className="mm-action-label">{treeMode ? '卡片' : '树状'}</span>
          </button>
          <button className="mm-action-btn" onClick={() => setFocus(!focusMode)} title="专注模式">
            <span className="mm-action-icon"><CatIcon name="focus" size={20} /></span>
            <span className="mm-action-label">专注</span>
          </button>
          <button className="mm-action-btn btn-import" onClick={() => fileInputRef.current?.click()} disabled={!selectedBookId} title="导入文件">
            <span className="mm-action-icon"><CatIcon name="import" size={20} /></span>
            <span className="mm-action-label">导入</span>
          </button>
          <button className="mm-action-btn btn-add-card" onClick={handleAddParent} disabled={!selectedBookId} title="新建母卡片">
            <span className="mm-action-icon"><CatIcon name="add" size={20} /></span>
            <span className="mm-action-label">添加</span>
          </button>

          {/* 书籍悬浮窗 */}
          {showBookPopover && (
            <div className="mm-book-popover">
              <div className="sidebar-header">
                <CatIcon name="books" size={14} />
                <span>书籍</span>
                <div className="sidebar-header-actions">
                  <button className="btn-icon" onClick={handleAddBook} title="新建书籍">+</button>
                  <button className={`btn-icon ${bookBatchMode ? 'active' : ''}`} onClick={() => { setBookBatchMode(!bookBatchMode); setSelectedBooks(new Set()); }} title="批量管理">☰</button>
                </div>
              </div>
              {bookBatchMode && (
                <div className="batch-bar">
                  <button className="tb-btn" onClick={() => { if (selectedBooks.size === books.length) setSelectedBooks(new Set()); else setSelectedBooks(new Set(books.map(b => b.id))); }}>{selectedBooks.size === books.length ? '取消全选' : '全选'}</button>
                  {selectedBooks.size > 0 && (
                    <button className="tb-btn" style={{color:'#d44'}} onClick={() => { if (confirm(`删除选中的 ${selectedBooks.size} 本书？`)) { selectedBooks.forEach(id => { deleteBook(id); if (selectedBookId === id) onSelectBook(null); }); setSelectedBooks(new Set()); } }}>删除 ({selectedBooks.size})</button>
                  )}
                  <span className="tb-info">已选 {selectedBooks.size}/{books.length}</span>
                </div>
              )}
              {books.map(b => (
                <div key={b.id} className={`dir-book-item ${selectedBookId === b.id ? 'active' : ''}`}
                  onClick={() => { if (bookBatchMode) { setSelectedBooks(prev => { const next = new Set(prev); if (next.has(b.id)) next.delete(b.id); else next.add(b.id); return next; }); } else { onSelectBook(b.id); setShowBookPopover(false); }}}>
                  <span className="dir-book-cover" onClick={e => { e.stopPropagation(); document.getElementById(`mm-pop-cover-${b.id}`)?.click(); }} title="换封面">
                    <BookCoverImg bookId={b.id} cover={b.cover} size={20} />
                    <input id={`mm-pop-cover-${b.id}`} type="file" accept="image/*" style={{display:'none'}} onChange={e => { const file = e.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => setBookCover(b.id, reader.result); reader.readAsDataURL(file); }} />
                  </span>
                  {' '}{b.title}
                  <span className="dir-book-count">{(b.mindMapCards || []).length}</span>
                </div>
              ))}
              {books.length === 0 && <div style={{textAlign:'center',padding:16,color:'var(--text3)',fontSize:12}}>暂无书籍，点击 + 新建</div>}
            </div>
          )}
        </div>

        {/* 批量操作 - 仅卡片模式 */}
        {!treeMode && book && (() => {
          const flatten = (cards, out = []) => { cards.forEach(c => { out.push(c); if (c.children) flatten(c.children, out); }); return out; };
          const all = flatten(book.mindMapCards || []);
          return all.length > 0 ? (
            <div className="batch-bar" style={{padding:'4px 10px',borderBottom:'1px solid var(--border)'}}>
              <button className="tb-btn" onClick={() => setSelected(selected.size === all.length ? new Set() : new Set(all.map(c => c.id)))}>
                {selected.size === all.length ? '取消全选' : '全选'}
              </button>
              {selected.size > 0 && (
                <button className="tb-btn" style={{color:'#d44'}} onClick={() => { if (confirm(`删除选中的 ${selected.size} 张卡片？`)) { selected.forEach(id => deleteMindMapCard(selectedBookId, id)); setSelected(new Set()); } }}>删除选中 ({selected.size})</button>
              )}
              <span className="tb-info">已选 {selected.size}/{all.length}</span>
            </div>
          ) : null;
        })()}

        <div className="mindmap-canvas" style={treeMode ? {padding:0,overflow:'visible',display:'flex',flexDirection:'column'} : {}}>
          {importing && <div className="import-overlay">正在导入...</div>}

          {/* 树状导图模式 */}
          {treeMode && renderTreeView()}

          {/* 卡片模式 */}
          {!treeMode && (focusCardId ? (() => {
            const focusCard = findCardById(book?.mindMapCards || [], focusCardId);
            if (!focusCard) return <div className="empty-canvas"><p>卡片不存在</p></div>;
            return (
              <div className="mm-focus-view">
                {renderCard(focusCard)}
              </div>
            );
          })() : (
            book?.mindMapCards?.length > 0 ? (
              book.mindMapCards.map(card => renderCard(card, 0, isMobile))
            ) : (
              <div className="empty-canvas">
                <p>{book ? '点击"添加"创建思维导图' : '选择或创建一本书吧~'}</p>
                <p className="hint">导入 Word/HTML/TXT 自动生成卡片</p>
              </div>
            )
          ))}
        </div>
      </div>

      {/* 触摸拖拽幽灵（卡片模式） */}
      {touchDragId && touchGhostPos && (() => {
        const dragCard = findCardById(book?.mindMapCards || [], touchDragId);
        return (
          <div className="touch-ghost" style={{ left: touchGhostPos.x - 40, top: touchGhostPos.y - 20 }}>
            {dragCard?.title?.slice(0, 8) || '拖拽中...'}
          </div>
        );
      })()}
      {/* 触摸拖拽幽灵（树状模式） */}
      {touchGhost && (
        <div className="touch-ghost" style={{ left: touchGhost.x - 40, top: touchGhost.y - 20 }}>
          {touchGhost.title?.slice(0, 8) || '拖拽中'}
        </div>
      )}

      {/* 隐藏的文件输入 */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".docx,.html,.htm,.txt"
        style={{display:'none'}}
        onChange={handleImport}
      />
    </div>
  );
}

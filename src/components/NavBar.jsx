import React, { useState, useRef } from 'react';
import useStore from '../store';
import CatIcon, { CatIconButton } from './CatIcon';

const mainTabs = [
  { key: 'directory', icon: 'books', label: '书籍目录' },
  { key: 'mindmap', icon: 'mindmap', label: '思维导图' },
  { key: 'inspiration', icon: 'inspiration', label: '灵感卡片' },
  { key: 'reading', icon: 'reading', label: '阅读' },
  { key: 'aichat', icon: 'aichat', label: 'AI 对话' },
  { key: 'history', icon: 'calendar', label: '历史版本' },
  { key: 'settings', icon: 'settings', label: '设置' },
];

const funItems = [
  { key: 'quicknote', icon: 'quicknote', label: '速记阁' },
  { key: 'filmnote', icon: 'filmnote', label: '拉片室' },
  { key: 'gacha', icon: 'gacha', label: '扭蛋屋' },
  { key: 'calendar', icon: 'calendar', label: '日历记' },
  { key: 'trash', icon: 'trash', label: '清理站' },
];

// 全局文件输入（和Icon组件共用同一个）
let _gInput = null;
function getGlobalInput(cb) {
  if (!_gInput) {
    _gInput = document.createElement('input');
    _gInput.type = 'file';
    _gInput.accept = 'image/*';
    _gInput.style.display = 'none';
    _gInput.onchange = (e) => { cb(e); _gInput.value = ''; };
    document.body.appendChild(_gInput);
  }
  _gInput.onchange = (e) => { cb(e); _gInput.value = ''; };
  return _gInput;
}

export default function NavBar({ activeTab, onTabChange, onGachaClick, onQuickNote, onFilmNote, onCalendarClick, onTrashClick }) {
  const [collapsed, setCollapsed] = useState(false);
  // [FIX-2] 顶层解构 persist，避免 getState() 跨组件调用
  const { settings, updateSettings, persist } = useStore();
  const longRef = useRef(null);
  const justLongRef = useRef(false);

  const handleAvatarUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => updateSettings({ avatar: reader.result });
    reader.readAsDataURL(file);
    // 防止文件选择后的残留click误触
    justLongRef.current = true;
    setTimeout(() => { justLongRef.current = false; }, 300);
  };

  const triggerFile = () => {
    const inp = getGlobalInput(handleAvatarUpload);
    setTimeout(() => inp.click(), 10);
  };

  // 右键 → 换头像
  const handleCtx = (e) => { e.preventDefault(); e.stopPropagation(); triggerFile(); };
  // 长按 → 换头像
  const handleTS = () => {
    justLongRef.current = false;
    if (longRef.current) clearTimeout(longRef.current);
    longRef.current = setTimeout(() => { longRef.current = null; justLongRef.current = true; triggerFile(); }, 600);
  };
  const handleTE = () => { if (longRef.current) { clearTimeout(longRef.current); longRef.current = null; } };
  // 拦截长按后的click
  const handleClick = (e) => { if (justLongRef.current) { e.stopPropagation(); e.preventDefault(); justLongRef.current = false; } };

  return (
    <nav className={`navbar ${collapsed ? 'collapsed' : ''}`}>
      {/* Logo */}
      <div className="nav-brand" onClick={() => onTabChange('directory')}>
        <span className="nav-paw" onClick={handleClick} onContextMenu={handleCtx}
          onTouchStart={handleTS} onTouchEnd={handleTE} onTouchMove={handleTE} onTouchCancel={handleTE}
          title="右键/长按更换头像">
          {settings.avatar ? (
            <img src={settings.avatar} alt="" style={{width:28,height:28,borderRadius:'50%',objectFit:'cover',pointerEvents:'none'}} />
          ) : (
            <CatIconButton name="brand" size={28} />
          )}
        </span>
        <div className="nav-brand-text">
          <span className="nav-title">小说助手</span>
        </div>
      </div>

      {/* 主导航 */}
      <div className="nav-tabs">
        {mainTabs.map(tab => (
          <button
            key={tab.key}
            className={`nav-tab ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => onTabChange(tab.key)}
            title={collapsed ? tab.label : ''}
          >
            <CatIconButton name={tab.icon} size={20} />
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* 乐趣栏 */}
      <div className="nav-fun-section">
        <div className="nav-fun-label">
          <span className="fun-dot" />
          <span className="tab-label">乐趣栏</span>
        </div>
        {funItems.map(item => (
          <button
            key={item.key}
            className="nav-tab nav-fun-tab"
            onClick={() => {
              if (item.key === 'gacha') onGachaClick();
              if (item.key === 'quicknote') onQuickNote();
              if (item.key === 'filmnote') onFilmNote();
              if (item.key === 'calendar') onCalendarClick();
              if (item.key === 'trash') onTrashClick();
            }}
            title={collapsed ? item.label : ''}
          >
            <CatIconButton name={item.icon} size={19} />
            <span className="tab-label">{item.label}</span>
          </button>
        ))}
      </div>

      {/* 保存到云端按钮 — persist 从顶层解构 */}
      <button className="nav-save-btn" onClick={() => persist()} title="保存到云端 (Ctrl+Shift+S)">
        <CatIcon name="import" size={16} /> <span className="tab-label">保存</span>
      </button>
      {/* 收起按钮 */}
      <button className="nav-collapse-btn" onClick={() => setCollapsed(!collapsed)} title={collapsed ? '展开' : '收起'}>
        {collapsed ? '→' : '←'}
      </button>
    </nav>
  );
}

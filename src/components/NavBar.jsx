import React, { useState } from 'react';
import Icon from './Icon';

const mainTabs = [
  { key: 'directory', icon: 'book', label: '书籍目录' },
  { key: 'mindmap', icon: 'mindmap', label: '思维导图' },
  { key: 'inspiration', icon: 'lightbulb', label: '灵感卡片' },
  { key: 'history', icon: 'clock', label: '历史版本' },
  { key: 'settings', icon: 'settings', label: '设置' },
];

const funItems = [
  { key: 'quicknote', icon: 'quicknote', label: '文字速记' },
  { key: 'filmnote', icon: 'film', label: '拉片速记' },
  { key: 'gacha', icon: 'gacha', label: '扭蛋机' },
];

export default function NavBar({ activeTab, onTabChange, onGachaClick, onQuickNote, onFilmNote, onCalendarClick, onTrashClick }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <nav className={`navbar ${collapsed ? 'collapsed' : ''}`}>
      {/* Logo */}
      <div className="nav-brand" onClick={() => onTabChange('directory')}>
        <span className="nav-paw">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="var(--pink)">
            <ellipse cx="8" cy="8" rx="4.5" ry="5" />
            <ellipse cx="16" cy="8" rx="4.5" ry="5" />
            <ellipse cx="5.5" cy="6" rx="3" ry="3.5" transform="rotate(-15 5.5 6)" />
            <ellipse cx="18.5" cy="6" rx="3" ry="3.5" transform="rotate(15 18.5 6)" />
            <ellipse cx="12" cy="15" rx="5.5" ry="5" />
            <ellipse cx="9" cy="11" rx="2.5" ry="3" />
            <ellipse cx="15" cy="11" rx="2.5" ry="3" />
            <ellipse cx="12" cy="10" rx="2" ry="2.5" />
          </svg>
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
            <Icon name={tab.icon} size={20} />
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
            }}
            title={collapsed ? item.label : ''}
          >
            <Icon name={item.icon} size={19} />
            <span className="tab-label">{item.label}</span>
          </button>
        ))}
      </div>

      {/* 字数日历 + 回收站 */}
      <button className="nav-calendar-btn" onClick={onCalendarClick} title="字数日历">
        📅 <span className="tab-label">字数日历</span>
      </button>
      <button className="nav-calendar-btn" onClick={onTrashClick} title="回收站">
        🗑️ <span className="tab-label">回收站</span>
      </button>

      {/* 收起按钮 */}
      <button className="nav-collapse-btn" onClick={() => setCollapsed(!collapsed)} title={collapsed ? '展开' : '收起'}>
        {collapsed ? '→' : '←'}
      </button>
    </nav>
  );
}

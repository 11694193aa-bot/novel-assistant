import React from 'react';

// Instagram风格极简线性图标
// 统一24x24 viewBox，1.5px描边，圆角端点

const icons = {
  // 书籍目录 — 书本
  book: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5V4.5C4 3.67 4.67 3 5.5 3H20v15H5.5C4.67 18 4 18.67 4 19.5ZM4 19.5C4 20.33 4.67 21 5.5 21H20" />
      <line x1="8" y1="7" x2="16" y2="7" />
      <line x1="8" y1="10" x2="16" y2="10" />
    </svg>
  ),

  // 思维导图 — 节点连线
  mindmap: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="5" r="2.5" />
      <circle cx="5" cy="13" r="2.5" />
      <circle cx="19" cy="13" r="2.5" />
      <circle cx="8" cy="20" r="2" />
      <circle cx="16" cy="20" r="2" />
      <line x1="11" y1="7.5" x2="6.5" y2="11" />
      <line x1="13" y1="7.5" x2="17.5" y2="11" />
      <line x1="6" y1="15.3" x2="7" y2="18.2" />
      <line x1="18" y1="15.3" x2="17" y2="18.2" />
    </svg>
  ),

  // 灵感卡片 — 灯泡
  lightbulb: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 17.5h4" />
      <path d="M9.5 21h5" />
      <path d="M12 2C8.13 2 5 5.13 5 9c0 2.38 1.19 4.47 3 5.74V16c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-1.26c1.81-1.27 3-3.36 3-5.74 0-3.87-3.13-7-7-7z" />
    </svg>
  ),

  // 历史版本 — 时钟
  clock: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),

  // 设置 — 齿轮
  settings: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  ),

  // 扭蛋机 — 礼物盒/扭蛋
  gacha: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="13" r="8" />
      <circle cx="12" cy="13" r="3" />
      <line x1="12" y1="5" x2="12" y2="10" />
      <circle cx="12" cy="4" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  ),

  // 文字速记 — 闪电/速写
  quicknote: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),

  // 拉片速记 — 胶片/播放
  film: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <line x1="2" y1="8" x2="22" y2="8" />
      <line x1="2" y1="16" x2="22" y2="16" />
      <line x1="7" y1="4" x2="7" y2="8" />
      <line x1="7" y1="16" x2="7" y2="20" />
      <line x1="17" y1="4" x2="17" y2="8" />
      <line x1="17" y1="16" x2="17" y2="20" />
    </svg>
  ),

  // 加号
  plus: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),

  // 搜索
  search: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
};

export default function Icon({ name, size = 24, className = '' }) {
  const icon = icons[name];
  if (!icon) return null;
  return (
    <span className={`icon-wrap ${className}`} style={{ width: size, height: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {icon}
    </span>
  );
}

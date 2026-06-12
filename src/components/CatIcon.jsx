import React, { useRef, useCallback } from 'react';
import useStore from '../store';

/**
 * 高级极简 Ins 风图标集
 * 全部 24×24 viewBox，单色线条 strokeWidth=1.5
 * 颜色由父级 color / currentColor 继承
 */

const icons = {
  // ── 书架：三册叠放书籍 ──
  books: (
    <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
      <rect x="4" y="17" width="16" height="3" rx="1" />
      <rect x="3" y="12" width="18" height="3" rx="1" />
      <rect x="5" y="7" width="14" height="3" rx="1" />
      <line x1="8" y1="7" x2="8" y2="4" />
      <line x1="16" y1="7" x2="16" y2="4" />
    </g>
  ),

  // ── 导图：中心节点放射网络 ──
  mindmap: (
    <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
      <circle cx="12" cy="12" r="3.5" />
      <line x1="15" y1="10.5" x2="20" y2="5" />
      <line x1="12" y1="8.5" x2="12" y2="3" />
      <line x1="9" y1="10.5" x2="4" y2="5" />
      <line x1="8.5" y1="13.5" x2="3" y2="14" />
      <line x1="15.5" y1="13.5" x2="21" y2="14" />
      <line x1="10.5" y1="15" x2="6" y2="20" />
      <line x1="13.5" y1="15" x2="18" y2="20" />
      <circle cx="20" cy="5" r="1.8" fill="currentColor" />
      <circle cx="12" cy="3" r="1.8" fill="currentColor" />
      <circle cx="4" cy="5" r="1.8" fill="currentColor" />
      <circle cx="3" cy="14" r="1.8" fill="currentColor" />
      <circle cx="21" cy="14" r="1.8" fill="currentColor" />
      <circle cx="6" cy="20" r="1.8" fill="currentColor" />
      <circle cx="18" cy="20" r="1.8" fill="currentColor" />
    </g>
  ),

  // ── 灵感：经典灯泡 ──
  inspiration: (
    <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
      <path d="M10 18 Q10 20 12 20.5 Q14 20 14 18 Q14 13 16.5 10.5 Q17.5 8.5 16.5 6.5 Q14.5 3.5 12 3.5 Q9.5 3.5 7.5 6.5 Q6.5 8.5 7.5 10.5 Q10 13 10 18Z" />
      <line x1="10" y1="17.5" x2="14" y2="17.5" />
      <path d="M11 13 Q11.5 11.5 12.5 12 Q13 12.5 12 10" strokeWidth="1" />
    </g>
  ),

  // ── AI：极简聊天气泡 + 闪点 ──
  aichat: (
    <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
      <path d="M12 3 Q6 3 4 8 Q3 11 5 14 L3 18 L8 16 Q10 17 12 17 Q18 17 20 12 Q21 8 18 5 Q15 3 12 3Z" />
      <circle cx="9" cy="10" r="1.2" fill="currentColor" />
      <circle cx="12" cy="10" r="1.2" fill="currentColor" />
      <circle cx="15" cy="10" r="1.2" fill="currentColor" />
    </g>
  ),

  // ── 乐趣：骰子/游戏方块 ──
  fun: (
    <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <circle cx="8.5" cy="8.5" r="1.2" fill="currentColor" />
      <circle cx="15.5" cy="8.5" r="1.2" fill="currentColor" />
      <circle cx="8.5" cy="15.5" r="1.2" fill="currentColor" />
      <circle cx="15.5" cy="15.5" r="1.2" fill="currentColor" />
    </g>
  ),

  // ── 设置：精密齿轮 ──
  settings: (
    <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
      <circle cx="12" cy="12" r="5" />
      <path d="M12 4 L12.5 6" />
      <path d="M12 18 L12.5 20" />
      <path d="M4 12 L6 12" />
      <path d="M18 12 L20 12" />
      <path d="M6.5 6.5 L8 8" />
      <path d="M16 16 L17.5 17.5" />
      <path d="M6.5 17.5 L8 16" />
      <path d="M16 8 L17.5 6.5" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
    </g>
  ),

  // ── 速记阁：钢笔 ──
  quicknote: (
    <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
      <path d="M17 3 L21 7 L14 17 L10 18 L11 14 Z" />
      <line x1="14" y1="10" x2="18" y2="6" />
      <line x1="6" y1="21" x2="10" y2="18" />
    </g>
  ),

  // ── 拉片室：胶片框 ──
  filmnote: (
    <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <rect x="7" y="8" width="10" height="8" rx="1" />
      <line x1="4" y1="8" x2="7" y2="8" />
      <line x1="4" y1="16" x2="7" y2="16" />
      <line x1="17" y1="8" x2="20" y2="8" />
      <line x1="17" y1="16" x2="20" y2="16" />
    </g>
  ),

  // ── 扭蛋屋：扭蛋胶囊 ──
  gacha: (
    <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
      <path d="M12 20 Q12 21.5 10.5 21.5 Q9 21.5 9 20 L9 5 Q9 2 12 2 Q15 2 15 5 L15 9" />
      <circle cx="15" cy="14" r="5" />
      <line x1="13" y1="14" x2="17" y2="14" />
      <line x1="15" y1="12" x2="15" y2="16" />
    </g>
  ),

  // ── 日历记：翻页日历 ──
  calendar: (
    <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
      <rect x="4" y="5" width="16" height="17" rx="2" />
      <line x1="4" y1="10" x2="20" y2="10" />
      <path d="M8 2 L8 6" />
      <path d="M16 2 L16 6" />
      <line x1="8" y1="14" x2="12" y2="14" />
      <line x1="8" y1="17" x2="16" y2="17" />
    </g>
  ),

  // ── 清理站：垃圾桶 ──
  trash: (
    <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
      <path d="M5 7 L6 21 L18 21 L19 7Z" />
      <line x1="3" y1="7" x2="21" y2="7" />
      <line x1="9" y1="7" x2="9" y2="5" />
      <line x1="15" y1="7" x2="15" y2="5" />
      <line x1="10" y1="11" x2="10" y2="18" />
      <line x1="14" y1="11" x2="14" y2="18" />
    </g>
  ),

  // ── 品牌：小猫脸 ──
  brand: (
    <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
      <circle cx="12" cy="12" r="8" />
      <path d="M7.5 10 L6 6 L9.5 9.5" />
      <path d="M16.5 10 L18 6 L14.5 9.5" />
      <circle cx="9" cy="12" r="1.2" fill="currentColor" />
      <circle cx="15" cy="12" r="1.2" fill="currentColor" />
      <path d="M10.5 14.5 Q12 16 13.5 14.5" />
    </g>
  ),

  // ── 猫爪印（装饰用） ──
  paw: (
    <g fill="currentColor" opacity="0.3">
      <ellipse cx="12" cy="16" rx="5" ry="4" />
      <ellipse cx="5" cy="9" rx="2.5" ry="2.8" transform="rotate(-10 5 9)" />
      <ellipse cx="12" cy="5" rx="2.5" ry="2.8" />
      <ellipse cx="19" cy="9" rx="2.5" ry="2.8" transform="rotate(10 19 9)" />
    </g>
  ),

  // ── 专注：冥想圆环 ──
  focus: (
    <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="2.5" fill="currentColor" />
      <path d="M12 3 L12 5 M12 19 L12 21 M3 12 L5 12 M19 12 L21 12" strokeWidth="1" opacity="0.5" />
    </g>
  ),

  // ── 树状图：分支结构 ──
  tree: (
    <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
      <circle cx="12" cy="4" r="2" fill="currentColor" />
      <line x1="12" y1="6" x2="12" y2="10" />
      <line x1="12" y1="10" x2="6" y2="15" />
      <line x1="12" y1="10" x2="18" y2="15" />
      <circle cx="6" cy="16" r="1.5" fill="currentColor" />
      <circle cx="18" cy="16" r="1.5" fill="currentColor" />
      <line x1="6" y1="17" x2="4" y2="21" />
      <line x1="6" y1="17" x2="8" y2="21" />
      <line x1="18" y1="17" x2="16" y2="21" />
      <line x1="18" y1="17" x2="20" y2="21" />
    </g>
  ),

  // ── 导入：下载箭头 ──
  import: (
    <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
      <path d="M12 3 L12 15" />
      <path d="M7 11 L12 16 L17 11" />
      <line x1="5" y1="20" x2="19" y2="20" />
    </g>
  ),

  // ── 文件夹 ──
  folder: (
    <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
      <path d="M3 7 L3 20 L21 20 L21 7Z" />
      <path d="M3 7 L10 3 L13 3 L13 7" />
      <line x1="3" y1="7" x2="13" y2="7" />
    </g>
  ),

  // ── 历史：时钟 ──
  history: (
    <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="12" x2="12" y2="7" />
      <line x1="12" y1="12" x2="16" y2="12" />
    </g>
  ),

  // ── 新增：加号圆圈 ──
  add: (
    <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
      <circle cx="12" cy="12" r="9" />
      <line x1="8" y1="12" x2="16" y2="12" />
      <line x1="12" y1="8" x2="12" y2="16" />
    </g>
  ),

  // ── 调色盘：美术主题 ──
  palette: (
    <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
      <path d="M6 3 L12 3 L18 8 L18 14 L14 18 L6 18 Q3 18 3 15 Q3 12 6 12 L18 12" />
      <circle cx="12" cy="14" r="1.5" fill="currentColor" />
      <circle cx="8" cy="14" r="1" fill="currentColor" />
    </g>
  ),

  // ── 字体：文字/A 图标 ──
  font: (
    <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
      <path d="M7 20 L12 4 L17 20" />
      <line x1="9" y1="14" x2="15" y2="14" />
    </g>
  ),

  // ── 目标：靶心 ──
  target: (
    <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </g>
  ),

  // ── 卡片：叠层卡片 ──
  cards: (
    <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
      <rect x="5" y="3" width="14" height="17" rx="2" />
      <line x1="5" y1="8" x2="19" y2="8" />
      <rect x="3" y="5" width="14" height="17" rx="2" strokeWidth="0.8" opacity="0.4" />
    </g>
  ),

  // ── 阅读：打开的书本 ──
  reading: (
    <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
      <path d="M4 6 Q4 4 6 4 L11.5 6 L12 6.5 L12.5 6 L12 6 L12 20 L12 20.5 L11.5 20 L6 18 Q4 18 4 20 Z" />
      <path d="M20 6 Q20 4 18 4 L12.5 6 L12 6.5 L12 6 L12 20 L12.5 20 L18 18 Q20 18 20 20 Z" />
      <line x1="12" y1="6" x2="12" y2="20" />
    </g>
  ),
};

const ICON_NAMES = Object.keys(icons);

// 全局单例文件输入（底栏图标自定义用）
let globalIconInput = null;
let globalIconCb = null;
function getGlobalIconInput(cb) {
  globalIconCb = cb;
  if (!globalIconInput) {
    globalIconInput = document.createElement('input');
    globalIconInput.type = 'file';
    globalIconInput.accept = 'image/*';
    globalIconInput.style.display = 'none';
    globalIconInput.onchange = (e) => { if (globalIconCb) globalIconCb(e); globalIconInput.value = ''; };
    document.body.appendChild(globalIconInput);
  }
  return globalIconInput;
}

/** 纯图标渲染 */
export default function CatIcon({ name, size = 24, className = '' }) {
  const svg = icons[name];
  if (!svg) return null;
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block', flexShrink: 0 }}
    >
      {svg}
    </svg>
  );
}

/** 可长按自定义的图标按钮（手机端底栏使用） */
export function CatIconButton({ name, size = 22, isActive = false, onLongPressChange }) {
  const { settings, updateSettings } = useStore();
  const longRef = useRef(null);
  const triggeredRef = useRef(false);
  const justLongRef = useRef(false);

  const customSrc = settings.customIcons?.[name];

  const handleUpload = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) { triggeredRef.current = false; return; }
    const reader = new FileReader();
    reader.onload = () => {
      updateSettings({ customIcons: { ...settings.customIcons, [name]: reader.result } });
    };
    reader.readAsDataURL(file);
    triggeredRef.current = false;
    if (onLongPressChange) onLongPressChange();
  }, [name, settings.customIcons, updateSettings, onLongPressChange]);

  const openPicker = useCallback(() => {
    if (triggeredRef.current) return;
    triggeredRef.current = true;
    justLongRef.current = true;
    setTimeout(() => { justLongRef.current = false; }, 400);
    const inp = getGlobalIconInput(handleUpload);
    setTimeout(() => inp.click(), 10);
  }, [handleUpload]);

  const handleTouchStart = () => {
    if (longRef.current) clearTimeout(longRef.current);
    longRef.current = setTimeout(() => { longRef.current = null; openPicker(); }, 600);
  };
  const handleTouchEnd = () => { if (longRef.current) { clearTimeout(longRef.current); longRef.current = null; } };
  const handleClick = (e) => { if (justLongRef.current) { e.preventDefault(); e.stopPropagation(); justLongRef.current = false; } };
  const handleCtx = (e) => { e.preventDefault(); openPicker(); };

  return (
    <span
      onContextMenu={handleCtx}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onClick={handleClick}
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
      title="长按或右键更换图标"
    >
      {customSrc ? (
        <img
          src={customSrc}
          alt={name}
          style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <CatIcon name={name} size={size} />
      )}
    </span>
  );
}

export { icons, ICON_NAMES };

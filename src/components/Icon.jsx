import React, { useRef, useCallback } from 'react';
import useStore from '../store';

const catIcons = [
  'brand', 'book', 'mindmap', 'lightbulb', 'clock', 'settings',
  'gacha', 'quicknote', 'film', 'calendar', 'trash', 'plus', 'search',
];

// 全局单例文件输入
let globalInput = null;
let globalCallback = null;
function getGlobalInput(cb) {
  globalCallback = cb;
  if (!globalInput) {
    globalInput = document.createElement('input');
    globalInput.type = 'file';
    globalInput.accept = 'image/*';
    globalInput.style.display = 'none';
    globalInput.onchange = (e) => { if (globalCallback) globalCallback(e); globalInput.value = ''; };
    document.body.appendChild(globalInput);
  }
  return globalInput;
}

export function getBookCat(bookId) {
  let hash = 0;
  for (let i = 0; i < (bookId || '').length; i++) {
    hash = ((hash << 5) - hash) + bookId.charCodeAt(i);
    hash |= 0;
  }
  return catIcons[Math.abs(hash) % catIcons.length];
}

export function BookCoverImg({ bookId, cover, size = 28 }) {
  const catName = getBookCat(bookId);
  const src = cover || `./icons/${catName}.png`;
  return <img src={src} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', display: 'block', pointerEvents: 'none' }} />;
}

export default function Icon({ name, size = 24, className = '' }) {
  const { settings, updateSettings } = useStore();
  const longPressRef = useRef(null);
  const triggeredRef = useRef(false);
  const justLongPressedRef = useRef(false);

  if (!catIcons.includes(name)) return null;

  const customSrc = settings.customIcons?.[name];
  const imgSrc = customSrc || `./icons/${name}.png`;

  const handleUpload = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) { triggeredRef.current = false; justLongPressedRef.current = false; return; }
    const reader = new FileReader();
    reader.onload = () => {
      updateSettings({ customIcons: { ...settings.customIcons, [name]: reader.result } });
    };
    reader.readAsDataURL(file);
    justLongPressedRef.current = true;
    triggeredRef.current = false;
    setTimeout(() => { justLongPressedRef.current = false; }, 300);
  }, [name, settings.customIcons, updateSettings]);

  const openPicker = useCallback(() => {
    if (triggeredRef.current) return;
    triggeredRef.current = true;
    justLongPressedRef.current = true;
    const inp = getGlobalInput(handleUpload);
    setTimeout(() => inp.click(), 10);
    setTimeout(() => { triggeredRef.current = false; }, 1200);
  }, [handleUpload]);

  const handleContextMenu = (e) => { e.preventDefault(); e.stopPropagation(); openPicker(); };

  const handleClick = (e) => {
    if (justLongPressedRef.current) { e.preventDefault(); e.stopPropagation(); justLongPressedRef.current = false; }
  };

  const handleTouchStart = () => {
    if (longPressRef.current) clearTimeout(longPressRef.current);
    justLongPressedRef.current = false;
    longPressRef.current = setTimeout(() => { longPressRef.current = null; openPicker(); }, 600);
  };
  const handleTouchEnd = () => { if (longPressRef.current) { clearTimeout(longPressRef.current); longPressRef.current = null; } };

  return (
    <span className={`icon-wrap ${className}`}
      style={{ width: size, height: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, borderRadius: '50%', overflow: 'hidden', background: 'transparent' }}
      onClick={handleClick} onContextMenu={handleContextMenu}
      onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} onTouchMove={handleTouchEnd} onTouchCancel={handleTouchEnd}
      title="右键/长按更换图标">
      <img src={imgSrc} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', pointerEvents: 'none' }} />
    </span>
  );
}

// 🐾
export function PawPrint({ size = 30, style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" style={{ pointerEvents: 'none', ...style }}>
      <ellipse cx="32" cy="43" rx="13" ry="10" fill="#F4A0B0" opacity="0.9" />
      <ellipse cx="31" cy="43" rx="9" ry="7" fill="#E8829E" opacity="0.55" />
      <ellipse cx="29" cy="41" rx="4" ry="3" fill="#FAD0D8" opacity="0.4" />
      <ellipse cx="15" cy="22" rx="6" ry="6.5" fill="#F4A0B0" opacity="0.9" transform="rotate(-10 15 22)" />
      <ellipse cx="14" cy="23" rx="4" ry="4.5" fill="#E8829E" opacity="0.5" transform="rotate(-10 14 23)" />
      <ellipse cx="32" cy="14" rx="6" ry="6.5" fill="#F4A0B0" opacity="0.9" />
      <ellipse cx="31" cy="15" rx="4" ry="4.5" fill="#E8829E" opacity="0.5" />
      <ellipse cx="49" cy="22" rx="6" ry="6.5" fill="#F4A0B0" opacity="0.9" transform="rotate(10 49 22)" />
      <ellipse cx="50" cy="23" rx="4" ry="4.5" fill="#E8829E" opacity="0.5" transform="rotate(10 50 23)" />
      <ellipse cx="32" cy="8" rx="5" ry="5.5" fill="#F4A0B0" opacity="0.9" />
      <ellipse cx="31" cy="9" rx="3.5" ry="4" fill="#E8829E" opacity="0.5" />
    </svg>
  );
}

export function spawnPaw(e) {
  const paw = document.createElement('div');
  paw.className = 'paw-ripple';
  paw.style.left = (e.clientX - 18) + 'px';
  paw.style.top = (e.clientY - 18) + 'px';
  paw.innerHTML = `<svg width="36" height="36" viewBox="0 0 64 64" fill="none" style="pointer-events:none">
    <ellipse cx="32" cy="43" rx="13" ry="10" fill="#F4A0B0" opacity="0.9"/>
    <ellipse cx="31" cy="43" rx="9" ry="7" fill="#E8829E" opacity="0.55"/>
    <ellipse cx="29" cy="41" rx="4" ry="3" fill="#FAD0D8" opacity="0.4"/>
    <ellipse cx="15" cy="22" rx="6" ry="6.5" fill="#F4A0B0" opacity="0.9" transform="rotate(-10 15 22)"/>
    <ellipse cx="14" cy="23" rx="4" ry="4.5" fill="#E8829E" opacity="0.5" transform="rotate(-10 14 23)"/>
    <ellipse cx="32" cy="14" rx="6" ry="6.5" fill="#F4A0B0" opacity="0.9"/>
    <ellipse cx="31" cy="15" rx="4" ry="4.5" fill="#E8829E" opacity="0.5"/>
    <ellipse cx="49" cy="22" rx="6" ry="6.5" fill="#F4A0B0" opacity="0.9" transform="rotate(10 49 22)"/>
    <ellipse cx="50" cy="23" rx="4" ry="4.5" fill="#E8829E" opacity="0.5" transform="rotate(10 50 23)"/>
    <ellipse cx="32" cy="8" rx="5" ry="5.5" fill="#F4A0B0" opacity="0.9"/>
    <ellipse cx="31" cy="9" rx="3.5" ry="4" fill="#E8829E" opacity="0.5"/>
  </svg>`;
  document.body.appendChild(paw);
  setTimeout(() => paw.remove(), 700);
}

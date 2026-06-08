import React from 'react';

// 极简萌化猫元素
// 只用基本形状：猫耳△ + 肉球○ + 颜文字

// 猫耳装饰 — 两个小三角
export function CatEars({ size = 14, color = '#ff8fa3' }) {
  const s = size;
  return (
    <span className="cat-ears-inline" style={{ display: 'inline-flex', gap: s * 0.2, verticalAlign: 'middle', height: s * 1.1 }}>
      <span style={{
        display: 'inline-block', width: 0, height: 0,
        borderLeft: `${s * 0.4}px solid transparent`,
        borderRight: `${s * 0.4}px solid transparent`,
        borderBottom: `${s * 0.9}px solid ${color}`,
        transform: 'rotate(-12deg)',
      }} />
      <span style={{
        display: 'inline-block', width: 0, height: 0,
        borderLeft: `${s * 0.4}px solid transparent`,
        borderRight: `${s * 0.4}px solid transparent`,
        borderBottom: `${s * 0.9}px solid ${color}`,
        transform: 'rotate(12deg)',
      }} />
    </span>
  );
}

// 猫肉球 — 一个大圆 + 三个小圆
export function CatPaw({ size = 16, color = '#ff8fa3' }) {
  const s = size;
  return (
    <span style={{ display: 'inline-block', position: 'relative', width: s * 1.4, height: s * 1.2, verticalAlign: 'middle' }}>
      {/* 大肉球 */}
      <span style={{
        position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: s * 0.6, height: s * 0.55, background: color, borderRadius: '50%',
      }} />
      {/* 三趾 */}
      <span style={{
        position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
        width: s * 0.32, height: s * 0.38, background: color, borderRadius: '50%',
      }} />
      <span style={{
        position: 'absolute', top: s * 0.15, left: s * 0.12,
        width: s * 0.28, height: s * 0.34, background: color, borderRadius: '50%',
      }} />
      <span style={{
        position: 'absolute', top: s * 0.15, right: s * 0.12,
        width: s * 0.28, height: s * 0.34, background: color, borderRadius: '50%',
      }} />
    </span>
  );
}

// 猫脸小图标 — 圆脸 + 猫耳 + 简笔五官
export function CatFace({ size = 24, mood = 'normal' }) {
  const s = size;
  const faceColor = '#fff';
  const earColor = '#ffb3c1';
  const earInner = '#ffd0da';
  const eyeColor = '#3d2025';

  const mouthMap = {
    normal: 'M9 16 Q12 18 15 16',
    happy: 'M8.5 15.5 Q12 20 15.5 15.5',
    sleep: 'M10 17 Q12 16.5 14 17',
    think: 'M10 17 L14 17',
  };

  return (
    <svg width={s} height={s} viewBox="0 0 24 24" style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}>
      {/* 耳朵 */}
      <polygon points="3,6 5.5,0 10,5" fill={earColor} />
      <polygon points="21,6 18.5,0 14,5" fill={earColor} />
      <polygon points="4.5,5.5 6,2 9,5.5" fill={earInner} />
      <polygon points="19.5,5.5 18,2 15,5.5" fill={earInner} />
      {/* 脸 */}
      <circle cx="12" cy="13" r="9" fill={faceColor} stroke={earColor} strokeWidth="0.8" />
      {/* 眼睛 */}
      {mood === 'sleep' ? (
        <>
          <line x1="7" y1="12.5" x2="11" y2="12.5" stroke={eyeColor} strokeWidth="1.2" strokeLinecap="round" />
          <line x1="13" y1="12.5" x2="17" y2="12.5" stroke={eyeColor} strokeWidth="1.2" strokeLinecap="round" />
        </>
      ) : mood === 'happy' ? (
        <>
          <path d="M7 12 Q9 9.5 11 12" fill="none" stroke={eyeColor} strokeWidth="1.2" strokeLinecap="round" />
          <path d="M13 12 Q15 9.5 17 12" fill="none" stroke={eyeColor} strokeWidth="1.2" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="9" cy="12" r="2.2" fill={eyeColor} />
          <circle cx="15" cy="12" r="2.2" fill={eyeColor} />
          <circle cx="9.8" cy="11" r="0.8" fill="white" />
          <circle cx="15.8" cy="11" r="0.8" fill="white" />
        </>
      )}
      {/* 鼻子 */}
      <ellipse cx="12" cy="15" rx="1.2" ry="0.8" fill="#ffb3c1" />
      {/* 嘴巴 */}
      <path d={mouthMap[mood] || mouthMap.normal} fill="none" stroke={eyeColor} strokeWidth="0.6" strokeLinecap="round" />
      {/* 腮红 */}
      <ellipse cx="5.5" cy="14.5" rx="2.5" ry="1.5" fill="#ffe0e6" opacity="0.7" />
      <ellipse cx="18.5" cy="14.5" rx="2.5" ry="1.5" fill="#ffe0e6" opacity="0.7" />
    </svg>
  );
}

// 综合猫娘小头像（用于Logo位置）
export default function CatMascot({ variant = 'small', mood = 'happy' }) {
  if (variant === 'tiny') return <CatFace size={20} mood={mood} />;
  if (variant === 'ears') return <CatEars size={14} />;
  return <CatFace size={variant === 'logo' ? 40 : 28} mood={mood} />;
}

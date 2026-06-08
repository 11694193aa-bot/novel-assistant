import React from 'react';

// CSS绘制的二次元小猫图标
// type: 'sit' | 'walk' | 'sleep' | 'happy' | 'think' | 'paw'
export default function CatIcon({ type = 'sit', size = 28, color = '#ff8fa3' }) {
  const s = size;
  const earColor = color;
  const faceColor = '#fff5f5';
  const eyeColor = '#2c1810';
  const noseColor = '#ff8fa3';
  const cheekColor = '#ffe0d3';

  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 64 64"
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}
    >
      {/* 耳朵 */}
      <polygon points="10,20 16,0 28,14" fill={earColor} />
      <polygon points="54,20 48,0 36,14" fill={earColor} />
      <polygon points="13,19 17,6 26,15" fill="#ffb8c6" />
      <polygon points="51,19 47,6 38,15" fill="#ffb8c6" />

      {/* 脸 */}
      <ellipse cx="32" cy="34" rx="22" ry="20" fill={faceColor} stroke={earColor} strokeWidth="1.5" />

      {/* 眼睛 */}
      {type === 'happy' && (
        <>
          <path d="M18,32 Q22,28 26,32" fill="none" stroke={eyeColor} strokeWidth="2" strokeLinecap="round" />
          <path d="M38,32 Q42,28 46,32" fill="none" stroke={eyeColor} strokeWidth="2" strokeLinecap="round" />
        </>
      )}
      {type === 'sleep' && (
        <>
          <line x1="16" y1="32" x2="26" y2="32" stroke={eyeColor} strokeWidth="2" strokeLinecap="round" />
          <line x1="38" y1="32" x2="48" y2="32" stroke={eyeColor} strokeWidth="2" strokeLinecap="round" />
        </>
      )}
      {(type === 'sit' || type === 'think' || type === 'walk' || type === 'paw') && (
        <>
          <ellipse cx="22" cy="32" rx="5" ry="5.5" fill={eyeColor} />
          <ellipse cx="23" cy="30" rx="2" ry="2.5" fill="white" />
          <circle cx="24.5" cy="28.5" r="1" fill="white" />
          <ellipse cx="42" cy="32" rx="5" ry="5.5" fill={eyeColor} />
          <ellipse cx="43" cy="30" rx="2" ry="2.5" fill="white" />
          <circle cx="44.5" cy="28.5" r="1" fill="white" />
        </>
      )}

      {/* 鼻子 */}
      <ellipse cx="32" cy="38" rx="3" ry="2.2" fill={noseColor} />

      {/* 嘴巴 */}
      <path d="M29,40 Q32,44 35,40" fill="none" stroke={eyeColor} strokeWidth="1" strokeLinecap="round" />

      {/* 腮红 */}
      <ellipse cx="14" cy="38" rx="5" ry="3.5" fill={cheekColor} opacity="0.6" />
      <ellipse cx="50" cy="38" rx="5" ry="3.5" fill={cheekColor} opacity="0.6" />

      {/* 胡须 */}
      <line x1="6" y1="36" x2="18" y2="37" stroke={eyeColor} strokeWidth="0.7" opacity="0.5" />
      <line x1="6" y1="39" x2="18" y2="39" stroke={eyeColor} strokeWidth="0.7" opacity="0.5" />
      <line x1="46" y1="37" x2="58" y2="36" stroke={eyeColor} strokeWidth="0.7" opacity="0.5" />
      <line x1="46" y1="39" x2="58" y2="39" stroke={eyeColor} strokeWidth="0.7" opacity="0.5" />

      {/* 身体/装饰 */}
      {type === 'sit' && (
        <ellipse cx="32" cy="56" rx="14" ry="8" fill={faceColor} stroke={earColor} strokeWidth="1" />
      )}
      {type === 'think' && (
        <>
          <ellipse cx="32" cy="56" rx="12" ry="7" fill={faceColor} stroke={earColor} strokeWidth="1" />
          <circle cx="48" cy="18" r="6" fill="none" stroke="#888" strokeWidth="1" strokeDasharray="2,2" />
          <text x="45" y="21" fontSize="7" fill="#888">?</text>
        </>
      )}
      {type === 'happy' && (
        <>
          <ellipse cx="32" cy="56" rx="13" ry="7.5" fill={faceColor} stroke={earColor} strokeWidth="1" />
          <text x="28" y="62" fontSize="20">🎀</text>
        </>
      )}
      {type === 'walk' && (
        <>
          <ellipse cx="28" cy="56" rx="8" ry="7" fill={faceColor} stroke={earColor} strokeWidth="1" />
          <ellipse cx="38" cy="57" rx="7" ry="5" fill={faceColor} stroke={earColor} strokeWidth="1" />
        </>
      )}
    </svg>
  );
}

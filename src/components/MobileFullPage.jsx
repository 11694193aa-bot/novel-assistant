import React from 'react';

// 手机端全屏页 — 轻量顶栏 + 可见返回按钮，不依赖手势
export default function MobileFullPage({ title, onBack, children, actions }) {
  return (
    <div className="ms-fullpage">
      {/* 超薄顶栏，始终可见，不遮挡内容 */}
      <div className="ms-thin-bar">
        <button className="ms-back-btn" onClick={onBack}>‹</button>
        <span className="ms-thin-title">{title}</span>
        {actions ? <div className="ms-header-actions">{actions}</div> : <span style={{width:24}} />}
      </div>
      <div className="ms-fullpage-body">{children}</div>
    </div>
  );
}

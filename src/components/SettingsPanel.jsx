import React, { useState, useEffect } from 'react';
import useStore from '../store';
import { getWebDAVConfig, saveWebDAVConfig, testConnection } from '../utils/webdav';
import { saveSplash } from '../utils/storage';
import CatIcon from './CatIcon';

const FONT_OPTIONS = [
  { key: 'font1', label: '微软雅黑', preview: '小说创作助手 — 现代清晰', desc: '现代无衬线，阅读最舒适' },
  { key: 'font2', label: '宋体', preview: '小说创作助手 — 经典庄重', desc: '传统衬线，印刷感强' },
  { key: 'font3', label: '楷体', preview: '小说创作助手 — 文艺优雅', desc: '书法风格，文学气质' },
  { key: 'font4', label: '黑体', preview: '小说创作助手 — 醒目有力', desc: '粗壮无衬线，标题感' },
  { key: 'font5', label: '等线', preview: '小说创作助手 — 简约干净', desc: '细线条，极简现代风' },
  { key: 'font6', label: '仿宋', preview: '小说创作助手 — 清秀端正', desc: '公文经典，笔画分明' },
  { key: 'font7', label: '圆体', preview: '小说创作助手 — 圆润亲和', desc: '圆角字形，温暖柔和' },
  { key: 'font8', label: '萌趣手写', preview: '小说创作助手 — 活泼可爱', desc: '漫画风格，创意表达' },
];

const COLOR_PRESETS = [
  '#4a3728', '#2c3e50', '#1a1a2e', '#333333',
  '#5b3a6b', '#1b4d3e', '#8b4513', '#191970',
];

const SIZE_PRESETS = [12, 14, 16, 18, 20, 22, 24];

export default function SettingsPanel() {
  const { settings, updateSettings } = useStore();
  const [showSplashPreview, setShowSplashPreview] = useState(false);
  const [splashLoading, setSplashLoading] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);

  const fontFamilyMap = {
    font1: '"Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", "微软雅黑", sans-serif',
    font2: '"SimSun", "Noto Serif SC", "STSong", "宋体", serif',
    font3: '"KaiTi", "STKaiti", "楷体", "Kai", serif',
    font4: '"SimHei", "PingFang SC", "Heiti SC", "黑体", sans-serif',
    font5: '"DengXian", "PingFang SC", "等线", "Hiragino Sans GB", sans-serif',
    font6: '"FangSong", "STFangsong", "仿宋", serif',
    font7: '"Rounded Mplus 1c", "Microsoft YaHei", "PingFang SC", sans-serif',
    font8: '"ZCOOL KuaiLe", "Comic Sans MS", "KaiTi", cursive, sans-serif',
  };

  return (
    <div className="settings-panel">
      <div className="settings-header">
        <h2>设置</h2>
        <p>自定义你的小说助手外观~</p>
      </div>

      <div className="settings-content">
        {/* 主题选择 */}
        <section className="setting-section">
          <h3><CatIcon name="palette" size={18} /> 美术主题</h3>
          <div className="theme-options">
            {[
              { key: 'warm', label: '暖茶', desc: '温暖大地色系', colors: ['#f7f3f0','#c47a5a','#4d3b30'] },
              { key: 'ink', label: '墨砚', desc: '暗色护眼模式', colors: ['#1e1e22','#8b9dc3','#d4d4d8'] },
              { key: 'sakura', label: '樱花', desc: '柔和粉色氛围', colors: ['#fef8fa','#e8829e','#5c3d4e'] },
              { key: 'forest', label: '森林', desc: '清新自然绿色', colors: ['#f4f7f2','#6b9e6b','#3d4d38'] },
              { key: 'ocean', label: '海洋', desc: '清爽蓝色调', colors: ['#f4f7fa','#5b8fbf','#3a4d5e'] },
            ].map(t => (
              <div
                key={t.key}
                className={`theme-option ${settings.theme === t.key ? 'active' : ''}`}
                onClick={() => updateSettings({ theme: t.key })}
              >
                <div className="theme-swatches">
                  {t.colors.map((c, i) => (
                    <span key={i} className="theme-dot" style={{background:c}} />
                  ))}
                </div>
                <div className="theme-info">
                  <span className="theme-label">{t.label}</span>
                  <span className="theme-desc">{t.desc}</span>
                </div>
                {settings.theme === t.key && <span>✓</span>}
              </div>
            ))}
          </div>
        </section>

        {/* 字体选择 */}
        <section className="setting-section">
          <h3><CatIcon name="font" size={18} /> 字体选择</h3>
          <div className="font-options">
            {FONT_OPTIONS.map(font => (
              <div
                key={font.key}
                className={`font-option ${settings.fontFamily === font.key ? 'active' : ''}`}
                onClick={() => updateSettings({ fontFamily: font.key })}
              >
                <div className="font-option-header">
                  <span className="font-label">{font.label}</span>
                  <span className="font-desc">{font.desc}</span>
                </div>
                <div className="font-preview" style={{ fontFamily: fontFamilyMap[font.key] }}>
                  {font.preview}
                </div>
                {settings.fontFamily === font.key && <span className="font-check">✓</span>}
              </div>
            ))}
          </div>
        </section>

        {/* 字号选择 */}
        <section className="setting-section">
          <h3>字号大小</h3>
          <div className="size-options">
            {SIZE_PRESETS.map(size => (
              <button
                key={size}
                className={`size-btn ${settings.fontSize === size ? 'active' : ''}`}
                onClick={() => updateSettings({ fontSize: size })}
              >
                {size}px
              </button>
            ))}
            <div className="size-custom">
              <input
                type="number"
                min="10"
                max="36"
                value={settings.fontSize}
                onChange={e => updateSettings({ fontSize: parseInt(e.target.value) || 16 })}
              />
              <span>px</span>
            </div>
          </div>
          <div className="size-preview" style={{ fontSize: settings.fontSize }}>
            喵~ 这是当前字号的预览文字
          </div>
        </section>

        {/* 字体颜色 */}
        <section className="setting-section">
          <h3><CatIcon name="palette" size={18} /> 字体颜色</h3>
          <div className="color-options">
            {COLOR_PRESETS.map(color => (
              <button
                key={color}
                className={`color-swatch ${settings.fontColor === color ? 'active' : ''}`}
                style={{ backgroundColor: color }}
                onClick={() => updateSettings({ fontColor: color })}
                title={color}
              />
            ))}
            <button
              className={`color-swatch color-custom ${showColorPicker ? 'active' : ''}`}
              onClick={() => setShowColorPicker(!showColorPicker)}
              title="自定义颜色"
            >
              <CatIcon name="palette" size={16} />
            </button>
          </div>
          {showColorPicker && (
            <div className="color-picker-wrap">
              <input
                type="color"
                value={settings.fontColor}
                onChange={e => updateSettings({ fontColor: e.target.value })}
              />
              <input
                type="text"
                value={settings.fontColor}
                onChange={e => updateSettings({ fontColor: e.target.value })}
                className="color-text-input"
              />
            </div>
          )}
          <div className="color-preview" style={{ color: settings.fontColor, opacity: settings.fontOpacity || 1 }}>
            字体颜色预览
          </div>
          <div className="opacity-control" style={{ marginTop: 10 }}>
            <label style={{ fontSize: 11, color: 'var(--text3)' }}>透明度 {Math.round((settings.fontOpacity || 1) * 100)}%</label>
            <input type="range" min="0.3" max="1" step="0.01"
              value={settings.fontOpacity || 1}
              onChange={e => updateSettings({ fontOpacity: parseFloat(e.target.value) })}
              style={{ width: '100%' }} />
          </div>
        </section>

        {/* 每日字数目标 */}
        <section className="setting-section">
          <h3><CatIcon name="target" size={18} /> 每日字数目标</h3>
          <div className="opacity-control">
            <input type="number" min="100" max="20000" step="100"
              value={settings.dailyGoal || 2000}
              onChange={e => updateSettings({ dailyGoal: parseInt(e.target.value) || 2000 })}
              style={{width:100,padding:'6px 10px',borderRadius:8,border:'1px solid var(--border)',fontFamily:'inherit',fontSize:14,fontWeight:600}} />
            <span style={{fontWeight:700,color:'var(--pink)',fontSize:14,marginLeft:8}}>字/天</span>
          </div>
        </section>

        {/* 悬浮窗透明度 */}
        <section className="setting-section">
          <h3> 悬浮窗默认透明度</h3>
          <div className="opacity-control">
            <input
              type="range"
              min="0.3"
              max="1"
              step="0.05"
              value={settings.windowOpacity || 0.9}
              onChange={e => updateSettings({ windowOpacity: parseFloat(e.target.value) })}
            />
            <span className="opacity-value">{Math.round((settings.windowOpacity || 0.9) * 100)}%</span>
          </div>
        </section>

        {/* 坚果云同步 */}
        <CloudSyncSection />

        {/* 存档设置 */}
        <section className="setting-section">
          <h3>存档设置</h3>
          <div className="setting-info">
            <p>历史版本上限: 最近20次</p>
            <p>按 Ctrl+S 手动存档</p>
            <p>配置坚果云后自动云端同步</p>
          </div>
        </section>

        {/* 导出全书 */}
        <ExportBookSection />

        {/* ☁️ 手动云端同步 */}
        <ManualSyncSection />

        {/* 🔥 全量备份 / 恢复 */}
        <BackupRestoreSection />

        {/* 开屏背景 */}
        <section className="setting-section">
          <h3>开屏背景</h3>
          <p className="setting-info" style={{marginBottom:8}}>启动 App 时显示的背景图</p>
          {/* 实时预览窗口 */}
          {settings.splashImage && (
            <div style={{width:'100%',height:140,borderRadius:10,overflow:'hidden',marginBottom:8,border:'1.5px solid var(--border)',
              background:`url(${settings.splashImage}) ${settings.splashPos || 'center'}/${settings.splashFit || 'cover'}`,backgroundRepeat:'no-repeat',
              display:'flex',alignItems:'flex-end',justifyContent:'space-between',padding:6}}>
              <span style={{background:'rgba(0,0,0,.5)',color:'#fff',padding:'1px 8px',borderRadius:8,fontSize:10,fontWeight:600}}>
                {settings.splashFit === '100% 100%' ? '拉伸' : settings.splashFit === 'contain' ? '完整' : '裁剪'}
              </span>
              <button onClick={() => setShowSplashPreview(true)}
                style={{background:'rgba(0,0,0,.5)',color:'#fff',border:'none',borderRadius:8,padding:'2px 10px',fontSize:10,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
                全屏预览
              </button>
            </div>
          )}
          {/* 手动位置微调 */}
          {settings.splashImage && settings.splashFit !== '100% 100%' && (
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8,fontSize:11,color:'var(--text2)'}}>
              <span>位置:</span>
              <input type="range" min="0" max="100" value={parseInt((settings.splashPos || 'center').split(' ')[0]) || 50}
                onChange={e => { const v = e.target.value + '%'; const old = (settings.splashPos || 'center').split(' '); updateSettings({ splashPos: v + ' ' + (old[1] || 'center') }); }}
                style={{flex:1,accentColor:'var(--pink)'}} title="水平位置" />
              <input type="range" min="0" max="100" value={parseInt((settings.splashPos || 'center').split(' ')[1]) || 50}
                onChange={e => { const v = e.target.value + '%'; const old = (settings.splashPos || 'center').split(' '); updateSettings({ splashPos: (old[0] || 'center') + ' ' + v }); }}
                style={{flex:1,accentColor:'var(--pink)'}} title="垂直位置" />
              <span style={{minWidth:50,textAlign:'center'}}>{settings.splashPos || 'center'}</span>
            </div>
          )}
          <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
            <div style={{width:80,height:120,borderRadius:8,overflow:'hidden',background:'var(--bg2)',
              display:'flex',alignItems:'center',justifyContent:'center',border:'1.5px solid var(--border)'}}>
              {settings.splashImage ? (
                <img src={settings.splashImage} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}} />
              ) : (
                <span style={{fontSize:28,color:'var(--text3)'}}>无</span>
              )}
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:6}}>
              <label className="tb-btn" style={{cursor:'pointer'}}><CatIcon name="folder" size={14} /> 选择
                <input type="file" accept="image/*" style={{display:'none'}}
                  onChange={e => {
                    const f = e.target.files?.[0]; if (!f) return;
                    setSplashLoading(true);
                    const img = new Image();
                    img.onerror = () => { setSplashLoading(false); alert('图片加载失败'); };
                    img.onload = () => {
                      const maxW = 1200;
                      const scale = Math.min(1, maxW / img.width);
                      const c = document.createElement('canvas');
                      c.width = img.width * scale;
                      c.height = img.height * scale;
                      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
                      const compressed = c.toDataURL('image/jpeg', 0.75);
                      // 立即存本地
                      saveSplash(compressed);
                      updateSettings({ splashImage: compressed });
                      // 后台异步推云端
                      useStore.getState().persist().catch(() => {});
                      setSplashLoading(false);
                      URL.revokeObjectURL(img.src);
                      alert('✅ 开屏背景已保存！');
                    };
                    img.src = URL.createObjectURL(f);
                  }} />
              </label>
              {splashLoading && <span style={{fontSize:11,color:'var(--pink)'}}>⏳ 处理中...</span>}
              {settings.splashImage && !splashLoading && (
                <button className="tb-btn" style={{color:'#d44'}}
                  onClick={async () => { updateSettings({ splashImage: null }); await useStore.getState().persist(); }}>移除</button>
              )}
              <select style={{padding:'4px 8px',borderRadius:6,border:'1px solid var(--border)',fontFamily:'inherit',fontSize:12}}
                value={settings.splashFit || 'cover'}
                onChange={async e => { updateSettings({ splashFit: e.target.value }); await useStore.getState().persist(); }}>
                <option value="cover">裁剪填充</option>
                <option value="contain">完整显示</option>
                <option value="100% 100%">拉伸铺满</option>
              </select>
            </div>
          </div>
        </section>

      </div>

      {/* 全屏开屏预览 */}
      {showSplashPreview && settings.splashImage && (
        <div onClick={() => setShowSplashPreview(false)}
          style={{position:'fixed',inset:0,zIndex:9999,background:`url(${settings.splashImage}) ${settings.splashPos||'center'}/${settings.splashFit||'cover'}`,backgroundRepeat:'no-repeat',
            display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'flex-end',padding:40,cursor:'pointer'}}>
          <p style={{background:'rgba(0,0,0,.6)',color:'#fff',padding:'8px 20px',borderRadius:20,fontSize:14,fontWeight:600,fontFamily:'inherit'}}>
            点击任意位置关闭预览
          </p>
        </div>
      )}
    </div>
  );
}

// 坚果云同步配置组件
function CloudSyncSection() {
  const saved = getWebDAVConfig();
  const [url, setUrl] = useState(saved?.url || 'https://dav.jianguoyun.com/dav/');
  const [username, setUsername] = useState(saved?.username || '11694193@qq.com');
  const [password, setPassword] = useState(saved?.password || 'a6k3j5k7vbhqeep7');
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState(saved ? 'connected' : null); // null | testing | connected | error

  const handleSave = () => {
    if (!url || !username || !password) return;
    saveWebDAVConfig({ url, username, password });
    setStatus('connected');
  };

  const handleTest = async () => {
    setTesting(true);
    setStatus('testing');
    const result = await testConnection({ url, username, password });
    setTesting(false);
    setStatus(result.ok ? 'connected' : 'error');
  };

  const handleDisconnect = () => {
    saveWebDAVConfig(null);
    setUrl('https://dav.jianguoyun.com/dav/');
    setUsername('');
    setPassword('');
    setStatus(null);
  };

  return (
    <section className="setting-section">
      <h3>坚果云同步</h3>
      <p style={{fontSize:12,color:'var(--text3)',marginBottom:10}}>
        配置后数据自动云同步 · 手机电脑实时互通 · 密码请用坚果云「应用密码」
      </p>
      <div className="webdav-form">
        <label>服务器地址</label>
        <input value={url} onChange={e => setUrl(e.target.value)}
          placeholder="https://dav.jianguoyun.com/dav/" />
        <label>账号</label>
        <input value={username} onChange={e => setUsername(e.target.value)}
          placeholder="坚果云账号（邮箱）" />
        <label>应用密码</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)}
          placeholder="坚果云「应用密码」（非登录密码）" />
        <div className="webdav-actions">
          <button onClick={handleTest} disabled={testing || !url || !username || !password}>
            {testing ? '测试中...' : '测试连接'}
          </button>
          <button onClick={handleSave} disabled={!url || !username || !password}>
            保存配置
          </button>
          {status === 'connected' && (
            <button onClick={handleDisconnect} className="webdav-disconnect">断开</button>
          )}
        </div>
        <div className="webdav-status">
          {status === 'testing' && <span>正在测试连接...</span>}
          {status === 'connected' && <span style={{color:'#4caf7c'}}>已连接 · 数据自动云同步</span>}
          {status === 'error' && <span style={{color:'#e74c3c'}}>连接失败 · 请检查地址/账号/密码</span>}
        </div>
      </div>
    </section>
  );
}

// ========== 导出全书组件 ==========
function ExportBookSection() {
  const { books } = useStore();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const handleExport = (format) => {
    try {
      setBusy(true);
      let text = '';
      let filename = '';
      const now = new Date().toISOString().slice(0, 10);

      if (books.length === 0) { setMsg('❌ 没有书籍可导出'); setBusy(false); return; }

      for (const book of books) {
        const chapters = book.chapters || [];
        text += `\n${'='.repeat(40)}\n《${book.title}》\n${'='.repeat(40)}\n\n`;
        for (const ch of chapters.sort((a, b) => a.order - b.order)) {
          text += `第${ch.order + 1}章 ${ch.title}\n${'-'.repeat(20)}\n${ch.content || ''}\n\n`;
        }
      }

      filename = `全书导出_${now}`;

      if (format === 'txt') {
        const blob = new Blob(['﻿' + text], { type: 'text/plain;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename + '.txt';
        a.click();
        setMsg('✅ TXT 已下载');
      } else {
        // HTML 导出
        const html = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>${filename}</title>
<style>body{font-family:"Microsoft YaHei",sans-serif;max-width:800px;margin:40px auto;padding:20px;line-height:2}
h1{color:#c47a5a} h2{color:#7a685b;margin-top:28px} p{text-indent:2em}</style></head><body>
<h1>全书导出</h1><p>${now}</p>
${books.map(b => `<h2>《${b.title}》</h2>${(b.chapters||[]).sort((a,b)=>a.order-b.order).map(c => `<h3>${c.title}</h3>${(c.content||'').split('\\n').filter(l=>l.trim()).map(l=>`<p>${l}</p>`).join('')}`).join('')}`).join('<hr>')}
</body></html>`;
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename + '.html';
        a.click();
        setMsg('✅ HTML 已下载');
      }
    } catch (e) {
      setMsg('❌ 导出失败: ' + e.message);
    } finally {
      setBusy(false);
      setTimeout(() => setMsg(null), 3000);
    }
  };

  return (
    <section className="setting-section">
      <h3>导出全书</h3>
      <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>
        将所有书籍所有章节合并导出为一个文件
      </p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button className="btn-export-book" onClick={() => handleExport('txt')} disabled={busy}>
          导出 TXT
        </button>
        <button className="btn-export-book" onClick={() => handleExport('html')} disabled={busy}>
          导出 HTML
        </button>
      </div>
      {msg && <div style={{ marginTop: 8, fontSize: 12, fontWeight: 600, color: msg.startsWith('✅') ? '#3b6d50' : '#d44' }}>{msg}</div>}
    </section>
  );
}

// ========== 手动云端同步组件 ==========
function ManualSyncSection() {
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState(null);

  const handleUpload = async () => {
    setSyncing(true); setMsg('⏳ 上传中...');
    try {
      const store = useStore.getState();
      const data = { books: store.books, inspirationCards: store.inspirationCards,
        aiConversations: store.aiConversations, settings: (() => { const { splashImage, ...s } = store.settings; return s; })(),
        dailyCounts: store.dailyCounts, trash: store.trash, _updatedAt: Date.now() };
      const { cloudSave } = await import('../utils/webdav');
      const ok = await cloudSave(data);
      setMsg(ok ? '✅ 上传成功 ' + new Date().toLocaleTimeString() : '❌ 上传失败');
    } catch (e) { setMsg('❌ ' + e.message); }
    setSyncing(false); setTimeout(() => setMsg(null), 3000);
  };

  const handleDownload = async () => {
    if (!confirm('从云端下载将覆盖本地数据，确定继续？')) return;
    setSyncing(true); setMsg('⏳ 下载中...');
    try {
      const { cloudLoad } = await import('../utils/webdav');
      const cloud = await cloudLoad();
      if (!cloud || !cloud.books) { setMsg('❌ 云端无数据'); setSyncing(false); return; }
      const store = useStore.getState();
      const splash = store.settings?.splashImage;
      useStore.setState({
        books: cloud.books || [],
        inspirationCards: cloud.inspirationCards || [],
        aiConversations: cloud.aiConversations || [],
        dailyCounts: cloud.dailyCounts || {},
        trash: cloud.trash || [],
        settings: { ...(store.settings || {}), ...(cloud.settings || {}), splashImage: splash },
        dirty: true,
      });
      await store.persist();
      setMsg('✅ 下载成功 ' + new Date().toLocaleTimeString() + '，即将刷新...');
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) { setMsg('❌ ' + e.message); }
    setSyncing(false);
  };

  return (
    <section className="setting-section">
      <h3>手动云端同步</h3>
      <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>
        上传：电脑数据 → 云端<br/>下载：云端 → 覆盖本机（手机/电脑切换时使用）
      </p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button className="tb-btn" onClick={handleUpload} disabled={syncing} style={{ fontWeight: 700 }}>
          上传到云端
        </button>
        <button className="tb-btn" onClick={handleDownload} disabled={syncing} style={{ fontWeight: 700 }}>
          从云端下载
        </button>
      </div>
      {msg && <div style={{ marginTop: 8, fontSize: 12, fontWeight: 600, color: msg.startsWith('✅') ? '#3b6d50' : '#d44' }}>{msg}</div>}
    </section>
  );
}

// ========== 全量备份 & 恢复组件 ==========
function BackupRestoreSection() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // { type:'ok'|'err', text }

  const showMsg = (type, text) => { setMsg({ type, text }); setTimeout(() => setMsg(null), 4000); };

  // ---- 导出 ----
  const handleExport = () => {
    try {
      setBusy(true);
      const store = useStore.getState();
      // 收集全部数据（不含 transient fields）
      const backup = {
        version: 2,
        exportedAt: new Date().toISOString(),
        books: store.books || [],
        inspirationCards: store.inspirationCards || [],
        aiConversations: store.aiConversations || [],
        settings: (() => { const { splashImage, ...s } = store.settings; return s; })(),
        dailyCounts: store.dailyCounts || {},
        trash: store.trash || [],
      };
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ts = new Date().toISOString().slice(0, 10);
      a.download = `小说助手备份_${ts}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showMsg('ok', `✅ 导出成功！共 ${backup.books.length} 本书 · ${backup.inspirationCards.length} 张灵感卡片`);
    } catch (e) {
      showMsg('err', '❌ 导出失败: ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  // ---- 导入 ----
  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const raw = ev.target.result;
        let backup;
        try { backup = JSON.parse(raw); } catch {
          showMsg('err', '❌ 文件格式错误：不是有效的 JSON');
          setBusy(false); return;
        }
        if (!backup.books && !backup.inspirationCards) {
          showMsg('err', '❌ 文件格式错误：缺少 books 或 inspirationCards 字段');
          setBusy(false); return;
        }

        // 二次确认
        const bookCount = backup.books?.length || 0;
        const cardCount = backup.inspirationCards?.length || 0;
        const convCount = backup.aiConversations?.length || 0;
        const ok = window.confirm(
          `即将恢复备份数据：\n\n${bookCount} 本书\n ${cardCount} 张灵感卡片\n🤖 ${convCount} 条 AI 对话\n\n⚠️ 当前数据将被覆盖，确定继续？`
        );
        if (!ok) { setBusy(false); return; }

        // 写入 store（Zustand 必须用 setState）
        const currentSplash = useStore.getState().settings?.splashImage;
        useStore.setState({
          books: backup.books || [],
          inspirationCards: backup.inspirationCards || [],
          aiConversations: backup.aiConversations || [],
          dailyCounts: backup.dailyCounts || {},
          trash: backup.trash || [],
          settings: {
            ...(useStore.getState().settings || {}),
            ...(backup.settings || {}),
            splashImage: currentSplash,
          },
          dirty: true,
        });
        // 写入 IndexedDB
        await useStore.getState().persist();
        showMsg('ok', `✅ 恢复成功！请刷新页面查看。\n${bookCount} 书 ·  ${cardCount} 灵感 · 🤖 ${convCount} 对话`);
        // 3 秒后自动刷新
        setTimeout(() => { window.location.reload(); }, 2500);
      } catch (e) {
        showMsg('err', '❌ 恢复失败: ' + e.message);
      } finally {
        setBusy(false);
        e.target.value = '';
      }
    };
    reader.onerror = () => { showMsg('err', '❌ 文件读取失败'); setBusy(false); };
    reader.readAsText(file);
  };

  return (
    <section className="setting-section">
      <h3>全量备份 & 恢复</h3>
      <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>
        一键导出全部数据为 JSON 文件 · 清缓存前先备份 · 换设备时用文件恢复
      </p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
        <button
          className="tb-btn"
          onClick={handleExport}
          disabled={busy}
          style={{ fontWeight: 700 }}
        >
          导出备份
        </button>
        <label className="tb-btn" style={{ cursor: 'pointer', fontWeight: 700 }}>
          导入恢复
          <input type="file" accept=".json" style={{ display: 'none' }}
            onChange={handleImport} disabled={busy} />
        </label>
      </div>
      {msg && (
        <div style={{
          padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
          background: msg.type === 'ok' ? 'var(--mint2)' : '#ffe0e0',
          color: msg.type === 'ok' ? '#3b6d50' : '#d44',
          whiteSpace: 'pre-wrap',
        }}>
          {msg.text}
        </div>
      )}
    </section>
  );
}

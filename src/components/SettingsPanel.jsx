import React, { useState, useEffect } from 'react';
import useStore from '../store';
import { getWebDAVConfig, saveWebDAVConfig, testConnection } from '../utils/webdav';

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
        <h2>😻 设置</h2>
        <p>自定义你的小说助手外观~</p>
      </div>

      <div className="settings-content">
        {/* 主题选择 */}
        <section className="setting-section">
          <h3>🎨 美术主题</h3>
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
          <h3>🔤 字体选择</h3>
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
          <h3>📏 字号大小</h3>
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
          <h3>🎨 字体颜色</h3>
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
              🎨
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
          <div className="color-preview" style={{ color: settings.fontColor }}>
            🐱 喵~ 这是字体颜色预览
          </div>
        </section>

        {/* 悬浮窗透明度 */}
        <section className="setting-section">
          <h3>🪟 悬浮窗默认透明度</h3>
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
          <h3>💾 存档设置</h3>
          <div className="setting-info">
            <p>📚 历史版本上限: 最近20次</p>
            <p>💡 按 Ctrl+S 手动存档</p>
            <p>☁️ 配置坚果云后自动云端同步</p>
          </div>
        </section>
      </div>
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
      <h3>☁️ 坚果云同步</h3>
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
            {testing ? '测试中...' : '🔍 测试连接'}
          </button>
          <button onClick={handleSave} disabled={!url || !username || !password}>
            💾 保存配置
          </button>
          {status === 'connected' && (
            <button onClick={handleDisconnect} className="webdav-disconnect">断开</button>
          )}
        </div>
        <div className="webdav-status">
          {status === 'testing' && <span>⏳ 正在测试连接...</span>}
          {status === 'connected' && <span style={{color:'#4caf7c'}}>✅ 已连接 · 数据自动云同步</span>}
          {status === 'error' && <span style={{color:'#e74c3c'}}>❌ 连接失败 · 请检查地址/账号/密码</span>}
        </div>
      </div>
    </section>
  );
}

import React, { useEffect, useRef, useCallback, useState, useMemo, lazy, Suspense } from 'react';
import useStore from './store';
import NavBar from './components/NavBar';
import DirectoryView from './components/DirectoryView';
import MobileStack from './components/MobileStack';
import MobileFullPage from './components/MobileFullPage';
import { spawnPaw } from './components/Icon';
import { loadSplash } from './utils/storage';

// 懒加载重量级组件
const MindMapView = lazy(() => import('./components/MindMapView'));
const InspirationView = lazy(() => import('./components/InspirationView'));
const AIChatView = lazy(() => import('./components/AIChatView'));
const DiffViewer = lazy(() => import('./components/DiffViewer'));
const SettingsPanel = lazy(() => import('./components/SettingsPanel'));
const GachaMachine = lazy(() => import('./components/GachaMachine'));
const QuickNotes = lazy(() => import('./components/QuickNotes'));
const CalendarView = lazy(() => import('./components/CalendarView'));
const TrashView = lazy(() => import('./components/TrashView'));

// 随机颜表情加载动画
const faces = ['(=ﾟωﾟ)=','( ﾟ∀。)','(´･ω･`)','(ﾉ>ω<)ﾉ','(=^･ω･^=)','(｡･ω･｡)','(◕‿◕)','(≧∇≦)','(◍•ᴗ•◍)'];
function randomFace() { return faces[Math.floor(Math.random() * faces.length)]; }
const Loader = () => {
  const [face] = useState(randomFace);
  return <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',color:'var(--text3)',gap:8}}>
    <span style={{fontSize:28}}>{face}</span>
    <span style={{fontSize:13}}>喵~ 加载中...</span>
  </div>;
};

const fontMap = {
  font1: '"Microsoft YaHei","PingFang SC",sans-serif',
  font2: '"SimSun","Noto Serif SC",serif',
  font3: '"KaiTi","STKaiti",serif',
  font4: '"SimHei","PingFang SC",sans-serif',
  font5: '"DengXian","PingFang SC",sans-serif',
  font6: '"FangSong","STFangsong",serif',
  font7: '"Rounded Mplus 1c","Microsoft YaHei",sans-serif',
  font8: '"ZCOOL KuaiLe","Comic Sans MS",cursive',
};

function hexToRgba(hex, opacity) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${opacity})`;
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768);
  useEffect(() => {
    let timer;
    const onResize = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setIsMobile(window.innerWidth <= 768), 200);
    };
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('resize', onResize); clearTimeout(timer); };
  }, []);
  return isMobile;
}

export default function App() {
  const { initialized, init, persist, dirty, settings, books, inspirationCards, toast, clearToast } = useStore();
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState('directory');
  const [gachaOpen, setGachaOpen] = useState(false);
  const [quickNoteOpen, setQuickNoteOpen] = useState(false);
  const [filmNoteOpen, setFilmNoteOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  const [selectedBookId, setSelectedBookId] = useState(null);
  const [selectedChapterId, setSelectedChapterId] = useState(null);
  const [mindmapDrillId, setMindmapDrillId] = useState(null);
  const [inspDrillId, setInspDrillId] = useState(null);
  const [inspCount, setInspCount] = useState(0);

  const selectedChapter = useMemo(() => {
    if (!selectedChapterId || !selectedBookId) return null;
    return books.find(b => b.id === selectedBookId)?.chapters?.find(c => c.id === selectedChapterId) || null;
  }, [books, selectedBookId, selectedChapterId]);

  useEffect(() => { init(); }, []);

  // App 启动时同步云端并提示
  useEffect(() => {
    if (initialized) {
      const { showToast } = useStore.getState();
      showToast('已从云端同步数据');
    }
  }, [initialized]);

  useEffect(() => {
    if (books.length > 0 && !selectedBookId) setSelectedBookId(books[0].id);
  }, [books, selectedBookId]);

  // 切换回目录时自动保存并同步云端
  const prevTabRef = useRef(activeTab);
  useEffect(() => {
    const prev = prevTabRef.current;
    prevTabRef.current = activeTab;
    const contentTabs = ['mindmap', 'inspiration', 'aichat', 'settings'];
    if (activeTab === 'directory' && contentTabs.includes(prev) && dirty) {
      persist();
    }
  }, [activeTab]);

  // Toast 自动消失
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => clearToast(), 2500);
    return () => clearTimeout(t);
  }, [toast?.ts]);

  // 每8秒自动保存
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  useEffect(() => {
    if (!initialized) return;
    const t = setInterval(() => { if (dirtyRef.current) persist(); }, 8000);
    return () => clearInterval(t);
  }, [initialized]);

  // Ctrl+S 手动保存
  useEffect(() => {
    const h = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        persist();
      }
    };
    document.addEventListener('keydown', h, { capture: true });
    return () => document.removeEventListener('keydown', h, { capture: true });
  }, []);

  // 🐾 全局猫爪点击效果
  useEffect(() => {
    const h = (e) => {
      const el = e.target.closest('button, .icon-wrap, .nav-brand, .clickable, [role="button"]');
      if (el) spawnPaw(e);
    };
    window.addEventListener('click', h);
    return () => window.removeEventListener('click', h);
  }, []);


  const fontColorRgba = useMemo(
    () => hexToRgba(settings.fontColor || '#4a3728', settings.fontOpacity ?? 0.92),
    [settings.fontColor, settings.fontOpacity]
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme || 'warm');
  }, [settings.theme]);

  if (!initialized) {
    // 从 localStorage 直接读开屏设置
    let splash = null, splashFit = 'cover', splashPos = 'center';
    try {
      splash = loadSplash();
      const raw = localStorage.getItem('novel_novel_app_data');
      if (raw) { const s = JSON.parse(raw).settings; splashFit = s?.splashFit || 'cover'; splashPos = s?.splashPos || 'center'; }
    } catch (_) {}
    const bgStyle = splash ? {
      background:`url(${splash}) ${splashPos}/${splashFit}`,
      backgroundRepeat:'no-repeat',
    } : {};
    return <div className="app-loading" style={bgStyle} />;
  }

  // ====== 手机端：翻页式导航 ======
  if (isMobile) {
    return (
      <div className="app-container mobile-app" style={{
        fontFamily: fontMap[settings.fontFamily] || fontMap.font1,
        fontSize: settings.fontSize + 'px',
        color: fontColorRgba,
      }}>
        {/* MobileStack 始终挂载（display切换保活） */}
        <div style={{display: activeTab === 'directory' ? 'flex' : 'none', flex:1, flexDirection:'column', height:'100%'}}>
          <MobileStack
            activeMainTab={activeTab}
            onTabChange={setActiveTab}
            onGachaClick={() => setGachaOpen(true)}
            onQuickNote={() => setQuickNoteOpen(true)}
            onFilmNote={() => setFilmNoteOpen(true)}
            onCalendarClick={() => setCalendarOpen(true)}
            onTrashClick={() => setTrashOpen(true)}
          />
        </div>

        {/* 思维导图全屏页 */}
        {activeTab === 'mindmap' && (
          mindmapDrillId ? (
            <MobileFullPage title="思维导图" onBack={() => setMindmapDrillId(null)}>
              <Suspense fallback={<Loader />}><MindMapView books={books} selectedBookId={selectedBookId} onSelectBook={setSelectedBookId}
                focusCardId={mindmapDrillId} onFocusCard={setMindmapDrillId} isMobile /></Suspense>
            </MobileFullPage>
          ) : (
            <MobileFullPage title="思维导图" onBack={() => setActiveTab('directory')}
              actions={<><button className="tb-btn" onClick={() => document.querySelector('.btn-add-card')?.click()}>+母卡片</button><button className="tb-btn" onClick={() => document.querySelector('.btn-import')?.click()}>导入</button></>}>
              <Suspense fallback={<Loader />}><MindMapView books={books} selectedBookId={selectedBookId} onSelectBook={setSelectedBookId}
                onFocusCard={setMindmapDrillId} isMobile /></Suspense>
            </MobileFullPage>
          )
        )}

        {/* 灵感卡片全屏页 */}
        {activeTab === 'inspiration' && (
          inspDrillId ? (
            <MobileFullPage title="灵感卡片" count={inspCount} onBack={() => setInspDrillId(null)}>
              <Suspense fallback={<Loader />}><InspirationView books={books} drillCardId={inspDrillId} onBack={() => setInspDrillId(null)} onCountChange={setInspCount} /></Suspense>
            </MobileFullPage>
          ) : (
            <MobileFullPage title="灵感卡片" count={inspCount} onBack={() => setActiveTab('directory')}
              actions={<><button className="tb-btn" onClick={() => document.getElementById('insp-import-file')?.click()}>导入</button></>}>
              <Suspense fallback={<Loader />}><InspirationView books={books} onDrillCard={setInspDrillId} isMobile onCountChange={setInspCount} /></Suspense>
            </MobileFullPage>
          )
        )}

        {/* AI 对话全屏页 */}
        {activeTab === 'aichat' && (
          <MobileFullPage title="AI 对话" onBack={() => setActiveTab('directory')}>
            <Suspense fallback={<Loader />}><AIChatView chapterContent={selectedChapter?.content || null}
              chapterTitle={selectedChapter?.title || null} /></Suspense>
          </MobileFullPage>
        )}

        {/* 设置全屏页 */}
        {activeTab === 'settings' && (
          <MobileFullPage title="设置" onBack={() => setActiveTab('directory')}>
            <Suspense fallback={<Loader />}><SettingsPanel /></Suspense>
          </MobileFullPage>
        )}

        {/* 弹窗 */}
        <Suspense fallback={null}>
          {gachaOpen && <GachaMachine books={books} onClose={() => setGachaOpen(false)} />}
          {quickNoteOpen && <QuickNotes mode="quick" books={books} onClose={() => setQuickNoteOpen(false)} />}
          {filmNoteOpen && <QuickNotes mode="film" books={books} onClose={() => setFilmNoteOpen(false)} />}
          {calendarOpen && <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setCalendarOpen(false)}>
            <div className="cal-modal"><button className="modal-close" onClick={() => setCalendarOpen(false)}>✕</button><CalendarView /></div></div>}
          {trashOpen && <TrashView onClose={() => setTrashOpen(false)} />}
        </Suspense>
        {/* Toast 提示 */}
        {toast && <div className="toast-bar">{toast.text}</div>}
      </div>
    );
  }

  // ====== 桌面端：原布局 ======
  return (
    <div className="app-container" style={{
      fontFamily: fontMap[settings.fontFamily] || fontMap.font1,
      fontSize: settings.fontSize + 'px',
      color: fontColorRgba,
    }}>
      <NavBar activeTab={activeTab} onTabChange={setActiveTab}
        onGachaClick={() => setGachaOpen(true)}
        onQuickNote={() => setQuickNoteOpen(true)}
        onFilmNote={() => setFilmNoteOpen(true)}
        onCalendarClick={() => setCalendarOpen(true)}
        onTrashClick={() => setTrashOpen(true)} />

      <div className="main-content">
        <Suspense fallback={<Loader />}>
          {activeTab === 'mindmap' && <MindMapView books={books} selectedBookId={selectedBookId} onSelectBook={setSelectedBookId} />}
          {activeTab === 'inspiration' && <InspirationView books={books} />}
          {activeTab === 'directory' && <DirectoryView selectedBookId={selectedBookId} selectedChapterId={selectedChapterId}
            onSelectBook={setSelectedBookId} onSelectChapter={setSelectedChapterId} onCalendarClick={() => setCalendarOpen(true)} />}
          {activeTab === 'settings' && <SettingsPanel />}
          {activeTab === 'aichat' && <AIChatView chapterContent={selectedChapter?.content || null}
            chapterTitle={selectedChapter?.title || null} />}
          {activeTab === 'history' && <DiffViewer books={books} inspirationCards={inspirationCards} />}
        </Suspense>
      </div>

      <Suspense fallback={null}>
        {gachaOpen && <GachaMachine books={books} onClose={() => setGachaOpen(false)} />}
        {quickNoteOpen && <QuickNotes mode="quick" books={books} onClose={() => setQuickNoteOpen(false)} />}
        {filmNoteOpen && <QuickNotes mode="film" books={books} onClose={() => setFilmNoteOpen(false)} />}
        {calendarOpen && <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setCalendarOpen(false)}>
          <div className="cal-modal"><button className="modal-close" onClick={() => setCalendarOpen(false)}>✕</button><CalendarView /></div></div>}
        {trashOpen && <TrashView onClose={() => setTrashOpen(false)} />}
      </Suspense>
      {toast && <div className="toast-bar">{toast.text}</div>}
    </div>
  );
}

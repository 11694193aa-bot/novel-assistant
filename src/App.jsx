import React, { useEffect, useRef, useCallback, useState } from 'react';
import useStore from './store';
import NavBar from './components/NavBar';
import MindMapView from './components/MindMapView';
import InspirationView from './components/InspirationView';
import GachaMachine from './components/GachaMachine';
import DirectoryView from './components/DirectoryView';
import DiffViewer from './components/DiffViewer';
import SettingsPanel from './components/SettingsPanel';
import QuickNotes from './components/QuickNotes';
import CalendarView from './components/CalendarView';
import TrashView from './components/TrashView';

const TABS = {
  MINDMAP: 'mindmap',
  INSPIRATION: 'inspiration',
  DIRECTORY: 'directory',
  GACHA: 'gacha',
  SETTINGS: 'settings',
  HISTORY: 'history',
};

export default function App() {
  const {
    initialized, init, persist, dirty,
    settings, books, inspirationCards,
  } = useStore();

  const [activeTab, setActiveTab] = useState(TABS.DIRECTORY);
  const [gachaOpen, setGachaOpen] = useState(false);
  const [quickNoteOpen, setQuickNoteOpen] = useState(false);
  const [filmNoteOpen, setFilmNoteOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  const [selectedBookId, setSelectedBookId] = useState(null);
  const [selectedChapterId, setSelectedChapterId] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyTarget, setHistoryTarget] = useState(null);

  // 初始化时加载数据
  useEffect(() => {
    init();
  }, []);

  // 选中第一本书
  useEffect(() => {
    if (books.length > 0 && !selectedBookId) {
      setSelectedBookId(books[0].id);
    }
  }, [books, selectedBookId]);

  // 会话存档：关闭/刷新时自动保存
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (dirtyRef.current) {
        // 同步保存（beforeunload 中必须同步）
        const { books: b, inspirationCards: ic, settings: s } = useStore.getState();
        const saveDataSync = () => {
          try {
            const data = JSON.stringify({ books: b, inspirationCards: ic, settings: s });
            localStorage.setItem('novel_novel_app_data', data);
            // 同时保存历史版本
            const histKey = 'novel_history_novel_app_data';
            const existing = JSON.parse(localStorage.getItem(histKey) || '[]');
            existing.unshift(Date.now());
            const trimmed = existing.slice(0, 20);
            localStorage.setItem(histKey, JSON.stringify(trimmed));
            localStorage.setItem(`novel_history_novel_app_data_${Date.now()}`, data);
          } catch (err) { /* ignore */ }
        };
        saveDataSync();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // 快捷键 Ctrl+S 手动存档
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        persist().then(() => console.log('💾 手动存档完成'));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleOpenHistory = useCallback((bookId, chapterId) => {
    setHistoryTarget({ type: 'chapter', bookId, chapterId });
    setHistoryOpen(true);
  }, []);

  const handleOpenInspirationHistory = useCallback((cardId) => {
    setHistoryTarget({ type: 'inspiration', cardId });
    setHistoryOpen(true);
  }, []);

  // 应用主题
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme || 'warm');
  }, [settings.theme]);

  // 应用设置：字体加粗
  const fontMap = {
    font1: '"Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", "微软雅黑", sans-serif',
    font2: '"SimSun", "Noto Serif SC", "STSong", "宋体", serif',
    font3: '"KaiTi", "STKaiti", "楷体", serif',
    font4: '"SimHei", "PingFang SC", "Heiti SC", "黑体", sans-serif',
    font5: '"DengXian", "PingFang SC", "等线", sans-serif',
    font6: '"FangSong", "STFangsong", "仿宋", serif',
    font7: '"Rounded Mplus 1c", "Microsoft YaHei", "PingFang SC", sans-serif',
    font8: '"ZCOOL KuaiLe", "Comic Sans MS", "KaiTi", cursive, sans-serif',
  };

  const appStyle = {
    fontFamily: fontMap[settings.fontFamily] || fontMap.font1,
    fontSize: `${settings.fontSize}px`,
    color: settings.fontColor,
    fontWeight: ['font4','font7'].includes(settings.fontFamily) ? 500 : 400,
  };

  if (!initialized) {
    return (
      <div className="app-loading">
        <div className="loading-cat">🐱</div>
        <p>(=ﾟωﾟ)= 喵~ 正在加载中...</p>
      </div>
    );
  }

  return (
    <div className="app-container" style={appStyle}>
      <NavBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onGachaClick={() => setGachaOpen(true)}
        onQuickNote={() => setQuickNoteOpen(true)}
        onFilmNote={() => setFilmNoteOpen(true)}
        onCalendarClick={() => setCalendarOpen(true)}
        onTrashClick={() => setTrashOpen(true)}
      />

      <div className="main-content">
        {activeTab === TABS.MINDMAP && (
          <MindMapView
            books={books}
            selectedBookId={selectedBookId}
            onSelectBook={setSelectedBookId}
          />
        )}

        {activeTab === TABS.INSPIRATION && (
          <InspirationView
            books={books}
            onOpenHistory={handleOpenInspirationHistory}
          />
        )}

        {activeTab === TABS.DIRECTORY && (
          <DirectoryView
            selectedBookId={selectedBookId}
            selectedChapterId={selectedChapterId}
            onSelectBook={setSelectedBookId}
            onSelectChapter={setSelectedChapterId}
            onCalendarClick={() => setCalendarOpen(true)}
          />
        )}

        {activeTab === TABS.SETTINGS && (
          <SettingsPanel />
        )}

        {activeTab === TABS.HISTORY && (
          <DiffViewer
            books={books}
            inspirationCards={inspirationCards}
          />
        )}
      </div>

      {gachaOpen && (
        <GachaMachine
          books={books}
          onClose={() => setGachaOpen(false)}
        />
      )}

      {quickNoteOpen && (
        <QuickNotes
          mode="quick"
          books={books}
          onClose={() => setQuickNoteOpen(false)}
        />
      )}

      {filmNoteOpen && (
        <QuickNotes
          mode="film"
          books={books}
          onClose={() => setFilmNoteOpen(false)}
        />
      )}

      {calendarOpen && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setCalendarOpen(false)}>
          <div className="cal-modal">
            <button className="modal-close" onClick={() => setCalendarOpen(false)}>✕</button>
            <CalendarView />
          </div>
        </div>
      )}

      {trashOpen && (
        <TrashView onClose={() => setTrashOpen(false)} />
      )}

      {historyOpen && historyTarget && (
        <DiffViewer
          books={books}
          inspirationCards={inspirationCards}
          target={historyTarget}
          onClose={() => { setHistoryOpen(false); setHistoryTarget(null); }}
        />
      )}
    </div>
  );
}

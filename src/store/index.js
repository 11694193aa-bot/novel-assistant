import { create } from 'zustand';
import { saveData, loadData, saveHistory } from '../utils/storage';

// 生成唯一ID
export const uid = () => crypto.randomUUID ? crypto.randomUUID() :
  'xxxx-xxxx-xxxx-xxxx'.replace(/x/g, () => Math.floor(Math.random() * 16).toString(16));

const SAVE_KEY = 'novel_app_data';

// 默认设置
const defaultSettings = {
  theme: 'warm',           // warm/ink/sakura/forest/ocean
  fontFamily: 'font1',     // font1=萌体, font2=宋体, font3=黑体
  fontSize: 16,
  fontColor: '#4a3728',
  windowOpacity: 0.9,
  autoSaveInterval: 5000,  // 5秒自动存档
  maxHistory: 20,
};

const useStore = create((set, get) => ({
  // ============ 数据 ============
  books: [],
  inspirationCards: [],
  settings: { ...defaultSettings },
  dailyCounts: {},
  trash: [],          // 回收站 [{ id, type, item, bookId, deletedAt }]
  dirty: false,
  initialized: false,

  // ============ 初始化 ============
  init: async () => {
    const data = await loadData(SAVE_KEY);
    if (data) {
      set({
        books: data.books || [],
        inspirationCards: data.inspirationCards || [],
        settings: { ...defaultSettings, ...(data.settings || {}) },
        dailyCounts: data.dailyCounts || {},
        trash: data.trash || [],
        initialized: true,
      });
    } else {
      set({ initialized: true });
    }
  },

  // ============ 持久化 ============
  persist: async () => {
    const { books, inspirationCards, settings, dailyCounts, trash } = get();
    const data = { books, inspirationCards, settings, dailyCounts, trash };
    await saveData(SAVE_KEY, data);
    const now = Date.now();
    await saveHistory(SAVE_KEY, data, now);
    set({ dirty: false });
  },

  markDirty: () => set({ dirty: true }),

  // ============ 每日字数追踪 ============
  addDailyCount: (delta) => {
    const today = new Date().toISOString().slice(0, 10); // "2026-06-08"
    set(s => ({
      dailyCounts: {
        ...s.dailyCounts,
        [today]: (s.dailyCounts[today] || 0) + delta,
      },
    }));
  },

  // ============ 回收站 ============
  moveToTrash: (type, item, bookId = null) => {
    set(s => ({
      trash: [...s.trash, { id: uid(), type, item, bookId, deletedAt: Date.now() }],
      dirty: true,
    }));
  },

  restoreFromTrash: (trashId) => {
    const entry = get().trash.find(t => t.id === trashId);
    if (!entry) return;
    const { type, item, bookId } = entry;
    if (type === 'book') {
      set(s => ({ books: [...s.books, item], trash: s.trash.filter(t => t.id !== trashId), dirty: true }));
    } else if (type === 'chapter') {
      set(s => ({ books: s.books.map(b => b.id === bookId ? { ...b, chapters: [...(b.chapters || []), item] } : b), trash: s.trash.filter(t => t.id !== trashId), dirty: true }));
    } else if (type === 'inspirationCard') {
      set(s => ({ inspirationCards: [...s.inspirationCards, item], trash: s.trash.filter(t => t.id !== trashId), dirty: true }));
    } else if (type === 'mindMapCard') {
      set(s => ({ books: s.books.map(b => b.id === bookId ? { ...b, mindMapCards: [...(b.mindMapCards || []), item] } : b), trash: s.trash.filter(t => t.id !== trashId), dirty: true }));
    }
  },

  permanentDelete: (trashId) => {
    set(s => ({ trash: s.trash.filter(t => t.id !== trashId), dirty: true }));
  },

  clearTrash: () => {
    set(s => ({ trash: [], dirty: true }));
  },

  // ============ 设置 ============
  updateSettings: (partial) => {
    set(s => ({ settings: { ...s.settings, ...partial }, dirty: true }));
  },

  // ============ 书籍操作 ============
  addBook: (title) => {
    const book = {
      id: uid(),
      title: title || '新书籍',
      createdAt: Date.now(),
      mindMapCards: [],
    };
    set(s => ({ books: [...s.books, book], dirty: true }));
    return book;
  },

  deleteBook: (bookId) => {
    const book = get().books.find(b => b.id === bookId);
    if (!book) return;
    get().moveToTrash('book', book, bookId);
    set(s => ({
      books: s.books.filter(b => b.id !== bookId),
      inspirationCards: s.inspirationCards.map(c =>
        c.bookId === bookId ? { ...c, bookId: null } : c
      ),
      dirty: true,
    }));
  },

  renameBook: (bookId, title) => {
    set(s => ({
      books: s.books.map(b => b.id === bookId ? { ...b, title } : b),
      dirty: true,
    }));
  },

  // ============ 章节操作 ============
  addChapter: (bookId, title, parentId = null) => {
    const book = get().books.find(b => b.id === bookId);
    if (!book) return null;
    const chapters = book.chapters || [];
    // 自动命名：按顺序"第N章"
    const autoTitle = () => {
      const siblings = chapters.filter(c => c.parentId === parentId);
      const num = siblings.length + 1;
      const toCN = (n) => {
        if (n <= 0) return '零';
        const digits = ['零','一','二','三','四','五','六','七','八','九'];
        const tens = ['','十','二十','三十','四十','五十','六十','七十','八十','九十'];
        if (n <= 10) return digits[n];
        if (n < 20) return '十' + (n % 10 === 0 ? '' : digits[n % 10]);
        if (n < 100) {
          const t = Math.floor(n / 10);
          const o = n % 10;
          return tens[t] + (o === 0 ? '' : digits[o]);
        }
        if (n < 200) {
          const r = n - 100;
          if (r === 0) return '一百';
          return '一百' + (r < 10 ? '零' : '') + toCN(r);
        }
        // 200+
        const h = Math.floor(n / 100);
        const r = n % 100;
        return digits[h] + '百' + (r === 0 ? '' : (r < 10 ? '零' : '') + toCN(r));
      };
      return parentId ? `第${toCN(num)}节` : `第${toCN(num)}章`;
    };
    const chapter = {
      id: uid(),
      title: title || autoTitle(),
      content: '',
      parentId,
      autoNamed: !title, // 标记是否自动命名
      order: chapters.length,
    };
    set(s => ({
      books: s.books.map(b => b.id === bookId
        ? { ...b, chapters: [...(b.chapters || []), chapter] }
        : b),
      dirty: true,
    }));
    return chapter;
  },

  deleteChapter: (bookId, chapterId) => {
    const book = get().books.find(b => b.id === bookId);
    const chapter = book?.chapters?.find(c => c.id === chapterId);
    if (chapter) get().moveToTrash('chapter', chapter, bookId);
    // 同时回收子章节
    const children = book?.chapters?.filter(c => c.parentId === chapterId) || [];
    children.forEach(ch => get().moveToTrash('chapter', ch, bookId));
    set(s => ({
      books: s.books.map(b => b.id === bookId ? {
        ...b,
        chapters: (b.chapters || []).filter(c =>
          c.id !== chapterId && c.parentId !== chapterId
        ),
      } : b),
      dirty: true,
    }));
  },

  renameChapter: (bookId, chapterId, title) => {
    set(s => ({
      books: s.books.map(b => b.id === bookId ? {
        ...b,
        chapters: (b.chapters || []).map(c =>
          c.id === chapterId ? { ...c, title, autoNamed: false } : c
        ),
      } : b),
      dirty: true,
    }));
  },

  updateChapterContent: (bookId, chapterId, content) => {
    set(s => ({
      books: s.books.map(b => b.id === bookId ? {
        ...b,
        chapters: (b.chapters || []).map(c =>
          c.id === chapterId ? { ...c, content } : c
        ),
      } : b),
      dirty: true,
    }));
  },

  moveChapter: (bookId, chapterId, newParentId) => {
    set(s => ({
      books: s.books.map(b => b.id === bookId ? {
        ...b,
        chapters: (b.chapters || []).map(c =>
          c.id === chapterId ? { ...c, parentId: newParentId } : c
        ),
      } : b),
      dirty: true,
    }));
  },

  // ============ 思维导图卡片操作（书籍级别） ============
  addMindMapCard: (bookId, title, content = '', parentCardId = null) => {
    const card = {
      id: uid(),
      title: title || '',
      content: content || '',
      parentId: parentCardId || null,
      children: [],
      createdAt: Date.now(),
    };
    set(s => ({
      books: s.books.map(b => {
        if (b.id !== bookId) return b;
        if (parentCardId) {
          const addToParent = (cards) => cards.map(c => {
            if (c.id === parentCardId) return { ...c, children: [...(c.children || []), card] };
            return { ...c, children: addToParent(c.children || []) };
          });
          return { ...b, mindMapCards: addToParent(b.mindMapCards || []) };
        }
        return { ...b, mindMapCards: [...(b.mindMapCards || []), card] };
      }),
      dirty: true,
    }));
    return card;
  },

  // 批量添加卡片（用于导入）
  addMindMapCards: (bookId, cards) => {
    set(s => ({
      books: s.books.map(b => b.id === bookId
        ? { ...b, mindMapCards: [...(b.mindMapCards || []), ...cards] }
        : b),
      dirty: true,
    }));
  },

  deleteMindMapCard: (bookId, cardId) => {
    // 递归查找卡片放入回收站
    const findCard = (cards) => {
      for (const c of cards) {
        if (c.id === cardId) return c;
        const found = findCard(c.children || []);
        if (found) return found;
      }
      return null;
    };
    const book = get().books.find(b => b.id === bookId);
    const card = findCard(book?.mindMapCards || []);
    if (card) get().moveToTrash('mindMapCard', card, bookId);

    const removeCard = (cards) => cards
      .filter(c => c.id !== cardId)
      .map(c => ({ ...c, children: removeCard(c.children || []) }));
    set(s => ({
      books: s.books.map(b => b.id === bookId
        ? { ...b, mindMapCards: removeCard(b.mindMapCards || []) }
        : b),
      dirty: true,
    }));
  },

  updateMindMapCard: (bookId, cardId, updates) => {
    const updateCard = (cards) => cards.map(c => {
      if (c.id === cardId) return { ...c, ...updates };
      return { ...c, children: updateCard(c.children || []) };
    });
    set(s => ({
      books: s.books.map(b => b.id === bookId
        ? { ...b, mindMapCards: updateCard(b.mindMapCards || []) }
        : b),
      dirty: true,
    }));
  },

  // ============ 灵感卡片操作 ============
  addInspirationCard: (card) => {
    const newCard = {
      id: uid(),
      title: card.title || '灵感',
      content: card.content || '',
      category: card.category || '灵感火花',
      bookId: card.bookId || null,
      source: card.source || 'manual',
      gachaQuestion: card.gachaQuestion || '',
      createdAt: Date.now(),
    };
    set(s => ({ inspirationCards: [...s.inspirationCards, newCard], dirty: true }));
    return newCard;
  },

  deleteInspirationCard: (cardId) => {
    const card = get().inspirationCards.find(c => c.id === cardId);
    if (card) get().moveToTrash('inspirationCard', card, card.bookId);
    set(s => ({
      inspirationCards: s.inspirationCards.filter(c => c.id !== cardId),
      dirty: true,
    }));
  },

  updateInspirationCard: (cardId, updates) => {
    set(s => ({
      inspirationCards: s.inspirationCards.map(c =>
        c.id === cardId ? { ...c, ...updates } : c),
      dirty: true,
    }));
  },

  moveInspirationToBook: (cardId, bookId) => {
    set(s => ({
      inspirationCards: s.inspirationCards.map(c =>
        c.id === cardId ? { ...c, bookId } : c),
      dirty: true,
    }));
  },

  // ============ 从章节提取到灵感卡片 ============
  extractToInspiration: (bookId, chapterId, selectedText) => {
    const card = {
      title: '章节摘录',
      content: selectedText,
      category: '章节笔记',
      bookId,
      source: 'extract',
      gachaQuestion: '',
    };
    return get().addInspirationCard(card);
  },
}));

export default useStore;

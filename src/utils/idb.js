// IndexedDB 封装 — 替代 localStorage，支持大容量存储
const DB_NAME = 'novel_app_db';
const DB_VERSION = 2;

let _dbCache = null;

function openDB() {
  if (_dbCache) return Promise.resolve(_dbCache);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('store')) {
        db.createObjectStore('store');
      }
    };
    req.onsuccess = (e) => {
      _dbCache = e.target.result;
      _dbCache.onclose = () => { _dbCache = null; };
      _dbCache.onversionchange = () => { _dbCache.close(); _dbCache = null; };
      resolve(_dbCache);
    };
    req.onerror = (e) => reject(e.target.error);
  });
}

export async function idbSet(key, value) {
  try {
    const db = await openDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('store', 'readwrite');
      tx.objectStore('store').put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e.target.error);
      tx.onabort = (e) => reject(e.target.error);
    });
  } catch (e) {
    // 降级到 localStorage
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
  }
}

export async function idbGet(key) {
  try {
    const db = await openDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('store', 'readonly');
      const req = tx.objectStore('store').get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = (e) => reject(e.target.error);
    });
  } catch (e) {
    // 降级到 localStorage
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
  }
}

export async function idbDelete(key) {
  try {
    const db = await openDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('store', 'readwrite');
      tx.objectStore('store').delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e.target.error);
    });
  } catch (e) {
    try { localStorage.removeItem(key); } catch (_) {}
  }
}

// 获取所有以某前缀开头的 key
export async function idbKeys(prefix) {
  try {
    const db = await openDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('store', 'readonly');
      const req = tx.objectStore('store').getAllKeys();
      const keys = [];
      req.onsuccess = () => {
        for (const k of req.result) {
          if (typeof k === 'string' && k.startsWith(prefix)) keys.push(k);
        }
        resolve(keys);
      };
      req.onerror = (e) => reject(e.target.error);
    });
  } catch (e) {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) keys.push(k);
    }
    return keys;
  }
}

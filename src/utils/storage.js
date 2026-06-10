import { cloudSave, cloudLoad } from './webdav';
import { idbSet, idbGet, idbDelete, idbKeys } from './idb';

// ========== 同步锁 ==========
let _syncing = false;
export function isSyncing() { return _syncing; }
function lockSync() { _syncing = true; }
function unlockSync() { _syncing = false; }

// ========== 核心存储（IndexedDB为主，localStorage降级） ==========

export async function saveData(key, data) {
  // 加时间戳
  const stamped = { ...data, _updatedAt: Date.now() };
  // 写入 IndexedDB
  try {
    await idbSet(`novel_${key}`, stamped);
  } catch (e) {
    console.error('IndexedDB 写入失败:', e.message);
  }
  // 异步推送到云端（不阻塞）
  if (!_syncing) {
    _syncing = true;
    try {
      await Promise.race([cloudSave(stamped), new Promise(r => setTimeout(() => r(false), 8000))]);
    } catch (e) {
      console.error('云端同步失败:', e.message);
    } finally {
      _syncing = false;
    }
  }
}

export async function loadData(key) {
  // 1. 读 IndexedDB
  let localData = null;
  try {
    localData = await idbGet(`novel_${key}`);
  } catch (e) {
    console.error('IndexedDB 读取失败:', e.message);
  }

  // 2. 读云端
  let cloudData = null;
  try {
    cloudData = await Promise.race([cloudLoad(), new Promise(r => setTimeout(() => r(null), 5000))]);
  } catch (e) {
    console.error('云端读取失败:', e.message);
  }

  // 3. 时间戳冲突解决
  const localTs = localData?._updatedAt || 0;
  const cloudTs = cloudData?._updatedAt || 0;
  const localBooks = (localData?.books || []).length;
  const cloudBooks = (cloudData?.books || []).length;

  // 无本地 → 用云端
  if (!localData || localBooks === 0) {
    if (cloudData && cloudBooks > 0) {
      try { await idbSet(`novel_${key}`, cloudData); } catch (_) {}
      return cloudData;
    }
    return localData || cloudData || null;
  }

  // 云端更新且内容不少于本地 → 云端覆盖本地（防数据量异常减少）
  const localItems = (localData?.inspirationCards || []).length + (localData?.aiConversations || []).length;
  const cloudItems = (cloudData?.inspirationCards || []).length + (cloudData?.aiConversations || []).length;
  if (cloudTs > localTs && cloudBooks > 0 && cloudItems >= localItems) {
    try { await idbSet(`novel_${key}`, cloudData); } catch (_) {}
    return cloudData;
  }

  // 本地更新 → 推送到云端
  if (localTs > cloudTs) {
    cloudSave(localData).catch(() => {});
  }

  return localData;
}

// ========== 历史版本（IndexedDB） ==========

function formatCompactDate(ts) {
  const d = new Date(ts);
  const M = String(d.getMonth() + 1).padStart(2, '0');
  const D = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${M}-${D} ${h}:${m}`;
}

export async function saveHistory(key, data, timestamp) {
  try {
    const historyKey = `novel_history_${key}`;
    const allKeys = (await idbGet(historyKey)) || [];
    allKeys.unshift(timestamp);
    const trimmed = allKeys.slice(0, 20);
    await idbSet(historyKey, trimmed);
    await idbSet(`novel_history_${key}_${timestamp}`, data);
  } catch (e) {
    console.error('历史保存失败:', e.message);
  }
}

export async function listHistory(key) {
  try {
    const historyKey = `novel_history_${key}`;
    const allKeys = (await idbGet(historyKey)) || [];
    return allKeys.map(ts => ({ timestamp: String(ts), label: formatCompactDate(ts) }));
  } catch (e) {
    return [];
  }
}

export async function loadHistoryVersion(key, timestamp) {
  try {
    return await idbGet(`novel_history_${key}_${timestamp}`);
  } catch (e) {
    return null;
  }
}

// ========== Splash 图片（localStorage，较大但已压缩） ==========
// 保持独立存储，不参与主数据同步
export function saveSplash(dataUrl) {
  try { localStorage.setItem('novel_splash', dataUrl); } catch (e) { console.error('splash保存失败:', e.message); }
}
export function loadSplash() {
  try { return localStorage.getItem('novel_splash'); } catch (_) { return null; }
}
export function removeSplash() {
  try { localStorage.removeItem('novel_splash'); } catch (_) {}
}

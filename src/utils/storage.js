import { cloudSave, cloudLoad } from './webdav';
import { idbSet, idbGet, idbDelete, idbKeys } from './idb';

// ========== 同步锁 & 防抖 ==========
let _syncing = false;
let _syncTimer = null;
const CLOUD_DEBOUNCE_MS = 15_000; // 15 秒内合并为一次云同步

export function isSyncing() { return _syncing; }
function lockSync() { _syncing = true; }
function unlockSync() { _syncing = false; }

function scheduleCloudSync(stamped) {
  clearTimeout(_syncTimer);
  _syncTimer = setTimeout(async () => {
    if (_syncing) return;
    _syncing = true;
    try {
      const icons = stamped.settings?.customIcons || {};
      const cloudPayload = {
        ...stamped,
        settings: { ...(stamped.settings || {}), customIcons: undefined },
        icons,
      };
      await Promise.race([cloudSave(cloudPayload), new Promise(r => setTimeout(() => r(false), 8000))]);
    } catch (e) {
      console.error('云端同步失败:', e.message);
    } finally {
      _syncing = false;
    }
  }, CLOUD_DEBOUNCE_MS);
}

// ========== 核心存储（IndexedDB为主，localStorage降级） ==========

export async function saveData(key, data) {
  // 加时间戳
  const stamped = { ...data, _updatedAt: Date.now() };
  // 写入 IndexedDB（立即写，本地速度快）
  try {
    await idbSet(`novel_${key}`, stamped);
  } catch (e) {
    console.error('IndexedDB 写入失败:', e.message);
  }
  // 本地历史版本（不等云同步）
  try {
    await saveHistory(key, stamped, stamped._updatedAt);
  } catch (e) {
    console.error('本地历史写入失败:', e.message);
  }
  // 云同步：防抖，避免高频请求风暴
  scheduleCloudSync(stamped);
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

  // 3. 时间戳冲突解决：谁新谁赢（删改后的数据不会被旧数据覆盖）
  const localTs = localData?._updatedAt || 0;
  const cloudTs = cloudData?._updatedAt || 0;

  if (!localData || localTs === 0) {
    if (cloudData && cloudTs > 0) {
      try { await idbSet(`novel_${key}`, cloudData); } catch (_) {}
      return cloudData;
    }
    return localData || cloudData || null;
  }

  if (cloudTs > localTs) {
    try { await idbSet(`novel_${key}`, cloudData); } catch (_) {}
    return { ...cloudData, _source: 'cloud' }; // 标记数据来源，用于提示用户
  }

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

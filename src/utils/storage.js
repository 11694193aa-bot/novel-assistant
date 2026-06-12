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
  _syncTimer = setTimeout(() => flushCloudSync(stamped), CLOUD_DEBOUNCE_MS);
}

// 立即云同步（persist 手动保存调用，不等防抖）
export async function flushCloudSync(stamped) {
  clearTimeout(_syncTimer);
  // [FIX] 防抖延迟触发时再次校验数据非空，防止过渡态空数据推送
  const hasData =
    stamped?.books?.length > 0 ||
    stamped?.readingBooks?.length > 0 ||
    stamped?.inspirationCards?.length > 0;
  if (!hasData) {
    console.warn('[flushCloudSync] 数据为空，取消本次云同步');
    return false;
  }
  if (_syncing) return false;
  _syncing = true;
  try {
    const icons = stamped.settings?.customIcons || {};
    const cloudPayload = {
      ...stamped,
      settings: { ...(stamped.settings || {}), customIcons: undefined },
      icons,
    };
    await Promise.race([cloudSave(cloudPayload), new Promise(r => setTimeout(() => r(false), 8000))]);
    return true;
  } catch (e) {
    console.error('云端同步失败:', e.message);
    return false;
  } finally {
    _syncing = false;
  }
}

// ========== 核心存储（IndexedDB为主，localStorage降级） ==========

// [SPLIT] 从 IndexedDB 还原 readingBooks 的 content 字段
async function restoreContents(data) {
  if (!data?.readingBooks?.length) return data;
  const restored = await Promise.all(
    data.readingBooks.map(async (b) => {
      if (b.content !== '__content_ref__') return b;
      try {
        const content = await idbGet(`novel_content_${b.id}`);
        return content ? { ...b, content } : b;
      } catch (_) { return b; }
    })
  );
  return { ...data, readingBooks: restored };
}

export async function saveData(key, data) {
  // [FIX] 写入前校验，空数据不写 IndexedDB 也不推云端
  const hasData =
    data?.books?.length > 0 ||
    data?.readingBooks?.length > 0 ||
    data?.inspirationCards?.length > 0;
  if (!hasData) {
    console.warn('[saveData] 数据为空，跳过本次写入');
    return;
  }

  // [SPLIT] 把 readingBooks 的 content 单独存 IndexedDB，主数据用占位符
  const contentMap = {};
  const readingBooksStripped = (data.readingBooks || []).map(b => {
    if (b.content && b.content.length > 100) {
      contentMap[b.id] = b.content;
      return { ...b, content: '__content_ref__' };
    }
    return b;
  });

  await Promise.all(
    Object.entries(contentMap).map(([bookId, content]) =>
      idbSet(`novel_content_${bookId}`, content).catch(e =>
        console.error('content写入失败', bookId, ':', e.message)
      )
    )
  );

  // 清理孤儿 content（不在当前 readingBooks 里的）
  const currentIds = new Set((data.readingBooks || []).map(b => b.id));
  try {
    const allContentKeys = await idbKeys('novel_content_');
    await Promise.all(
      allContentKeys
        .filter(k => !currentIds.has(k.replace('novel_content_', '')))
        .map(k => idbDelete(k).catch(() => {}))
    );
  } catch (_) {}

  // 主数据不含 content，体积大幅减小
  const strippedData = { ...data, readingBooks: readingBooksStripped };
  const stamped = { ...strippedData, _updatedAt: Date.now() };

  try {
    await idbSet(`novel_${key}`, stamped);
  } catch (e) {
    console.error('IndexedDB 写入失败:', e.message);
  }
  try {
    await saveHistory(key, stamped, stamped._updatedAt);
  } catch (e) {
    console.error('本地历史写入失败:', e.message);
  }
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

  // 3. 时间戳冲突解决：谁新谁赢
  const localTs = localData?._updatedAt || 0;
  const cloudTs = cloudData?._updatedAt || 0;

  if (!localData || localTs === 0) {
    if (cloudData && cloudTs > 0) {
      try { await idbSet(`novel_${key}`, cloudData); } catch (_) {}
      // [SPLIT] 还原 content
      return restoreContents(cloudData);
    }
    return localData ? restoreContents(localData) : (cloudData ? restoreContents(cloudData) : null);
  }

  if (cloudTs > localTs) {
    try { await idbSet(`novel_${key}`, cloudData); } catch (_) {}
    // [SPLIT] 还原 content
    return restoreContents({ ...cloudData, _source: 'cloud' });
  }

  // [FIX] 本地推送云端前做空数据保护，防止本地空数据覆盖云端
  if (localTs > cloudTs) {
    const localHasData =
      localData?.books?.length > 0 ||
      localData?.readingBooks?.length > 0 ||
      localData?.inspirationCards?.length > 0;
    if (localHasData) {
      cloudSave(localData).catch(() => {});
    } else {
      console.warn('[loadData] 本地数据为空，跳过推送云端，保留云端数据');
    }
  }

  // [SPLIT] 还原 content
  return restoreContents(localData);
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

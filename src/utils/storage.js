import { cloudSave, cloudLoad, cloudListHistory, cloudLoadHistory, getWebDAVConfig } from './webdav';

// 本地存储 + 云端同步双写
const API = window.electronAPI;

export async function saveData(key, data) {
  // 本地保存
  if (API) {
    await API.saveData(key, data);
  } else {
    localStorage.setItem(`novel_${key}`, JSON.stringify(data));
  }
  // 云端同步（后台静默，不阻塞）
  if (getWebDAVConfig()) {
    cloudSave(data).catch(() => {});
  }
}

export async function loadData(key) {
  // 优先从云端加载
  if (getWebDAVConfig()) {
    try {
      const cloud = await cloudLoad();
      if (cloud) {
        // 云端数据同步到本地
        if (API) {
          await API.saveData(key, cloud);
        } else {
          localStorage.setItem(`novel_${key}`, JSON.stringify(cloud));
        }
        return cloud;
      }
    } catch {}
  }
  // 降级到本地
  if (API) {
    const res = await API.loadData(key);
    return res.data;
  } else {
    const raw = localStorage.getItem(`novel_${key}`);
    return raw ? JSON.parse(raw) : null;
  }
}

export async function saveHistory(key, data, timestamp) {
  // 本地
  if (API) {
    await API.saveHistory(key, data, timestamp);
  } else {
    const allKeys = JSON.parse(localStorage.getItem(`novel_history_${key}`) || '[]');
    allKeys.unshift(timestamp);
    const trimmed = allKeys.slice(0, 20);
    localStorage.setItem(`novel_history_${key}`, JSON.stringify(trimmed));
    localStorage.setItem(`novel_history_${key}_${timestamp}`, JSON.stringify(data));
    if (trimmed.length < allKeys.length) {
      allKeys.slice(20).forEach(ts => {
        localStorage.removeItem(`novel_history_${key}_${ts}`);
      });
    }
  }
  // 云端历史在 cloudSave 里一并处理
}

export async function listHistory(key) {
  // 优先云端
  if (getWebDAVConfig()) {
    try {
      const cloud = await cloudListHistory();
      if (cloud.length > 0) return cloud;
    } catch {}
  }
  if (API) {
    const res = await API.listHistory(key);
    return res.versions || [];
  } else {
    const allKeys = JSON.parse(localStorage.getItem(`novel_history_${key}`) || '[]');
    return allKeys.map(ts => ({
      timestamp: String(ts),
      label: new Date(ts).toLocaleString('zh-CN'),
    }));
  }
}

export async function loadHistoryVersion(key, timestamp) {
  // 优先云端
  if (getWebDAVConfig()) {
    try {
      const cloud = await cloudLoadHistory(timestamp);
      if (cloud) return cloud;
    } catch {}
  }
  if (API) {
    const res = await API.loadHistory(key, timestamp);
    return res.data;
  } else {
    const raw = localStorage.getItem(`novel_history_${key}_${timestamp}`);
    return raw ? JSON.parse(raw) : null;
  }
}

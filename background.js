// 背景脚本：合并「批量获取CID」功能

chrome.runtime.onInstalled.addListener(() => {
  console.log('商务WLB扩展已安装');
});

// ===== 达人CID数据库（IndexedDB）=====

class CreatorDatabase {
  constructor() {
    this.dbName = 'TikTokShopCreators';
    this.version = 3;
    this.storeName = 'creators';
    this.db = null;
    this.init();
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        const oldVersion = event.oldVersion;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
          store.createIndex('cid', 'cid', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('url', 'url', { unique: false });
        } else {
          const store = event.target.transaction.objectStore(this.storeName);
          if (oldVersion < 2 && !store.indexNames.contains('url')) {
            store.createIndex('url', 'url', { unique: false });
          }
        }
      };
    });
  }

  async storeCreator(creatorData) {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([this.storeName], 'readwrite');
      const store = tx.objectStore(this.storeName);
      const data = { ...creatorData, timestamp: Date.now() };
      const req = store.put(data);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async getAllCreators() {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([this.storeName], 'readonly');
      const store = tx.objectStore(this.storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async clearAllData() {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([this.storeName], 'readwrite');
      const store = tx.objectStore(this.storeName);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }
}

const cidDb = new CreatorDatabase();

// tabId -> { query, resolve, timeoutId }
const pendingCidWaitByTab = new Map();
let isBatchSearchStopped = false;

// ===== 订单查询持久化状态 =====
let orderQueryState = {
  isRunning: false,
  shouldStop: false,
  currentIndex: 0,
  total: 0,
  processedCount: 0,
  failedCount: 0,
  currentOrderId: '',
  progress: 0,
  message: '',
  allOrders: [],
  failedOrders: []
};

// ===== 消息处理 =====

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    try {
      const res = await handleMessage(request, sender);
      sendResponse(res);
    } catch (err) {
      sendResponse({ success: false, error: err?.message || String(err) });
    }
  })();
  return true;
});

function normalize(s) {
  return String(s || '').trim().toLowerCase();
}

function scoreCandidate(query, candidateName) {
  const q = normalize(query);
  const n = normalize(candidateName);
  if (!q || !n) return 0;
  if (n === q) return 100;
  if (n.includes(q) || q.includes(n)) return 50;
  if (n.replace(/\s+/g, '').includes(q.replace(/\s+/g, ''))) return 30;
  return 0;
}

function resolvePendingCid(tabId, cid, sourceUrl = '') {
  const pending = pendingCidWaitByTab.get(tabId);
  if (!pending) return false;
  clearTimeout(pending.timeoutId);
  pendingCidWaitByTab.delete(tabId);
  pending.resolve({ cid: String(cid), sourceUrl: String(sourceUrl || '') });
  return true;
}

async function updateBatchSearchStatus(status) {
  await chrome.storage.local.set({ batchSearchStatus: status });
}

async function executeBatchSearch(tabId, creatorIds) {
  let successCount = 0;
  let failCount = 0;
  const results = [];

  await updateBatchSearchStatus({
    status: 'running',
    currentIndex: 0,
    total: creatorIds.length,
    successCount: 0,
    failCount: 0,
    currentCreatorId: '',
    results: []
  });

  for (let i = 0; i < creatorIds.length; i++) {
    if (isBatchSearchStopped) {
      break;
    }
    const creatorId = creatorIds[i];
    const currentIndex = i + 1;

    await updateBatchSearchStatus({
      status: 'running',
      currentIndex,
      total: creatorIds.length,
      successCount,
      failCount,
      currentCreatorId: creatorId,
      results
    });

    chrome.tabs.sendMessage(tabId, {
      action: 'showBatchProgress',
      status: 'running',
      currentIndex,
      total: creatorIds.length,
      successCount,
      failCount,
      currentCreatorId: creatorId
    }).catch(() => { });

    try {
      const response = await chrome.tabs.sendMessage(tabId, {
        action: 'searchCreator',
        creatorId
      });

      if (response.success) {
        successCount++;
        results.push({ id: creatorId, cid: response.cid, url: response.url, success: true });
        try {
          await cidDb.storeCreator({ id: creatorId, cid: response.cid, url: response.url, avatarBase64: response.avatarBase64 || '' });
        } catch (storeError) {
          console.error(`[批量搜索] ${creatorId} 数据存储失败:`, storeError);
        }
      } else {
        failCount++;
        results.push({ id: creatorId, error: response.error || '获取失败', success: false });
      }
    } catch (error) {
      failCount++;
      results.push({ id: creatorId, error: error?.message || String(error), success: false });
    }

    if (i < creatorIds.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  await updateBatchSearchStatus({
    status: 'completed',
    currentIndex: creatorIds.length,
    total: creatorIds.length,
    successCount,
    failCount,
    currentCreatorId: '',
    results
  });

  chrome.tabs.sendMessage(tabId, {
    action: 'showBatchProgress',
    status: 'completed',
    total: creatorIds.length,
    successCount,
    failCount
  }).catch(() => { });
}

async function handleMessage(request, sender) {
  switch (request.action) {
    case 'storeResult': {
      await cidDb.storeCreator(request.data);
      return { success: true };
    }
    case 'getStoredResults': {
      const results = await cidDb.getAllCreators();
      return { success: true, results };
    }
    case 'clearData': {
      await cidDb.clearAllData();
      return { success: true };
    }
    case 'exportExcel': {
      const creators = await cidDb.getAllCreators();
      if (!creators.length) return { success: false, error: '没有数据可以导出' };
      const xlsxBytes = await generateXlsx(creators);
      const filename = `tiktok_cid_${new Date().toISOString().split('T')[0]}.xlsx`;
      await downloadExcel(xlsxBytes, filename);
      return { success: true };
    }
    case 'openTab': {
      const url = String(request.url || '');
      if (!url.startsWith('https://affiliate.tiktokshopglobalselling.com/')) {
        return { success: false, error: '非法URL' };
      }
      const tab = await chrome.tabs.create({ url, active: true });
      return { success: true, tabId: tab.id };
    }
    case 'closeTab': {
      const tabId = Number(request.tabId);
      if (!tabId || tabId <= 0) return { success: false, error: '无效的tabId' };
      try {
        await chrome.tabs.remove(tabId);
        return { success: true };
      } catch (err) {
        return { success: false, error: err?.message || '关闭标签页失败' };
      }
    }
    case 'startBatchSearch': {
      isBatchSearchStopped = false;
      let tabId = request.tabId || sender?.tab?.id;
      if (!tabId) {
        try {
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tabs && tabs.length > 0) tabId = tabs[0].id;
        } catch (err) {
          console.error('[批量搜索] 查询tab失败:', err);
        }
      }
      if (!tabId) return { success: false, error: '无法获取当前tabId，请确保在TikTok Shop页面使用' };
      const creatorIds = Array.isArray(request.creatorIds) ? request.creatorIds : [];
      if (creatorIds.length === 0) return { success: false, error: '请输入至少一个达人ID' };
      executeBatchSearch(tabId, creatorIds).catch(err => {
        updateBatchSearchStatus({
          status: 'error',
          error: err?.message || String(err),
          currentIndex: creatorIds.length,
          total: creatorIds.length
        });
      });
      return { success: true, message: '批量搜索已启动' };
    }
    case 'getBatchSearchStatus': {
      const status = await chrome.storage.local.get('batchSearchStatus');
      return { success: true, status: status.batchSearchStatus || null };
    }
    case 'stopBatchSearch': {
      isBatchSearchStopped = true;
      return { success: true };
    }
    case 'clearBatchSearchStatus': {
      await chrome.storage.local.remove('batchSearchStatus');
      return { success: true };
    }
    case 'startWaitingForCid': {
      const tabId = sender?.tab?.id;
      if (!tabId) return { success: false, error: '无法获取当前tabId' };
      const query = String(request.query || '').trim();
      const timeoutMs = Number(request.timeoutMs || 15000);
      const old = pendingCidWaitByTab.get(tabId);
      if (old) {
        clearTimeout(old.timeoutId);
        pendingCidWaitByTab.delete(tabId);
      }
      const result = await new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          pendingCidWaitByTab.delete(tabId);
          reject(new Error('等待CID超时'));
        }, timeoutMs);
        pendingCidWaitByTab.set(tabId, { query, resolve, timeoutId });
      });
      return { success: true, cid: result.cid, sourceUrl: result.sourceUrl };
    }
    case 'hookCandidates': {
      const tabId = sender?.tab?.id;
      if (!tabId) return { success: false, error: '无法获取当前tabId' };
      const pending = pendingCidWaitByTab.get(tabId);
      if (!pending) return { success: true, ignored: true };
      const candidates = Array.isArray(request.candidates) ? request.candidates : [];
      if (!candidates.length) return { success: true, ignored: true };
      const sourceUrl = String(request.url || '');
      let bestCid = '';
      let bestScore = -1;
      for (const c of candidates) {
        const cid = c?.cid ? String(c.cid) : '';
        if (!cid) continue;
        const name = c?.name ? String(c.name) : '';
        const score = scoreCandidate(pending.query, name);
        if (score > bestScore) { bestScore = score; bestCid = cid; }
      }
      if (!bestCid) return { success: true, ignored: true };
      if (bestScore < 1 && candidates.length > 1) return { success: true, ignored: true };
      resolvePendingCid(tabId, bestCid, sourceUrl);
      return { success: true, resolved: true };
    }
    case 'installNetworkHook': {
      if (!sender?.tab?.id) return { success: false, error: '无法获取当前tabId' };
      await chrome.scripting.executeScript({
        target: { tabId: sender.tab.id, allFrames: true },
        world: 'MAIN',
        func: () => {
          if (window.__TT_CID_HOOK_INSTALLED__) return;
          window.__TT_CID_HOOK_INSTALLED__ = true;
          const SOURCE = 'tt-cid-hook';
          function safePost(payload) {
            try { window.postMessage({ source: SOURCE, ...payload }, '*'); } catch (_) { }
          }
          safePost({ type: 'installed', href: String(location.href || '') });
          function isCidValue(v) {
            if (typeof v === 'number') return v > 10_000_000_000;
            if (typeof v === 'string') return /^\d{10,}$/.test(v);
            return false;
          }
          function pickFirstString(obj, keys) {
            for (const k of keys) {
              const v = obj?.[k];
              if (typeof v === 'string' && v.trim()) return v.trim();
            }
            return '';
          }
          function extractCandidatesFromJson(json) {
            const out = [];
            const seen = new WeakSet();
            const nameKeys = ['unique_id', 'uniqueId', 'handle', 'username', 'creator_name', 'creatorName', 'name', 'nickname', 'display_name', 'displayName'];
            function walk(node) {
              if (!node || typeof node !== 'object') return;
              if (seen.has(node)) return;
              seen.add(node);
              for (const [k, v] of Object.entries(node)) {
                const keyLower = String(k).toLowerCase();
                if (keyLower.includes('cid') || keyLower === 'creator_id' || keyLower === 'creatorid') {
                  if (isCidValue(v)) {
                    out.push({ cid: String(v), name: pickFirstString(node, nameKeys) });
                  }
                }
                if (typeof v === 'string' && v.includes('creator/detail') && v.includes('cid=')) {
                  const m = v.match(/cid=(\d{10,})/);
                  if (m) out.push({ cid: String(m[1]), name: pickFirstString(node, nameKeys) });
                }
              }
              for (const v of Object.values(node)) {
                if (v && typeof v === 'object') walk(v);
              }
            }
            walk(json);
            const map = new Map();
            for (const c of out) { if (!map.has(c.cid)) map.set(c.cid, c); }
            return Array.from(map.values());
          }
          async function tryHandleJson(url, json) {
            const candidates = extractCandidatesFromJson(json);
            if (candidates.length) safePost({ type: 'candidates', url, candidates });
          }
          function tryHandleText(url, text) {
            if (!text || !text.includes('cid')) return;
            const out = [];
            const re = /"([^"]*cid|cid|creator_id|creatorId)"\s*:\s*"?(\d{10,})"?/gi;
            let m;
            while ((m = re.exec(text)) !== null) out.push({ cid: m[2], name: '' });
            const reUrl = /creator\/detail\?[^\s"']*cid=(\d{10,})/gi;
            while ((m = reUrl.exec(text)) !== null) out.push({ cid: m[1], name: '' });
            if (out.length) {
              const map = new Map();
              for (const c of out) if (!map.has(c.cid)) map.set(c.cid, c);
              safePost({ type: 'candidates', url, candidates: Array.from(map.values()) });
            }
          }
          const originalFetch = window.fetch;
          if (typeof originalFetch === 'function') {
            window.fetch = async function (...args) {
              const res = await originalFetch.apply(this, args);
              try {
                const clone = res.clone();
                const ct = (clone.headers.get('content-type') || '').toLowerCase();
                const url = clone.url || '';
                const text = await clone.text();
                tryHandleText(url, text);
                if (ct.includes('application/json')) {
                  try { await tryHandleJson(url, JSON.parse(text)); } catch (_) { }
                }
              } catch (_) { }
              return res;
            };
          }
          const origOpen = XMLHttpRequest.prototype.open;
          const origSend = XMLHttpRequest.prototype.send;
          XMLHttpRequest.prototype.open = function (method, url) {
            this.__tt_url = url;
            return origOpen.apply(this, arguments);
          };
          XMLHttpRequest.prototype.send = function () {
            this.addEventListener('load', function () {
              try {
                const url = this.__tt_url || '';
                const ct = (this.getResponseHeader('content-type') || '').toLowerCase();
                const text = this.responseText || '';
                tryHandleText(url, text);
                if (ct.includes('application/json')) {
                  try { tryHandleJson(url, JSON.parse(text)); } catch (_) { }
                }
              } catch (_) { }
            }, { once: true });
            return origSend.apply(this, arguments);
          };
        }
      });
    }
    // ===== 开始: 通过CID查达人 (移植自 CID_NAME) =====
    case 'startBatchQuery_cidToName': {
      if (batchQueryState_cidToName.isRunning) {
        return { success: false, error: '批量查询已在运行中' };
      }
      const cids = Array.isArray(request.cids) ? request.cids : [];
      if (cids.length === 0) return { success: false, error: '请输入有效的CID列表' };

      batchQueryState_cidToName = {
        isRunning: true, currentIndex: 0, total: cids.length, successCount: 0, failCount: 0, currentCid: '', results: []
      };
      chrome.storage.local.set({ batchQueryState_cidToName });

      executeBatchQuery_cidToName(cids, request.region).catch(err => {
        console.error('批量查询执行失败:', err);
        batchQueryState_cidToName.isRunning = false;
        batchQueryState_cidToName.error = err?.message || String(err);
        chrome.storage.local.set({ batchQueryState_cidToName });
      });
      return { success: true, message: '批量查询已启动' };
    }
    case 'getBatchQueryStatus_cidToName': {
      return { success: true, status: batchQueryState_cidToName };
    }
    case 'clearBatchQueryStatus_cidToName': {
      batchQueryState_cidToName = {
        isRunning: false, currentIndex: 0, total: 0, successCount: 0, failCount: 0, currentCid: '', results: []
      };
      await chrome.storage.local.set({ batchQueryState_cidToName });
      return { success: true };
    }
    // ===== 结束: 通过CID查达人 =====
    case 'startOrderQuery': {
      if (orderQueryState.isRunning) {
        return { success: false, error: '订单查询已在运行中' };
      }
      const orderIds = Array.isArray(request.orderIds) ? request.orderIds : [];
      const tabId = Number(request.tabId);
      if (orderIds.length === 0) return { success: false, error: '请输入有效的订单ID列表' };
      if (!tabId) return { success: false, error: '无法获取当前tabId' };

      orderQueryState = {
        isRunning: true,
        shouldStop: false,
        currentIndex: 0,
        total: orderIds.length,
        processedCount: 0,
        failedCount: 0,
        currentOrderId: '',
        progress: 0,
        message: '查询已启动',
        allOrders: [],
        failedOrders: []
      };
      await chrome.storage.local.set({ orderQueryState });

      executeOrderQuery(tabId, orderIds).catch(err => {
        console.error('订单查询执行失败:', err);
        orderQueryState.isRunning = false;
        orderQueryState.error = err?.message || String(err);
        chrome.storage.local.set({ orderQueryState });
      });
      return { success: true, message: '订单查询已启动' };
    }
    case 'getOrderQueryStatus': {
      const state = await chrome.storage.local.get('orderQueryState');
      return { success: true, state: state.orderQueryState || null };
    }
    case 'stopOrderQuery': {
      orderQueryState.shouldStop = true;
      await chrome.storage.local.set({ orderQueryState });
      return { success: true };
    }
    case 'clearOrderQueryState': {
      orderQueryState = {
        isRunning: false,
        shouldStop: false,
        currentIndex: 0,
        total: 0,
        processedCount: 0,
        failedCount: 0,
        currentOrderId: '',
        progress: 0,
        message: '',
        allOrders: [],
        failedOrders: []
      };
      await chrome.storage.local.remove('orderQueryState');
      return { success: true };
    }
    case 'exportOrderData': {
      const orders = await chrome.storage.local.get('orderQueryOrders');
      const allOrders = orders.orderQueryOrders || [];
      if (!allOrders.length) return { success: false, error: '没有数据可以导出' };
      const xlsxResult = await generateOrderXlsx(allOrders);
      if (!xlsxResult.success) return { success: false, error: xlsxResult.error };
      await downloadExcel(xlsxResult.data, xlsxResult.filename);
      return { success: true };
    }
    case 'clearOrderData': {
      await chrome.storage.local.remove(['orderQueryOrders', 'orderQueryState']);
      return { success: true };
    }
    default:
      return { success: false, error: '未知操作' };
  }
}

// ===== ZIP + XLSX 生成器（无外部依赖）=====

// CRC32
const _CRC32 = new Int32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
  _CRC32[i] = c;
}
function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ _CRC32[(crc ^ buf[i]) & 0xFF];
  return (crc ^ -1) >>> 0;
}

function u16(b, o, v) { b[o] = v & 0xFF; b[o + 1] = (v >> 8) & 0xFF; }
function u32(b, o, v) { b[o] = v & 0xFF; b[o + 1] = (v >> 8) & 0xFF; b[o + 2] = (v >> 16) & 0xFF; b[o + 3] = (v >> 24) & 0xFF; }

async function deflateRaw(data) {
  const cs = new CompressionStream('deflate-raw');
  const w = cs.writable.getWriter();
  w.write(data); w.close();
  const chunks = [];
  const r = cs.readable.getReader();
  while (true) { const { done, value } = await r.read(); if (done) break; chunks.push(value); }
  let sz = 0; for (const c of chunks) sz += c.length;
  const out = new Uint8Array(sz); let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.length; }
  return out;
}

async function buildZip(files) {
  const enc = new TextEncoder();
  const locals = []; const parts = []; let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name);
    const comp = await deflateRaw(f.data);
    const useComp = comp.length < f.data.length;
    const data = useComp ? comp : f.data;
    const method = useComp ? 8 : 0;
    const crc = crc32(f.data);
    const lh = new Uint8Array(30 + name.length);
    u32(lh, 0, 0x04034B50); u16(lh, 4, 20); u16(lh, 6, 0); u16(lh, 8, method);
    u16(lh, 10, 0); u16(lh, 12, 0); u32(lh, 14, crc);
    u32(lh, 18, data.length); u32(lh, 22, f.data.length);
    u16(lh, 26, name.length); u16(lh, 28, 0);
    lh.set(name, 30);
    locals.push({ name, crc, cs: data.length, us: f.data.length, method, offset });
    offset += lh.length + data.length;
    parts.push(lh, data);
  }
  const cdParts = []; let cdSz = 0; const cdOff = offset;
  for (const h of locals) {
    const cd = new Uint8Array(46 + h.name.length);
    u32(cd, 0, 0x02014B50); u16(cd, 4, 20); u16(cd, 6, 20); u16(cd, 8, 0); u16(cd, 10, h.method);
    u16(cd, 12, 0); u16(cd, 14, 0); u32(cd, 16, h.crc);
    u32(cd, 20, h.cs); u32(cd, 24, h.us);
    u16(cd, 28, h.name.length); u16(cd, 30, 0); u16(cd, 32, 0);
    u16(cd, 34, 0); u16(cd, 36, 0); u32(cd, 38, 0); u32(cd, 42, h.offset);
    cd.set(h.name, 46);
    cdParts.push(cd); cdSz += cd.length;
  }
  const eocd = new Uint8Array(22);
  u32(eocd, 0, 0x06054B50); u16(eocd, 4, 0); u16(eocd, 6, 0);
  u16(eocd, 8, locals.length); u16(eocd, 10, locals.length);
  u32(eocd, 12, cdSz); u32(eocd, 16, cdOff); u16(eocd, 20, 0);
  const all = [...parts, ...cdParts, eocd];
  let total = 0; for (const p of all) total += p.length;
  const result = new Uint8Array(total); let pos = 0;
  for (const p of all) { result.set(p, pos); pos += p.length; }
  return result;
}

function s2b(str) { return new TextEncoder().encode(str); }
function xmlEsc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function b64ToBytes(b64str) {
  const b64 = b64str.replace(/^data:[^;]+;base64,/, '');
  const bin = atob(b64); const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function generateXlsx(creators) {
  const ROW_HT_PT = 20; // 标准行高
  const COL_WIDTH_AVATAR = 0; // 移除头像列，不再导出图片
  const hasImg = false; // 始终设为false，不生成绘图部分

  // Shared strings
  const strs = ['达人 ID', 'CID', '获取时间'];
  const strMap = new Map(strs.map((s, i) => [s, i]));
  function si(s) {
    const str = String(s || '');
    if (!strMap.has(str)) { strMap.set(str, strs.length); strs.push(str); }
    return strMap.get(str);
  }

  // Sheet rows: header + data
  let sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetFormatPr defaultRowHeight="${ROW_HT_PT}"/>
<cols><col min="1" max="1" width="25" customWidth="1"/><col min="2" max="2" width="20" customWidth="1"/><col min="3" max="3" width="25" customWidth="1"/></cols>
<sheetData>`;

  // Header row
  sheetXml += `<row r="1"><c r="A1" t="s"><v>${si('达人 ID')}</v></c><c r="B1" t="s"><v>${si('CID')}</v></c><c r="C1" t="s"><v>${si('获取时间')}</v></c></row>`;

  creators.forEach((c, i) => {
    const r = i + 2;
    const ts = new Date(c.timestamp || Date.now()).toLocaleString('zh-CN');
    sheetXml += `<row r="${r}"><c r="A${r}" t="s"><v>${si(c.id || '')}</v></c><c r="B${r}" t="s"><v>${si(c.cid || '')}</v></c><c r="C${r}" t="s"><v>${si(ts)}</v></c></row>`;
  });
  sheetXml += `</sheetData></worksheet>`;

  const ssXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${strs.length}" uniqueCount="${strs.length}">${strs.map(s => `<si><t xml:space="preserve">${xmlEsc(s)}</t></si>`).join('')}</sst>`;
  const styXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts><font><sz val="11"/><name val="Calibri"/></font></fonts><fills><fill><patternFill patternType="none"/></fill></fills><borders><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs></styleSheet>`;
  const wbXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="达人CID" sheetId="1" r:id="rId1"/></sheets></workbook>`;
  const wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
  const ctXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`;

  const files = [
    { name: '[Content_Types].xml', data: s2b(ctXml) },
    { name: '_rels/.rels', data: s2b(rels) },
    { name: 'xl/workbook.xml', data: s2b(wbXml) },
    { name: 'xl/_rels/workbook.xml.rels', data: s2b(wbRels) },
    { name: 'xl/worksheets/sheet1.xml', data: s2b(sheetXml) },
    { name: 'xl/sharedStrings.xml', data: s2b(ssXml) },
    { name: 'xl/styles.xml', data: s2b(styXml) },
  ];

  if (hasImg) {
    // 图片导出已禁用 - 改由popup.js通过ExcelJS库处理
    // 如需为达人头像添加图片，请在popup.js中增加类似TikTok视频封面的ExcelJS实现
  }

  return await buildZip(files);
}

async function downloadExcel(data, customFilename = null) {
  let bin = '';
  for (let i = 0; i < data.length; i++) bin += String.fromCharCode(data[i]);
  const dataUrl = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${btoa(bin)}`;
  const filename = customFilename || `orders_${new Date().toISOString().split('T')[0]}.xlsx`;
  await chrome.downloads.download({ url: dataUrl, filename, saveAs: true });
}

// ==========================================================
// 通过CID查达人 后台功能区 (移植自 CID_NAME)
// ==========================================================
let batchQueryState_cidToName = {
  isRunning: false,
  currentIndex: 0,
  total: 0,
  successCount: 0,
  failCount: 0,
  currentCid: '',
  results: []
};

async function executeBatchQuery_cidToName(cids, region) {
  for (let i = 0; i < cids.length; i++) {
    if (!batchQueryState_cidToName.isRunning) break;
    const cid = String(cids[i] || '').trim();
    if (!cid) continue;

    batchQueryState_cidToName.currentIndex = i + 1;
    batchQueryState_cidToName.currentCid = cid;
    await chrome.storage.local.set({ batchQueryState_cidToName });

    try {
      const url = `https://affiliate.tiktokshopglobalselling.com/connection/creator/detail?cid=${encodeURIComponent(cid)}&enter_from=affiliate_crm&shop_region=${region}`;
      const tab = await chrome.tabs.create({ url, active: false });

      const result = await new Promise((resolve, reject) => {
        const timeout = 30000;
        const updateListener = (tabId, changeInfo, updatedTab) => {
          if (tabId === tab.id && changeInfo.status === 'complete') {
            setTimeout(async () => {
              try {
                const response = await chrome.tabs.sendMessage(tabId, { action: 'extractUsername', cid: cid });
                if (response && response.username) resolve({ success: true, username: response.username, avatarUrl: response.avatarUrl });
                else resolve({ success: false, username: null });
              } catch (e) {
                resolve({ success: false, username: null });
              }
            }, 2000);
            chrome.tabs.onUpdated.removeListener(updateListener);
          }
        };
        chrome.tabs.onUpdated.addListener(updateListener);
        setTimeout(() => { chrome.tabs.onUpdated.removeListener(updateListener); resolve({ success: false, username: null }); }, timeout);
      });

      if (result.success) {
        batchQueryState_cidToName.successCount++;
        batchQueryState_cidToName.results.push({ cid, region, username: result.username, avatarUrl: result.avatarUrl || '' });
      } else {
        batchQueryState_cidToName.failCount++;
        batchQueryState_cidToName.results.push({ cid, region, username: '查询失败' });
      }

      await chrome.tabs.remove(tab.id).catch(() => { });
      await chrome.storage.local.set({ batchQueryState_cidToName });

      await new Promise(r => setTimeout(r, 2000));
    } catch (err) {
      batchQueryState_cidToName.failCount++;
      batchQueryState_cidToName.results.push({ cid, region, username: '查询失败', error: err?.message || String(err) });
      await chrome.storage.local.set({ batchQueryState_cidToName });
    }
  }

  batchQueryState_cidToName.isRunning = false;
  batchQueryState_cidToName.currentCid = '';
  await chrome.storage.local.set({ batchQueryState_cidToName });
}

// ==========================================================
// 订单查询持久化功能 (在后台持续运行)
// ==========================================================
async function executeOrderQuery(tabId, orderIds) {
  for (let i = 0; i < orderIds.length; i++) {
    if (orderQueryState.shouldStop) {
      console.log('[订单查询] 用户停止了查询');
      break;
    }

    const orderId = String(orderIds[i] || '').trim();
    if (!orderId) continue;

    orderQueryState.currentIndex = i + 1;
    orderQueryState.currentOrderId = orderId;
    orderQueryState.progress = Math.round(((i + 1) / orderIds.length) * 100);
    orderQueryState.message = `正在查询: ${orderId}`;
    await chrome.storage.local.set({ orderQueryState });

    try {
      const response = await chrome.tabs.sendMessage(tabId, {
        action: 'startOrderAutomation',
        orderId: orderId
      });

      if (response.success && response.data && response.data.length > 0) {
        orderQueryState.processedCount++;
        orderQueryState.allOrders.push(...response.data);
        console.log(`[订单查询] 订单 ${orderId} 处理成功，获取 ${response.data.length} 条数据`);
      } else {
        orderQueryState.failedCount++;
        orderQueryState.failedOrders.push(`${orderId}: ${response.error || '未找到相关数据'}`);
        console.warn(`[订单查询] 订单 ${orderId} 查询失败:`, response.error);
      }
    } catch (error) {
      orderQueryState.failedCount++;
      orderQueryState.failedOrders.push(`${orderId}: ${error.message}`);
      console.error(`[订单查询] 订单 ${orderId} 处理出错:`, error);
    }

    await chrome.storage.local.set({ orderQueryState });

    if (i < orderIds.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  orderQueryState.isRunning = false;
  orderQueryState.currentOrderId = '';
  orderQueryState.message = orderQueryState.shouldStop ? '查询已停止' : '查询完成';
  await chrome.storage.local.set({ orderQueryState });

  if (orderQueryState.allOrders.length > 0) {
    await chrome.storage.local.set({ orderQueryOrders: orderQueryState.allOrders });
  }
}

async function generateOrderXlsx(orders) {
  const headers = ['达人ID', '产品ID', '订单ID', '状态', '时间'];

  // 构建Excel XML格式
  let excelContent = '<?xml version="1.0"?>\n';
  excelContent += '<?mso-application progid="Excel.Sheet"?>\n';
  excelContent += '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"\n';
  excelContent += ' xmlns:o="urn:schemas-microsoft-com:office:office"\n';
  excelContent += ' xmlns:x="urn:schemas-microsoft-com:office:excel"\n';
  excelContent += ' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">\n';
  excelContent += ' <Styles>\n';
  excelContent += '  <Style ss:ID="Default" ss:Name="Normal">\n';
  excelContent += '   <Alignment ss:Vertical="Center"/>\n';
  excelContent += '   <Font ss:FontName="宋体" x:CharSet="134" ss:Size="11"/>\n';
  excelContent += '  </Style>\n';
  excelContent += '  <Style ss:ID="s16">\n';
  excelContent += '   <Font ss:FontName="宋体" x:CharSet="134" ss:Size="11" ss:Bold="1"/>\n';
  excelContent += '  </Style>\n';
  excelContent += ' </Styles>\n';
  excelContent += ' <Worksheet ss:Name="订单数据">\n';
  excelContent += '  <Table ss:ExpandedColumnCount="5" ss:ExpandedRowCount="' + (orders.length + 1) + '" x:FullColumns="1" x:FullRows="1">\n';
  excelContent += '   <Column ss:Width="100"/>\n';
  excelContent += '   <Column ss:Width="100"/>\n';
  excelContent += '   <Column ss:Width="120"/>\n';
  excelContent += '   <Column ss:Width="80"/>\n';
  excelContent += '   <Column ss:Width="140"/>\n';

  // 表头
  excelContent += '   <Row ss:StyleID="s16">\n';
  headers.forEach(header => {
    excelContent += '    <Cell><Data ss:Type="String">' + header + '</Data></Cell>\n';
  });
  excelContent += '   </Row>\n';

  // 数据行
  for (let i = 0; i < orders.length; i++) {
    const order = orders[i];
    excelContent += '   <Row>\n';
    excelContent += '    <Cell><Data ss:Type="String">' + ((order.creatorId || '').replace(/^@/, '') || '') + '</Data></Cell>\n';
    excelContent += '    <Cell><Data ss:Type="String">' + (order.productId || '') + '</Data></Cell>\n';
    excelContent += '    <Cell><Data ss:Type="String">' + (order.orderId || '') + '</Data></Cell>\n';
    excelContent += '    <Cell><Data ss:Type="String">' + (order.status || '') + '</Data></Cell>\n';
    excelContent += '    <Cell><Data ss:Type="String">' + (order.timestamp || '') + '</Data></Cell>\n';
    excelContent += '   </Row>\n';
  }

  excelContent += '  </Table>\n';
  excelContent += ' </Worksheet>\n';
  excelContent += '</Workbook>';

  // 使用 UTF-8 BOM 编码
  const encoder = new TextEncoder();
  const data = encoder.encode(excelContent);

  const filename = `orders_${new Date().toISOString().split('T')[0]}.xlsx`;

  // 返回 Excel 数据
  return {
    success: true,
    data: data,
    filename: filename,
    method: 'data'
  };
}

// 背景脚本：合并「批量获取CID」功能
import { handleCidToNameMessage } from './cid_to_name/cid_to_name_background.js';
import { handleOrderMessage } from './order/order_background.js';
import { handleUsernameAvatarCidMessage } from './username_avatarcid/username_avatarcid_background.js';
import { handleCoverMessage } from './cover/cover_background.js';

chrome.runtime.onInstalled.addListener(() => {
  console.log('商务WLB扩展已安装');
});

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

async function handleMessage(request, sender) {
  const usernameAvatarCidResult = await handleUsernameAvatarCidMessage(request, sender, downloadExcel);
  if (usernameAvatarCidResult) {
    return usernameAvatarCidResult;
  }
  switch (request.action) {
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
      return { success: true };
    }
    default: {
      const coverResult = await handleCoverMessage(request);
      if (coverResult) {
        return coverResult;
      }
      const cidToNameResult = await handleCidToNameMessage(request);
      if (cidToNameResult) {
        return cidToNameResult;
      }
      const orderResult = await handleOrderMessage(request, downloadExcel);
      if (orderResult) {
        return orderResult;
      }
      return { success: false, error: '未知操作' };
    }
  }
}

async function downloadExcel(data, customFilename = null) {
  let bin = '';
  for (let i = 0; i < data.length; i++) bin += String.fromCharCode(data[i]);
  const dataUrl = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${btoa(bin)}`;
  const filename = customFilename || `orders_${new Date().toISOString().split('T')[0]}.xlsx`;
  await chrome.downloads.download({ url: dataUrl, filename, saveAs: true });
}

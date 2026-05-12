// 背景脚本：合并「批量获取CID」功能
import { handleCidToNameMessage } from './quick_module/cid_to_name/cid_to_name_background.js';
import { handleOrderMessage } from './quick_module/order/order_background.js';
import { handleUsernameAvatarCidMessage } from './quick_module/username_avatarcid/username_avatarcid_background.js';
import { handleCoverMessage } from './quick_module/cover/cover_background.js';
import { handleBitableCoverMessage } from './quick_module/bitable_cover/bitable_cover_background.js';
import { handleSampleCrawlMessage } from './quick_module/sample_crawl/sample_crawl_background.js';

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
  console.log('[Bg] 收到消息:', JSON.stringify({ action: request.action, keys: Object.keys(request) }));
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
    case 'fetchFeishuSheetData': {
      return await handleFetchFeishuSheetData(request.config);
    }
    case 'updateFeishuSheetRow': {
      return await handleUpdateFeishuSheetRow(request.config, request.row, request.values);
    }
    case 'appendFeishuSheetRow': {
      return await handleAppendFeishuSheetRow(request.config, request.values);
    }
    case 'findFeishuRowByCreatorId': {
      return await handleFindFeishuRowByCreatorId(request.config, request.creatorId);
    }
    case 'getFeishuSheetHeaders': {
      return await handleGetFeishuSheetHeaders(request.config);
    }
    case 'bulkWriteFeishuSheet': {
      return await handleBulkWriteFeishuSheet(request.config, request.startRow, request.values2D);
    }
    case 'listBitableRecords': {
      return await handleListBitableRecords(request.config);
    }
    case 'fetchAndUploadBitableCover': {
      return await handleFetchAndUploadBitableCover(request.config, request.recordId, request.videoUrl);
    }
    case 'resolveWikiToken': {
      return await handleResolveWikiToken(request.config, request.wikiToken);
    }
    default: {
      console.log('[Bg] default: 未匹配到处理函数, action=', request.action);
      const coverResult = await handleCoverMessage(request);
      if (coverResult) {
        return coverResult;
      }
      const bitableCoverResult = await handleBitableCoverMessage(request, handleListBitableRecords, handleFetchAndUploadBitableCover);
      if (bitableCoverResult) {
        return bitableCoverResult;
      }
      const cidToNameResult = await handleCidToNameMessage(request);
      if (cidToNameResult) {
        return cidToNameResult;
      }
      const orderResult = await handleOrderMessage(request, downloadExcel);
      if (orderResult) {
        return orderResult;
      }
      const sampleCrawlResult = await handleSampleCrawlMessage(request, sender, appendBitableRecords);
      if (sampleCrawlResult) {
        return sampleCrawlResult;
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

async function getFeishuAccessToken(config) {
  const tokenResponse = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      app_id: config.appId,
      app_secret: config.appSecret
    })
  });

  if (!tokenResponse.ok) {
    const errText = await tokenResponse.text();
    throw new Error(`获取飞书 token 失败 (${tokenResponse.status}): ${errText}`);
  }

  const tokenData = await tokenResponse.json();
  if (tokenData.code !== 0) {
    throw new Error(`飞书 token 返回错误: ${tokenData.msg || JSON.stringify(tokenData)}`);
  }

  return tokenData.tenant_access_token;
}

function buildFeishuRowRange(baseRange, row) {
  const withSheet = baseRange.match(/^([^!]+)!([A-Z]+):([A-Z]+)$/);
  if (withSheet) {
    return `${withSheet[1]}!${withSheet[2]}${row}:${withSheet[3]}${row}`;
  }
  const noSheet = baseRange.match(/^([A-Z]+):([A-Z]+)$/);
  if (noSheet) {
    return `${noSheet[1]}${row}:${noSheet[2]}${row}`;
  }
  return baseRange;
}

async function handleFetchFeishuSheetData(config) {
  try {
    const accessToken = await getFeishuAccessToken(config);
    const range = config.range || 'A:E';
    const url = `https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${config.spreadsheetToken}/values/${encodeURIComponent(range)}`;

    const sheetResponse = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!sheetResponse.ok) {
      const errText = await sheetResponse.text();
      throw new Error(`读取飞书表格失败 (${sheetResponse.status}): ${errText}`);
    }

    const sheetData = await sheetResponse.json();
    if (sheetData.code !== 0) {
      throw new Error(`飞书表格返回错误: ${sheetData.msg || JSON.stringify(sheetData)}`);
    }

    const values = sheetData.data?.valueRange?.values;
    if (!Array.isArray(values) || values.length === 0) {
      return { success: true, data: [] };
    }

    return { success: true, data: values };
  } catch (err) {
    console.error('[Feishu] 获取数据失败:', err);
    return { success: false, error: err.message };
  }
}

async function handleUpdateFeishuSheetRow(config, row, values) {
  try {
    const accessToken = await getFeishuAccessToken(config);
    const range = buildFeishuRowRange(config.range || 'A:E', row);
    const url = `https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${config.spreadsheetToken}/values`;

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        valueRange: {
          range: range,
          values: [values]
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`更新飞书表格失败 (${response.status}): ${errText}`);
    }

    const data = await response.json();
    if (data.code !== 0) {
      throw new Error(`飞书表格返回错误: ${data.msg || JSON.stringify(data)}`);
    }

    return { success: true };
  } catch (err) {
    console.error('[Feishu] 更新行失败:', err);
    return { success: false, error: err.message };
  }
}

async function handleAppendFeishuSheetRow(config, values) {
  try {
    const accessToken = await getFeishuAccessToken(config);
    const range = config.range || 'A:E';
    const url = `https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${config.spreadsheetToken}/values_prepend`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        valueRange: {
          range: range,
          values: [values]
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`追加飞书表格行失败 (${response.status}): ${errText}`);
    }

    const data = await response.json();
    if (data.code !== 0) {
      throw new Error(`飞书表格返回错误: ${data.msg || JSON.stringify(data)}`);
    }

    return { success: true };
  } catch (err) {
    console.error('[Feishu] 追加行失败:', err);
    return { success: false, error: err.message };
  }
}

async function handleFindFeishuRowByCreatorId(config, creatorId) {
  try {
    const accessToken = await getFeishuAccessToken(config);
    const baseRange = config.range || 'A:E';
    const match = baseRange.match(/^([^!]+)!/);
    const colRange = match ? `${match[1]}!A:A` : 'A:A';
    const url = `https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${config.spreadsheetToken}/values/${encodeURIComponent(colRange)}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`读取飞书表格失败 (${response.status}): ${errText}`);
    }

    const data = await response.json();
    if (data.code !== 0) {
      throw new Error(`飞书表格返回错误: ${data.msg || JSON.stringify(data)}`);
    }

    const values = data.data?.valueRange?.values || [];
    for (let i = 0; i < values.length; i++) {
      if (values[i][0]?.toString().trim() === creatorId) {
        return { success: true, row: i + 1 };
      }
    }

    return { success: true, row: -1 };
  } catch (err) {
    console.error('[Feishu] 查找行失败:', err);
    return { success: false, error: err.message };
  }
}

async function handleGetFeishuSheetHeaders(config) {
  try {
    const accessToken = await getFeishuAccessToken(config);
    const range = config.range || 'A:E';
    const match = range.match(/^([^!]+)!/);
    const firstRowRange = match ? `${match[1]}!A1:Z1` : 'A1:Z1';
    const url = `https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${config.spreadsheetToken}/values/${encodeURIComponent(firstRowRange)}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`读取飞书表头失败 (${response.status}): ${errText}`);
    }

    const data = await response.json();
    if (data.code !== 0) {
      throw new Error(`飞书表格返回错误: ${data.msg || JSON.stringify(data)}`);
    }

    const headers = data.data?.valueRange?.values?.[0] || [];
    return { success: true, headers };
  } catch (err) {
    console.error('[Feishu] 获取表头失败:', err);
    return { success: false, error: err.message };
  }
}

async function handleBulkWriteFeishuSheet(config, startRow, values2D) {
  try {
    const accessToken = await getFeishuAccessToken(config);
    const range = config.range || 'A:E';
    const withSheet = range.match(/^([^!]+)!/);
    const sheetName = withSheet ? withSheet[1] : '';
    const colMatch = range.match(/[A-Z]+:[A-Z]+/);
    const colEnd = colMatch ? colMatch[0].split(':')[1] : 'E';
    const colStart = colMatch ? colMatch[0].split(':')[0] : 'A';
    const rowCount = values2D.length;
    const endRow = startRow + rowCount - 1;
    const writeRange = sheetName ? `${sheetName}!${colStart}${startRow}:${colEnd}${endRow}` : `${colStart}${startRow}:${colEnd}${endRow}`;

    const url = `https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${config.spreadsheetToken}/values`;

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        valueRange: {
          range: writeRange,
          values: values2D
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`批量写入飞书表格失败 (${response.status}): ${errText}`);
    }

    const data = await response.json();
    if (data.code !== 0) {
      throw new Error(`飞书表格返回错误: ${data.msg || JSON.stringify(data)}`);
    }

    return { success: true, rowCount };
  } catch (err) {
    console.error('[Feishu] 批量写入失败:', err);
    return { success: false, error: err.message };
  }
}

async function handleListBitableRecords(config) {
  try {
    const accessToken = await getFeishuAccessToken(config);
    const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${config.baseToken}/tables/${config.tableId}/records?page_size=500`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`读取多维表格失败 (${response.status}): ${errText}`);
    }

    const data = await response.json();
    if (data.code !== 0) {
      throw new Error(`多维表格返回错误: ${data.msg || JSON.stringify(data)}`);
    }

    const items = data.data?.items || [];
    const records = items.map(item => ({
      recordId: item.record_id,
      fields: item.fields || {}
    }));

    return { success: true, records };
  } catch (err) {
    console.error('[Bitable] 读取记录失败:', err);
    return { success: false, error: err.message };
  }
}

async function handleFetchAndUploadBitableCover(config, recordId, videoUrl) {
  try {
    const accessToken = await getFeishuAccessToken(config);

    const apiUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(videoUrl)}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    const coverResp = await fetch(apiUrl, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!coverResp.ok) throw new Error(`TikTok 返回 HTTP ${coverResp.status}`);

    const contentType = coverResp.headers.get('content-type') || '';
    const respText = await coverResp.text();

    if (contentType.includes('text/html') || respText.trim().startsWith('<!DOCTYPE') || respText.trim().startsWith('<html')) {
      throw new Error('TikTok 返回了 HTML 页面，可能受地区限制');
    }

    const coverData = JSON.parse(respText);
    const thumbnailUrl = coverData.thumbnail_url;
    if (!thumbnailUrl) throw new Error('未获取到封面 URL');

    const imgResp = await fetch(thumbnailUrl);
    if (!imgResp.ok) throw new Error(`下载封面失败 HTTP ${imgResp.status}`);
    const imgBlob = await imgResp.blob();

    const fileName = `cover_${recordId}_${Date.now()}.jpeg`;
    const formData = new FormData();
    formData.append('file_name', fileName);
    formData.append('parent_type', 'bitable_file');
    formData.append('parent_node', config.baseToken);
    formData.append('size', imgBlob.size.toString());
    formData.append('file', imgBlob, fileName);

    const uploadResp = await fetch('https://open.feishu.cn/open-apis/drive/v1/medias/upload_all', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}` },
      body: formData
    });

    if (!uploadResp.ok) {
      const errText = await uploadResp.text();
      throw new Error(`上传图片到飞书失败 (${uploadResp.status}): ${errText}`);
    }

    const uploadData = await uploadResp.json();
    if (uploadData.code !== 0) {
      throw new Error(`飞书上传返回错误: ${uploadData.msg || JSON.stringify(uploadData)}`);
    }

    const fileToken = uploadData.data?.file_token;
    if (!fileToken) throw new Error('未获取到 file_token');

    const updateResp = await fetch(
      `https://open.feishu.cn/open-apis/bitable/v1/apps/${config.baseToken}/tables/${config.tableId}/records/${recordId}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fields: {
            [config.coverField]: [{ file_token: fileToken }]
          }
        })
      }
    );

    if (!updateResp.ok) {
      const errText = await updateResp.text();
      throw new Error(`更新记录失败 (${updateResp.status}): ${errText}`);
    }

    const updateData = await updateResp.json();
    if (updateData.code !== 0) {
      throw new Error(`更新记录返回错误: ${updateData.msg || JSON.stringify(updateData)}`);
    }

    return { success: true, thumbnailUrl, title: coverData.title || '' };
  } catch (err) {
    console.error('[Bitable] 获取并上传封面失败:', err);
    return { success: false, error: err.message, videoUrl };
  }
}

async function handleResolveWikiToken(config, wikiToken) {
  try {
    const accessToken = await getFeishuAccessToken(config);
    const url = `https://open.feishu.cn/open-apis/wiki/v2/spaces/get_node?token=${encodeURIComponent(wikiToken)}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`飞书 Wiki API 失败 (${response.status}): ${errText}`);
    }

    const data = await response.json();
    if (data.code !== 0) {
      throw new Error(`飞书 Wiki API 返回错误: ${data.msg || JSON.stringify(data)}`);
    }

    const node = data.data?.node;
    if (!node) {
      throw new Error('API 返回中未找到 node 信息');
    }

    return {
      success: true,
      baseToken: node.obj_token || '',
      objType: node.obj_type || '',
      title: node.title || ''
    };
  } catch (err) {
    console.error('[Bitable] 解析 wiki token 失败:', err);
    return { success: false, error: err.message };
  }
}

async function handleAppendBitableRecords(config, recordsData) {
  try {
    const accessToken = await getFeishuAccessToken(config);
    const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${config.baseToken}/tables/${config.tableId}/records/batch_create`;

    const chunkSize = 500;
    let allSuccess = true;
    for (let i = 0; i < recordsData.length; i += chunkSize) {
      const chunk = recordsData.slice(i, i + chunkSize);
      const body = {
        records: chunk.map(r => ({
          fields: {
            [config.creatorNameField]: r.creator_name,
            [config.creatorIdField]: r.creator_id,
            [config.productIdField]: r.apply_product_id
          }
        }))
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`批量写入多维表格失败 (${response.status}): ${errText}`);
      }

      const data = await response.json();
      if (data.code !== 0) {
        throw new Error(`多维表格返回错误: ${data.msg || JSON.stringify(data)}`);
      }
    }

    return { success: true, total: recordsData.length };
  } catch (err) {
    console.error('[Feishu] 追加记录失败:', err);
    return { success: false, error: err.message };
  }
}

chrome.commands.onCommand.addListener((command) => {
  if (command === 'triggerPhraseSelector') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs.length > 0) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'triggerPhraseSelector' }).catch(() => {});
      }
    });
  } else if (command === 'triggerTranslateQuickInput') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs.length > 0) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'showTranslate' }).catch(() => {});
      }
    });
  }
});

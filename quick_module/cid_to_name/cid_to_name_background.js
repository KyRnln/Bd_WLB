// 通过CID查达人 - 后台模块

let batchQueryState_cidToName = {
  isRunning: false,
  currentIndex: 0,
  total: 0,
  successCount: 0,
  failCount: 0,
  currentCid: '',
  results: []
};

// 初始化：从 storage 恢复状态
async function initBatchQueryState_cidToName() {
  const stored = await chrome.storage.local.get('batchQueryState_cidToName');
  if (stored.batchQueryState_cidToName) {
    batchQueryState_cidToName = { ...batchQueryState_cidToName, ...stored.batchQueryState_cidToName };
  }
}
initBatchQueryState_cidToName();

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

async function handleCidToNameMessage(request) {
  switch (request.action) {
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
      const stored = await chrome.storage.local.get('batchQueryState_cidToName');
      const status = stored.batchQueryState_cidToName || batchQueryState_cidToName;
      return { success: true, status };
    }
    case 'clearBatchQueryStatus_cidToName': {
      batchQueryState_cidToName = {
        isRunning: false, currentIndex: 0, total: 0, successCount: 0, failCount: 0, currentCid: '', results: []
      };
      chrome.storage.local.set({ batchQueryState_cidToName });
      return Promise.resolve({ success: true });
    }
    case 'stopBatchQuery_cidToName': {
      batchQueryState_cidToName.isRunning = false;
      await chrome.storage.local.set({ batchQueryState_cidToName });
      return { success: true };
    }
  }
  return null;
}

export { handleCidToNameMessage };

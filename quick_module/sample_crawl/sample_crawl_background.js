let sampleCrawlState = {
  isRunning: false,
  shouldStop: false,
  currentPage: 0,
  totalPages: 0,
  collectedCount: 0,
  totalCount: 0,
  percent: 0,
  message: '',
  tabId: null
};

let crawlResultData = null;
let feishuConfig = null;

async function initSampleCrawlState() {
  const stored = await chrome.storage.local.get('sampleCrawlState');
  if (stored.sampleCrawlState) {
    sampleCrawlState = { ...sampleCrawlState, ...stored.sampleCrawlState };
  }
}
initSampleCrawlState();

async function saveSampleCrawlState() {
  await chrome.storage.local.set({ sampleCrawlState });
}

function resetState(tabId) {
  sampleCrawlState = {
    isRunning: false,
    shouldStop: false,
    currentPage: 0,
    totalPages: 0,
    collectedCount: 0,
    totalCount: 0,
    percent: 0,
    message: '',
    tabId: tabId || null
  };
  crawlResultData = null;
  saveSampleCrawlState();
}

async function checkContentScript(tabId) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, { action: 'ping' });
    return response && response.success;
  } catch (e) {
    return false;
  }
}

async function injectContentScript(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['quick_module/sample_crawl/sample_crawl_content.js']
    });
    await new Promise(r => setTimeout(r, 800));
    return await checkContentScript(tabId);
  } catch (e) {
    console.error('[SampleCrawl] 注入content script失败:', e);
    return false;
  }
}

async function reloadTab(tabId) {
  try {
    await chrome.tabs.reload(tabId);
    await new Promise(r => setTimeout(r, 3000));
  } catch (e) {
    console.error('[SampleCrawl] 刷新页面失败:', e);
  }
}

async function executeSampleCrawl(tabId) {
  try {
    await reloadTab(tabId);

    let csReady = false;
    for (let attempt = 0; attempt < 15; attempt++) {
      csReady = await checkContentScript(tabId);
      if (csReady) break;
      await new Promise(r => setTimeout(r, 1000));
    }

    if (!csReady) {
      csReady = await injectContentScript(tabId);
    }
    if (!csReady) {
      sampleCrawlState.isRunning = false;
      sampleCrawlState.message = '无法注入采集脚本';
      await saveSampleCrawlState();
      return;
    }

    await new Promise(r => setTimeout(r, 2000));

    const startResponse = await chrome.tabs.sendMessage(tabId, { action: 'startSampleCrawl' });
    if (!startResponse || !startResponse.success) {
      sampleCrawlState.isRunning = false;
      sampleCrawlState.message = startResponse?.error || '启动采集失败';
      await saveSampleCrawlState();
      return;
    }

    sampleCrawlState.isRunning = true;
    sampleCrawlState.message = '采集中...';
    await saveSampleCrawlState();
    await chrome.storage.local.set({ sampleCrawlResult: null });

  } catch (e) {
    sampleCrawlState.isRunning = false;
    sampleCrawlState.message = '执行失败: ' + e.message;
    await saveSampleCrawlState();
  }
}

async function handleSampleCrawlMessage(request, sender, appendBitableRecords) {
  switch (request.action) {
    case 'startSampleCrawl': {
      if (sampleCrawlState.isRunning) {
        return { success: false, error: '已有采集任务在运行中' };
      }

      let tabId = request.tabId;
      if (!tabId && sender?.tab?.id) {
        tabId = sender.tab.id;
      }
      if (!tabId) {
        return { success: false, error: '无法获取当前标签页' };
      }

      if (!request.feishuConfig || !request.feishuConfig.baseToken) {
        return { success: false, error: '请先配置飞书多维表格信息' };
      }

      feishuConfig = request.feishuConfig;
      resetState(tabId);
      sampleCrawlState.isRunning = true;
      sampleCrawlState.message = '正在刷新页面...';
      await saveSampleCrawlState();

      executeSampleCrawl(tabId).catch(e => {
        console.error('[SampleCrawl] 执行失败:', e);
        sampleCrawlState.isRunning = false;
        sampleCrawlState.message = '执行失败: ' + e.message;
        saveSampleCrawlState();
      });

      return { success: true, message: '采集已启动' };
    }

    case 'stopSampleCrawl': {
      sampleCrawlState.shouldStop = true;
      sampleCrawlState.isRunning = false;
      sampleCrawlState.message = '已停止';
      await saveSampleCrawlState();

      if (sampleCrawlState.tabId) {
        try {
          await chrome.tabs.sendMessage(sampleCrawlState.tabId, { action: 'stopSampleCrawl' });
        } catch (_) {}
      }
      return { success: true };
    }

    case 'getSampleCrawlStatus': {
      const state = await chrome.storage.local.get('sampleCrawlState');
      const result = await chrome.storage.local.get('sampleCrawlResult');
      const stateData = state.sampleCrawlState || null;
      if (stateData && !stateData.isRunning && crawlResultData) {
        stateData.hasResult = true;
      }
      return { success: true, state: stateData, result: result.sampleCrawlResult || null };
    }

    case 'sampleCrawlProgress': {
      const d = request.data;
      sampleCrawlState.currentPage = d.currentPage || 0;
      sampleCrawlState.totalPages = d.totalPages || 0;
      sampleCrawlState.collectedCount = d.collectedCount || 0;
      sampleCrawlState.totalCount = d.totalCount || 0;
      sampleCrawlState.percent = d.percent || 0;
      sampleCrawlState.message = `第 ${d.currentPage}/${d.totalPages} 页 | 已采集 ${d.collectedCount}/${d.totalCount} 条`;
      await saveSampleCrawlState();
      return { success: true };
    }

    case 'sampleCrawlComplete': {
      const d = request.data;
      sampleCrawlState.isRunning = false;
      sampleCrawlState.message = '上传中...';
      await saveSampleCrawlState();

      crawlResultData = d;
      await chrome.storage.local.set({ sampleCrawlResult: d });

      const recordsData = [];
      for (const c of d.mapping) {
        const ids = c.apply_product_ids || [];
        if (ids.length === 0) {
          recordsData.push({ creator_name: c.creator_name, creator_id: c.creator_id, apply_product_id: '' });
        } else {
          for (const pid of ids) {
            recordsData.push({ creator_name: c.creator_name, creator_id: c.creator_id, apply_product_id: pid });
          }
        }
      }

      try {
        sampleCrawlState.message = `上传中... 0/${recordsData.length}`;
        await saveSampleCrawlState();

        const result = await appendBitableRecords(feishuConfig, recordsData);

        if (!result.success) {
          throw new Error(result.error || '上传到飞书失败');
        }

        sampleCrawlState.message = '采集完成，数据已上传飞书';
        sampleCrawlState.percent = 100;
        await saveSampleCrawlState();

        setTimeout(() => {
          chrome.storage.local.remove(['sampleCrawlState', 'sampleCrawlResult']).catch(() => {});
          crawlResultData = null;
        }, 5000);
      } catch (e) {
        console.error('[SampleCrawl] 上传飞书失败:', e);
        sampleCrawlState.message = '上传飞书失败: ' + e.message;
        await saveSampleCrawlState();
        return { success: false, error: e.message };
      }

      return { success: true };
    }

    case 'sampleCrawlHookReady': {
      return { success: true };
    }

    case 'clearSampleCrawlState': {
      resetState(null);
      feishuConfig = null;
      await chrome.storage.local.remove(['sampleCrawlState', 'sampleCrawlResult']);
      return { success: true };
    }
  }
  return null;
}

export { handleSampleCrawlMessage };

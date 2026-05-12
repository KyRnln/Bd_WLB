const TARGET_API = '/api/v1/affiliate/sample/group/list';

let crawlState = {
  isRunning: false,
  shouldStop: false,
  seenGroupIds: new Set(),
  allItems: [],
  firstJson: null,
  totalCount: 0,
  currentPage: 1,
  totalPages: 0
};

let pendingApiBuffer = [];

window.addEventListener('message', function onHookMessage(event) {
  if (event.source !== window) return;
  if (event.data?.source !== 'sample-crawl-hook') return;

  if (event.data.type === 'apiResponse' && event.data.json) {
    if (crawlState.isRunning) {
      handleApiResponse(event.data.json);
    } else {
      pendingApiBuffer.push(event.data.json);
    }
  }
  if (event.data.type === 'hookInstalled') {
    chrome.runtime.sendMessage({ action: 'sampleCrawlHookReady' });
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startSampleCrawl') {
    startCrawl().then(sendResponse);
    return true;
  }
  if (request.action === 'stopSampleCrawl') {
    stopCrawl();
    sendResponse({ success: true });
    return true;
  }
  if (request.action === 'getSampleCrawlStatus') {
    sendResponse({ success: true, state: getPublicState() });
    return true;
  }
  if (request.action === 'ping') {
    sendResponse({ success: true });
    return true;
  }
});

function getPublicState() {
  return {
    isRunning: crawlState.isRunning,
    shouldStop: crawlState.shouldStop,
    currentPage: crawlState.currentPage,
    totalPages: crawlState.totalPages,
    collectedCount: crawlState.allItems.length,
    totalCount: crawlState.totalCount
  };
}

function handleApiResponse(json) {
  if (!json?.agg_info) return;

  if (!crawlState.firstJson) {
    crawlState.firstJson = json;
    crawlState.totalCount = json.total_count || 0;
    crawlState.totalPages = Math.ceil(crawlState.totalCount / 50);
  }

  let newCount = 0;
  for (const item of json.agg_info) {
    if (!crawlState.seenGroupIds.has(item.apply_group.group_id)) {
      crawlState.seenGroupIds.add(item.apply_group.group_id);
      crawlState.allItems.push(item);
      newCount++;
    }
  }

  chrome.runtime.sendMessage({
    action: 'sampleCrawlProgress',
    data: {
      collectedCount: crawlState.allItems.length,
      totalCount: crawlState.totalCount,
      currentPage: crawlState.currentPage,
      totalPages: crawlState.totalPages,
      newItemsThisPage: newCount,
      percent: crawlState.totalCount > 0
        ? Math.round((crawlState.allItems.length / crawlState.totalCount) * 100)
        : 0
    }
  });

  if (crawlState.currentPage < crawlState.totalPages && !crawlState.shouldStop) {
    crawlState.currentPage++;
    setTimeout(() => clickPage(crawlState.currentPage), 800);
  } else {
    finishCrawl();
  }
}

function clickPage(pageNum) {
  const selectors = [
    'ul.arco-pagination li',
    '.arco-pagination-item',
    'li'
  ];
  for (const sel of selectors) {
    const items = document.querySelectorAll(sel);
    for (const el of items) {
      if (el.textContent.trim() === String(pageNum)) {
        const btn = el.querySelector('button') || el;
        btn.click();
        return true;
      }
    }
  }
  return false;
}

function finishCrawl() {
  crawlState.isRunning = false;

  crawlState.allItems.sort((a, b) =>
    (a.apply_group.group_id).localeCompare(b.apply_group.group_id)
  );

  const merged = {
    code: 0,
    total_count: crawlState.allItems.length,
    agg_info: crawlState.allItems
  };

  const mapping = parseCreatorProduct(merged);
  const multi = mapping.filter(r => r.apply_product_ids.length > 1);

  chrome.runtime.sendMessage({
    action: 'sampleCrawlComplete',
    data: {
      raw: merged,
      mapping: mapping,
      multiProductCount: multi.length,
      multiProductList: multi.map(r => ({
        creator_name: r.creator_name,
        creator_id: r.creator_id,
        product_ids: r.apply_product_ids
      }))
    }
  });
}

function parseCreatorProduct(rawJson) {
  const creatorMap = {};
  for (const item of rawJson.agg_info) {
    const c = item.apply_group.creator_info;
    const applyInfos = item.apply_deatil?.apply_infos || [];
    if (!creatorMap[c.creator_id]) {
      creatorMap[c.creator_id] = {
        creator_name: c.name,
        creator_id: c.creator_id,
        apply_product_ids: []
      };
    }
    for (const apply of applyInfos) {
      if (!creatorMap[c.creator_id].apply_product_ids.includes(apply.product_id)) {
        creatorMap[c.creator_id].apply_product_ids.push(apply.product_id);
      }
    }
  }
  return Object.values(creatorMap);
}

function stopCrawl() {
  crawlState.shouldStop = true;
  crawlState.isRunning = false;
}

async function startCrawl() {
  if (crawlState.isRunning) {
    return { success: false, error: '采集中，请勿重复启动' };
  }

  if (!location.href.includes('affiliate.tiktokshopglobalselling.com/product/sample-request')) {
    return { success: false, error: '请在样品申请页面使用此功能' };
  }

  crawlState = {
    isRunning: true,
    shouldStop: false,
    seenGroupIds: new Set(),
    allItems: [],
    firstJson: null,
    totalCount: 0,
    currentPage: 1,
    totalPages: 0
  };

  for (const json of pendingApiBuffer) {
    if (crawlState.isRunning) {
      handleApiResponse(json);
    }
  }
  pendingApiBuffer = [];

  if (!crawlState.isRunning) {
    return { success: true, alreadyFinished: true };
  }

  return { success: true, message: '采集已启动' };
}

function injectHookScript() {
  try {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('quick_module/sample_crawl/sample_crawl_hook.js');
    script.onload = () => script.remove();
    (document.head || document.documentElement).appendChild(script);
  } catch (e) {
    console.error('[SampleCrawl] 注入hook失败:', e);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectHookScript);
} else {
  injectHookScript();
}

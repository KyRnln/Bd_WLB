var orderState = {
  capturedData: [],
  apiCount: 0,
  isRunning: false,
  usernames: [],
  tabId: null
};

async function checkContentScript(tabId) {
  try {
    var response = await chrome.tabs.sendMessage(tabId, { action: 'ping' });
    return response && response.success;
  } catch (e) {
    return false;
  }
}

async function injectContentScript(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['quick_module/order/order_content.js']
    });
    await new Promise(function (r) { setTimeout(r, 800); });
    return await checkContentScript(tabId);
  } catch (e) {
    console.error('[Order Background] inject content script failed:', e);
    return false;
  }
}

async function ensureContentScriptInjected(tabId) {
  var csReady = await checkContentScript(tabId);
  if (!csReady) {
    csReady = await injectContentScript(tabId);
  }
  return csReady;
}

async function startOrderCapture(tabId, usernames) {
  orderState.usernames = usernames || [];
  orderState.tabId = tabId;
  orderState.capturedData = [];
  orderState.apiCount = 0;

  var csReady = await ensureContentScriptInjected(tabId);
  if (!csReady) {
    orderState.isRunning = false;
    return { success: false, error: '无法注入采集脚本，请刷新页面重试' };
  }

  var response = await chrome.tabs.sendMessage(tabId, {
    action: 'orderStartCapture',
    usernames: usernames
  });

  if (!response || !response.success) {
    return { success: false, error: (response && response.error) || '启动捕获失败' };
  }

  orderState.isRunning = true;
  return { success: true };
}

async function handleOrderMessage(request, sender, downloadExcel) {
  switch (request.action) {
    case 'startOrderCapture': {
      if (orderState.isRunning) {
        return { success: false, error: '已有捕获任务在运行中' };
      }

      var tabId = request.tabId;
      if (!tabId && sender && sender.tab && sender.tab.id) {
        tabId = sender.tab.id;
      }
      if (!tabId) {
        return { success: false, error: '无法获取当前标签页' };
      }

      var result = await startOrderCapture(tabId, request.usernames);
      return result;
    }

    case 'stopOrderCapture': {
      orderState.isRunning = false;
      if (orderState.tabId) {
        try {
          await chrome.tabs.sendMessage(orderState.tabId, { action: 'orderStopCapture' });
        } catch (_) {}
      }
      return { success: true };
    }

    case 'orderGetStatus': {
      return {
        success: true,
        data: {
          isRunning: orderState.isRunning,
          capturedCount: orderState.capturedData.length,
          apiCount: orderState.apiCount,
          usernames: orderState.usernames
        }
      };
    }

    case 'orderHookReady': {
      console.log('[Order Background] hook ready');
      return { success: true };
    }

    case 'orderDataCaptured': {
      orderState.capturedData = request.data.allData || [];
      orderState.apiCount = request.data.totalCount || 0;
      return { success: true };
    }

    case 'getOrderData': {
      return {
        success: true,
        data: orderState.capturedData,
        apiCount: orderState.apiCount
      };
    }

    case 'clearOrderData': {
      orderState.capturedData = [];
      orderState.apiCount = 0;
      if (orderState.tabId) {
        try {
          await chrome.tabs.sendMessage(orderState.tabId, { action: 'orderClearCapturedData' });
        } catch (_) {}
      }
      return { success: true };
    }

    case 'orderEnsureContentScript': {
      var tabId = request.tabId;
      if (!tabId && sender && sender.tab && sender.tab.id) {
        tabId = sender.tab.id;
      }
      if (!tabId) {
        return { success: false, error: '无法获取当前标签页' };
      }

      var csReady = await ensureContentScriptInjected(tabId);
      if (!csReady) {
        return { success: false, error: '无法注入采集脚本，请刷新页面重试' };
      }

      orderState.tabId = tabId;
      return { success: true };
    }
  }

  return null;
}

console.log('[Order Background] loaded');

export { handleOrderMessage };

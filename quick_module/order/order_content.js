(function () {
  var orderState = {
    isActive: false,
    capturedData: [],
    apiCount: 0,
    usernames: [],
    isCapturing: false,
    batchProgress: { currentIndex: 0, total: 0, currentName: '', done: false }
  };

  var pendingApiBuffer = [];
  var searchResponseBuffer = [];
  var isSearchWaiting = false;

  window.addEventListener('message', function (event) {
    if (event.source !== window) return;
    if (event.data?.source !== 'order-hook') return;

    if (event.data.type === 'hookInstalled') {
      orderState.isActive = true;
      chrome.runtime.sendMessage({ action: 'orderHookReady' }).catch(function () {});
    }

    if (event.data.type === 'apiResponse' && event.data.json) {
      if (isSearchWaiting) {
        searchResponseBuffer.push(event.data.json);
      } else if (orderState.isCapturing) {
        orderState.apiCount++;
        handleApiResponse(event.data.json);
      } else {
        pendingApiBuffer.push({ json: event.data.json, url: event.data.url });
      }
    }
  });

  chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request.action === 'orderStartCapture') {
      startBatchCapture(request.usernames).then(sendResponse);
      return true;
    }

    if (request.action === 'orderStopCapture') {
      orderState.isCapturing = false;
      orderState.batchProgress.done = true;
      sendResponse({ success: true });
      return true;
    }

    if (request.action === 'orderGetCapturedData') {
      sendResponse({
        success: true,
        data: orderState.capturedData,
        apiCount: orderState.apiCount,
        batchProgress: orderState.batchProgress
      });
      return true;
    }

    if (request.action === 'orderClearCapturedData') {
      orderState.capturedData = [];
      orderState.apiCount = 0;
      orderState.batchProgress = { currentIndex: 0, total: 0, currentName: '', done: false };
      sendResponse({ success: true });
      return true;
    }

    if (request.action === 'orderSearchOne') {
      searchOne(request.username).then(sendResponse);
      return true;
    }

    if (request.action === 'ping') {
      sendResponse({ success: true, hookActive: orderState.isActive });
      return true;
    }
  });

  function handleApiResponse(json) {
    if (!json) return;

    var orderData = cleanOrderData(json);

    if (orderData && orderData.length > 0) {
      orderState.capturedData.push.apply(orderState.capturedData, orderData);
      console.log('[Order] extracted', orderData.length, 'records, total:', orderState.capturedData.length);

      chrome.runtime.sendMessage({
        action: 'orderDataCaptured',
        data: {
          newData: orderData,
          totalCount: orderState.capturedData.length,
          allData: orderState.capturedData
        }
      }).catch(function () {});
    }
  }

  var STATUS_MAP = { 10: '待审核', 20: '待发货', 30: '已发货', 40: '处理中', 51: '拒绝', 53: '逾期', 100: '已发布' };

  function mapCurrStatus(code) {
    if (code === undefined || code === null || code === '') return '';
    var num = Number(code);
    if (isNaN(num)) return String(code);
    var mapped = STATUS_MAP[num];
    if (mapped) return mapped;
    return '未知状态(' + num + ')';
  }

  function cleanOrderData(json) {
    var result = [];
    var aggInfo = resolveAggInfo(json);
    if (!aggInfo) return result;

    for (var i = 0; i < aggInfo.length; i++) {
      var item = aggInfo[i];
      var applyDetail = item.apply_deatil || item.apply_detail || item;
      var creatorInfo = applyDetail.creator_info || (item.apply_group || {}).creator_info || item.creator_info || {};
      var applyInfos = applyDetail.apply_infos || item.apply_infos || [];
      var creatorName = creatorInfo.name || '';
      var creatorId = creatorInfo.creator_id || '';
      var timestamp = new Date().toISOString();

      for (var j = 0; j < applyInfos.length; j++) {
        var apply = applyInfos[j];
        result.push({
          creator_id: creatorName,
          creator_cid: creatorId,
          product_id: apply.product_id || '',
          order_id: apply.main_order_id || '',
          order_status: mapCurrStatus(apply.curr_status),
          timestamp: timestamp
        });
      }
    }

    return result;
  }

  function resolveAggInfo(json) {
    if (Array.isArray(json.agg_info)) return json.agg_info;
    if (Array.isArray(json.data)) return json.data;
    if (Array.isArray(json.list)) return json.list;
    if (json.data && Array.isArray(json.data.list)) return json.data.list;
    if (json.data && Array.isArray(json.data.records)) return json.data.records;
    return null;
  }

  function clickAllTab() {
    var tabElements = document.querySelectorAll('div.m4b-tabs-pane-title-content');
    for (var i = 0; i < tabElements.length; i++) {
      if (tabElements[i].textContent.trim() === '全部') {
        tabElements[i].click();
        console.log('[Order] clicked 全部 tab');
        return true;
      }
    }
    console.log('[Order] 全部 tab not found');
    return false;
  }

  function waitForPageLoad(timeout) {
    return new Promise(function (resolve) {
      var start = Date.now();
      function check() {
        var input = document.querySelector('input[data-tid="m4b_input_search"]') || findSearchInput();
        if (input) {
          resolve(true);
          return;
        }
        if (Date.now() - start > timeout) {
          resolve(false);
          return;
        }
        setTimeout(check, 500);
      }
      check();
    });
  }

  function findSearchInput() {
    var selectors = [
      'input[data-tid="m4b_input_search"]',
      'input[placeholder*="搜索"]',
      'input[placeholder*="订单"]',
      'input[placeholder*="search"]',
      'input[placeholder*="order"]',
      'input[type="text"]'
    ];

    for (var i = 0; i < selectors.length; i++) {
      var elements = document.querySelectorAll(selectors[i]);
      for (var j = 0; j < elements.length; j++) {
        if (elements[j].offsetParent !== null && elements[j].clientWidth > 100) {
          return elements[j];
        }
      }
    }

    var allInputs = document.querySelectorAll('input[type="text"], input:not([type])');
    var candidates = [];
    for (var k = 0; k < allInputs.length; k++) {
      var inp = allInputs[k];
      var rect = inp.getBoundingClientRect();
      if (inp.offsetParent !== null && rect.width > 150 && rect.height > 20 && !inp.disabled && !inp.readOnly) {
        candidates.push(inp);
      }
    }
    candidates.sort(function (a, b) {
      return (b.offsetWidth * b.offsetHeight) - (a.offsetWidth * a.offsetHeight);
    });

    return candidates.length > 0 ? candidates[0] : null;
  }

  function setInputValue(input, value) {
    var nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    nativeInputValueSetter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function triggerEnter(input) {
    var enterDown = new KeyboardEvent('keydown', {
      key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true
    });
    var enterUp = new KeyboardEvent('keyup', {
      key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true
    });
    input.dispatchEvent(enterDown);
    input.dispatchEvent(enterUp);
  }

  async function triggerSearchAndCollect(username, waitMs) {
    clickAllTab();
    await new Promise(function (r) { setTimeout(r, 500); });

    var input = findSearchInput();
    if (!input) return null;

    input.focus();
    await new Promise(function (r) { setTimeout(r, 200); });

    setInputValue(input, '');
    await new Promise(function (r) { setTimeout(r, 200); });

    setInputValue(input, username);
    await new Promise(function (r) { setTimeout(r, 300); });

    searchResponseBuffer = [];
    isSearchWaiting = true;

    triggerEnter(input);
    console.log('[Order] searching:', username);

    await new Promise(function (r) { setTimeout(r, waitMs); });

    isSearchWaiting = false;

    var allItems = [];
    if (searchResponseBuffer.length > 0) {
      for (var ri = 0; ri < searchResponseBuffer.length; ri++) {
        var batch = cleanOrderData(searchResponseBuffer[ri]);
        for (var bi = 0; bi < batch.length; bi++) {
          allItems.push(batch[bi]);
        }
      }
      console.log('[Order] got', allItems.length, 'items from', searchResponseBuffer.length, 'responses for:', username);
    } else {
      console.log('[Order] no API response for:', username);
    }

    searchResponseBuffer = [];
    return allItems;
  }

  async function searchAndWait(name) {
    var items = await triggerSearchAndCollect(name, 3000);
    if (items && items.length > 0) {
      orderState.apiCount += items.length;
      orderState.capturedData.push.apply(orderState.capturedData, items);
      chrome.runtime.sendMessage({
        action: 'orderDataCaptured',
        data: {
          newData: items,
          totalCount: orderState.capturedData.length,
          allData: orderState.capturedData
        }
      }).catch(function () {});
    }
  }

  async function searchOne(username) {
    if (!location.href.includes('affiliate.tiktokshopglobalselling.com')) {
      return { success: false, error: '请在TikTok联盟订单页面使用此功能' };
    }

    var input = findSearchInput();
    if (!input) {
      console.log('[Order] search input not found');
      var loaded = await waitForPageLoad(15000);
      if (!loaded) {
        return { success: false, error: '页面未加载完成，找不到搜索框' };
      }
      input = findSearchInput();
      if (!input) {
        return { success: false, error: '找不到搜索输入框' };
      }
    }

    var items = await triggerSearchAndCollect(username, 6000);
    return { success: true, items: items || [] };
  }

  async function startBatchCapture(usernames) {
    if (!location.href.includes('affiliate.tiktokshopglobalselling.com')) {
      return { success: false, error: '请在TikTok联盟订单页面使用此功能' };
    }

    if (!Array.isArray(usernames) || usernames.length === 0) {
      return { success: false, error: '请输入至少一个达人昵称' };
    }

    orderState.usernames = usernames;
    orderState.capturedData = [];
    orderState.apiCount = 0;
    orderState.isCapturing = true;
    orderState.batchProgress = {
      currentIndex: 0,
      total: usernames.length,
      currentName: '',
      done: false
    };

    for (var b = 0; b < pendingApiBuffer.length; b++) {
      if (orderState.isCapturing) {
        handleApiResponse(pendingApiBuffer[b].json);
      }
    }
    pendingApiBuffer = [];

    if (!document.querySelector('input[data-tid="m4b_input_search"]') &&
        !findSearchInput()) {
      console.log('[Order] page not fully loaded, waiting...');
      var loaded = await waitForPageLoad(15000);
      if (!loaded) {
        orderState.isCapturing = false;
        return { success: false, error: '页面未完全加载，请刷新页面重试' };
      }
    }

    runBatch().catch(function (e) {
      console.error('[Order] batch error:', e);
    });

    return { success: true, message: '批量捕获已启动' };
  }

  async function runBatch() {
    var usernames = orderState.usernames;

    for (var i = 0; i < usernames.length; i++) {
      if (!orderState.isCapturing) break;

      var name = usernames[i];
      orderState.batchProgress.currentIndex = i + 1;
      orderState.batchProgress.currentName = name;

      console.log('[Order] processing', (i + 1) + '/' + usernames.length, ':', name);

      await searchAndWait(name);

      await new Promise(function (r) { setTimeout(r, 2000); });
    }

    orderState.isCapturing = false;
    orderState.batchProgress.done = true;
    orderState.batchProgress.currentName = '';
    console.log('[Order] batch complete, total:', orderState.capturedData.length);
  }

  function injectHookScript() {
    try {
      var script = document.createElement('script');
      script.src = chrome.runtime.getURL('quick_module/order/order_hook.js');
      script.onload = function () { script.remove(); };
      (document.head || document.documentElement).appendChild(script);
    } catch (e) {
      console.error('[Order] inject hook failed:', e);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectHookScript);
  } else {
    injectHookScript();
  }
})();

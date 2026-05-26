document.addEventListener('DOMContentLoaded', () => {
  const backBtn = document.getElementById('backBtn');
  const orderStartBtn = document.getElementById('orderStartBtn');
  const orderStopBtn = document.getElementById('orderStopBtn');
  const orderClearBtn = document.getElementById('orderClearBtn');
  const orderPanelStatus = document.getElementById('orderPanelStatus');
  const orderStatsRow = document.getElementById('orderStatsRow');
  const statFeishuTotal = document.getElementById('statFeishuTotal');
  const statPending = document.getElementById('statPending');
  const statMatched = document.getElementById('statMatched');
  const statUnmatched = document.getElementById('statUnmatched');
  const orderProgressBar = document.getElementById('orderProgressBar');
  const orderProgressFill = document.getElementById('orderProgressFill');
  const orderProgressText = document.getElementById('orderProgressText');
  const orderResults = document.getElementById('orderResults');
  const orderResultSummary = document.getElementById('orderResultSummary');
  const logPanel = document.getElementById('logPanel');
  const logList = document.getElementById('logList');

  const feishuUrl = document.getElementById('feishuUrl');
  const parseUrlBtn = document.getElementById('parseUrlBtn');
  const feishuAppId = document.getElementById('feishuAppId');
  const feishuAppSecret = document.getElementById('feishuAppSecret');
  const baseToken = document.getElementById('baseToken');
  const tableId = document.getElementById('tableId');
  const creatorNameField = document.getElementById('creatorNameField');
  const creatorCidField = document.getElementById('creatorCidField');
  const productIdField = document.getElementById('productIdField');
  const fulfillmentStatusField = document.getElementById('fulfillmentStatusField');
  const orderNumberField = document.getElementById('orderNumberField');
  const feishuStatus = document.getElementById('feishuStatus');

  let feishuConfig = null;
  let isRunning = false;
  let feishuRecords = [];

  function showStatus(message, type) {
    orderPanelStatus.textContent = message;
    orderPanelStatus.className = 'panel-status ' + type;
    orderPanelStatus.style.display = 'block';
    setTimeout(() => { orderPanelStatus.style.display = 'none'; }, 5000);
  }

  function escapeHtml(text) {
    var map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return String(text || '').replace(/[&<>"']/g, function (ch) { return map[ch]; });
  }

  function log(msg, type) {
    type = type || 'info';
    if (!logList) return;
    logPanel.style.display = 'block';
    var time = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    var entry = document.createElement('div');
    entry.className = 'log-entry ' + type;
    entry.innerHTML = '<span class="time">' + time + '</span><span class="msg">' + escapeHtml(msg) + '</span>';
    logList.appendChild(entry);
    logPanel.scrollTop = logPanel.scrollHeight;
  }

  function parseFeishuUrl(url) {
    var result = { baseToken: '', tableId: '', wikiToken: '', isWiki: false };
    if (!url) return result;
    try {
      var u = new URL(url);
      var baseMatch = u.pathname.match(/\/base\/([A-Za-z0-9]+)/);
      var wikiMatch = u.pathname.match(/\/wiki\/([A-Za-z0-9]+)/);
      if (baseMatch) {
        result.baseToken = baseMatch[1];
      } else if (wikiMatch) {
        result.wikiToken = wikiMatch[1];
        result.isWiki = true;
      }
      var tableParam = u.searchParams.get('table');
      if (tableParam) result.tableId = tableParam;
    } catch (e) {}
    return result;
  }

  function readConfigFromFields() {
    return {
      appId: feishuAppId.value.trim(),
      appSecret: feishuAppSecret.value.trim(),
      baseToken: baseToken.value.trim(),
      tableId: tableId.value.trim(),
      creatorNameField: creatorNameField.value.trim() || '达人ID',
      creatorCidField: creatorCidField.value.trim() || '达人CID',
      productIdField: productIdField.value.trim() || '产品ID',
      fulfillmentStatusField: fulfillmentStatusField.value.trim() || '履约状态',
      orderNumberField: orderNumberField.value.trim() || '订单号'
    };
  }

  var autoSaveTimer = null;
  function autoSaveConfig() {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(function () {
      var fields = readConfigFromFields();
      feishuConfig = fields;
      saveConfig();
      updateFeishuStatus();
    }, 300);
  }

  function immediateSaveConfig() {
    clearTimeout(autoSaveTimer);
    var fields = readConfigFromFields();
    feishuConfig = fields;
    saveConfig();
    updateFeishuStatus();
  }

  var configInputs = [feishuAppId, feishuAppSecret, baseToken, tableId, creatorNameField, creatorCidField, productIdField, fulfillmentStatusField, orderNumberField];
  configInputs.forEach(function (el) {
    if (el) {
      el.addEventListener('input', autoSaveConfig);
      el.addEventListener('blur', immediateSaveConfig);
    }
  });

  async function loadConfig() {
    try {
      var result = await new Promise(function (resolve) { chrome.storage.local.get(['orderFeishuConfig'], resolve); });
      feishuConfig = result.orderFeishuConfig || null;
      if (feishuConfig) {
        feishuAppId.value = feishuConfig.appId || '';
        feishuAppSecret.value = feishuConfig.appSecret || '';
        baseToken.value = feishuConfig.baseToken || '';
        tableId.value = feishuConfig.tableId || '';
        creatorNameField.value = feishuConfig.creatorNameField || '达人ID';
        creatorCidField.value = feishuConfig.creatorCidField || '达人CID';
        productIdField.value = feishuConfig.productIdField || '产品ID';
        fulfillmentStatusField.value = feishuConfig.fulfillmentStatusField || '履约状态';
        orderNumberField.value = feishuConfig.orderNumberField || '订单号';
      }
      updateFeishuStatus();
    } catch (e) {
      feishuConfig = null;
      updateFeishuStatus();
    }
  }

  async function saveConfig() {
    await new Promise(function (resolve) { chrome.storage.local.set({ orderFeishuConfig: feishuConfig }, resolve); });
  }

  function updateFeishuStatus() {
    if (feishuConfig && feishuConfig.baseToken && feishuConfig.tableId) {
      feishuStatus.textContent = '已配置';
      feishuStatus.style.color = '#137333';
    } else {
      feishuStatus.textContent = '未配置';
      feishuStatus.style.color = '#ba1a1a';
    }
  }

  parseUrlBtn.addEventListener('click', async function () {
    var url = feishuUrl.value.trim();
    if (!url) { showStatus('请粘贴多维表格链接', 'error'); return; }
    var parsed = parseFeishuUrl(url);
    if (!parsed.baseToken && !parsed.wikiToken) { showStatus('未识别到链接，请检查链接格式', 'error'); return; }
    if (!parsed.tableId) { showStatus('未识别到 Table ID', 'error'); return; }
    tableId.value = parsed.tableId;

    if (parsed.isWiki) {
      var cfg = readConfigFromFields();
      if (!cfg.appId || !cfg.appSecret) {
        showStatus('请先填写并保存 App ID 和 App Secret，再解析 wiki 链接', 'error');
        return;
      }
      showStatus('正在解析 wiki 链接，请稍候...', 'info');
      try {
        var response = await chrome.runtime.sendMessage({
          action: 'resolveWikiToken',
          config: cfg,
          wikiToken: parsed.wikiToken
        });
        if (response && response.success) {
          baseToken.value = response.baseToken;
          showStatus('解析成功！已自动填入 Base Token 和 Table ID', 'success');
          immediateSaveConfig();
        } else {
          showStatus('解析失败：' + (response && response.error || '未知错误'), 'error');
        }
      } catch (err) {
        showStatus('解析异常：' + err.message, 'error');
      }
    } else {
      baseToken.value = parsed.baseToken;
      showStatus('已自动填入 Base Token 和 Table ID', 'success');
      immediateSaveConfig();
    }
  });

  function updateProgress(current, total, currentName) {
    var pct = total > 0 ? Math.round((current / total) * 100) : 0;
    orderProgressFill.style.width = pct + '%';
    orderProgressText.textContent = currentName
      ? current + '/' + total + ' (' + pct + '%) - 当前: ' + currentName
      : current + '/' + total + ' (' + pct + '%)';
  }

  function updateStats(feishuTotal, pending, matched, unmatched) {
    orderStatsRow.style.display = 'flex';
    statFeishuTotal.querySelector('strong').textContent = feishuTotal;
    statPending.textContent = pending;
    statMatched.textContent = matched;
    statUnmatched.textContent = unmatched;
  }

  function setRunningUI() {
    isRunning = true;
    orderStartBtn.disabled = true;
    orderStartBtn.textContent = '查询中...';
    orderStartBtn.style.opacity = '0.7';
    orderStopBtn.style.display = 'flex';
    orderProgressBar.style.display = 'block';
  }

  function setStoppedUI() {
    isRunning = false;
    orderStartBtn.disabled = false;
    orderStartBtn.textContent = '开始查询';
    orderStartBtn.style.opacity = '1';
    orderStopBtn.style.display = 'none';
  }

  async function fetchFeishuRecords() {
    var cfg = readConfigFromFields();
    if (!cfg.appId || !cfg.appSecret) {
      throw new Error('请填写飞书 App ID 和 App Secret');
    }
    if (!cfg.baseToken || !cfg.tableId) {
      throw new Error('请填写或解析飞书多维表格链接');
    }

    log('正在从飞书多维表格读取记录...', 'info');

    var response = await chrome.runtime.sendMessage({
      action: 'listBitableRecords',
      config: cfg
    });

    if (!response || !response.success) {
      throw new Error(response && response.error || '读取飞书记录失败');
    }

    var records = response.records || [];
    log('读取到 ' + records.length + ' 条飞书记录', 'info');

    return records;
  }

  function filterPendingRecords(records) {
    var cfg = readConfigFromFields();
    var statusField = cfg.fulfillmentStatusField || '履约状态';
    return records.filter(function (r) {
      var val = getFeishuFieldValue(r.fields[statusField]);
      return val === '';
    });
  }

  function groupByCreatorName(records) {
    var cfg = readConfigFromFields();
    var nameField = cfg.creatorNameField || '达人ID';
    var groups = {};
    for (var i = 0; i < records.length; i++) {
      var name = getFeishuFieldValue(records[i].fields[nameField]).trim();
      if (!name) continue;
      if (!groups[name]) groups[name] = [];
      groups[name].push(records[i]);
    }
    return groups;
  }

  async function ensureContentScript() {
    var [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) throw new Error('无法获取当前标签页');

    var response = await chrome.runtime.sendMessage({
      action: 'orderEnsureContentScript',
      tabId: tab.id
    });

    if (!response || !response.success) {
      throw new Error(response && response.error || '注入脚本失败');
    }

    return tab;
  }

  async function searchOneInTikTok(username) {
    var tab = await ensureContentScript();

    var response = await chrome.tabs.sendMessage(tab.id, {
      action: 'orderSearchOne',
      username: username
    });

    if (!response || !response.success) {
      throw new Error(response && response.error || '搜索失败');
    }

    return response.items || [];
  }

  function getFeishuFieldValue(field) {
    if (field === undefined || field === null) return '';
    if (typeof field === 'string') return field;
    if (typeof field === 'number') return String(field);
    if (Array.isArray(field)) {
      if (field.length > 0) {
        if (typeof field[0] === 'object' && field[0] !== null) {
          return String(field[0].text || field[0].value || '');
        }
        return String(field[0]);
      }
      return '';
    }
    if (typeof field === 'object') {
      return String(field.text || field.value || '');
    }
    return String(field);
  }

  function matchTikTokItem(tiktokItem, feishuRecords, writtenRecordIds) {
    var cfg = readConfigFromFields();
    var cidField = cfg.creatorCidField || '达人CID';
    var prodField = cfg.productIdField || '产品ID';
    var tiktokCid = String(tiktokItem.creator_cid || '').trim();
    var tiktokProdId = String(tiktokItem.product_id || '').trim();

    if (!tiktokCid || !tiktokProdId) {
      log('    TikTok数据CID或产品ID为空: CID="' + tiktokCid + '" 产品="' + tiktokProdId + '"', 'warn');
      return null;
    }

    for (var j = 0; j < feishuRecords.length; j++) {
      var record = feishuRecords[j];
      if (writtenRecordIds && writtenRecordIds[record.recordId]) continue;
      var feishuCid = getFeishuFieldValue(record.fields[cidField]).trim();
      var feishuProdId = getFeishuFieldValue(record.fields[prodField]).trim();

      if (tiktokCid === feishuCid && tiktokProdId === feishuProdId) {
        return record;
      }
    }

    log('    CID=' + tiktokCid + ' 产品=' + tiktokProdId + ' 在飞书' + feishuRecords.length + '条记录中未匹配到', 'warn');
    return null;
  }

  async function writeOneToFeishu(recordId, orderId, orderStatus) {
    var cfg = readConfigFromFields();
    var orderField = cfg.orderNumberField || '订单号';
    var statusField = cfg.fulfillmentStatusField || '履约状态';

    var fields = {};
    fields[orderField] = orderId;
    fields[statusField] = orderStatus;

    var response = await chrome.runtime.sendMessage({
      action: 'updateBitableRecord',
      config: cfg,
      recordId: recordId,
      fields: fields
    });

    if (!response || !response.success) {
      throw new Error(response && response.error || '回写失败');
    }

    return true;
  }

  async function runOneByOne(pendingRecords) {
    var cfg = readConfigFromFields();
    var cidField = cfg.creatorCidField || '达人CID';
    var prodField = cfg.productIdField || '产品ID';
    var groups = groupByCreatorName(pendingRecords);
    var creatorNames = Object.keys(groups);
    var totalCreators = creatorNames.length;
    var totalRecords = pendingRecords.length;

    var matchedCount = 0;
    var unmatchedCount = 0;
    var processedTiktok = 0;
    var writtenRecordIds = {};

    log('共 ' + totalRecords + ' 条待处理记录，' + totalCreators + ' 个达人', 'info');
    updateStats(feishuRecords.length, totalRecords, 0, 0);

    for (var i = 0; i < creatorNames.length; i++) {
      if (!isRunning) {
        log('用户停止操作', 'info');
        break;
      }

      var creatorName = creatorNames[i];
      var records = groups[creatorName];

      updateProgress(i + 1, totalCreators, creatorName);
      log('搜索达人 (' + (i + 1) + '/' + totalCreators + '): ' + creatorName + '（待处理 ' + records.length + ' 条）', 'info');
      if (records.length > 0) {
        log('    飞书样本: CID=' + getFeishuFieldValue(records[0].fields[cidField]) + ' 产品=' + getFeishuFieldValue(records[0].fields[prodField]), 'info');
      }

      try {
        var tiktokItems = await searchOneInTikTok(creatorName);
        log('  搜索到 ' + tiktokItems.length + ' 条TikTok数据', 'info');
        if (tiktokItems.length > 0) {
          for (var ti = 0; ti < Math.min(tiktokItems.length, 3); ti++) {
            var sample = tiktokItems[ti];
            log('    示例: CID=' + String(sample.creator_cid) + ' 产品=' + String(sample.product_id) + ' 订单=' + String(sample.order_id) + ' 状态=' + String(sample.order_status), 'info');
          }
        }

        for (var t = 0; t < tiktokItems.length; t++) {
          if (!isRunning) break;

          var tiktokItem = tiktokItems[t];
          processedTiktok++;

          var matchedRecord = matchTikTokItem(tiktokItem, records, writtenRecordIds);

          if (matchedRecord && !writtenRecordIds[matchedRecord.recordId]) {
            try {
              await writeOneToFeishu(matchedRecord.recordId, tiktokItem.order_id, tiktokItem.order_status);
              writtenRecordIds[matchedRecord.recordId] = true;
              matchedCount++;
              log('  匹配回写: CID=' + String(tiktokItem.creator_cid) + ' 产品=' + String(tiktokItem.product_id) + ' -> 订单=' + tiktokItem.order_id + ' 状态=' + tiktokItem.order_status, 'success');
            } catch (e) {
              unmatchedCount++;
              log('  回写失败: ' + e.message, 'error');
            }
          } else if (!matchedRecord) {
            unmatchedCount++;
            log('  未匹配: CID=' + String(tiktokItem.creator_cid) + ' 产品=' + String(tiktokItem.product_id), 'info');
          }

          updateStats(feishuRecords.length, totalRecords - matchedCount - unmatchedCount, matchedCount, unmatchedCount);
        }
      } catch (e) {
        log('  搜索失败: ' + e.message, 'error');
        unmatchedCount += records.length;
        updateStats(feishuRecords.length, totalRecords - matchedCount - unmatchedCount, matchedCount, unmatchedCount);
      }

      if (i < creatorNames.length - 1 && isRunning) {
        await new Promise(function (r) { setTimeout(r, 1000); });
      }
    }

    return { matched: matchedCount, unmatched: unmatchedCount };
  }

  orderStartBtn.addEventListener('click', async function () {
    if (isRunning) return;

    orderResults.style.display = 'none';
    orderResultSummary.innerHTML = '';
    logList.innerHTML = '';
    logPanel.style.display = 'none';

    var cfg = readConfigFromFields();
    if (!cfg.appId || !cfg.appSecret) {
      showStatus('请填写飞书 App ID 和 App Secret', 'error');
      return;
    }
    if (!cfg.baseToken || !cfg.tableId) {
      showStatus('请填写或解析飞书多维表格链接', 'error');
      return;
    }

    setRunningUI();
    updateStats(0, 0, 0, 0);
    updateProgress(0, 0, '');

    try {
      feishuRecords = await fetchFeishuRecords();
      var pendingRecords = filterPendingRecords(feishuRecords);
      log('履约状态为空的记录: ' + pendingRecords.length + ' 条', 'info');

      if (pendingRecords.length === 0) {
        showStatus('没有履约状态为空的记录', 'info');
        setStoppedUI();
        orderProgressBar.style.display = 'none';
        updateStats(feishuRecords.length, 0, 0, 0);
        orderResults.style.display = 'block';
        orderResultSummary.innerHTML = '<div style="text-align:center;color:#6b7280;padding:12px;">没有需要处理的记录，所有记录的履约状态均已填写</div>';
        return;
      }

      var result = await runOneByOne(pendingRecords);

      setStoppedUI();
      showStatus('查询完成，匹配 ' + result.matched + ' 条，未匹配 ' + result.unmatched + ' 条', 'success');
      log('查询完成：匹配 ' + result.matched + ' 条，未匹配 ' + result.unmatched + ' 条', 'success');

    } catch (e) {
      showStatus('操作失败: ' + e.message, 'error');
      log('错误: ' + e.message, 'error');
      setStoppedUI();
      orderProgressBar.style.display = 'none';
    }
  });

  orderStopBtn.addEventListener('click', async function () {
    isRunning = false;
    setStoppedUI();
    orderProgressBar.style.display = 'none';
    showStatus('已停止', 'info');
    log('用户停止操作', 'info');
  });

  orderClearBtn.addEventListener('click', async function () {
    isRunning = false;
    feishuRecords = [];
    orderResults.style.display = 'none';
    orderResultSummary.innerHTML = '';
    orderProgressBar.style.display = 'none';
    orderProgressFill.style.width = '0%';
    orderProgressText.textContent = '';
    orderStatsRow.style.display = 'none';
    logList.innerHTML = '';
    logPanel.style.display = 'none';
    setStoppedUI();
    showStatus('数据已清除', 'success');
  });

  backBtn.addEventListener('click', function () {
    isRunning = false;
    window.location.href = '../../popup.html';
  });

  loadConfig();
});

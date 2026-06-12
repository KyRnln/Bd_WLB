document.addEventListener('click', (e) => {
  const summary = e.target.closest('details.panel > summary, details.panel .custom-summary');
  if (!summary) return;
  const details = summary.closest('details.panel');
  if (!details) return;
  const content = details.querySelector('.panel-content');
  if (!content) return;
  const wrap = content.querySelector('.panel-content-wrap');
  e.preventDefault();
  e.stopPropagation();
  if (details.open) {
    if (wrap) wrap.style.overflow = 'hidden';
    content.style.transition = 'grid-template-rows 0.3s ease-in';
    requestAnimationFrame(() => {
      content.style.gridTemplateRows = '0fr';
    });
    const onEnd = () => {
      content.removeEventListener('transitionend', onEnd);
      details.open = false;
      details.classList.remove('is-open');
      content.style.transition = '';
      content.style.gridTemplateRows = '';
    };
    content.addEventListener('transitionend', onEnd);
  } else {
    details.open = true;
    details.classList.add('is-open');
    content.style.gridTemplateRows = '0fr';
    requestAnimationFrame(() => {
      content.style.transition = 'grid-template-rows 0.3s ease-out';
      content.style.gridTemplateRows = '1fr';
    });
    const onEnd = () => {
      content.removeEventListener('transitionend', onEnd);
      if (wrap) wrap.style.overflow = 'visible';
      content.style.transition = '';
    };
    content.addEventListener('transitionend', onEnd);
  }
});

document.addEventListener('DOMContentLoaded', () => {
  const startBtn = document.getElementById('startSampleCrawlBtn');
  const stopBtn = document.getElementById('stopSampleCrawlBtn');
  const clearBtn = document.getElementById('clearSampleCrawlBtn');
  const backBtn = document.getElementById('backBtn');
  const progressBar = document.getElementById('sampleProgressBar');
  const progressFill = document.getElementById('sampleProgressFill');
  const progressText = document.getElementById('sampleProgressText');
  const statsRow = document.getElementById('sampleStatsRow');
  const statTotal = document.getElementById('sampleStatTotal');
  const statCollected = document.getElementById('sampleStatCollected');
  const statAll = document.getElementById('sampleStatAll');
  const multiStats = document.getElementById('sampleMultiStats');
  const statMulti = document.getElementById('sampleStatMulti');
  const resultsDiv = document.getElementById('sampleResults');
  const resultSummary = document.getElementById('sampleResultSummary');
  const logPanel = document.getElementById('logPanel');
  const logList = document.getElementById('logList');
  const feishuUrl = document.getElementById('feishuUrl');
  const parseUrlBtn = document.getElementById('parseUrlBtn');
  const feishuAppId = document.getElementById('feishuAppId');
  const feishuAppSecret = document.getElementById('feishuAppSecret');
  const baseToken = document.getElementById('baseToken');
  const tableId = document.getElementById('tableId');
  const creatorNameField = document.getElementById('creatorNameField');
  const creatorIdField = document.getElementById('creatorIdField');
  const productIdField = document.getElementById('productIdField');
  const feishuStatus = document.getElementById('feishuStatus');

  let feishuConfig = null;
  let statusPollInterval = null;

  function showStatus(message, type = 'info') {
    const statusDiv = document.getElementById('samplePanelStatus');
    if (!statusDiv) return;
    const icons = {
      success: '<svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" style="flex-shrink:0"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>',
      error: '<svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" style="flex-shrink:0"><path stroke-linecap="round" stroke-linejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>',
      info: '<svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" style="flex-shrink:0"><path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" /></svg>'
    };
    statusDiv.innerHTML = (icons[type] || icons.info) + '<span>' + message + '</span>';
    statusDiv.className = 'panel-status ' + type;
    statusDiv.style.display = 'flex';
    setTimeout(() => {
      statusDiv.style.display = 'none';
    }, 5000);
  }

  function escapeHtml(text) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return String(text).replace(/[&<>"']/g, ch => map[ch]);
  }

  function log(msg, type = 'info') {
    if (!logList) return;
    logPanel.style.display = 'block';
    const time = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    const entry = document.createElement('div');
    entry.className = 'log-entry' + (type === 'error' ? ' error' : type === 'success' ? ' success' : '');
    entry.innerHTML = `<span class="time">${time}</span><span class="msg">${escapeHtml(msg)}</span>`;
    logList.appendChild(entry);
    logPanel.scrollTop = logPanel.scrollHeight;
  }

  function parseFeishuUrl(url) {
    const result = { baseToken: '', tableId: '', wikiToken: '', isWiki: false };
    if (!url) return result;
    try {
      const u = new URL(url);
      const baseMatch = u.pathname.match(/\/base\/([A-Za-z0-9]+)/);
      const wikiMatch = u.pathname.match(/\/wiki\/([A-Za-z0-9]+)/);
      if (baseMatch) {
        result.baseToken = baseMatch[1];
      } else if (wikiMatch) {
        result.wikiToken = wikiMatch[1];
        result.isWiki = true;
      }
      const tableParam = u.searchParams.get('table');
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
      creatorIdField: creatorIdField.value.trim() || '达人CID',
      productIdField: productIdField.value.trim() || '商品ID'
    };
  }

  let autoSaveTimer = null;
  function autoSaveConfig() {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
      const fields = readConfigFromFields();
      feishuConfig = fields;
      saveConfig();
      updateFeishuStatus();
    }, 300);
  }

  function immediateSaveConfig() {
    clearTimeout(autoSaveTimer);
    const fields = readConfigFromFields();
    feishuConfig = fields;
    saveConfig();
    updateFeishuStatus();
  }

  const configInputs = [feishuAppId, feishuAppSecret, baseToken, tableId, creatorNameField, creatorIdField, productIdField];
  configInputs.forEach(el => {
    if (el) {
      el.addEventListener('input', autoSaveConfig);
      el.addEventListener('blur', immediateSaveConfig);
    }
  });

  async function loadConfig() {
    try {
      const result = await new Promise(resolve => chrome.storage.local.get(['sampleCrawlFeishuConfig'], resolve));
      feishuConfig = result.sampleCrawlFeishuConfig || null;
      if (feishuConfig) {
        feishuAppId.value = feishuConfig.appId || '';
        feishuAppSecret.value = feishuConfig.appSecret || '';
        baseToken.value = feishuConfig.baseToken || '';
        tableId.value = feishuConfig.tableId || '';
        creatorNameField.value = feishuConfig.creatorNameField || '达人ID';
        creatorIdField.value = feishuConfig.creatorIdField || '达人CID';
        productIdField.value = feishuConfig.productIdField || '商品ID';
      }
      updateFeishuStatus();
    } catch (e) {
      feishuConfig = null;
      updateFeishuStatus();
    }
  }

  async function saveConfig() {
    await new Promise(resolve => chrome.storage.local.set({ sampleCrawlFeishuConfig: feishuConfig }, resolve));
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

  parseUrlBtn.addEventListener('click', async () => {
    const url = feishuUrl.value.trim();
    if (!url) { showStatus('请粘贴多维表格链接', 'error'); return; }
    const parsed = parseFeishuUrl(url);
    if (!parsed.baseToken && !parsed.wikiToken) { showStatus('未识别到链接，请检查链接格式', 'error'); return; }
    if (!parsed.tableId) { showStatus('未识别到 Table ID', 'error'); return; }
    tableId.value = parsed.tableId;

    if (parsed.isWiki) {
      const cfg = readConfigFromFields();
      if (!cfg.appId || !cfg.appSecret) {
        showStatus('请先填写并保存 App ID 和 App Secret，再解析 wiki 链接', 'error');
        return;
      }
      showStatus('正在解析 wiki 链接，请稍候...', 'info');
      try {
        const response = await chrome.runtime.sendMessage({
          action: 'resolveWikiToken',
          config: cfg,
          wikiToken: parsed.wikiToken
        });
        if (response && response.success) {
          baseToken.value = response.baseToken;
          showStatus('解析成功！已自动填入 Base Token 和 Table ID', 'success');
          immediateSaveConfig();
        } else {
          showStatus('解析失败：' + (response?.error || '未知错误'), 'error');
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

  function updateProgress(collected, total) {
    const pct = total === 0 ? 0 : Math.round((collected / total) * 100);
    progressFill.style.width = `${pct}%`;
    progressText.textContent = `${collected}/${total} (${pct}%)`;
  }

  function updateStats(state) {
    if (!state) return;
    statTotal.textContent = `页数: ${state.currentPage || 0}/${state.totalPages || 0}`;
    statCollected.textContent = state.collectedCount || 0;
    statAll.textContent = state.totalCount || 0;
  }

  function showResultSummary(data) {
    if (!data) return;
    resultsDiv.style.display = 'block';
    multiStats.style.display = 'flex';
    statMulti.textContent = data.multiProductCount || 0;

    const mappings = data.mapping || [];
    const multiList = data.multiProductList || [];
    const totalRows = mappings.reduce((sum, c) => sum + (c.apply_product_ids?.length || 1), 0);

    const successIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#15803d" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-top:-2px;"><path d="M20 6L9 17l-5-5"/></svg>';

    let html = `
      <div style="margin-bottom: 8px; font-weight: 500;">采集完成</div>
      <div style="font-size: 13px; line-height: 1.8;">
        <div>${successIcon} 达人数量: <strong>${mappings.length}</strong> 位</div>
        <div>${successIcon} 多商品达人: <strong>${data.multiProductCount}</strong> 位</div>
        <div>${successIcon} 写入多维表格: <strong>${totalRows}</strong> 行</div>
      </div>
    `;

    if (multiList.length > 0) {
      html += `<div style="margin-top: 12px; font-size: 13px; font-weight: 500;">多商品达人列表:</div>`;
      html += `<div style="font-size: 12px; max-height: 200px; overflow-y: auto; margin-top: 4px;">`;
      for (const m of multiList) {
        html += `<div style="padding: 2px 0;">${escapeHtml(m.creator_name)}: [${m.product_ids.join(', ')}]</div>`;
      }
      html += `</div>`;
    }

    html += `
      <div style="margin-top: 12px; font-size: 12px; color: #6b7280;">
        数据已上传到飞书多维表格，临时数据已清理
      </div>
    `;

    resultSummary.innerHTML = html;
  }

  function setRunningUI() {
    startBtn.disabled = true;
    startBtn.textContent = '采集中...';
    startBtn.style.opacity = '0.7';
    stopBtn.style.display = 'inline-block';
    progressBar.style.display = 'block';
    statsRow.style.display = 'flex';
    resultsDiv.style.display = 'none';
    multiStats.style.display = 'none';
  }

  function setStoppedUI() {
    startBtn.disabled = false;
    startBtn.textContent = '开始采集';
    startBtn.style.opacity = '1';
    stopBtn.style.display = 'none';
  }

  function startStatusPolling() {
    if (statusPollInterval) clearInterval(statusPollInterval);

    statusPollInterval = setInterval(async () => {
      try {
        const response = await chrome.runtime.sendMessage({ action: 'getSampleCrawlStatus' });
        if (!response || !response.success) return;

        const state = response.state;
        if (!state) return;

        if (state.isRunning) {
          updateProgress(state.collectedCount, state.totalCount);
          updateStats(state);
          startBtn.textContent = `${state.collectedCount}/${state.totalCount} (${state.percent}%)`;
        } else {
          if (state.percent === 100 || state.message?.includes('完成')) {
            clearInterval(statusPollInterval);
            statusPollInterval = null;
            updateProgress(state.collectedCount, state.totalCount);
            updateStats(state);
            setStoppedUI();

            if (response.result) {
              showResultSummary(response.result);
              showStatus('采集完成！数据已上传飞书', 'success');
            }
          } else if (state.message?.includes('停止')) {
            clearInterval(statusPollInterval);
            statusPollInterval = null;
            setStoppedUI();
            showStatus('采集已停止', 'info');
          } else if (state.message?.includes('上传中')) {
            startBtn.textContent = state.message;
          } else if (!state.isRunning && state.collectedCount === 0) {
            clearInterval(statusPollInterval);
            statusPollInterval = null;
            setStoppedUI();
          }
        }
      } catch (e) {
        console.error('[SampleCrawl] 轮询状态失败:', e);
      }
    }, 600);
  }

  startBtn.addEventListener('click', async () => {
    const cfg = readConfigFromFields();
    if (!cfg.baseToken || !cfg.tableId) {
      showStatus('请先配置飞书多维表格信息', 'error');
      return;
    }
    feishuConfig = cfg;
    await saveConfig();

    try {
      setRunningUI();
      log('正在启动采集...', 'info');

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const url = tab?.url || '';

      if (!url.includes('affiliate.tiktokshopglobalselling.com/product/sample-request')) {
        showStatus('请在 TikTok 联盟样品申请页面使用此功能', 'error');
        setStoppedUI();
        progressBar.style.display = 'none';
        statsRow.style.display = 'none';
        return;
      }

      const response = await chrome.runtime.sendMessage({
        action: 'startSampleCrawl',
        tabId: tab.id,
        feishuConfig: cfg
      });

      if (response && response.success) {
        log('采集已启动，正在刷新页面...', 'info');
        startStatusPolling();
      } else {
        log('启动失败: ' + (response?.error || '未知错误'), 'error');
        showStatus('启动失败: ' + (response?.error || '未知错误'), 'error');
        setStoppedUI();
        progressBar.style.display = 'none';
        statsRow.style.display = 'none';
      }
    } catch (e) {
      log('启动失败: ' + e.message, 'error');
      showStatus('启动失败: ' + e.message, 'error');
      setStoppedUI();
      progressBar.style.display = 'none';
      statsRow.style.display = 'none';
    }
  });

  stopBtn.addEventListener('click', async () => {
    try {
      stopBtn.disabled = true;
      stopBtn.textContent = '停止中...';
      await chrome.runtime.sendMessage({ action: 'stopSampleCrawl' });
      log('正在停止...', 'info');
    } catch (e) {
      console.error('[SampleCrawl] 停止失败:', e);
    }
  });

  clearBtn.addEventListener('click', async () => {
    try {
      await chrome.runtime.sendMessage({ action: 'clearSampleCrawlState' });
      resultsDiv.style.display = 'none';
      progressBar.style.display = 'none';
      statsRow.style.display = 'none';
      multiStats.style.display = 'none';
      progressFill.style.width = '0%';
      progressText.textContent = '0/0';
      statTotal.textContent = '页数: 0';
      statCollected.textContent = '0';
      statAll.textContent = '0';
      statMulti.textContent = '0';
      logPanel.style.display = 'none';
      logList.innerHTML = '';
      showStatus('已清空', 'info');
    } catch (e) {
      console.error('[SampleCrawl] 清空失败:', e);
    }
  });

  if (backBtn) {
    backBtn.addEventListener('click', () => {
      window.location.href = '../../popup.html';
    });
  }

  loadConfig();
});

(function() {
  'use strict';

  let feishuConfig = null;
  let records = [];
  let processing = false;
  let statusPollInterval = null;

  function showStatus(message, type = 'info') {
    const div = document.getElementById('bitableStatus');
    div.textContent = message;
    div.className = 'status ' + type;
    div.style.display = 'flex';
    setTimeout(() => { div.style.display = 'none'; }, 20000);
  }

  function log(msg, type = 'info') {
    const list = document.getElementById('logList');
    const panel = document.getElementById('logPanel');
    if (!list) return;
    panel.style.display = 'block';
    const time = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    const entry = document.createElement('div');
    entry.className = 'log-entry' + (type === 'error' ? ' error' : type === 'success' ? ' success' : '');
    entry.innerHTML = `<span class="time">${time}</span><span class="msg">${escapeHtml(msg)}</span>`;
    list.appendChild(entry);
    panel.scrollTop = panel.scrollHeight;
  }

  function escapeHtml(text) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return String(text).replace(/[&<>"']/g, ch => map[ch]);
  }

  function parseBitableUrl(url) {
    const result = { baseToken: '', tableId: '', wikiToken: '', isWiki: false };
    if (!url) return result;
    try {
      const u = new URL(url);
      const baseMatch = u.pathname.match(/\/base\/([A-Za-z0-9]+)/);
      const wikiMatch = u.pathname.match(/\/wiki\/([A-Za-z0-9]+)/);
      if (baseMatch) result.baseToken = baseMatch[1];
      else if (wikiMatch) { result.wikiToken = wikiMatch[1]; result.isWiki = true; }
      const tableParam = u.searchParams.get('table');
      if (tableParam) result.tableId = tableParam;
    } catch (e) { }
    return result;
  }

  async function handleParseUrl() {
    const url = document.getElementById('bitableUrl').value.trim();
    if (!url) { showStatus('请粘贴多维表格链接', 'error'); return; }
    const parsed = parseBitableUrl(url);
    if (!parsed.wikiToken && !parsed.baseToken) { showStatus('未识别到链接，请检查链接格式', 'error'); return; }
    if (!parsed.tableId) { showStatus('未识别到 Table ID', 'error'); return; }
    document.getElementById('tableId').value = parsed.tableId;
    if (parsed.baseToken) {
      document.getElementById('baseToken').value = parsed.baseToken;
      showStatus('已自动填入 Base Token 和 Table ID', 'success');
      autoSaveConfig();
    } else if (parsed.wikiToken) {
      if (!feishuConfig || !feishuConfig.appId || !feishuConfig.appSecret) {
        showStatus('请先填写并保存 App ID 和 App Secret，再解析 wiki 链接', 'error');
        return;
      }
      showStatus('正在解析 wiki 链接，请稍候...', 'info');
      try {
        const response = await chrome.runtime.sendMessage({ action: 'resolveWikiToken', config: feishuConfig, wikiToken: parsed.wikiToken });
        if (response && response.success) {
          document.getElementById('baseToken').value = response.baseToken;
          showStatus(`解析成功！${response.title ? '标题: ' + response.title : ''}`, 'success');
          autoSaveConfig();
        } else showStatus('解析失败：' + (response?.error || '未知错误'), 'error');
      } catch (err) { showStatus('解析异常：' + err.message, 'error'); }
    }
  }

  function readConfigFromFields() {
    return {
      appId: document.getElementById('feishuAppId').value.trim(),
      appSecret: document.getElementById('feishuAppSecret').value.trim(),
      baseToken: document.getElementById('baseToken').value.trim(),
      tableId: document.getElementById('tableId').value.trim(),
      videoLinkField: document.getElementById('videoLinkField').value.trim(),
      coverField: document.getElementById('coverField').value.trim()
    };
  }

  let _autoSaveTimer = null;
  function autoSaveConfig() {
    clearTimeout(_autoSaveTimer);
    _autoSaveTimer = setTimeout(() => {
      const fields = readConfigFromFields();
      if (fields.appId || fields.appSecret || fields.baseToken || fields.tableId) {
        feishuConfig = fields;
        saveConfig();
        updateStatus();
      }
    }, 500);
  }

  async function loadConfig() {
    try {
      const result = await new Promise(resolve => chrome.storage.local.get(['bitableCoverConfig'], resolve));
      feishuConfig = result.bitableCoverConfig || null;
      if (feishuConfig) {
        document.getElementById('feishuAppId').value = feishuConfig.appId || '';
        document.getElementById('feishuAppSecret').value = feishuConfig.appSecret || '';
        document.getElementById('baseToken').value = feishuConfig.baseToken || '';
        document.getElementById('tableId').value = feishuConfig.tableId || '';
        document.getElementById('videoLinkField').value = feishuConfig.videoLinkField || '视频链接';
        document.getElementById('coverField').value = feishuConfig.coverField || '视频封面';
      }
      updateStatus();
    } catch (e) { feishuConfig = null; updateStatus(); }
  }

  async function saveConfig() {
    await new Promise(resolve => chrome.storage.local.set({ bitableCoverConfig: feishuConfig }, resolve));
  }

  function updateStatus() {
    const el = document.getElementById('feishuStatus');
    if (feishuConfig && feishuConfig.baseToken) {
      el.textContent = '已配置';
      el.style.color = '#137333';
    } else { el.textContent = '未配置'; el.style.color = '#ba1a1a'; }
  }

  async function setProgress(show) {
    const bar = document.getElementById('progressBar');
    const fill = document.getElementById('progressFill');
    const text = document.getElementById('progressText');
    if (bar) bar.style.display = show ? 'block' : 'none';
    if (fill) fill.style.width = '0%';
    if (text) text.textContent = '0/0';
  }

  function updateProgress(current, total) {
    const fill = document.getElementById('progressFill');
    const text = document.getElementById('progressText');
    const pct = total === 0 ? 0 : Math.round((current / total) * 100);
    if (fill) fill.style.width = pct + '%';
    if (text) text.textContent = `${current}/${total}`;
  }

  function updateStats() {
    const total = records.length;
    const pending = records.filter(r => r.status === 'pending').length;
    const success = records.filter(r => r.status === 'success').length;
    const error = records.filter(r => r.status === 'error').length;
    document.getElementById('statTotal').innerHTML = `总记录: <strong>${total}</strong>`;
    document.getElementById('statPending').innerHTML = `待处理: <strong>${pending}</strong>`;
    document.getElementById('statSuccess').innerHTML = `成功: <strong>${success}</strong>`;
    document.getElementById('statError').innerHTML = `失败: <strong>${error}</strong>`;
    document.getElementById('statsRow').style.display = 'flex';
  }

  function resetProcessingUI() {
    processing = false;
    document.getElementById('processBtn').style.display = 'none';
    document.getElementById('stopBtn').style.display = 'none';
    document.getElementById('stopBtn').disabled = false;
    document.getElementById('scanBtn').style.display = '';
    document.getElementById('scanBtn').textContent = '扫描记录';
    document.getElementById('clearBtn').disabled = false;
  }

  async function scanRecords() {
    if (!feishuConfig || !feishuConfig.baseToken) {
      showStatus('请先配置飞书信息', 'error');
      return;
    }

    const scanBtn = document.getElementById('scanBtn');
    scanBtn.disabled = true;
    scanBtn.textContent = '正在扫描...';
    setProgress(true);
    updateProgress(0, 1);
    log('正在从多维表格读取记录...', 'info');

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'startBitableCoverScan',
        config: feishuConfig
      });
      if (!response || !response.success) {
        throw new Error(response?.error || '启动扫描失败');
      }
      startStatusPolling('scan');
    } catch (err) {
      log('扫描失败：' + err.message, 'error');
      showStatus('扫描失败：' + err.message, 'error');
      scanBtn.disabled = false;
      scanBtn.textContent = '扫描记录';
      setProgress(false);
    }
  }

  function startStatusPolling(mode) {
    if (statusPollInterval) clearInterval(statusPollInterval);

    statusPollInterval = setInterval(async () => {
      try {
        const response = await chrome.runtime.sendMessage({ action: 'getBitableCoverStatus' });
        if (!response || !response.success || !response.status) return;

        const status = response.status;

        if (mode === 'scan') {
          if (status.status === 'scanning') {
            scanBtn.textContent = '扫描中...';
          } else if (status.status === 'scan_done') {
            clearInterval(statusPollInterval);
            statusPollInterval = null;
            records = status.records || [];
            log(`扫描完成：找到 ${records.length} 条待处理记录`, records.length > 0 ? 'success' : 'info');
            updateStats();
            document.getElementById('scanBtn').style.display = 'none';
            setProgress(false);
            if (records.length > 0) {
              document.getElementById('processBtn').style.display = 'flex';
            }
          } else if (status.status === 'error') {
            clearInterval(statusPollInterval);
            statusPollInterval = null;
            log('扫描失败：' + (status.error || '未知错误'), 'error');
            showStatus('扫描失败：' + (status.error || '未知错误'), 'error');
            document.getElementById('scanBtn').disabled = false;
            document.getElementById('scanBtn').textContent = '扫描记录';
            setProgress(false);
          }
        } else if (mode === 'process') {
          if (status.status === 'processing') {
            updateProgress(status.currentIndex, status.total);
            document.getElementById('scanBtn').textContent = `处理中 ${status.currentIndex}/${status.total}`;
          } else if (status.status === 'completed') {
            clearInterval(statusPollInterval);
            statusPollInterval = null;
            records = status.records || records;
            updateProgress(status.total, status.total);
            updateStats();

            let msg = `处理完成：成功 ${status.successCount}，失败 ${status.failCount}`;
            log(msg, status.failCount === 0 ? 'success' : 'info');
            showStatus(msg, status.failCount === 0 ? 'success' : 'info');
            resetProcessingUI();
            setProgress(false);
          } else if (status.status === 'error') {
            clearInterval(statusPollInterval);
            statusPollInterval = null;
            log('处理失败：' + (status.error || '未知错误'), 'error');
            showStatus('处理失败：' + (status.error || '未知错误'), 'error');
            resetProcessingUI();
            setProgress(false);
          }
        }
      } catch (err) {
        console.error('[BitableCover] 轮询状态失败:', err);
      }
    }, 500);
  }

  async function processRecords() {
    if (processing) return;
    if (records.length === 0) {
      showStatus('没有待处理的记录', 'error');
      return;
    }
    const pendingCount = records.filter(r => r.status === 'pending').length;
    if (pendingCount === 0) {
      showStatus('所有记录已处理完毕', 'info');
      return;
    }
    if (!confirm(`确定开始处理 ${pendingCount} 条记录吗？`)) return;

    processing = true;
    document.getElementById('processBtn').style.display = 'none';
    document.getElementById('stopBtn').style.display = 'inline-flex';
    document.getElementById('scanBtn').disabled = true;
    document.getElementById('clearBtn').disabled = true;
    setProgress(true);
    updateProgress(0, 1);

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'startBitableCoverProcess',
        config: feishuConfig
      });
      if (!response || !response.success) {
        throw new Error(response?.error || '启动处理失败');
      }
      startStatusPolling('process');
    } catch (err) {
      log('启动处理失败：' + err.message, 'error');
      showStatus('启动处理失败：' + err.message, 'error');
      resetProcessingUI();
      setProgress(false);
    }
  }

  function stopProcessing() {
    chrome.runtime.sendMessage({ action: 'stopBitableCoverProcess' });
    log('正在停止（等待当前任务完成）...', 'info');
    document.getElementById('stopBtn').disabled = true;
  }

  function clearAll() {
    if (processing) return;
    records = [];
    document.getElementById('statsRow').style.display = 'none';
    document.getElementById('scanBtn').style.display = '';
    document.getElementById('scanBtn').textContent = '扫描记录';
    document.getElementById('processBtn').style.display = 'none';
    document.getElementById('stopBtn').style.display = 'none';
    document.getElementById('stopBtn').disabled = false;
    document.getElementById('logPanel').style.display = 'none';
    document.getElementById('logList').innerHTML = '';
    chrome.runtime.sendMessage({ action: 'clearBitableCoverStatus' });
    showStatus('已清空', 'success');
  }

  async function checkRunningTask() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getBitableCoverStatus' });
      if (response && response.success && response.status) {
        const status = response.status;
        if (status.status === 'processing') {
          processing = true;
          document.getElementById('processBtn').style.display = 'none';
          document.getElementById('stopBtn').style.display = 'inline-flex';
          document.getElementById('scanBtn').disabled = true;
          document.getElementById('clearBtn').disabled = true;
          setProgress(true);
          if (status.records) records = status.records;
          startStatusPolling('process');
        } else if (status.status === 'scan_done' && status.records) {
          records = status.records;
          document.getElementById('scanBtn').style.display = 'none';
          updateStats();
          if (records.filter(r => r.status === 'pending').length > 0) {
            document.getElementById('processBtn').style.display = 'flex';
          }
        } else if (status.status === 'completed' && status.records) {
          records = status.records;
          updateStats();
        }
      }
    } catch (e) {
      console.error('[BitableCover] 检查任务状态失败:', e);
    }
  }

  function init() {
    document.getElementById('backBtn').addEventListener('click', () => window.location.href = '../../popup.html');
    document.getElementById('parseUrlBtn').addEventListener('click', handleParseUrl);

    const autoSaveFields = ['feishuAppId', 'feishuAppSecret', 'baseToken', 'tableId', 'videoLinkField', 'coverField'];
    for (const id of autoSaveFields) {
      document.getElementById(id).addEventListener('input', autoSaveConfig);
    }

    document.getElementById('scanBtn').addEventListener('click', scanRecords);
    document.getElementById('processBtn').addEventListener('click', processRecords);
    document.getElementById('stopBtn').addEventListener('click', stopProcessing);
    document.getElementById('clearBtn').addEventListener('click', clearAll);

    loadConfig();
    checkRunningTask();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

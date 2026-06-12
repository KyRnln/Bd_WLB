// 备份模块 - 数据备份、恢复、WebDAV同步

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

(function() {
  'use strict';

  function getStorage() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      return chrome.storage.local;
    }
    console.error('存储不可用');
    return null;
  }

  const storageAPI = getStorage();
  if (!storageAPI) return;

  function showStatus(message, type = 'info', elementId = 'backupStatus') {
    let statusDiv = document.getElementById(elementId);
    if (!statusDiv) {
      statusDiv = document.getElementById('status');
    }
    if (!statusDiv) {
      console.error(`找不到状态提示元素: ${elementId}`);
      return;
    }
    const icons = {
      success: '<svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" style="flex-shrink:0"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>',
      error: '<svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" style="flex-shrink:0"><path stroke-linecap="round" stroke-linejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>',
      info: '<svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" style="flex-shrink:0"><path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" /></svg>'
    };
    statusDiv.innerHTML = (icons[type] || icons.info) + '<span>' + message + '</span>';
    statusDiv.className = 'status ' + type;
    statusDiv.style.display = 'flex';
    setTimeout(() => {
      statusDiv.style.display = 'none';
    }, 20000);
  }

  async function getAllData() {
    return new Promise(resolve => {
      storageAPI.get([
        'savedPhrases',
        'savedTags',
        'activeTagId',
        'creatorBlacklist',
        'translateConfig',
        'webdavConfig',
        'feishuConfig',
        'feishuConfigs',
        'hiddenFeishuConfig',
        'orderFeishuConfig',
        'sampleCrawlFeishuConfig',
        'bitableCoverConfig'
      ], resolve);
    });
  }

  async function saveAllData(data) {
    return new Promise(resolve => {
      storageAPI.set({
        savedPhrases: data.phrases || [],
        savedTags: data.tags || [],
        activeTagId: data.activeTagId || '__ALL__',
        translateConfig: data.translateConfig || null,
        feishuConfig: data.feishuConfig || null,
        feishuConfigs: data.feishuConfigs || null,
        hiddenFeishuConfig: data.hiddenFeishuConfig || null,
        orderFeishuConfig: data.orderFeishuConfig || null,
        sampleCrawlFeishuConfig: data.sampleCrawlFeishuConfig || null,
        bitableCoverConfig: data.bitableCoverConfig || null
      }, resolve);
    });
  }

  function exportData() {
    return {
      version: '1.1',
      exportTime: new Date().toISOString(),
      phrases: [],
      tags: [],
      activeTagId: '__ALL__',
      translateConfig: null
    };
  }

  async function handleExport() {
    try {
      const result = await getAllData();
      const data = {
        version: '1.3',
        exportTime: new Date().toISOString(),
        phrases: result.savedPhrases || [],
        tags: result.savedTags || [],
        activeTagId: result.activeTagId || '__ALL__',
        translateConfig: result.translateConfig || null,
        feishuConfig: result.feishuConfig || null,
        feishuConfigs: result.feishuConfigs || null,
        hiddenFeishuConfig: result.hiddenFeishuConfig || null,
        orderFeishuConfig: result.orderFeishuConfig || null,
        sampleCrawlFeishuConfig: result.sampleCrawlFeishuConfig || null,
        bitableCoverConfig: result.bitableCoverConfig || null
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `wlb_backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showStatus('数据已导出', 'success', 'webdavStatus');
    } catch (err) {
      console.error('导出失败', err);
      showStatus('导出失败', 'error', 'webdavStatus');
    }
  }

  async function handleImport() {
    const importDataFile = document.getElementById('importDataFile');
    if (!importDataFile) return;

    const file = importDataFile.files[0];
    if (!file) {
      showStatus('请选择文件', 'error', 'webdavStatus');
      return;
    }

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      await saveAllData(data);

      showStatus('数据已导入，正在刷新...', 'success', 'webdavStatus');
      setTimeout(() => window.location.reload(), 1000);
    } catch (err) {
      console.error('导入失败', err);
      showStatus('导入失败，请检查文件格式', 'error', 'webdavStatus');
    }
  }

  async function handleBackupToWebDAV() {
    const webdavUrl = document.getElementById('webdavUrl');
    const webdavUsername = document.getElementById('webdavUsername');
    const webdavPassword = document.getElementById('webdavPassword');

    const url = webdavUrl ? webdavUrl.value.trim() : '';
    const username = webdavUsername ? webdavUsername.value.trim() : '';
    const password = webdavPassword ? webdavPassword.value.trim() : '';

    if (!url || !username || !password) {
      showStatus('请填写WebDAV配置', 'error', 'webdavStatus');
      return;
    }

    try {
      const result = await getAllData();
      const data = {
        version: '1.3',
        exportTime: new Date().toISOString(),
        phrases: result.savedPhrases || [],
        tags: result.savedTags || [],
        activeTagId: result.activeTagId || '__ALL__',
        translateConfig: result.translateConfig || null,
        feishuConfig: result.feishuConfig || null,
        feishuConfigs: result.feishuConfigs || null,
        hiddenFeishuConfig: result.hiddenFeishuConfig || null,
        orderFeishuConfig: result.orderFeishuConfig || null,
        sampleCrawlFeishuConfig: result.sampleCrawlFeishuConfig || null,
        bitableCoverConfig: result.bitableCoverConfig || null
      };

      const fileUrl = url + 'wlb_backup.json';

      let response = await fetch(fileUrl, {
        method: 'PUT',
        headers: {
          'Authorization': 'Basic ' + btoa(username + ':' + password),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data, null, 2)
      });

      // If 404 or 409, the directory may not exist; try MKCOL to create it, then retry
      if (response.status === 404 || response.status === 409) {
        const dirUrl = fileUrl.substring(0, fileUrl.lastIndexOf('/') + 1);
        const rootPattern = /^https?:\/\/[^\/]+\/dav\/$/i;
        const isRoot = rootPattern.test(dirUrl);
        if (!isRoot) {
          const mkcolRes = await fetch(dirUrl, {
            method: 'MKCOL',
            headers: {
              'Authorization': 'Basic ' + btoa(username + ':' + password)
            }
          });
          if (mkcolRes.ok || mkcolRes.status === 405 || mkcolRes.status === 201) {
            response = await fetch(fileUrl, {
              method: 'PUT',
              headers: {
                'Authorization': 'Basic ' + btoa(username + ':' + password),
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(data, null, 2)
            });
          }
        }
      }

      if (response.ok) {
        await new Promise(resolve => storageAPI.set({ webdavConfig: { url, username, password } }, resolve));
        showStatus('已备份到WebDAV', 'success', 'webdavStatus');
      } else if (response.status === 404 || response.status === 409) {
        showStatus('备份失败: 目录不存在，请在坚果云网页端手动创建文件夹 (如 wlb_backup)，然后将服务器地址改为对应的子目录路径', 'error', 'webdavStatus');
      } else {
        showStatus(`备份失败: ${response.status}`, 'error', 'webdavStatus');
      }
    } catch (err) {
      console.error('WebDAV备份失败', err);
      showStatus('备份失败，请检查网络和配置', 'error', 'webdavStatus');
    }
  }

  async function handleRestoreFromWebDAV() {
    const webdavUrl = document.getElementById('webdavUrl');
    const webdavUsername = document.getElementById('webdavUsername');
    const webdavPassword = document.getElementById('webdavPassword');

    const url = webdavUrl ? webdavUrl.value.trim() : '';
    const username = webdavUsername ? webdavUsername.value.trim() : '';
    const password = webdavPassword ? webdavPassword.value.trim() : '';

    if (!url || !username || !password) {
      showStatus('请填写WebDAV配置', 'error', 'webdavStatus');
      return;
    }

    try {
      const response = await fetch(url + 'wlb_backup.json', {
        method: 'GET',
        headers: {
          'Authorization': 'Basic ' + btoa(username + ':' + password)
        }
      });

      if (response.ok) {
        const data = await response.json();

        await saveAllData(data);
        await new Promise(resolve => storageAPI.set({ webdavConfig: { url, username, password } }, resolve));

        showStatus('已从WebDAV恢复，正在刷新...', 'success', 'webdavStatus');
        setTimeout(() => window.location.reload(), 1000);
      } else if (response.status === 404) {
        showStatus('恢复失败: 备份文件不存在，请先备份', 'error', 'webdavStatus');
      } else {
        showStatus(`恢复失败: ${response.status}`, 'error', 'webdavStatus');
      }
    } catch (err) {
      console.error('WebDAV恢复失败', err);
      showStatus('恢复失败，请检查网络和配置', 'error', 'webdavStatus');
    }
  }

  async function handleInitApp() {
    if (!confirm('确定要初始化应用吗？这将重置所有设置但保留数据。')) return;

    const result = await getAllData();

    await new Promise(resolve => storageAPI.set({
      activeTagId: '__ALL__',
      savedPhrases: result.savedPhrases || [],
      savedTags: result.savedTags || [{ id: 'default', name: '默认', createdAt: Date.now(), updatedAt: Date.now() }],
      savedCreators: result.savedCreators || [],
      creatorBlacklist: result.creatorBlacklist || []
    }, resolve));

    showStatus('应用已初始化', 'success', 'webdavStatus');
    setTimeout(() => window.location.reload(), 1000);
  }

  async function handleClearAllData() {
    if (!confirm('确定要清除所有数据吗？此操作不可恢复！')) return;
    if (!confirm('再次确认：这将删除所有短语、标签、达人和隐藏记录！')) return;

    await new Promise(resolve => storageAPI.clear(resolve));
    showStatus('所有数据已清除', 'success', 'webdavStatus');
    setTimeout(() => window.location.reload(), 1000);
  }

  async function loadWebdavConfig() {
    try {
      const result = await new Promise(resolve => storageAPI.get(['webdavConfig'], resolve));
      if (result.webdavConfig) {
        const webdavUrl = document.getElementById('webdavUrl');
        const webdavUsername = document.getElementById('webdavUsername');
        const webdavPassword = document.getElementById('webdavPassword');

        if (webdavUrl) webdavUrl.value = result.webdavConfig.url || 'https://dav.jianguoyun.com/dav/wlb_backup/';
        if (webdavUsername) webdavUsername.value = result.webdavConfig.username || '';
        if (webdavPassword) webdavPassword.value = result.webdavConfig.password || '';
      }
    } catch (e) {
      console.error('加载WebDAV配置失败', e);
    }
  }

  function bindEvents() {
    const backBtn = document.getElementById('backBtn');
    const exportDataBtn = document.getElementById('exportDataBtn');
    const importDataBtn = document.getElementById('importDataBtn');
    const backupToWebdavBtn = document.getElementById('backupToWebdavBtn');
    const restoreFromWebdavBtn = document.getElementById('restoreFromWebdavBtn');
    const initAppBtn = document.getElementById('initAppBtn');
    const clearAllDataBtn = document.getElementById('clearAllDataBtn');

    if (backBtn) {
      backBtn.addEventListener('click', () => {
        window.location.href = '../popup.html';
      });
    }

    if (exportDataBtn) {
      exportDataBtn.addEventListener('click', handleExport);
    }
    if (importDataBtn) {
      importDataBtn.addEventListener('click', handleImport);
    }

    const selectFileBtn = document.getElementById('selectFileBtn');
    const importDataFile = document.getElementById('importDataFile');
    const fileNameDisplay = document.getElementById('fileNameDisplay');
    if (selectFileBtn && importDataFile) {
      selectFileBtn.addEventListener('click', () => {
        importDataFile.click();
      });
      importDataFile.addEventListener('change', () => {
        if (importDataFile.files.length > 0) {
          fileNameDisplay.textContent = importDataFile.files[0].name;
          fileNameDisplay.style.color = '#1a1a1a';
        } else {
          fileNameDisplay.textContent = '未选择文件';
          fileNameDisplay.style.color = '#6b7280';
        }
      });
    }
    if (backupToWebdavBtn) {
      backupToWebdavBtn.addEventListener('click', handleBackupToWebDAV);
    }
    if (restoreFromWebdavBtn) {
      restoreFromWebdavBtn.addEventListener('click', handleRestoreFromWebDAV);
    }
    if (initAppBtn) {
      initAppBtn.addEventListener('click', handleInitApp);
    }
    if (clearAllDataBtn) {
      clearAllDataBtn.addEventListener('click', handleClearAllData);
    }
  }

  function initBackupModule() {
    loadWebdavConfig();
    bindEvents();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBackupModule);
  } else {
    initBackupModule();
  }

  window.BackupModule = {
    exportData: handleExport,
    importData: handleImport,
    backupToWebDAV: handleBackupToWebDAV,
    restoreFromWebDAV: handleRestoreFromWebDAV,
    initApp: handleInitApp,
    clearAllData: handleClearAllData
  };
})();

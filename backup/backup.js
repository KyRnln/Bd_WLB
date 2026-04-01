// 备份模块 - 数据备份、恢复、WebDAV同步

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
    statusDiv.textContent = message;
    statusDiv.className = 'status ' + type;
    statusDiv.style.display = 'block';
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
        'savedCreators',
        'creatorBlacklist',
        'translateConfig',
        'webdavConfig'
      ], resolve);
    });
  }

  async function saveAllData(data) {
    return new Promise(resolve => {
      storageAPI.set({
        savedPhrases: data.phrases || [],
        savedTags: data.tags || [],
        activeTagId: data.activeTagId || '__ALL__',
        savedCreators: data.creators || [],
        creatorBlacklist: data.creatorBlacklist || [],
        translateConfig: data.translateConfig || null
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
      creators: [],
      creatorBlacklist: [],
      translateConfig: null
    };
  }

  async function handleExport() {
    try {
      const result = await getAllData();
      const data = {
        version: '1.1',
        exportTime: new Date().toISOString(),
        phrases: result.savedPhrases || [],
        tags: result.savedTags || [],
        activeTagId: result.activeTagId || '__ALL__',
        creators: result.savedCreators || [],
        creatorBlacklist: result.creatorBlacklist || [],
        translateConfig: result.translateConfig || null
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `wlb_backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showStatus('✅ 数据已导出', 'success', 'webdavStatus');
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

      showStatus('✅ 数据已导入，正在刷新...', 'success', 'webdavStatus');
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
        version: '1.1',
        exportTime: new Date().toISOString(),
        phrases: result.savedPhrases || [],
        tags: result.savedTags || [],
        activeTagId: result.activeTagId || '__ALL__',
        creators: result.savedCreators || [],
        creatorBlacklist: result.creatorBlacklist || [],
        translateConfig: result.translateConfig || null
      };

      const response = await fetch(url + 'wlb_backup.json', {
        method: 'PUT',
        headers: {
          'Authorization': 'Basic ' + btoa(username + ':' + password),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data, null, 2)
      });

      if (response.ok) {
        await new Promise(resolve => storageAPI.set({ webdavConfig: { url, username, password } }, resolve));
        showStatus('✅ 已备份到WebDAV', 'success', 'webdavStatus');
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

        showStatus('✅ 已从WebDAV恢复，正在刷新...', 'success', 'webdavStatus');
        setTimeout(() => window.location.reload(), 1000);
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

    showStatus('✅ 应用已初始化', 'success', 'webdavStatus');
    setTimeout(() => window.location.reload(), 1000);
  }

  async function handleClearAllData() {
    if (!confirm('确定要清除所有数据吗？此操作不可恢复！')) return;
    if (!confirm('再次确认：这将删除所有短语、标签、达人和隐藏记录！')) return;

    await new Promise(resolve => storageAPI.clear(resolve));
    showStatus('✅ 所有数据已清除', 'success', 'webdavStatus');
    setTimeout(() => window.location.reload(), 1000);
  }

  async function loadWebdavConfig() {
    try {
      const result = await new Promise(resolve => storageAPI.get(['webdavConfig'], resolve));
      if (result.webdavConfig) {
        const webdavUrl = document.getElementById('webdavUrl');
        const webdavUsername = document.getElementById('webdavUsername');
        const webdavPassword = document.getElementById('webdavPassword');

        if (webdavUrl) webdavUrl.value = result.webdavConfig.url || 'https://dav.jianguoyun.com/dav/';
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

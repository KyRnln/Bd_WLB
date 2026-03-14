// Popup 主逻辑 - 数据备份等功能

function getStorage() {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    return chrome.storage.local;
  }
  console.error('存储不可用');
  return null;
}

document.addEventListener('DOMContentLoaded', () => {
  const storageAPI = getStorage();
  if (!storageAPI) return;

  // 工具按钮导航
  const btnCover = document.getElementById('btnCover');
  const btnCid = document.getElementById('btnCid');
  const btnCidToName = document.getElementById('btnCidToName');
  const btnOrder = document.getElementById('btnOrder');

  if (btnCover) {
    btnCover.addEventListener('click', () => {
      window.location.href = 'cover/cover.html';
    });
  }
  if (btnCid) {
    btnCid.addEventListener('click', () => {
      window.location.href = 'username_avatarcid/username_avatarcid.html';
    });
  }
  if (btnCidToName) {
    btnCidToName.addEventListener('click', () => {
      window.location.href = 'cid_to_name/cid_to_name.html';
    });
  }
  if (btnOrder) {
    btnOrder.addEventListener('click', () => {
      window.location.href = 'order/order.html';
    });
  }

  // 界面元素
  const clearAllDataBtn = document.getElementById('clearAllDataBtn');
  const backupBtn = document.getElementById('backupBtn');
  const initAppBtn = document.getElementById('initAppBtn');
  const backupDialog = document.getElementById('backupDialog');
  const exportDataBtn = document.getElementById('exportDataBtn');
  const importDataFile = document.getElementById('importDataFile');
  const importDataBtn = document.getElementById('importDataBtn');
  const closeBackupDialogBtn = document.getElementById('closeBackupDialogBtn');

  // WebDAV
  const webdavUrl = document.getElementById('webdavUrl');
  const webdavUsername = document.getElementById('webdavUsername');
  const webdavPassword = document.getElementById('webdavPassword');
  const backupToWebdavBtn = document.getElementById('backupToWebdavBtn');
  const restoreFromWebdavBtn = document.getElementById('restoreFromWebdavBtn');
  const webdavStatus = document.getElementById('webdavStatus');

  // 状态提示
  function showStatus(message, type = 'info', elementId = 'status') {
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
    }, 1800);
  }

  // 加载WebDAV配置
  async function loadWebdavConfig() {
    try {
      const result = await new Promise(resolve => 
        storageAPI.get(['webdavConfig'], resolve)
      );
      if (result.webdavConfig) {
        if (webdavUrl) webdavUrl.value = result.webdavConfig.url || 'https://dav.jianguoyun.com/dav/';
        if (webdavUsername) webdavUsername.value = result.webdavConfig.username || '';
        if (webdavPassword) webdavPassword.value = result.webdavConfig.password || '';
      }
    } catch (e) {
      console.error('加载WebDAV配置失败', e);
    }
  }

  // 备份弹窗
  if (backupBtn && backupDialog) {
    backupBtn.addEventListener('click', () => backupDialog.classList.add('show'));
  }
  if (closeBackupDialogBtn && backupDialog) {
    closeBackupDialogBtn.addEventListener('click', () => backupDialog.classList.remove('show'));
  }

  // 导出数据
  if (exportDataBtn) {
    exportDataBtn.addEventListener('click', async () => {
      try {
        const result = await new Promise(resolve => 
          storageAPI.get(['savedPhrases', 'savedTags', 'activeTagId', 'savedCreators', 'creatorBlacklist'], resolve)
        );
        const data = {
          version: '1.0',
          exportTime: new Date().toISOString(),
          phrases: result.savedPhrases || [],
          tags: result.savedTags || [],
          activeTagId: result.activeTagId || '__ALL__',
          creators: result.savedCreators || [],
          creatorBlacklist: result.creatorBlacklist || []
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
    });
  }

  // 导入数据
  if (importDataBtn && importDataFile) {
    importDataBtn.addEventListener('click', async () => {
      const file = importDataFile.files[0];
      if (!file) {
        showStatus('请选择文件', 'error', 'webdavStatus');
        return;
      }

      try {
        const text = await file.text();
        const data = JSON.parse(text);

        await new Promise(resolve => storageAPI.set({
          savedPhrases: data.phrases || [],
          savedTags: data.tags || [],
          activeTagId: data.activeTagId || '__ALL__',
          savedCreators: data.creators || [],
          creatorBlacklist: data.creatorBlacklist || []
        }, resolve));

        showStatus('✅ 数据已导入，正在刷新...', 'success', 'webdavStatus');
        setTimeout(() => window.location.reload(), 1000);
      } catch (err) {
        console.error('导入失败', err);
        showStatus('导入失败，请检查文件格式', 'error', 'webdavStatus');
      }
    });
  }

  // WebDAV 备份
  if (backupToWebdavBtn) {
    backupToWebdavBtn.addEventListener('click', async () => {
      const url = webdavUrl ? webdavUrl.value.trim() : '';
      const username = webdavUsername ? webdavUsername.value.trim() : '';
      const password = webdavPassword ? webdavPassword.value.trim() : '';

      if (!url || !username || !password) {
        showStatus('请填写WebDAV配置', 'error', 'webdavStatus');
        return;
      }

      try {
        const result = await new Promise(resolve => 
          storageAPI.get(['savedPhrases', 'savedTags', 'activeTagId', 'savedCreators', 'creatorBlacklist'], resolve)
        );
        const data = {
          version: '1.0',
          exportTime: new Date().toISOString(),
          phrases: result.savedPhrases || [],
          tags: result.savedTags || [],
          activeTagId: result.activeTagId || '__ALL__',
          creators: result.savedCreators || [],
          creatorBlacklist: result.creatorBlacklist || []
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
    });
  }

  // WebDAV 恢复
  if (restoreFromWebdavBtn) {
    restoreFromWebdavBtn.addEventListener('click', async () => {
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

          await new Promise(resolve => storageAPI.set({
            savedPhrases: data.phrases || [],
            savedTags: data.tags || [],
            activeTagId: data.activeTagId || '__ALL__',
            savedCreators: data.creators || [],
            creatorBlacklist: data.creatorBlacklist || [],
            webdavConfig: { url, username, password }
          }, resolve));

          showStatus('✅ 已从WebDAV恢复，正在刷新...', 'success', 'webdavStatus');
          setTimeout(() => window.location.reload(), 1000);
        } else {
          showStatus(`恢复失败: ${response.status}`, 'error', 'webdavStatus');
        }
      } catch (err) {
        console.error('WebDAV恢复失败', err);
        showStatus('恢复失败，请检查网络和配置', 'error', 'webdavStatus');
      }
    });
  }

  // 初始化应用
  if (initAppBtn) {
    initAppBtn.addEventListener('click', async () => {
      if (!confirm('确定要初始化应用吗？这将重置所有设置但保留数据。')) return;

      const result = await new Promise(resolve => 
        storageAPI.get(['savedPhrases', 'savedTags', 'savedCreators', 'creatorBlacklist'], resolve)
      );

      await new Promise(resolve => storageAPI.set({
        activeTagId: '__ALL__',
        savedPhrases: result.savedPhrases || [],
        savedTags: result.savedTags || [{ id: 'default', name: '默认', createdAt: Date.now(), updatedAt: Date.now() }],
        savedCreators: result.savedCreators || [],
        creatorBlacklist: result.creatorBlacklist || []
      }, resolve));

      showStatus('✅ 应用已初始化', 'success', 'dataCardStatus');
      setTimeout(() => window.location.reload(), 1000);
    });
  }

  // 清除所有数据
  if (clearAllDataBtn) {
    clearAllDataBtn.addEventListener('click', async () => {
      if (!confirm('确定要清除所有数据吗？此操作不可恢复！')) return;
      if (!confirm('再次确认：这将删除所有短语、标签、达人和隐藏记录！')) return;

      await new Promise(resolve => storageAPI.clear(resolve));
      showStatus('✅ 所有数据已清除', 'success', 'dataCardStatus');
      setTimeout(() => window.location.reload(), 1000);
    });
  }

  // 加载WebDAV配置
  loadWebdavConfig();
});

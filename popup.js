// Popup 主逻辑 - 工具按钮导航

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

  const btnCover = document.getElementById('btnCover');
  const btnCid = document.getElementById('btnCid');
  const btnCidToName = document.getElementById('btnCidToName');
  const btnOrder = document.getElementById('btnOrder');

  const btnCoverOriginalText = btnCover ? btnCover.textContent : '📹 获取视频封面';
  const btnCidOriginalText = btnCid ? btnCid.textContent : '👤 获取头像/CID';
  const btnCidToNameOriginalText = btnCidToName ? btnCidToName.textContent : '🔍 通过CID获取达人信息';
  const btnOrderOriginalText = btnOrder ? btnOrder.textContent : '📦 获取订单履约情况';

  function setButtonRunning(btn, text) {
    if (!btn) return;
    btn.textContent = text;
    btn.style.background = '#3b82f6';
    btn.style.color = '#fff';
  }

  function resetButton(btn, originalText) {
    if (!btn) return;
    btn.textContent = originalText;
    btn.style.background = '';
    btn.style.color = '';
  }

  async function updateCoverButtonStatus() {
    if (!btnCover) return;
    try {
      const result = await new Promise(resolve =>
        storageAPI.get(['coverFetchStatus'], resolve)
      );
      const status = result.coverFetchStatus;
      if (status && status.status === 'running') {
        const { currentIndex, total, successCount, failCount } = status;
        setButtonRunning(btnCover, `${currentIndex}/${total} ✅${successCount} ❌${failCount}`);
      } else {
        resetButton(btnCover, btnCoverOriginalText);
      }
    } catch (e) {
      resetButton(btnCover, btnCoverOriginalText);
    }
  }

  async function updateCidButtonStatus() {
    if (!btnCid) return;
    try {
      const result = await new Promise(resolve =>
        storageAPI.get(['batchSearchStatus'], resolve)
      );
      const status = result.batchSearchStatus;
      if (status && status.status === 'running') {
        const { currentIndex, total, successCount, failCount } = status;
        setButtonRunning(btnCid, `${currentIndex}/${total} ✅${successCount} ❌${failCount}`);
      } else {
        resetButton(btnCid, btnCidOriginalText);
      }
    } catch (e) {
      resetButton(btnCid, btnCidOriginalText);
    }
  }

  async function updateCidToNameButtonStatus() {
    if (!btnCidToName) return;
    try {
      const result = await new Promise(resolve =>
        storageAPI.get(['batchQueryState_cidToName'], resolve)
      );
      const status = result.batchQueryState_cidToName;
      if (status && status.isRunning) {
        const { currentIndex, total, successCount, failCount } = status;
        setButtonRunning(btnCidToName, `${currentIndex}/${total} ✅${successCount} ❌${failCount}`);
      } else {
        resetButton(btnCidToName, btnCidToNameOriginalText);
      }
    } catch (e) {
      resetButton(btnCidToName, btnCidToNameOriginalText);
    }
  }

  async function updateOrderButtonStatus() {
    if (!btnOrder) return;
    try {
      const result = await new Promise(resolve =>
        storageAPI.get(['orderQueryState'], resolve)
      );
      const status = result.orderQueryState;
      if (status && status.isRunning) {
        const { currentIndex, total, processedCount, failedCount } = status;
        setButtonRunning(btnOrder, `${currentIndex}/${total} ✅${processedCount || 0} ❌${failedCount || 0}`);
      } else {
        resetButton(btnOrder, btnOrderOriginalText);
      }
    } catch (e) {
      resetButton(btnOrder, btnOrderOriginalText);
    }
  }

  updateCoverButtonStatus();
  updateCidButtonStatus();
  updateCidToNameButtonStatus();
  updateOrderButtonStatus();

  storageAPI.onChanged.addListener((changes, area) => {
    if (area === 'local') {
      if (changes.coverFetchStatus) updateCoverButtonStatus();
      if (changes.batchSearchStatus) updateCidButtonStatus();
      if (changes.batchQueryState_cidToName) updateCidToNameButtonStatus();
      if (changes.orderQueryState) updateOrderButtonStatus();
    }
  });

  if (btnCover) {
    btnCover.addEventListener('click', () => {
      window.location.href = 'quick_module/cover/cover.html';
    });
  }
  if (btnCid) {
    btnCid.addEventListener('click', () => {
      window.location.href = 'quick_module/username_avatarcid/username_avatarcid.html';
    });
  }
  if (btnCidToName) {
    btnCidToName.addEventListener('click', () => {
      window.location.href = 'quick_module/cid_to_name/cid_to_name.html';
    });
  }
  if (btnOrder) {
    btnOrder.addEventListener('click', () => {
      window.location.href = 'quick_module/order/order.html';
    });
  }

  const btnBitableCover = document.getElementById('btnBitableCover');
  if (btnBitableCover) {
    btnBitableCover.addEventListener('click', () => {
      window.location.href = 'quick_module/bitable_cover/bitable_cover.html';
    });
  }

  const btnBackup = document.getElementById('btnBackup');
  if (btnBackup) {
    btnBackup.addEventListener('click', () => {
      window.location.href = 'backup/backup.html';
    });
  }

  const btnTranslateNow = document.getElementById('btnTranslateNow');
  if (btnTranslateNow) {
    btnTranslateNow.addEventListener('click', () => {
      window.location.href = 'translate/translate_now.html';
    });
  }

  const btnTranslate = document.getElementById('btnTranslate');
  if (btnTranslate) {
    btnTranslate.addEventListener('click', () => {
      window.location.href = 'translate/translate.html';
    });
  }

  async function loadTranslateModelInfo() {
    const modelInfoEl = document.getElementById('translateModelInfo');
    if (!modelInfoEl) return;

    try {
      const result = await storageAPI.get(['translateConfig']);
      const config = result.translateConfig;

      if (config && config.apiKey && config.modelName) {
        const providerNames = {
          qwen: '通义千问',
          openai: 'OpenAI',
          deepseek: 'DeepSeek',
          custom: '自定义'
        };
        const providerName = providerNames[config.provider] || config.provider;
        modelInfoEl.textContent = `${providerName} - ${config.modelName}`;
        modelInfoEl.style.color = '#1890ff';
      } else {
        modelInfoEl.textContent = '未配置';
        modelInfoEl.style.color = '#999';
      }
    } catch (e) {
      modelInfoEl.textContent = '未配置';
      modelInfoEl.style.color = '#999';
    }
  }
  loadTranslateModelInfo();

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.translateConfig) {
      loadTranslateModelInfo();
    }
  });

  async function updatePopupCreatorStats() {
    try {
      const result = await new Promise(resolve =>
        storageAPI.get(['savedCreators'], resolve)
      );
      const creators = Array.isArray(result.savedCreators) ? result.savedCreators : [];
      const totalEl = document.getElementById('popupTotalCount');
      const lostEl = document.getElementById('popupLostCount');
      const perfEl = document.getElementById('popupPerfCount');
      if (totalEl) totalEl.textContent = creators.length;
      if (lostEl) lostEl.textContent = creators.filter(c => c.tag === '流失达人').length;
      if (perfEl) perfEl.textContent = creators.filter(c => c.tag === '绩效达人').length;
    } catch (e) {
      console.error('更新达人统计失败', e);
    }
  }
  updatePopupCreatorStats();

  storageAPI.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.savedCreators) {
      updatePopupCreatorStats();
    }
  });

  async function updatePhraseShortcutHint() {
    const hintEl = document.getElementById('phraseShortcutHint');
    if (!hintEl) return;
    try {
      const commands = await chrome.commands.getAll();
      const triggerCmd = commands.find(c => c.name === 'triggerPhraseSelector');
      if (triggerCmd && triggerCmd.shortcut) {
        hintEl.textContent = `快捷短语 ${triggerCmd.shortcut} 触发`;
      } else {
        hintEl.textContent = '快捷短语 (未设置快捷键)';
      }
    } catch (e) {
      hintEl.textContent = '快捷短语输入"/"触发';
    }
  }
  updatePhraseShortcutHint();
});

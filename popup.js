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

  const btnOrder = document.getElementById('btnOrder');

  const btnSampleCrawl = document.getElementById('btnSampleCrawl');
  const btnOrderOriginalText = btnOrder ? btnOrder.textContent : '订单履约情况';
  const btnSampleCrawlOriginalText = btnSampleCrawl ? btnSampleCrawl.textContent : '样品申请采集';

  function setButtonRunning(btn, text) {
    if (!btn) return;
    btn.textContent = text;
    btn.style.background = '#e8f0fe';
    btn.style.color = '#1660c1';
    btn.style.borderColor = '#1660c1';
  }

  function resetButton(btn, originalText) {
    if (!btn) return;
    btn.textContent = originalText;
    btn.style.background = '';
    btn.style.color = '';
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
        setButtonRunning(btnOrder, `${currentIndex}/${total} ${processedCount || 0} ${failedCount || 0}`);
      } else {
        resetButton(btnOrder, btnOrderOriginalText);
      }
    } catch (e) {
      resetButton(btnOrder, btnOrderOriginalText);
    }
  }

  async function updateSampleCrawlButtonStatus() {
    if (!btnSampleCrawl) return;
    try {
      const result = await new Promise(resolve =>
        storageAPI.get(['sampleCrawlState'], resolve)
      );
      const status = result.sampleCrawlState;
      if (status && status.isRunning) {
        setButtonRunning(btnSampleCrawl, `${status.collectedCount || 0}/${status.totalCount || 0}`);
      } else {
        resetButton(btnSampleCrawl, btnSampleCrawlOriginalText);
      }
    } catch (e) {
      resetButton(btnSampleCrawl, btnSampleCrawlOriginalText);
    }
  }

  updateOrderButtonStatus();
  updateSampleCrawlButtonStatus();

  storageAPI.onChanged.addListener((changes, area) => {
    if (area === 'local') {
      if (changes.orderQueryState) updateOrderButtonStatus();
      if (changes.sampleCrawlState) updateSampleCrawlButtonStatus();
    }
  });

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

  if (btnSampleCrawl) {
    btnSampleCrawl.addEventListener('click', () => {
      window.location.href = 'quick_module/sample_crawl/sample_crawl.html';
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
      const reconnectEl = document.getElementById('popupReconnectCount');
      if (totalEl) totalEl.textContent = creators.length;
      if (lostEl) lostEl.textContent = creators.filter(c => c.tag === '流失达人').length;
      if (perfEl) perfEl.textContent = creators.filter(c => c.tag === '绩效达人').length;
      if (reconnectEl) reconnectEl.textContent = creators.filter(c => c.tag === '复联达人').length;
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

  async function updateTranslateShortcutHint() {
    const hintEl = document.getElementById('translateShortcutHint');
    if (!hintEl) return;
    try {
      const commands = await chrome.commands.getAll();
      const triggerCmd = commands.find(c => c.name === 'triggerTranslateQuickInput');
      if (triggerCmd && triggerCmd.shortcut) {
        hintEl.textContent = `${triggerCmd.shortcut} 触发`;
      } else {
        hintEl.textContent = '(未设置快捷键)';
      }
    } catch (e) {
      hintEl.textContent = 'Alt+Q 触发';
    }
  }
  updateTranslateShortcutHint();

  document.querySelectorAll('.dialog-mask').forEach(mask => {
    mask.addEventListener('click', (e) => {
      if (e.target === mask) mask.classList.remove('show');
    });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.dialog-mask.show').forEach(m => m.classList.remove('show'));
    }
  });
});

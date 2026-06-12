document.addEventListener('click', (e) => {
  const summary = e.target.closest('details.panel > summary, details.panel .custom-summary');
  if (!summary) return;
  const details = summary.closest('details.panel');
  if (!details) return;
  if (e.target.closest('.chevron-icon, .custom-summary') && !e.target.closest('.chevron-icon')) {
    e.preventDefault(); return;
  }
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

(function () {
  'use strict';

  const defaultConfig = {
    provider: 'qwen',
    apiUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    apiKey: '',
    modelName: 'qwen-mt-plus',
    targetLanguages: ['英语', '泰语', '越南语', '印尼语'],
    promptTemplate: '将以下内容翻译成{target}，只返回翻译结果，不要添加任何解释：'
  };

  const providerConfigs = {
    qwen: {
      apiUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
      modelName: 'qwen-mt-plus'
    },
    openai: {
      apiUrl: 'https://api.openai.com/v1/chat/completions',
      modelName: 'gpt-4o-mini'
    },
    deepseek: {
      apiUrl: 'https://api.deepseek.com/v1/chat/completions',
      modelName: 'deepseek-chat'
    },
    custom: {
      apiUrl: '',
      modelName: ''
    }
  };

  let currentConfig = { ...defaultConfig };

  async function loadConfig() {
    try {
      const result = await chrome.storage.local.get(['translateConfig']);
      if (result.translateConfig) {
        currentConfig = { ...defaultConfig, ...result.translateConfig };
      }
      updateUI();
    } catch (e) {
      console.error('加载配置失败', e);
    }
  }

  async function saveConfig() {
    try {
      currentConfig = {
        provider: document.getElementById('provider').value,
        apiUrl: document.getElementById('apiUrl').value,
        apiKey: document.getElementById('apiKey').value,
        modelName: document.getElementById('modelName').value,
        targetLanguages: getTargetLanguages(),
        promptTemplate: document.getElementById('promptTemplate').value
      };

      await chrome.storage.local.set({ translateConfig: currentConfig });
      showStatus('配置已保存', 'success');
    } catch (e) {
      showStatus('保存失败: ' + e.message, 'error');
    }
  }

  function updateUI() {
    document.getElementById('provider').value = currentConfig.provider;
    document.getElementById('apiUrl').value = currentConfig.apiUrl;
    document.getElementById('apiKey').value = currentConfig.apiKey;
    document.getElementById('modelName').value = currentConfig.modelName;
    document.getElementById('promptTemplate').value = currentConfig.promptTemplate;
    renderTargetLanguages();
  }

  function getTargetLanguages() {
    const btns = document.querySelectorAll('#targetLanguages .lang-btn');
    return Array.from(btns).map(btn => btn.dataset.lang);
  }

  function renderTargetLanguages() {
    const container = document.getElementById('targetLanguages');
    container.innerHTML = '';
    container.style.display = 'flex';
    container.style.flexWrap = 'wrap';
    container.style.gap = '8px';

    currentConfig.targetLanguages.forEach(lang => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'lang-btn';
      btn.dataset.lang = lang;
      btn.innerHTML = `${lang}<span class="remove" style="margin-left: 6px; font-size: 12px; opacity: 0.7;">×</span>`;
      btn.style.cssText = 'display: inline-flex; align-items: center; justify-content: center; padding: 6px 16px; font-size: 14px; font-weight: 500; border-radius: 8px; cursor: pointer; transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1); border: 1px solid #e5e7eb; background: #ffffff; color: #374151;';

      btn.addEventListener('mouseenter', () => {
        btn.style.background = '#f9fafb';
        btn.style.color = '#374151';
        btn.style.borderColor = '#d1d5db';
        btn.style.boxShadow = '0 2px 12px 2px rgba(0, 0, 0, 0.08), 0 0 4px 1px rgba(0, 0, 0, 0.04)';
        btn.style.transform = 'scale(1.05)';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.background = '#ffffff';
        btn.style.color = '#374151';
        btn.style.borderColor = '#e5e7eb';
        btn.style.boxShadow = 'none';
        btn.style.transform = 'scale(1)';
      });

      btn.querySelector('.remove').addEventListener('click', (e) => {
        e.stopPropagation();
        removeLanguage(lang);
      });

      container.appendChild(btn);
    });
  }

  function addLanguage(lang) {
    if (!lang || currentConfig.targetLanguages.includes(lang)) return;
    currentConfig.targetLanguages.push(lang);
    renderTargetLanguages();
  }

  function removeLanguage(lang) {
    currentConfig.targetLanguages = currentConfig.targetLanguages.filter(l => l !== lang);
    renderTargetLanguages();
  }

  function showStatus(message, type) {
    const status = document.getElementById('status');
    status.textContent = message;
    status.className = 'status ' + type;
    status.style.display = 'block';
    setTimeout(() => {
      status.style.display = 'none';
    }, 20000);
  }

  async function testConnection() {
    const apiUrl = document.getElementById('apiUrl').value;
    const apiKey = document.getElementById('apiKey').value;
    const modelName = document.getElementById('modelName').value;

    if (!apiUrl || !apiKey || !modelName) {
      showStatus('请填写完整的配置信息', 'error');
      return;
    }

    showStatus('正在测试连接...', 'success');

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: modelName,
          messages: [
            { role: 'user', content: 'Hello' }
          ],
          max_tokens: 10
        })
      });

      if (response.ok) {
        showStatus('连接成功！API 配置有效', 'success');
      } else {
        const error = await response.json();
        showStatus('连接失败: ' + (error.error?.message || response.statusText), 'error');
      }
    } catch (e) {
      showStatus('连接失败: ' + e.message, 'error');
    }
  }

  function handleProviderChange() {
    const provider = document.getElementById('provider').value;
    const config = providerConfigs[provider];
    if (config) {
      document.getElementById('apiUrl').value = config.apiUrl;
      document.getElementById('modelName').value = config.modelName;
    }
  }

  function init() {
    loadConfig();

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.translateConfig) {
        currentConfig = { ...defaultConfig, ...changes.translateConfig.newValue };
        updateUI();
      }
    });

    document.getElementById('backBtn').addEventListener('click', () => {
      window.location.href = '../popup.html';
    });
    document.getElementById('provider').addEventListener('change', handleProviderChange);
    document.getElementById('saveBtn').addEventListener('click', saveConfig);
    document.getElementById('testBtn').addEventListener('click', testConnection);

    const modal = document.getElementById('addLangModal');
    const addLangBtn = document.getElementById('addLangBtn');
    const cancelLangBtn = document.getElementById('cancelLangBtn');
    const confirmLangBtn = document.getElementById('confirmLangBtn');
    const newLangInput = document.getElementById('newLangInput');

    addLangBtn.addEventListener('click', () => {
      modal.classList.add('show');
      newLangInput.value = '';
      newLangInput.focus();
    });

    cancelLangBtn.addEventListener('click', () => {
      modal.classList.remove('show');
    });

    confirmLangBtn.addEventListener('click', () => {
      const lang = newLangInput.value.trim();
      if (lang) {
        addLanguage(lang);
        modal.classList.remove('show');
      }
    });

    newLangInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        confirmLangBtn.click();
      }
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('show');
      }
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.dialog-mask.show').forEach(m => m.classList.remove('show'));
    }
  });

  document.addEventListener('DOMContentLoaded', init);
})();

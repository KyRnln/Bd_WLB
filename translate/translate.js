(function () {
  'use strict';

  const API_BASE_URL = 'https://kyrnln.cloud/api';

  const defaultConfig = {
    provider: 'qwen',
    api_url: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    api_key: '',
    model_name: 'qwen-mt-plus',
    target_langs: ['英语', '泰语', '越南语', '印尼语'],
    prompt_template: '将以下内容翻译成{target}，只返回翻译结果，不要添加任何解释：'
  };

  const providerConfigs = {
    qwen: {
      api_url: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
      model_name: 'qwen-mt-plus'
    },
    openai: {
      api_url: 'https://api.openai.com/v1/chat/completions',
      model_name: 'gpt-4o-mini'
    },
    deepseek: {
      api_url: 'https://api.deepseek.com/v1/chat/completions',
      model_name: 'deepseek-chat'
    },
    custom: {
      api_url: '',
      model_name: ''
    }
  };

  let currentConfig = { ...defaultConfig };

  function getTokenFromStorage() {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['auth_token'], (result) => {
          resolve(result.auth_token || null);
        });
      } else {
        resolve(null);
      }
    });
  }

  let cachedToken = null;

  async function apiRequest(endpoint, options = {}) {
    if (!cachedToken) {
      cachedToken = await getTokenFromStorage();
    }
    const url = `${API_BASE_URL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (cachedToken) {
      headers['Authorization'] = `Bearer ${cachedToken}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          console.warn('[Translate] 用户未登录');
        }
        throw new Error(data.message || '请求失败');
      }

      return data;
    } catch (error) {
      console.error('[Translate] API 请求错误:', error);
      throw error;
    }
  }

  async function loadConfig() {
    try {
      const result = await apiRequest('/translate/config');
      if (result.data) {
        const serverConfig = result.data;
        currentConfig = {
          provider: serverConfig.provider || defaultConfig.provider,
          api_url: serverConfig.api_url || '',
          api_key: serverConfig.api_key || '',
          model_name: serverConfig.model_name || '',
          target_langs: serverConfig.target_langs || defaultConfig.target_langs,
          prompt_template: serverConfig.prompt_template || defaultConfig.prompt_template
        };
      } else {
        currentConfig = { ...defaultConfig };
      }
      updateUI();
    } catch (e) {
      console.error('加载配置失败', e);
      currentConfig = { ...defaultConfig };
      updateUI();
    }
  }

  async function saveConfig() {
    try {
      currentConfig = {
        provider: document.getElementById('provider').value,
        api_url: document.getElementById('apiUrl').value,
        api_key: document.getElementById('apiKey').value,
        model_name: document.getElementById('modelName').value,
        target_langs: getTargetLanguages(),
        prompt_template: document.getElementById('promptTemplate').value
      };

      await apiRequest('/translate/config', {
        method: 'POST',
        body: JSON.stringify(currentConfig)
      });

      showStatus('配置已保存', 'success');
    } catch (e) {
      showStatus('保存失败: ' + e.message, 'error');
    }
  }

  function updateUI() {
    document.getElementById('provider').value = currentConfig.provider;
    document.getElementById('apiUrl').value = currentConfig.api_url;
    document.getElementById('apiKey').value = currentConfig.api_key;
    document.getElementById('modelName').value = currentConfig.model_name;
    document.getElementById('promptTemplate').value = currentConfig.prompt_template;
    renderTargetLanguages();
  }

  function getTargetLanguages() {
    const tags = document.querySelectorAll('#targetLanguages .lang-tag');
    return Array.from(tags).map(tag => tag.dataset.lang);
  }

  function renderTargetLanguages() {
    const container = document.getElementById('targetLanguages');
    container.innerHTML = '';

    currentConfig.target_langs.forEach(lang => {
      const tag = document.createElement('span');
      tag.className = 'lang-tag';
      tag.dataset.lang = lang;
      tag.innerHTML = `${lang}<span class="remove">×</span>`;
      tag.querySelector('.remove').addEventListener('click', (e) => {
        e.stopPropagation();
        removeLanguage(lang);
      });
      container.appendChild(tag);
    });
  }

  function addLanguage(lang) {
    if (!lang || currentConfig.target_langs.includes(lang)) return;
    currentConfig.target_langs.push(lang);
    renderTargetLanguages();
  }

  function removeLanguage(lang) {
    currentConfig.target_langs = currentConfig.target_langs.filter(l => l !== lang);
    renderTargetLanguages();
  }

  function showStatus(message, type) {
    const status = document.getElementById('status');
    status.textContent = message;
    status.className = 'status ' + type;
    setTimeout(() => {
      status.className = 'status';
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

    showStatus('正在测试连接...', 'info');

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
      document.getElementById('apiUrl').value = config.api_url;
      document.getElementById('modelName').value = config.model_name;
    }
  }

  function init() {
    loadConfig();

    document.getElementById('provider').addEventListener('change', handleProviderChange);
    document.getElementById('saveBtn').addEventListener('click', saveConfig);
    document.getElementById('testBtn').addEventListener('click', testConnection);

    const openShortcutsBtn = document.getElementById('openShortcutsBtn');
    if (openShortcutsBtn) {
      openShortcutsBtn.addEventListener('click', () => {
        chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
      });
      chrome.commands.getAll((commands) => {
        const cmd = commands.find(c => c.name === 'toggle-translate');
        if (cmd && cmd.shortcut) {
          openShortcutsBtn.textContent = '快捷键: ' + cmd.shortcut;
        }
      });
    }

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

  document.addEventListener('DOMContentLoaded', init);

  window.getTranslateModelName = function() {
    return currentConfig.model_name || '未配置';
  };
})();
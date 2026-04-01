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

  let currentConfig = { ...defaultConfig };
  let selectedLanguage = null;
  let isTranslating = false;
  let cachedToken = null;

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
          console.warn('[Translate Now] 用户未登录');
        }
        throw new Error(data.message || '请求失败');
      }

      return data;
    } catch (error) {
      console.error('[Translate Now] API 请求错误:', error);
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
      renderTargetLanguages();
    } catch (e) {
      console.error('加载配置失败', e);
      currentConfig = { ...defaultConfig };
      renderTargetLanguages();
    }
  }

  function renderTargetLanguages() {
    const container = document.getElementById('targetLanguages');

    if (!currentConfig.target_langs || currentConfig.target_langs.length === 0) {
      container.innerHTML = '<div class="no-langs">暂无语言<br><a href="translate.html">去添加</a></div>';
      return;
    }

    container.innerHTML = '';

    currentConfig.target_langs.forEach(lang => {
      const tag = document.createElement('span');
      tag.className = 'lang-tag';
      tag.dataset.lang = lang;
      tag.textContent = lang;

      if (selectedLanguage === lang) {
        tag.classList.add('selected');
      }

      tag.addEventListener('click', () => {
        document.querySelectorAll('.lang-tag').forEach(t => t.classList.remove('selected'));
        tag.classList.add('selected');
        selectedLanguage = lang;
      });

      container.appendChild(tag);
    });

    if (currentConfig.target_langs.length > 0 && !selectedLanguage) {
      const firstTag = container.querySelector('.lang-tag');
      if (firstTag) {
        firstTag.classList.add('selected');
        selectedLanguage = currentConfig.target_langs[0];
      }
    }
  }

  function showStatus(message, type) {
    const status = document.getElementById('status');
    status.textContent = message;
    status.className = 'status ' + type;
  }

  function hideStatus() {
    const status = document.getElementById('status');
    status.className = 'status';
  }

  async function translate() {
    const inputText = document.getElementById('sourceText').value.trim();

    if (!inputText) {
      showStatus('请输入要翻译的内容', 'error');
      return;
    }

    if (!selectedLanguage) {
      showStatus('请选择目标语言', 'error');
      return;
    }

    if (!currentConfig.api_key) {
      showStatus('请先配置 API Key', 'error');
      return;
    }

    if (isTranslating) return;

    isTranslating = true;
    const translateBtn = document.getElementById('translateBtn');
    translateBtn.disabled = true;
    translateBtn.textContent = '翻译中...';
    showStatus('正在翻译...', 'info');

    try {
      const prompt = currentConfig.prompt_template.replace('{target}', selectedLanguage);
      const messages = [
        { role: 'user', content: `${prompt}\n\n${inputText}` }
      ];

      const response = await fetch(currentConfig.api_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentConfig.api_key}`
        },
        body: JSON.stringify({
          model: currentConfig.model_name,
          messages: messages,
          max_tokens: 4096
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || `HTTP ${response.status}`);
      }

      const data = await response.json();
      const translatedText = data.choices?.[0]?.message?.content || '翻译失败';

      showResult(selectedLanguage, translatedText);
      showStatus('翻译完成', 'success');
      setTimeout(hideStatus, 2000);

    } catch (e) {
      showStatus('翻译失败: ' + e.message, 'error');
    } finally {
      isTranslating = false;
      translateBtn.disabled = false;
      translateBtn.textContent = '翻译';
    }
  }

  function showResult(lang, text) {
    const resultSection = document.getElementById('resultArea');
    const resultsContainer = document.getElementById('translatedText');

    const card = document.createElement('div');
    card.className = 'result-card';
    card.innerHTML = `
      <div class="result-header">
        <span class="result-lang">${lang}</span>
        <span class="result-copy">复制</span>
      </div>
      <div class="result-text">${escapeHtml(text)}</div>
    `;

    card.querySelector('.result-copy').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(text);
        const copyBtn = card.querySelector('.result-copy');
        copyBtn.textContent = '已复制';
        setTimeout(() => {
          copyBtn.textContent = '复制';
        }, 1500);
      } catch (e) {
        console.error('复制失败', e);
      }
    });

    resultsContainer.insertBefore(card, resultsContainer.firstChild);
    resultSection.style.display = 'block';
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function clearAll() {
    document.getElementById('sourceText').value = '';
    document.getElementById('translatedText').innerHTML = '';
    document.getElementById('resultArea').style.display = 'none';
    hideStatus();
  }

  function init() {
    loadConfig();

    document.getElementById('translateBtn').addEventListener('click', translate);
    document.getElementById('clearBtn').addEventListener('click', clearAll);

    document.getElementById('sourceText').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        translate();
      }
    });

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.auth_token) {
        cachedToken = changes.auth_token.newValue || null;
        loadConfig();
      }
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
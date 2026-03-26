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

  let currentConfig = { ...defaultConfig };
  let selectedLanguage = null;
  let isTranslating = false;

  async function loadConfig() {
    try {
      const result = await chrome.storage.local.get(['translateConfig']);
      if (result.translateConfig) {
        currentConfig = { ...defaultConfig, ...result.translateConfig };
      }
      renderTargetLanguages();
    } catch (e) {
      console.error('加载配置失败', e);
      renderTargetLanguages();
    }
  }

  function renderTargetLanguages() {
    const container = document.getElementById('targetLanguages');
    
    if (!currentConfig.targetLanguages || currentConfig.targetLanguages.length === 0) {
      container.innerHTML = '<div class="no-langs">暂无语言<br><a href="translate.html">去添加</a></div>';
      return;
    }

    container.innerHTML = '';

    currentConfig.targetLanguages.forEach(lang => {
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

    if (currentConfig.targetLanguages.length > 0 && !selectedLanguage) {
      const firstTag = container.querySelector('.lang-tag');
      if (firstTag) {
        firstTag.classList.add('selected');
        selectedLanguage = currentConfig.targetLanguages[0];
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

    if (!currentConfig.apiKey) {
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
      const prompt = currentConfig.promptTemplate.replace('{target}', selectedLanguage);
      const messages = [
        { role: 'user', content: `${prompt}\n\n${inputText}` }
      ];

      const response = await fetch(currentConfig.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentConfig.apiKey}`
        },
        body: JSON.stringify({
          model: currentConfig.modelName,
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
  }

  document.addEventListener('DOMContentLoaded', init);
})();

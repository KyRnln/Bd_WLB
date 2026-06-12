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
    container.style.display = 'flex';
    container.style.flexWrap = 'wrap';
    container.style.gap = '8px';

    currentConfig.targetLanguages.forEach(lang => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'lang-btn';
      btn.dataset.lang = lang;
      btn.textContent = lang;
      btn.style.cssText = 'display: inline-flex; align-items: center; justify-content: center; padding: 6px 16px; font-size: 14px; font-weight: 500; border-radius: 8px; cursor: pointer; transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1); border: 1px solid #e5e7eb; background: #ffffff; color: #374151;';
      
      if (selectedLanguage === lang) {
        btn.style.background = '#e8f0fe';
        btn.style.color = '#1660c1';
        btn.style.borderColor = '#1660c1';
      }

      btn.addEventListener('click', () => {
        container.querySelectorAll('.lang-btn').forEach(t => {
          t.style.background = '#ffffff';
          t.style.color = '#374151';
          t.style.borderColor = '#e5e7eb';
        });
        btn.style.background = '#e8f0fe';
        btn.style.color = '#1660c1';
        btn.style.borderColor = '#1660c1';
        selectedLanguage = lang;
      });

      btn.addEventListener('mouseenter', () => {
        if (selectedLanguage !== lang) {
          btn.style.background = '#f9fafb';
          btn.style.color = '#374151';
          btn.style.borderColor = '#d1d5db';
          btn.style.boxShadow = '0 2px 12px 2px rgba(0, 0, 0, 0.08), 0 0 4px 1px rgba(0, 0, 0, 0.04)';
        } else {
          btn.style.background = '#d0e0fd';
          btn.style.boxShadow = '0 2px 14px 3px rgba(22, 96, 193, 0.15), 0 0 6px 1px rgba(22, 96, 193, 0.08)';
        }
        btn.style.transform = 'scale(1.05)';
      });
      btn.addEventListener('mouseleave', () => {
        if (selectedLanguage !== lang) {
          btn.style.background = '#ffffff';
          btn.style.color = '#374151';
          btn.style.borderColor = '#e5e7eb';
          btn.style.boxShadow = 'none';
        } else {
          btn.style.background = '#e8f0fe';
          btn.style.boxShadow = 'none';
        }
        btn.style.transform = 'scale(1)';
      });
      btn.addEventListener('mouseleave', () => {
        if (selectedLanguage !== lang) {
          btn.style.background = '#ffffff';
          btn.style.borderColor = '#e5e7eb';
        } else {
          btn.style.background = '#e8f0fe';
          btn.style.boxShadow = 'none';
        }
      });

      container.appendChild(btn);
    });

    if (currentConfig.targetLanguages.length > 0 && !selectedLanguage) {
      const firstBtn = container.querySelector('.lang-btn');
      if (firstBtn) {
        firstBtn.style.background = '#e8f0fe';
        firstBtn.style.color = '#1660c1';
        firstBtn.style.borderColor = '#1660c1';
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

      showResult(selectedLanguage, translatedText, inputText);
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

  function showResult(lang, text, originalText) {
    const resultSection = document.getElementById('resultArea');
    const resultsContainer = document.getElementById('translatedText');

    const card = document.createElement('div');
    card.className = 'result-card';
    card.style.cssText = 'background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; margin-bottom: 12px;';
    card.innerHTML = `
      <div class="result-header" style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: #f9fafb; border-bottom: 1px solid #e5e7eb;">
        <span class="result-lang" style="font-size: 13px; font-weight: 600; color: #374151;">${lang}${originalText ? ' <span style="font-weight: 400; color: #9ca3af; font-size: 12px;">| 原文: ' + escapeHtml(originalText.slice(0, 60)) + (originalText.length > 60 ? '...' : '') + '</span>' : ''}</span>
        <button type="button" class="result-copy" style="display: inline-flex; align-items: center; justify-content: center; padding: 4px 12px; font-size: 12px; font-weight: 500; color: #374151; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; cursor: pointer; transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);">复制</button>
      </div>
      <div class="result-text" style="padding: 14px; font-size: 14px; line-height: 1.6; color: #1a1a1a; white-space: pre-wrap; word-break: break-word;">${escapeHtml(text)}</div>
    `;

    const copyBtn = card.querySelector('.result-copy');
    copyBtn.addEventListener('mouseenter', () => {
      copyBtn.style.background = '#f9fafb';
      copyBtn.style.color = '#374151';
      copyBtn.style.borderColor = '#d1d5db';
      copyBtn.style.boxShadow = '0 2px 12px 2px rgba(0, 0, 0, 0.08), 0 0 4px 1px rgba(0, 0, 0, 0.04)';
      copyBtn.style.transform = 'scale(1.05)';
    });
    copyBtn.addEventListener('mouseleave', () => {
      copyBtn.style.background = '#ffffff';
      copyBtn.style.color = '#374151';
      copyBtn.style.borderColor = '#e5e7eb';
      copyBtn.style.boxShadow = 'none';
      copyBtn.style.transform = 'scale(1)';
    });
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(text);
        copyBtn.textContent = '已复制';
        copyBtn.style.background = '#ecfdf5';
        copyBtn.style.color = '#065f46';
        copyBtn.style.borderColor = '#a7f3d0';
        setTimeout(() => {
          copyBtn.textContent = '复制';
          copyBtn.style.background = '#ffffff';
          copyBtn.style.color = '#374151';
          copyBtn.style.borderColor = '#e5e7eb';
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

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.translateConfig) {
        currentConfig = { ...defaultConfig, ...changes.translateConfig.newValue };
        selectedLanguage = null;
        renderTargetLanguages();
      }
    });

    document.getElementById('backBtn').addEventListener('click', () => {
      window.location.href = '../popup.html';
    });
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

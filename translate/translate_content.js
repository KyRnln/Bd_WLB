(function () {
  'use strict';

  let config = null;
  let translateBox = null;
  let isVisible = false;
  let currentTextarea = null;

  async function loadConfig() {
    try {
      const result = await chrome.storage.local.get(['translateConfig']);
      config = result.translateConfig || null;
    } catch (e) {
      console.error('加载翻译配置失败', e);
    }
  }

  function createTranslateBox() {
    if (translateBox) return;

    translateBox = document.createElement('div');
    translateBox.id = 'wlb-translate-box';
    translateBox.style.cssText = `
      position: fixed;
      z-index: 999999;
      background: #fff;
      border: 1px solid #1890ff;
      border-radius: 999px;
      box-shadow: 0 4px 20px rgba(24, 144, 255, 0.3);
      padding: 6px;
      display: none;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      white-space: nowrap;
    `;

    translateBox.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <select id="wlb-translate-target" style="
          height: 28px;
          padding: 0 8px;
          border: 1px solid #1890ff;
          border-radius: 999px;
          font-size: 13px;
          outline: none;
          background: #fff;
          cursor: pointer;
          color: #1890ff;
        "></select>
        <input type="text" id="wlb-translate-input" placeholder="输入中文，回车翻译" style="
          min-width: 100px;
          max-width: 1000px;
          height: 28px;
          border: none;
          border-bottom: 1px solid #e0e0e0;
          padding: 0 8px;
          font-size: 14px;
          outline: none;
          background: transparent;
        " />
        <span id="wlb-translate-close" style="
          cursor: pointer;
          color: #1890ff;
          font-size: 16px;
          padding: 0 4px;
          line-height: 28px;
          font-weight: bold;
        ">×</span>
      </div>
    `;

    document.body.appendChild(translateBox);

    document.getElementById('wlb-translate-close').addEventListener('click', hideTranslateBox);
    
    const inputEl = document.getElementById('wlb-translate-input');
    inputEl.addEventListener('input', function() {
      this.style.width = 'auto';
      const newWidth = Math.max(100, Math.min(1000, this.scrollWidth + 16));
      this.style.width = newWidth + 'px';
      
      if (translateBox) {
        const boxRect = translateBox.getBoundingClientRect();
        if (boxRect.right > window.innerWidth - 10) {
          const newLeft = window.innerWidth - boxRect.width - 10;
          translateBox.style.left = Math.max(10, newLeft) + 'px';
        }
      }
    });
    document.getElementById('wlb-translate-input').addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        hideTranslateBox(true);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        doTranslate();
      }
    });
  }

  function updateTargetLanguages() {
    const select = document.getElementById('wlb-translate-target');
    if (!select || !config || !config.targetLanguages) return;

    select.innerHTML = '';
    config.targetLanguages.forEach(lang => {
      const option = document.createElement('option');
      option.value = lang;
      option.textContent = lang;
      select.appendChild(option);
    });
  }

  function showTranslateBox(x, y, textarea) {
    if (!config || !config.apiKey) {
      showNotification('请先配置翻译服务', 'error');
      return;
    }

    currentTextarea = textarea;
    createTranslateBox();
    updateTargetLanguages();

    const boxHeight = 40;
    let posX = x + 10;
    let posY = y - boxHeight - 10;

    if (posX < 10) {
      posX = 10;
    }
    if (posY < 10) {
      posY = y + 30;
    }

    translateBox.style.left = posX + 'px';
    translateBox.style.top = posY + 'px';
    translateBox.style.display = 'inline-block';
    isVisible = true;

    document.getElementById('wlb-translate-input').focus();
  }

  function hideTranslateBox(keepFocus = false) {
    const textareaToFocus = keepFocus ? currentTextarea : null;
    
    if (translateBox) {
      translateBox.style.display = 'none';
      document.getElementById('wlb-translate-input').value = '';
    }
    isVisible = false;
    currentTextarea = null;

    if (textareaToFocus) {
      textareaToFocus.focus();
    }
  }

  async function doTranslate() {
    const input = document.getElementById('wlb-translate-input').value.trim();
    const target = document.getElementById('wlb-translate-target').value;

    if (!input) {
      return;
    }

    if (!config || !config.apiKey) {
      showNotification('请先配置翻译服务', 'error');
      return;
    }

    const prompt = (config.promptTemplate || '将以下内容翻译成{target}：')
      .replace('{target}', target);

    try {
      const response = await fetch(config.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          model: config.modelName,
          messages: [
            { role: 'user', content: `你是一个专业的翻译助手，请准确翻译用户的内容。\n\n${prompt}\n\n${input}` }
          ],
          temperature: 0.3
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || '翻译请求失败');
      }

      const data = await response.json();
      const translation = data.choices?.[0]?.message?.content || '翻译失败';

      if (currentTextarea) {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype,
          'value'
        ).set;
        nativeInputValueSetter.call(currentTextarea, translation);
        currentTextarea.dispatchEvent(new Event('input', { bubbles: true }));
        currentTextarea.dispatchEvent(new Event('change', { bubbles: true }));
        currentTextarea.focus();
      }

      setTimeout(() => {
        hideTranslateBox();
      }, 500);

    } catch (e) {
      showNotification('翻译失败: ' + e.message, 'error');
    }
  }

  function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      background: ${type === 'error' ? '#ffebee' : '#e8f5e9'};
      color: ${type === 'error' ? '#c62828' : '#2e7d32'};
      border-radius: 6px;
      font-size: 14px;
      z-index: 9999999;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    `;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.remove();
    }, 3000);
  }

  function handleClick(e) {
    if (isVisible && translateBox && !translateBox.contains(e.target)) {
      hideTranslateBox();
    }
  }

  function handleKeydown(e) {
    if (e.key !== 'ArrowUp') return;
    if (isVisible) return;

    const target = e.target;
    if (target.tagName !== 'TEXTAREA' && target.tagName !== 'INPUT') return;
    if (target.id !== 'imTextarea' && !target.placeholder?.includes('发送消息')) return;

    e.preventDefault();
    loadConfig().then(() => {
      const rect = target.getBoundingClientRect();
      showTranslateBox(rect.left, rect.top, target);
    });
  }

  function init() {
    loadConfig();

    document.addEventListener('click', handleClick, true);
    document.addEventListener('keydown', handleKeydown, true);

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.translateConfig) {
        config = changes.translateConfig.newValue;
        updateTargetLanguages();
      }
    });
  }

  init();
})();

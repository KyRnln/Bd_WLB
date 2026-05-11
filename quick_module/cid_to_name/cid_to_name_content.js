(function () {
  function createStatusDisplay() {
    let statusDiv = document.getElementById('tiktok-cidtoname-status-display');
    if (!statusDiv) {
      statusDiv = document.createElement('div');
      statusDiv.id = 'tiktok-cidtoname-status-display';
      statusDiv.style.cssText = `
        position: fixed; bottom: 20px; left: 20px; z-index: 10000;
        background: #007bff; color: white; padding: 10px 15px; border-radius: 5px;
        font-size: 14px; box-shadow: 0 2px 10px rgba(0,0,0,0.3); max-width: 300px; word-wrap: break-word;
      `;
      document.body.appendChild(statusDiv);
    }
    return statusDiv;
  }

  function updateStatus(message) {
    let statusDiv = createStatusDisplay();
    statusDiv.textContent = message;
    setTimeout(() => {
      if (statusDiv.parentNode) statusDiv.parentNode.removeChild(statusDiv);
    }, 3000);
  }

  function isValidUsername(text) {
    if (!text) return false;
    const trimmedText = text.trim();
    return trimmedText.length >= 3 && trimmedText.length <= 50 &&
      /^[a-zA-Z0-9_@.-]+$/.test(trimmedText) && /[a-zA-Z]/.test(trimmedText);
  }

  function extractUsername() {
    try {
      updateStatus('开始搜索达人ID...');
      const selectors = [
        'span[data-e2e="b7f56c3b-f013-3448"]',
        '[data-e2e*="username"]', '[data-testid*="username"]',
        '.text-head-l.mr-8', '.text-head-l', 'h1 span:first-child', '.profile-username',
        '.creator-name', '.username', '.display-name', 'span:not(:empty)[class*="text"]:first-child',
        'div > span:last-child', '.ant-typography'
      ];
      for (const selector of selectors) {
        try {
          const element = document.querySelector(selector);
          if (element && element.textContent && isValidUsername(element.textContent)) {
            const txt = element.textContent.trim();
            updateStatus(`找到达人ID: ${txt}`);
            return txt;
          }
        } catch (e) { continue; }
      }
      updateStatus('尝试广泛搜索...');
      const allElements = document.querySelectorAll('span, div, h1, h2, h3, p, a, li');
      for (const element of allElements) {
        const text = element.textContent && element.textContent.trim();
        if (text && isValidUsername(text)) {
          if (element.closest('.profile, .user, .creator, .detail')) {
            updateStatus(`找到达人ID: ${text}`);
            return text;
          }
        }
      }
      for (const element of allElements) {
        const text = element.textContent && element.textContent.trim();
        if (text) {
          const matches = text.match(/@?([a-zA-Z0-9._]{3,30})/);
          if (matches && matches[1]) {
            const username = matches[1].replace('@', '');
            if (isValidUsername(username)) {
              updateStatus(`找到达人ID: ${username}`);
              return username;
            }
          }
        }
      }
      updateStatus('未能找到达人ID');
      return null;
    } catch (error) {
      updateStatus('提取过程中发生错误');
      return null;
    }
  }

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (window !== window.top) return;

    if (request.action === 'extractUsername') {
      updateStatus('正在提取达人ID...');
      const username = extractUsername();
      if (username) {
        let avatarUrl = '';
        const imgElements = document.querySelectorAll('img');
        for (const img of imgElements) {
          if (img.src && img.src.includes('tiktokcdn.com') && img.src.includes('avt-')) {
            avatarUrl = img.src;
            break;
          }
        }

        sendResponse({ username: username, cid: request.cid, avatarUrl: avatarUrl });
      } else {
        updateStatus('未能提取到达人ID');
        sendResponse({ username: null, cid: request.cid });
      }
      return true;
    }
  });

  console.log('[CIDtoName] 通过CID查达人功能已加载');
})();

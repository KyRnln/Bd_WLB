// 快捷图片 - 页面内选择器
// 支持在 contenteditable 区域（如 TikTok 聊天框）快速插入图片
(() => {
  'use strict';

  if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return;

  const STORAGE_KEY = 'quickImages';
  let focusedInput = null;
  let panel = null;
  let overlay = null;

  function getAllImages() {
    return new Promise((resolve) => {
      chrome.storage.local.get([STORAGE_KEY], (result) => {
        resolve(Array.isArray(result[STORAGE_KEY]) ? result[STORAGE_KEY] : []);
      });
    });
  }

  function createPanel() {
    if (panel) return;

    // Lightweight overlay for click-to-close (no background)
    overlay = document.createElement('div');
    overlay.className = 'wlb-image-overlay';
    overlay.style.cssText = 'position:fixed;z-index:999997;top:0;left:0;right:0;bottom:0;display:none;background:transparent;';

    panel = document.createElement('div');
    panel.className = 'wlb-image-panel';
    panel.style.cssText = `
      position:fixed;z-index:999998;background:#fff;border:1px solid #e0e0e0;
      border-radius:0 0 12px 12px;box-shadow:0 2px 12px rgba(0,0,0,0.1);
      font-family:var(--font-family);
      display:none;min-width:220px;max-width:360px;box-sizing:border-box;
    `;

    panel.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-bottom:1px solid #f2f2f2;">
        <span style="font-size:13px;font-weight:600;color:#1a1c1c;display:flex;align-items:center;gap:6px;">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.41a2.25 2.25 0 013.182 0l2.909 2.91m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>
          快捷图片
        </span>
        <span style="font-size:11px;color:#9ca3af;">Alt+W</span>
      </div>
      <div id="wlb-image-list" style="max-height:240px;overflow-y:auto;"></div>
    `;

    document.body.appendChild(overlay);
    document.body.appendChild(panel);

    overlay.addEventListener('click', hidePanel);
  }

  function showPanel() {
    if (!focusedInput) return;
    createPanel();
    loadImages();
    positionPanel();
    panel.style.display = 'block';
    overlay.style.display = 'block';
  }

  function hidePanel() {
    if (panel) panel.style.display = 'none';
    if (overlay) overlay.style.display = 'none';
    if (focusedInput) focusedInput.focus();
  }

  function positionPanel() {
    if (!focusedInput || !panel) return;
    const rect = focusedInput.getBoundingClientRect();
    const panelW = Math.min(Math.max(rect.width, 220), 360);
    // Position below input
    let left = rect.left;
    let top = rect.bottom;
    // Adjust to stay in viewport
    if (left + panelW > window.innerWidth - 10) {
      left = Math.max(10, window.innerWidth - 10 - panelW);
    }
    if (top + 240 > window.innerHeight - 10) {
      top = rect.top - Math.min(240, panel.scrollHeight || 240);
      if (top < 10) top = 10;
    }
    panel.style.width = panelW + 'px';
    panel.style.left = left + 'px';
    panel.style.top = top + 'px';
  }

  async function loadImages() {
    const listEl = document.getElementById('wlb-image-list');
    if (!listEl) return;
    const images = await getAllImages();
    if (!images.length) {
      listEl.innerHTML = '<div style="padding:16px 12px;color:#9ca3af;font-size:12px;text-align:center;">暂无快捷图片，请先在管理页面中添加</div>';
      return;
    }
    listEl.innerHTML = images.map(img => `
      <div class="wlb-image-item" data-id="${img.id}" style="display:flex;align-items:center;gap:10px;padding:10px 12px;cursor:pointer;border-bottom:1px solid #f2f2f2;transition:background 0.1s;">
        <img src="${img.imageData}" style="width:28px;height:28px;border-radius:4px;object-fit:cover;flex-shrink:0;" />
        <span style="flex:1;font-size:13px;font-weight:600;color:#1a1c1c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(img.name)}</span>
      </div>
    `).join('');

    // Add hover + last-child styling
    const items = listEl.querySelectorAll('.wlb-image-item');
    items.forEach(el => {
      el.addEventListener('mouseenter', () => { el.style.background = '#f3f3f3'; });
      el.addEventListener('mouseleave', () => { el.style.background = ''; });
      el.addEventListener('click', () => {
        const id = el.dataset.id;
        const img = images.find(i => i.id === id);
        if (img) insertImage(img);
      });
    });
    // Last child remove border
    if (items.length) {
      items[items.length - 1].style.borderBottom = 'none';
    }
  }

  function insertImage(img) {
    if (!img) return;

    const blob = dataURLToBlob(img.imageData);
    const mime = blob.type || 'image/png';

    // Write to clipboard
    navigator.clipboard.write([
      new ClipboardItem({ [mime]: blob })
    ]).catch((err) => console.error('Clipboard write failed:', err));

    // Focus input and dispatch Ctrl+V to trigger TikTok's own clipboard detection
    if (focusedInput) {
      focusedInput.focus();
      focusedInput.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'v',
        code: 'KeyV',
        keyCode: 86,
        ctrlKey: true,
        metaKey: false,
        bubbles: true,
        cancelable: true
      }));
      focusedInput.dispatchEvent(new KeyboardEvent('keyup', {
        key: 'v',
        code: 'KeyV',
        keyCode: 86,
        ctrlKey: false,
        metaKey: false,
        bubbles: true,
        cancelable: true
      }));
    }

    hidePanel();
  }

  function dataURLToBlob(dataUrl) {
    const parts = dataUrl.split(',');
    const mimeMatch = parts[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/png';
    const bytes = atob(parts[1]);
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) {
      arr[i] = bytes.charCodeAt(i);
    }
    return new Blob([arr], { type: mime });
  }

  function escapeHtml(text) {
    const d = document.createElement('div');
    d.textContent = text;
    return d.innerHTML;
  }

  let notificationTimer = null;

  function showNotification(msg, type = 'info') {
    const existing = document.querySelector('.wlb-image-notification');
    if (existing) existing.remove();
    const el = document.createElement('div');
    el.className = 'wlb-image-notification';
    el.style.cssText = `
      position:fixed;bottom:24px;left:50%;transform:translateX(-50%);
      z-index:999999;background:#323232;color:#fff;padding:10px 20px;
      border-radius:8px;font-size:13px;
      font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      box-shadow:0 4px 12px rgba(0,0,0,0.2);max-width:360px;text-align:center;
    `;
    el.textContent = msg;
    document.body.appendChild(el);
    clearTimeout(notificationTimer);
    notificationTimer = setTimeout(() => el.remove(), 3000);
  }

  // --- Event Listeners ---

  // Track focus so we know where to trigger the panel
  document.addEventListener('focusin', (e) => {
    const el = e.target;
    if (el.isContentEditable || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      focusedInput = el;
    }
  });

  // Keyboard shortcut
  document.addEventListener('keydown', (e) => {
    if (e.altKey && e.code === 'KeyW') {
      e.preventDefault();
      e.stopPropagation();
      if (panel && panel.style.display === 'block') {
        hidePanel();
      } else if (focusedInput) {
        showPanel();
      } else {
        showNotification('请先点击输入框', 'error');
      }
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && panel && panel.style.display === 'block') {
      hidePanel();
    }
  });

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'triggerQuickImage') {
      focusedInput = document.activeElement;
      if (focusedInput && (focusedInput.isContentEditable || focusedInput.tagName === 'INPUT' || focusedInput.tagName === 'TEXTAREA')) {
        showPanel();
      } else {
        showNotification('请先点击输入框', 'error');
      }
      sendResponse({ success: true });
    }
  });
})();
(() => {
  if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return;

  let focusedInput = null;
  let phrases = [];
  let filteredPhrases = [];
  let activeTagId = '__ALL__';
  let searchBar = null;
  let selector = null;
  let selectedIndex = 0;
  let keyboardMode = false;
  let savedCursorPos = null;

  async function loadPhrases() {
    try {
      const result = await new Promise(resolve => chrome.storage.local.get(['savedPhrases', 'activeTagId'], resolve));
      phrases = Array.isArray(result.savedPhrases) ? result.savedPhrases : [];
      activeTagId = typeof result.activeTagId === 'string' ? result.activeTagId : '__ALL__';
      filteredPhrases = getVisiblePhrases().slice();
    } catch (e) {
      phrases = [];
      filteredPhrases = [];
      activeTagId = '__ALL__';
    }
  }

  function getVisiblePhrases() {
    if (activeTagId === '__ALL__') return phrases.slice();
    return phrases.filter(p => p && p.tagId === activeTagId);
  }

  function createElements() {
    if (selector) return;

    searchBar = document.createElement('div');
    searchBar.className = 'wlb-phrase-search-bar';
    searchBar.style.display = 'none';
    searchBar.innerHTML = `
      <input type="text" id="wlb-phrase-search" class="phrase-search-input" placeholder="搜索短语..." />
      <button id="wlb-phrase-close" class="phrase-close">×</button>
    `;

    selector = document.createElement('div');
    selector.className = 'wlb-phrase-selector';
    selector.tabIndex = -1;
    selector.style.display = 'none';
    selector.innerHTML = `<div id="wlb-phrase-list"></div>`;

    document.body.appendChild(searchBar);
    document.body.appendChild(selector);

    document.getElementById('wlb-phrase-close').addEventListener('click', hideSelector);

    document.getElementById('wlb-phrase-search').addEventListener('input', (e) => {
      applyFilter(e.target.value);
    });

    document.getElementById('wlb-phrase-search').addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') {
        e.preventDefault();
        hideSelector(true);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredPhrases.length > 0 && selectedIndex >= 0 && selectedIndex < filteredPhrases.length) {
          insertSelectedPhrase();
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        keyboardMode = true;
        selector.classList.add('keyboard-active');
        if (filteredPhrases.length > 0 && selectedIndex < filteredPhrases.length - 1) {
          selectedIndex++;
          updateActiveItem();
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        keyboardMode = true;
        selector.classList.add('keyboard-active');
        if (filteredPhrases.length > 0 && selectedIndex > 0) {
          selectedIndex--;
          updateActiveItem();
        }
      }
    });

    selector.addEventListener('click', (e) => {
      const item = e.target.closest('.phrase-item');
      if (!item) return;
      const idx = Number(item.dataset.idx);
      if (!isNaN(idx) && idx >= 0 && idx < filteredPhrases.length) {
        keyboardMode = false;
        selector.classList.remove('keyboard-active');
        selectedIndex = idx;
        insertSelectedPhrase();
      }
    });

    selector.addEventListener('mouseover', (e) => {
      if (keyboardMode) return;
      const item = e.target.closest('.phrase-item');
      if (!item) return;
      const idx = Number(item.dataset.idx);
      if (!isNaN(idx)) {
        selectedIndex = idx;
        updateActiveItem();
      }
    });

    selector.addEventListener('mousemove', () => {
      if (keyboardMode) {
        keyboardMode = false;
        selector.classList.remove('keyboard-active');
      }
    });
  }

  function showSelector() {
    if (!focusedInput) return;
    const visible = getVisiblePhrases();
    if (!visible.length) {
      showNotification('暂无可用快捷短语', 'error');
      return;
    }

    createElements();
    keyboardMode = false;
    selector.classList.remove('keyboard-active');
    selectedIndex = 0;
    filteredPhrases = visible.slice();
    renderList();

    const rect = focusedInput.getBoundingClientRect();
    const searchBarHeight = 44;
    let posX = rect.left + 10;
    let posY = rect.top - searchBarHeight - 10;

    if (posX < 10) posX = 10;
    if (posY < 10) {
      posX = rect.left + 10;
      posY = rect.bottom + 4;
    }

    searchBar.style.left = posX + 'px';
    searchBar.style.top = posY + 'px';
    searchBar.style.display = 'flex';

    savedCursorPos = focusedInput.selectionStart || 0;

    const selectorTop = posY + searchBarHeight;
    selector.style.left = posX + 'px';
    selector.style.top = selectorTop + 'px';
    selector.style.display = 'block';

    requestAnimationFrame(() => {
      const barBox = searchBar.getBoundingClientRect();
      const listBox = selector.getBoundingClientRect();
      const margin = 8;
      let left = parseFloat(searchBar.style.left);
      if (barBox.right > window.innerWidth - margin) {
        left = Math.max(margin, window.innerWidth - margin - barBox.width);
        searchBar.style.left = left + 'px';
        selector.style.left = left + 'px';
      }
      if (listBox.bottom > window.innerHeight - margin) {
        const totalHeight = listBox.height + searchBarHeight;
        searchBar.style.top = (window.innerHeight - margin - totalHeight) + 'px';
        selector.style.top = (window.innerHeight - margin - totalHeight + searchBarHeight) + 'px';
      }
      // 同步选择器宽度与搜索栏一致
      selector.style.width = barBox.width + 'px';
    });

    document.getElementById('wlb-phrase-search').value = '';
    setTimeout(() => document.getElementById('wlb-phrase-search').focus(), 50);
  }

  function hideSelector(keepFocus = false) {
    if (searchBar) searchBar.style.display = 'none';
    if (selector) {
      selector.style.display = 'none';
      document.getElementById('wlb-phrase-search').value = '';
    }
    selectedIndex = 0;
    if (keepFocus && focusedInput) {
      focusedInput.focus();
    }
  }

  function renderList() {
    const listEl = document.getElementById('wlb-phrase-list');
    if (!listEl) return;

    if (!filteredPhrases.length) {
      listEl.innerHTML = '<div class="phrase-empty">暂无匹配短语</div>';
      return;
    }

    listEl.innerHTML = filteredPhrases.map((p, idx) => `
      <div class="phrase-item ${idx === selectedIndex ? 'active' : ''}" data-idx="${idx}">
        <div class="phrase-title">${escapeHtml(p.title || '未命名')}</div>
        <div class="phrase-content">${escapeHtml(p.content || '')}</div>
      </div>
    `).join('');
  }

  function updateActiveItem() {
    const listEl = document.getElementById('wlb-phrase-list');
    if (!listEl) return;
    listEl.querySelectorAll('.phrase-item').forEach((el, idx) => {
      if (idx === selectedIndex) el.classList.add('active');
      else el.classList.remove('active');
    });
    ensureActiveVisible();
  }

  function ensureActiveVisible() {
    if (!selector) return;
    if (selectedIndex < 0) return;
    const activeEl = selector.querySelector('.phrase-item.active');
    if (!activeEl) return;

    const containerTop = selector.scrollTop;
    const containerBottom = containerTop + selector.clientHeight;
    const elTop = activeEl.offsetTop;
    const elBottom = elTop + activeEl.offsetHeight;

    if (elTop < containerTop) {
      selector.scrollTop = elTop;
    } else if (elBottom > containerBottom) {
      selector.scrollTop = Math.max(0, elBottom - selector.clientHeight);
    }
  }

  function applyFilter(keyword) {
    const kw = (keyword || '').trim().toLowerCase();
    const base = getVisiblePhrases();
    const oldSelectedPhrase = filteredPhrases[selectedIndex];

    if (!kw) {
      filteredPhrases = base.slice();
    } else {
      filteredPhrases = base.filter(p =>
        (p.title || '').toLowerCase().includes(kw) ||
        (p.content || '').toLowerCase().includes(kw)
      );
    }

    if (filteredPhrases.length === 0) {
      selectedIndex = -1;
    } else {
      if (oldSelectedPhrase) {
        const newIndex = filteredPhrases.findIndex(p => p.id === oldSelectedPhrase.id);
        selectedIndex = newIndex >= 0 ? newIndex : 0;
      } else {
        selectedIndex = 0;
      }
      if (selectedIndex >= filteredPhrases.length) selectedIndex = 0;
    }

    renderList();
  }

  function insertSelectedPhrase() {
    if (!focusedInput || selectedIndex < 0 || selectedIndex >= filteredPhrases.length) {
      hideSelector();
      return;
    }
    const phrase = filteredPhrases[selectedIndex];
    if (!phrase) {
      hideSelector();
      return;
    }

    if (focusedInput.tagName === 'TEXTAREA' || focusedInput.tagName === 'INPUT') {
      const value = focusedInput.value || '';
      const pos = savedCursorPos !== null ? savedCursorPos : focusedInput.selectionStart || 0;
      const before = value.slice(0, pos);
      const after = value.slice(pos);
      const nextValue = `${before}${phrase.content}${after}`;
      const cursorPos = before.length + phrase.content.length;
      focusedInput.value = nextValue;
      focusedInput.selectionStart = focusedInput.selectionEnd = cursorPos;
      focusedInput.dispatchEvent(new Event('input', { bubbles: true }));
    }

    hideSelector(true);
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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
      border-radius: 8px;
      font-size: 14px;
      z-index: 9999999;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
  }

  function handleClick(e) {
    if (selector && selector.style.display !== 'none' && !selector.contains(e.target) && !searchBar.contains(e.target)) {
      hideSelector();
    }
  }

  loadPhrases();

  document.addEventListener('mousedown', (e) => {
    const target = e.target;
    if (target.tagName === 'TEXTAREA' || (target.tagName === 'INPUT' && /^(text|search|tel|url|email|password|number)$/.test(target.type))) {
      focusedInput = target;
    }
  }, true);

  document.addEventListener('click', handleClick, true);

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    let needRerender = false;
    if (changes.savedPhrases) {
      phrases = Array.isArray(changes.savedPhrases.newValue) ? changes.savedPhrases.newValue : [];
      needRerender = true;
    }
    if (changes.activeTagId) {
      activeTagId = typeof changes.activeTagId.newValue === 'string' ? changes.activeTagId.newValue : '__ALL__';
      needRerender = true;
    }
    if (selector && selector.style.display !== 'none' && needRerender) {
      selectedIndex = 0;
      filteredPhrases = getVisiblePhrases().slice();
      applyFilter(document.getElementById('wlb-phrase-search').value);
    }
  });

  chrome.runtime.onMessage.addListener((request) => {
    if (request.action === 'triggerPhraseSelector') {
      if (!focusedInput) {
        showNotification('请先点击选择一个文本输入框', 'error');
        return;
      }
      loadPhrases().then(() => showSelector());
    }
  });
})();

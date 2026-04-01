// 内容脚本：快捷短语浮动选择功能

(() => {
  if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return;

  let phrases = [];
  let filteredPhrases = [];
  let activeTagId = '__ALL__';
  let selector = null;
  let currentInput = null;
  let selectedIndex = 0;
  let triggerPosition = -1;

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

  function injectStyles() {
    if (document.getElementById('quick-phrase-styles')) return;
    const style = document.createElement('style');
    style.id = 'quick-phrase-styles';
    style.textContent = `
      .quick-phrase-selector {
        position: fixed;
        background: #fff;
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        box-shadow: 0 6px 18px rgba(0,0,0,0.15);
        min-width: 240px;
        max-width: 360px;
        max-height: 260px;
        overflow-y: auto;
        z-index: 2147483647;
        font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
        animation: qp-fade-in 0.12s ease-out;
      }
      .quick-phrase-selector__item {
        padding: 10px 12px;
        cursor: pointer;
        border-bottom: 1px solid #f2f2f2;
      }
      .quick-phrase-selector__item:last-child { border-bottom: none; }
      .quick-phrase-selector__item:hover,
      .quick-phrase-selector__item.active {
        background: linear-gradient(90deg, #f5f7ff 0%, #eef2ff 100%);
        box-shadow: inset 2px 0 0 #4b7bff;
      }
      .quick-phrase-selector__title {
        font-size: 13px;
        font-weight: 600;
        color: #222;
        margin-bottom: 4px;
      }
      .quick-phrase-selector__content {
        font-size: 12px;
        color: #555;
        white-space: nowrap;
        text-overflow: ellipsis;
        overflow: hidden;
      }
      @keyframes qp-fade-in { from{opacity:0;transform:translateY(-4px);} to{opacity:1;transform:translateY(0);} }
    `;
    document.documentElement.appendChild(style);
  }

  function getCaretPosition(elem) {
    if (!elem) return { x: 0, y: 0 };

    if (elem.isContentEditable) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0).cloneRange();
        const rect = range.getBoundingClientRect();
        if (rect && rect.width + rect.height > 0) {
          return { x: rect.left, y: rect.bottom };
        }
      }
    }

    const rect = elem.getBoundingClientRect();
    return { x: rect.left + 10, y: rect.bottom + 4 };
  }

  function showSelector(target) {
    const visible = getVisiblePhrases();
    if (!visible.length) return;
    hideSelector();
    injectStyles();
    currentInput = target;
    selectedIndex = 0;
    filteredPhrases = visible.slice();
    const position = getCaretPosition(target);

    selector = document.createElement('div');
    selector.className = 'quick-phrase-selector';
    selector.style.left = `${position.x}px`;
    selector.style.top = `${position.y}px`;
    const listForRender = filteredPhrases.length ? filteredPhrases : [];
    selector.innerHTML = listForRender.length
      ? listForRender.map((p, idx) => `
      <div class="quick-phrase-selector__item ${idx === 0 ? 'active' : ''}" data-id="${p.id}" data-idx="${idx}">
        <div class="quick-phrase-selector__title">${escapeHtml(p.title || '未命名')}</div>
        <div class="quick-phrase-selector__content">${escapeHtml(p.content || '')}</div>
      </div>
    `).join('')
      : `<div style="padding:12px;color:#666;font-size:12px;text-align:center;">暂无匹配短语</div>`;

    selector.addEventListener('click', (e) => {
      const item = e.target.closest('.quick-phrase-selector__item');
      if (!item) return;
      const idx = Number(item.dataset.idx || '0');
      setActiveIndex(idx);
      insertSelectedPhrase();
    });

    selector.addEventListener('mouseover', (e) => {
      const item = e.target.closest('.quick-phrase-selector__item');
      if (!item) return;
      const idx = Number(item.dataset.idx || '0');
      setActiveIndex(idx);
    });

    document.documentElement.appendChild(selector);
    updateActiveItem();

    requestAnimationFrame(() => {
      const box = selector.getBoundingClientRect();
      const margin = 8;
      let left = box.left;
      let top = box.top;
      if (box.right > window.innerWidth - margin) {
        left = Math.max(margin, window.innerWidth - margin - box.width);
      }
      if (box.bottom > window.innerHeight - margin) {
        top = Math.max(margin, window.innerHeight - margin - box.height);
      }
      selector.style.left = `${left}px`;
      selector.style.top = `${top}px`;
    });
  }

  function hideSelector() {
    if (selector && selector.parentNode) {
      selector.parentNode.removeChild(selector);
    }
    selector = null;
    currentInput = null;
    triggerPosition = -1;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function insertSelectedPhrase() {
    const list = filteredPhrases.length ? filteredPhrases : getVisiblePhrases();
    if (!currentInput || selectedIndex < 0 || selectedIndex >= list.length) {
      hideSelector();
      return;
    }
    const phrase = list[selectedIndex];
    if (!phrase) {
      hideSelector();
      return;
    }

    if (currentInput.tagName === 'TEXTAREA' || currentInput.tagName === 'INPUT') {
      const value = currentInput.value || '';
      const start = triggerPosition > 0 ? triggerPosition - 1 : 0;
      const end = currentInput.selectionEnd || start;
      const before = value.slice(0, start);
      const after = value.slice(end);
      const nextValue = `${before}${phrase.content}${after}`;
      const cursorPos = before.length + phrase.content.length;
      currentInput.value = nextValue;
      currentInput.selectionStart = currentInput.selectionEnd = cursorPos;
      currentInput.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (currentInput.isContentEditable) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0).cloneRange();
        range.setStart(range.startContainer, Math.max(0, range.startOffset - 1));
        range.deleteContents();
        range.insertNode(document.createTextNode(phrase.content));
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }
    hideSelector();
  }

  function handleKeydown(e) {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
    if (!isInput) return;

    if (selector) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const base = filteredPhrases.length ? filteredPhrases : getVisiblePhrases();
        const list = base;
        if (list.length > 0) setActiveIndex((selectedIndex + 1) % list.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        const base = filteredPhrases.length ? filteredPhrases : getVisiblePhrases();
        const list = base;
        if (list.length > 0) setActiveIndex((selectedIndex - 1 + list.length) % list.length);
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        insertSelectedPhrase();
        return;
      }
      if (e.key === 'Escape') {
        hideSelector();
        return;
      }
    }

    if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      triggerPosition = getCursorPos(target);
      setTimeout(() => showSelector(target), 0);
    }
  }

  function handleInput(e) {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
    if (!isInput) return;
    if (!selector) return;

    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
      const value = target.value || '';
      const caret = target.selectionStart ?? value.length;
      let keyword = '';
      const tail = value.slice(caret);
      const tailMatch = tail.match(/^([^\s]{1,50})/);
      if (tailMatch) {
        keyword = tailMatch[1];
      } else {
        const start = Math.max(0, triggerPosition);
        const raw = value.slice(start, caret);
        keyword = raw.startsWith('/') ? raw.slice(1) : raw;
      }
      applyFilter(keyword);
    }

    if ((target.value || '').indexOf('/') === -1 && !target.isContentEditable) {
      hideSelector();
    }
  }

  function getCursorPos(el) {
    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
      return el.selectionStart || 0;
    }
    return 0;
  }

  function updateActiveItem() {
    if (!selector) return;
    selector.querySelectorAll('.quick-phrase-selector__item').forEach((el, idx) => {
      if (idx === selectedIndex) el.classList.add('active');
      else el.classList.remove('active');
    });
    ensureActiveVisible();
  }

  function setActiveIndex(idx) {
    selectedIndex = idx;
    updateActiveItem();
  }

  function ensureActiveVisible() {
    if (!selector) return;
    if (selectedIndex < 0) return;
    const activeEl = selector.querySelector('.quick-phrase-selector__item.active');
    if (!activeEl) return;

    const container = selector;
    const containerTop = container.scrollTop;
    const containerBottom = containerTop + container.clientHeight;
    const elTop = activeEl.offsetTop;
    const elBottom = elTop + activeEl.offsetHeight;

    if (elTop < containerTop) {
      container.scrollTop = elTop;
      return;
    }
    if (elBottom > containerBottom) {
      container.scrollTop = Math.max(0, elBottom - container.clientHeight);
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
        if (newIndex >= 0) {
          selectedIndex = newIndex;
        } else {
          selectedIndex = Math.min(selectedIndex, filteredPhrases.length - 1);
        }
      }

      if (selectedIndex < 0 || selectedIndex >= filteredPhrases.length) {
        selectedIndex = 0;
      }
    }

    renderFilteredList();
  }

  function renderFilteredList() {
    if (!selector) return;
    const listForRender = filteredPhrases.length ? filteredPhrases : [];
    selector.innerHTML = listForRender.length
      ? listForRender.map((p, idx) => `
      <div class="quick-phrase-selector__item ${idx === selectedIndex ? 'active' : ''}" data-id="${p.id}" data-idx="${idx}">
        <div class="quick-phrase-selector__title">${escapeHtml(p.title || '未命名')}</div>
        <div class="quick-phrase-selector__content">${escapeHtml(p.content || '')}</div>
      </div>
    `).join('')
      : `<div style="padding:12px;color:#666;font-size:12px;text-align:center;">暂无匹配短语</div>`;

    selector.querySelectorAll('.quick-phrase-selector__item').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.idx || '0');
        setActiveIndex(idx);
        insertSelectedPhrase();
      });
      btn.addEventListener('mouseover', () => {
        const idx = Number(btn.dataset.idx || '0');
        setActiveIndex(idx);
      });
    });

    updateActiveItem();
  }

  function getVisiblePhrases() {
    if (activeTagId === '__ALL__') return phrases.slice();
    return phrases.filter(p => p && p.tagId === activeTagId);
  }

  loadPhrases();
  injectStyles();

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
    if (selector && needRerender) {
      selectedIndex = 0;
      filteredPhrases = getVisiblePhrases().slice();
      renderFilteredList();
    }
  });

  document.addEventListener('keydown', handleKeydown, true);
  document.addEventListener('input', handleInput, true);
})();

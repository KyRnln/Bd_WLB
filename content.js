// 内容脚本：仅保留快捷短语浮动选择功能

(() => {
  if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return;

  let phrases = [];
  let filteredPhrases = [];
  let creators = [];
  let activeTagId = '__ALL__';
  let selector = null;
  let currentInput = null;
  let selectedIndex = 0;
  let triggerPosition = -1; // 记录触发字符“/”的位置
  const CREATOR_HIT_CLASS = 'quick-creator-hit';
  let creatorObserver = null;
  let highlightScheduled = false;
  const DEBUG_FN_NAME = '__quickInputCreatorDebug';
  const BRIDGE_FLAG = '__QI_CREATOR_BRIDGE_INSTALLED__';
  const REQ = 'QI_CREATOR_DEBUG_REQUEST';
  const RES = 'QI_CREATOR_DEBUG_RESPONSE';

  async function loadPhrases() {
    try {
      const result = await new Promise(resolve => chrome.storage.local.get(['savedPhrases', 'activeTagId', 'savedCreators'], resolve));
      phrases = Array.isArray(result.savedPhrases) ? result.savedPhrases : [];
      activeTagId = typeof result.activeTagId === 'string' ? result.activeTagId : '__ALL__';
      creators = Array.isArray(result.savedCreators) ? result.savedCreators : [];
      filteredPhrases = getVisiblePhrases().slice();
    } catch (e) {
      phrases = [];
      filteredPhrases = [];
      activeTagId = '__ALL__';
      creators = [];
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
      .${CREATOR_HIT_CLASS} {
        color: #ff0050 !important;
        font-weight: 700;
      }
    `;
    document.documentElement.appendChild(style);
  }

  // 获取光标位置；优先使用选区 rect，退化到元素 rect
  function getCaretPosition(elem) {
    if (!elem) return { x: 0, y: 0 };

    // contenteditable 优先使用 selection range
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

    // input/textarea：使用元素 rect
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

    // 防止浮窗溢出屏幕：测量后修正位置
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
      // 将起始位置回退 1 字符以移除触发的“/”
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
        // 将起始位置回退 1 字符以移除触发的“/”
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

    // 动态匹配（仅处理 input/textarea，contenteditable 保持全部列表）
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
      const value = target.value || '';
      const caret = target.selectionStart ?? value.length;
      // 优先使用光标之后的文本（直到下一个空白），避免依赖光标前内容
      let keyword = '';
      const tail = value.slice(caret);
      const tailMatch = tail.match(/^([^\s]{1,50})/);
      if (tailMatch) {
        keyword = tailMatch[1];
      } else {
        // 退化：使用从触发位置到光标的文本
        const start = Math.max(0, triggerPosition);
        const raw = value.slice(start, caret);
        keyword = raw.startsWith('/') ? raw.slice(1) : raw;
      }
      applyFilter(keyword);
    }

    // 如果用户删除了触发斜杠，则关闭
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

  // 让当前 active 项始终在浮窗可视范围内（仅滚动浮窗自身，不滚动页面）
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
    const oldSelectedPhrase = filteredPhrases[selectedIndex]; // 保存当前选中的短语

    if (!kw) {
      filteredPhrases = base.slice();
    } else {
      filteredPhrases = base.filter(p =>
        (p.title || '').toLowerCase().includes(kw) ||
        (p.content || '').toLowerCase().includes(kw)
      );
    }

    // 始终保持短语选中状态
    if (filteredPhrases.length === 0) {
      selectedIndex = -1;
    } else {
      // 如果之前有选中的短语且仍在结果中，保持其位置
      if (oldSelectedPhrase) {
        const newIndex = filteredPhrases.findIndex(p => p.id === oldSelectedPhrase.id);
        if (newIndex >= 0) {
          selectedIndex = newIndex;
        } else {
          // 如果当前选中的短语被过滤掉了，保持当前位置或选择第一个
          selectedIndex = Math.min(selectedIndex, filteredPhrases.length - 1);
        }
      }

      // 确保selectedIndex在有效范围内
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

  function normalizeCreatorId(text) {
    // 允许页面展示为 "@xxx" 但导入为 "xxx"（仍是“同一个达人ID”）
    return (text || '')
      .trim()
      .replace(/^[@＠]+/, '')
      .trim();
  }

  function getCreatorIdSet() {
    const ids = new Set();
    if (!Array.isArray(creators)) return ids;
    for (const c of creators) {
      const raw = c && c.id ? String(c.id) : '';
      const norm = normalizeCreatorId(raw);
      if (norm) ids.add(norm);
    }
    return ids;
  }

  function highlightCreators() {
    const ids = getCreatorIdSet();
    if (!ids.size) return;

    // 先选更可能的容器，避免全页扫太重
    const container =
      document.querySelector('.arco-table-body') ||
      document.querySelector('#root') ||
      document.body;

    // 选择更通用的候选：表格/列表内常见文本节点容器
    const candidates = container.querySelectorAll(
      'td .arco-table-cell-wrap-value, td .arco-table-cell, td div,' +
      'a, span, div'
    );

    candidates.forEach(node => {
      if (!(node instanceof HTMLElement)) return;
      // 已高亮的不重复处理
      if (node.classList.contains(CREATOR_HIT_CLASS)) return;

      const rawText = (node.textContent || '').trim();
      if (!rawText) return;
      const norm = normalizeCreatorId(rawText);
      if (!norm) return;

      if (ids.has(norm)) {
        node.classList.add(CREATOR_HIT_CLASS);
        node.title = '匹配达人ID';
      }
    });
  }

  function scheduleHighlightCreators() {
    if (highlightScheduled) return;
    highlightScheduled = true;
    requestAnimationFrame(() => {
      highlightScheduled = false;
      highlightCreators();
    });
  }

  function collectCandidateIds() {
    const container =
      document.querySelector('.arco-table-body') ||
      document.querySelector('#root') ||
      document.body;

    const candidates = container.querySelectorAll(
      'td .arco-table-cell-wrap-value, td .arco-table-cell, td div,' +
      'a, span, div'
    );

    const res = [];
    candidates.forEach(node => {
      if (!(node instanceof HTMLElement)) return;
      const rawText = (node.textContent || '').trim();
      if (!rawText) return;
      const norm = normalizeCreatorId(rawText);
      if (!norm) return;
      // 粗过滤：达人id一般是短字符串（避免把整段文案当作id）
      if (norm.length > 64) return;
      res.push(norm);
    });
    return Array.from(new Set(res));
  }

  function collectHighlightedIds() {
    const nodes = document.querySelectorAll(`.${CREATOR_HIT_CLASS}`);
    const res = [];
    nodes.forEach(node => {
      if (!(node instanceof HTMLElement)) return;
      const rawText = (node.textContent || '').trim();
      if (!rawText) return;
      const norm = normalizeCreatorId(rawText);
      if (norm) res.push(norm);
    });
    return Array.from(new Set(res));
  }

  function installDebugFn() {
    // 通过 page_bridge.js 暴露 window.__quickInputCreatorDebug（可在页面控制台直接调用）
    try {
      if (!window[BRIDGE_FLAG] && chrome.runtime && chrome.runtime.getURL) {
        const s = document.createElement('script');
        s.src = chrome.runtime.getURL('page_bridge.js');
        s.async = true;
        (document.documentElement || document.head || document.body).appendChild(s);
        window[BRIDGE_FLAG] = true;
      }

      // 监听来自 page world 的请求
      window.addEventListener('message', (event) => {
        if (event.source !== window) return;
        const data = event.data;
        if (!data || data.type !== REQ || !data.requestId) return;

        const loaded = Array.from(getCreatorIdSet()).sort();
        const candidates = collectCandidateIds().sort();
        const highlighted = collectHighlightedIds().sort();
        const matchedOnPage = candidates.filter(x => loaded.includes(x));

        const payload = {
          ok: true,
          url: location.href,
          frame: window === window.top ? 'top' : 'iframe',
          loadedIdsCount: loaded.length,
          candidateIdsCount: candidates.length,
          matchedOnPageCount: matchedOnPage.length,
          highlightedIdsCount: highlighted.length,
          loadedIds: loaded,
          matchedOnPage,
          highlightedIds: highlighted
        };

        window.postMessage({ type: RES, requestId: data.requestId, payload }, '*');
      });

      // 兼容：在扩展隔离环境里依然保留这个函数名（用于选择“扩展内容脚本”上下文调试）
      window[DEBUG_FN_NAME] = () => {
        const loaded = Array.from(getCreatorIdSet()).sort();
        const candidates = collectCandidateIds().sort();
        const highlighted = collectHighlightedIds().sort();
        const matchedOnPage = candidates.filter(x => loaded.includes(x));
        return {
          ok: true,
          url: location.href,
          frame: window === window.top ? 'top' : 'iframe',
          loadedIdsCount: loaded.length,
          candidateIdsCount: candidates.length,
          matchedOnPageCount: matchedOnPage.length,
          highlightedIdsCount: highlighted.length,
          loadedIds: loaded,
          matchedOnPage,
          highlightedIds: highlighted
        };
      };
    } catch (e) {
      // ignore
    }
  }

  function setupCreatorObserver() {
    if (creatorObserver) creatorObserver.disconnect();
    // document_start 时 body 可能还不存在；用 documentElement 保证能挂上 observer
    const root = document.documentElement || document.body;
    if (!root) return;
    creatorObserver = new MutationObserver(() => {
      scheduleHighlightCreators();
    });
    creatorObserver.observe(root, { childList: true, subtree: true });
    scheduleHighlightCreators();
  }

  // 初始化
  loadPhrases();
  injectStyles();
  installDebugFn();
  setupCreatorObserver();
  // 页面完成构建后再触发一次，避免早期未命中
  document.addEventListener('DOMContentLoaded', () => {
    scheduleHighlightCreators();
  }, { once: true });
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
    if (changes.savedCreators) {
      creators = Array.isArray(changes.savedCreators.newValue) ? changes.savedCreators.newValue : [];
      scheduleHighlightCreators();
    }
    if (selector && needRerender) {
      // 保持当前关键字过滤逻辑：这里直接按新 base 重新渲染
      selectedIndex = 0;
      filteredPhrases = getVisiblePhrases().slice();
      renderFilteredList();
    }
    if (changes.savedCreators && !selector) {
      scheduleHighlightCreators();
    }
  });

  document.addEventListener('keydown', handleKeydown, true);
  document.addEventListener('input', handleInput, true);
})();

// ===== 订单查询自动化功能 =====

// IndexedDB 数据库管理
class OrderDatabase {
  constructor() {
    this.dbName = 'OrderQueryDB';
    this.version = 2;
    this.storeName = 'orders';
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        const oldVersion = event.oldVersion;

        console.log(`数据库升级: 从版本 ${oldVersion} 升级到版本 ${this.version}`);

        if (db.objectStoreNames.contains(this.storeName)) {
          db.deleteObjectStore(this.storeName);
        }

        const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
        store.createIndex('orderId', 'orderId', { unique: false });
        store.createIndex('creatorId', 'creatorId', { unique: false });
        store.createIndex('productId', 'productId', { unique: false });
        store.createIndex('orderProduct', ['orderId', 'productId'], { unique: true });

        console.log('数据库结构升级完成');
      };
    });
  }

  async saveOrder(orderData) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put(orderData);

      request.onsuccess = () => {
        console.log(`成功保存记录: ${orderData.orderId} - ${orderData.productId}`);
        resolve();
      };
      request.onerror = () => {
        console.error(`保存记录失败: ${orderData.orderId} - ${orderData.productId}`, request.error);
        reject(request.error);
      };
    });
  }

  async getAllOrders() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        const result = request.result;
        console.log(`从IndexedDB获取到 ${result.length} 条记录:`, result);
        resolve(result);
      };
      request.onerror = () => {
        console.error('获取所有订单失败:', request.error);
        reject(request.error);
      };
    });
  }

  async clearAll() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

// DOM选择器和XPath配置
const ORDER_SELECTORS = {
  allTab: 'div.m4b-tabs-pane-title-content',
  creatorSelect: 'span.arco-select-view-value',
  orderIdOption: 'li.arco-select-option.m4b-select-option',
  searchInput: 'input[data-tid="m4b_input_search"]',
  searchButton: 'svg.arco-icon-search',
  tableRows: 'tbody tr.arco-table-tr',
  creatorId: '.creator-info__HightBoldText-lfMAmF',
  productId: '.arco-typography.text-body-s-regular.text-neutral-text3',
  orderId: 'span[data-e2e].truncate',
  status: '.product-status-info__StyledTag-hrmRnJ .content .text div'
};

// XPath选择器已移除，只使用CSS选择器

  // 自动化操作类
class OrderAutomation {
  constructor() {
    this.db = new OrderDatabase();
    this.db.init();
    this.progressElement = null;
  }

  // 更新页面进度显示
  updatePageProgress(message, type = 'info') {
    // 直接创建全局进度显示，避免XPath查找
    this.createGlobalProgress(message, type);
  }

  // 创建全局进度显示（如果找不到指定元素）
  createGlobalProgress(message = '', type = 'info') {
    let progressContainer = document.getElementById('order-query-progress');
    if (!progressContainer) {
      progressContainer = document.createElement('div');
      progressContainer.id = 'order-query-progress';
      progressContainer.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(255, 255, 255, 0.95);
        border: 2px solid #007bff;
        border-radius: 8px;
        padding: 12px 16px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        font-family: Arial, sans-serif;
        font-size: 14px;
        color: #333;
        max-width: 400px;
        text-align: center;
      `;
      document.body.appendChild(progressContainer);
    }

    if (message) {
      progressContainer.innerHTML = this.createProgressHtml(message, type);
      progressContainer.style.display = 'block';
    }
  }

  // 创建进度显示HTML
  createProgressHtml(message, type) {
    const iconMap = {
      'info': '🔄',
      'success': '✅',
      'error': '❌',
      'warning': '⚠️'
    };

    const icon = iconMap[type] || iconMap.info;

    return `
      <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
        <span style="font-size: 16px;">${icon}</span>
        <span style="flex: 1; text-align: center;">${message}</span>
      </div>
    `;
  }

  // 隐藏进度显示
  hidePageProgress() {
    try {
      if (this.progressElement) {
        this.progressElement.style.display = 'none';
      }

      const globalProgress = document.getElementById('order-query-progress');
      if (globalProgress) {
        globalProgress.style.display = 'none';
      }
    } catch (error) {
      console.error('隐藏进度显示失败:', error);
    }
  }

  findElement(selector) {
    return document.querySelector(selector);
  }

  async waitForElement(selector, timeout = 5000) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      const element = this.findElement(selector);
      if (element) {
        return element;
      }
      await this.sleep(100);
    }
    throw new Error(`Element not found: ${selector}`);
  }

  async waitForClickable(selector, timeout = 5000) {
    const element = await this.waitForElement(selector, timeout);
    if (!element) {
      throw new Error(`Element is null: ${selector}`);
    }

    let attempts = 0;
    while (attempts < 50) {
      if (!element.disabled && element.offsetParent !== null) {
        return element;
      }
      await this.sleep(100);
      attempts++;
    }
    throw new Error(`Element not clickable: ${selector}`);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async clickElement(selector) {
    console.log(`Attempting to click element: ${selector}`);

    const element = await this.waitForClickable(selector, 5000);

    if (!element) {
      throw new Error(`Element is null, cannot click: ${selector}`);
    }

    if (typeof element.click !== 'function') {
      throw new Error(`Element.click is not a function. Element type: ${element.constructor.name}, selector: ${selector}`);
    }

    console.log('Clicking element:', element);
    element.click();
    await this.sleep(500);
  }

  async triggerEnterKey(selector) {
    console.log(`Triggering Enter key on selector: ${selector}`);

    let element = await this.waitForElement(selector, 3000).catch(() => null);

    // 如果没找到，使用与inputText相同的查找逻辑
    if (!element) {
      console.log('原选择器未找到输入框，尝试其他选择器...');

      const searchSelectors = [
        'input[data-tid="m4b_input_search"]',
        'input[placeholder*="订单"]',
        'input[placeholder*="搜索"]',
        'input[type="text"]',
        'input:not([type="hidden"])',
        'input'
      ];

      for (const searchSelector of searchSelectors) {
        try {
          console.log(`尝试选择器: ${searchSelector}`);
          const elements = document.querySelectorAll(searchSelector);

          for (const el of elements) {
            if (el.offsetParent !== null && el.clientWidth > 100) {
              element = el;
              console.log(`使用选择器 "${searchSelector}" 找到输入框:`, element);
              break;
            }
          }

          if (element) break;
        } catch (e) {
          console.log(`选择器 "${searchSelector}" 无效:`, e.message);
        }
      }

      // 如果还是没找到，尝试更通用的查找方式
      if (!element) {
        console.log('尝试通用输入框查找...');
        const allInputs = document.querySelectorAll('input[type="text"], input:not([type])');

        const candidates = Array.from(allInputs)
          .filter(input => {
            const rect = input.getBoundingClientRect();
            return input.offsetParent !== null &&
                   rect.width > 150 && rect.height > 20 &&
                   !input.disabled && !input.readOnly;
          })
          .sort((a, b) => {
            const aInForm = a.closest('form') !== null;
            const bInForm = b.closest('form') !== null;
            if (aInForm && !bInForm) return -1;
            if (!aInForm && bInForm) return 1;

            const aArea = a.offsetWidth * a.offsetHeight;
            const bArea = b.offsetWidth * b.offsetHeight;
            return bArea - aArea;
          });

        if (candidates.length > 0) {
          element = candidates[0];
          console.log('使用通用查找找到输入框:', element);
        }
      }
    }

    if (!element) {
      console.log(`未找到输入框用于Enter键: ${selector}，跳过搜索触发`);
      return; // 不抛出错误，静默返回
    }

    console.log('Found input element for Enter:', element);

    const enterEvent = new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true
    });

    element.dispatchEvent(enterEvent);
    await this.sleep(500);

    console.log('Enter key triggered');
  }

  async inputText(selector, text) {
    console.log(`Inputting text "${text}" into selector: ${selector}`);

    let element = await this.waitForElement(selector, 3000).catch(() => null);

    // 如果没找到，尝试更灵活的搜索输入框查找
    if (!element) {
      console.log('原选择器未找到搜索输入框，尝试其他选择器...');

      const searchSelectors = [
        'input[data-tid="m4b_input_search"]', // 原选择器
        'input[placeholder*="订单"]', // 包含"订单"的placeholder
        'input[placeholder*="搜索"]', // 包含"搜索"的placeholder
        'input[placeholder*="order"]', // 英文订单
        'input[placeholder*="search"]', // 英文搜索
        'input[type="text"]', // 文本输入框
        'input:not([type="hidden"])', // 非隐藏的输入框
        'input' // 任何输入框
      ];

      for (const searchSelector of searchSelectors) {
        try {
          console.log(`尝试选择器: ${searchSelector}`);
          const elements = document.querySelectorAll(searchSelector);

          // 查找最可能是搜索框的元素
          for (const el of elements) {
            if (el.offsetParent !== null && el.clientWidth > 100) { // 可见且有足够宽度的输入框
              element = el;
              console.log(`使用选择器 "${searchSelector}" 找到搜索输入框:`, element);
              break;
            }
          }

          if (element) break;
        } catch (e) {
          console.log(`选择器 "${searchSelector}" 无效:`, e.message);
        }
      }

      // 如果还是没找到，尝试更通用的查找方式
      if (!element) {
        console.log('尝试通用输入框查找...');
        const allInputs = document.querySelectorAll('input[type="text"], input:not([type])');

        // 按优先级排序：可见、足够大、在表单中的输入框
        const candidates = Array.from(allInputs)
          .filter(input => {
            const rect = input.getBoundingClientRect();
            return input.offsetParent !== null && // 可见
                   rect.width > 150 && rect.height > 20 && // 足够大
                   !input.disabled && !input.readOnly; // 可编辑
          })
          .sort((a, b) => {
            // 优先选择在表单中的输入框
            const aInForm = a.closest('form') !== null;
            const bInForm = b.closest('form') !== null;
            if (aInForm && !bInForm) return -1;
            if (!aInForm && bInForm) return 1;

            // 然后按面积大小排序
            const aArea = a.offsetWidth * a.offsetHeight;
            const bArea = b.offsetWidth * b.offsetHeight;
            return bArea - aArea;
          });

        if (candidates.length > 0) {
          element = candidates[0];
          console.log('使用通用查找找到输入框:', element);
        }
      }
    }

    if (!element) {
      console.log(`未找到输入框: ${selector}，跳过输入步骤`);
      return; // 不抛出错误，静默返回
    }

    console.log('Found input element:', element);

    element.value = '';
    element.focus();

    element.value = text;

    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));

    await this.sleep(300);
  }

  findElementByText(selector, text) {
    const elements = document.querySelectorAll(selector);
    for (const element of elements) {
      if (element.textContent.includes(text)) {
        return element;
      }
    }
    return null;
  }

  async getTableData() {
    console.log('=== 开始获取表格数据 ===');
    console.log('当前页面URL:', window.location.href);
    console.log('document.readyState:', document.readyState);

    await this.sleep(2000);

    console.log('SELECTORS.tableRows:', ORDER_SELECTORS.tableRows);

    const tables = document.querySelectorAll('table');
    console.log('页面中的table元素数量:', tables.length);

    const tbodies = document.querySelectorAll('tbody');
    console.log('页面中的tbody元素数量:', tbodies.length);

    const arcoTables = document.querySelectorAll('.arco-table');
    console.log('页面中的.arco-table元素数量:', arcoTables.length);

    const rows = document.querySelectorAll(ORDER_SELECTORS.tableRows);
    console.log('使用选择器查询结果 - rows.length:', rows.length);

    if (rows.length === 0) {
      console.log('尝试其他选择器...');
      const altRows1 = document.querySelectorAll('tr.arco-table-tr');
      console.log('altRows1.length:', altRows1.length);

      const altRows2 = document.querySelectorAll('tbody tr');
      console.log('altRows2.length:', altRows2.length);
    }

    console.log('rows:', rows);
    const orders = [];

    console.log(`发现 ${rows.length} 行数据`);

    const orderGroups = new Map();

    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex];
      console.log(`\n=== 分析第 ${rowIndex + 1} 行 ===`);

      try {
        const cells = row.querySelectorAll('td');
        console.log(`该行有 ${cells.length} 个单元格`);
        cells.forEach((cell, cellIndex) => {
          const text = cell.textContent.trim();
          console.log(`单元格 ${cellIndex}: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`);
        });

        let orderElement = row.querySelector('td.arco-table-td:nth-child(3) [class*="creator-product-info__ProductInfoWrap"] [class*="text-neutral-text3"] span[data-e2e].truncate');

        if (!orderElement) {
          orderElement = row.querySelector('td:nth-child(3) span[data-e2e].truncate');
        }

        if (!orderElement) {
          const allOrderSpans = row.querySelectorAll('span[data-e2e].truncate');
          for (const span of allOrderSpans) {
            if (span.textContent.includes('订单 ID：') || /^\d{18,}$/.test(span.textContent.trim())) {
              orderElement = span;
              break;
            }
          }
        }

        if (orderElement) {
          let orderId = '';
          if (orderElement.textContent.includes('订单 ID：')) {
            orderId = orderElement.textContent.replace('订单 ID：', '').trim();
          } else {
            orderId = orderElement.textContent.trim();
          }

          if (orderId) {
            if (!orderGroups.has(orderId)) {
              orderGroups.set(orderId, []);
            }
            orderGroups.get(orderId).push(row);
          }
        }
      } catch (error) {
        console.error(`分析第 ${rowIndex + 1} 行时出错:`, error);
      }
    }

    console.log(`分组完成: 发现 ${orderGroups.size} 个不同订单ID`);
    for (const [orderId, rows] of orderGroups) {
      console.log(`订单 ${orderId}: ${rows.length} 个产品`);
    }

    if (orderGroups.size === 0) {
      console.log('当前页面未找到订单数据分组，可能数据尚未加载或页面结构不同');
      return [];
    }

    for (const [orderId, orderRows] of orderGroups) {
      console.log(`处理订单 ${orderId}，包含 ${orderRows.length} 个产品`);

      for (let i = 0; i < orderRows.length; i++) {
        const row = orderRows[i];
        const isMultiProduct = orderRows.length > 1;

        try {
          const creatorElement = row.querySelector('[class*="creator-info__HightBoldText"]');

          let productElement = null;
          const arcoTypographyElements = row.querySelectorAll('[class*="arco-typography"]');
          for (const element of arcoTypographyElements) {
            if (element.textContent.includes('ID:')) {
              productElement = element;
              break;
            }
          }
          const statusElement = row.querySelector('[class*="product-status-info__StyledTag"] [class*="text"] div');

          let creatorId = '';
          let productId = '';
          let status = '';

          if (creatorElement) {
            creatorId = creatorElement.textContent.trim();
          }

          if (productElement) {
            console.log(`找到产品ID元素: "${productElement.textContent}"`);
            productId = productElement.textContent.replace('ID: ', '').trim();
            console.log(`提取的产品ID: "${productId}"`);
          } else {
            console.log('未找到产品ID元素');
          }

          if (statusElement) {
            status = statusElement.textContent.trim();
          }

          const orderData = {
            id: `${orderId}_${productId}`,
            creatorId,
            productId,
            orderId,
            status,
            productIndex: isMultiProduct ? i + 1 : null,
            totalProducts: orderRows.length,
            timestamp: new Date().toISOString()
          };

          orders.push(orderData);
          console.log(`已添加订单记录:`, orderData);

        } catch (error) {
          console.error(`处理订单 ${orderId} 行 ${i + 1} 时出错:`, error);
        }
      }
    }

    console.log(`总共处理了 ${orders.length} 条记录`);

    if (orders.length === 0) {
      console.log('未提取到订单数据，可能页面结构或数据格式需要调整');
    }

    return orders;
  }

  async executeAutomation(orderId) {
    console.log(`=== 开始执行自动化流程，订单ID: ${orderId} ===`);
    try {
      // 显示开始进度
      this.updatePageProgress(`开始查询订单: ${orderId}`, 'info');

      console.log('步骤1：点击"全部"标签');
      this.updatePageProgress('正在切换到全部标签...', 'info');

      // 尝试查找"全部"标签，但不强制要求找到
      let allTabElement = null;

      try {
        // 多重策略查找"全部"标签
        allTabElement = this.findElementByText(ORDER_SELECTORS.allTab, '全部');

        // 如果没找到，尝试更宽泛的选择器
        if (!allTabElement) {
          const allSelectors = [
            'div[role="tab"]', // 标签页通用选择器
            '.arco-tabs-tab-title', // Arco Design标签页
            'span', // 更宽泛的span选择器
            'div' // 最宽泛的div选择器
          ];

          for (const selector of allSelectors) {
            const elements = document.querySelectorAll(selector);
            for (const element of elements) {
              if (element.textContent && element.textContent.trim() === '全部') {
                allTabElement = element;
                break;
              }
            }
            if (allTabElement) break;
          }
        }

        // 如果还是没找到，尝试查找包含"全部"的任何元素
        if (!allTabElement) {
          const allElements = document.querySelectorAll('*');
          for (const element of allElements) {
            if (element.textContent && element.textContent.trim() === '全部') {
              allTabElement = element;
              break;
            }
          }
        }

        if (allTabElement) {
          console.log('找到"全部"标签元素，正在点击');
          if (typeof allTabElement.click === 'function') {
            allTabElement.click();
            await this.sleep(500);
          } else {
            allTabElement.dispatchEvent(new Event('click', { bubbles: true }));
            await this.sleep(500);
          }
        } else {
          // 只记录调试信息，不显示警告
          console.log('未找到"全部"标签，可能已在正确页面，继续执行查询');
        }
      } catch (tabError) {
        console.log('查找"全部"标签时出错，但继续执行查询:', tabError.message);
      }

      console.log('步骤2：点击"达人昵称"选择框');
      this.updatePageProgress('正在选择达人昵称字段...', 'info');
      const creatorSelectElement = this.findElementByText(ORDER_SELECTORS.creatorSelect, '达人昵称');
      if (creatorSelectElement) {
        if (typeof creatorSelectElement.click === 'function') {
          creatorSelectElement.click();
          await this.sleep(500);
        } else {
          creatorSelectElement.dispatchEvent(new Event('click', { bubbles: true }));
          await this.sleep(500);
        }
      }

      console.log('步骤3：选择"订单ID"选项');
      this.updatePageProgress('正在选择订单ID搜索方式...', 'info');
      const orderIdOptionElement = this.findElementByText(ORDER_SELECTORS.orderIdOption, '订单 ID');
      if (orderIdOptionElement) {
        if (typeof orderIdOptionElement.click === 'function') {
          orderIdOptionElement.click();
          await this.sleep(500);
        } else {
          orderIdOptionElement.dispatchEvent(new Event('click', { bubbles: true }));
          await this.sleep(500);
        }
      }

      console.log('步骤4：在输入框输入订单号');
      this.updatePageProgress('正在输入订单号...', 'info');
      try {
        await this.inputText(ORDER_SELECTORS.searchInput, orderId);
        console.log('订单号输入完成');
      } catch (inputError) {
        console.log('订单号输入失败，使用备选方案直接查询数据');
        this.updatePageProgress('直接查询数据...', 'info');
      }

      console.log('步骤5：触发Enter键进行搜索');
      this.updatePageProgress('正在执行搜索...', 'info');
      let searchTriggered = false;

      try {
        await this.triggerEnterKey(ORDER_SELECTORS.searchInput);
        searchTriggered = true;
        console.log('搜索触发完成');
      } catch (enterError) {
        console.log('Enter键搜索失败，尝试搜索按钮');

        // 尝试点击搜索按钮
        try {
          const searchButton = this.findElement(ORDER_SELECTORS.searchButton);
          if (searchButton) {
            searchButton.click();
            await this.sleep(500);
            searchTriggered = true;
            console.log('搜索按钮点击完成');
          } else {
            console.log('未找到搜索按钮，直接获取数据');
          }
        } catch (buttonError) {
          console.log('搜索按钮点击失败，直接获取数据');
        }
      }

      // 如果搜索触发成功或失败，都继续获取数据
      if (!searchTriggered) {
        this.updatePageProgress('正在获取数据...', 'info');
      }

      console.log('步骤6：获取数据');
      this.updatePageProgress('正在获取查询结果...', 'info');
      const orders = await this.getTableData();

      console.log(`正在保存 ${orders.length} 条订单数据到IndexedDB`);
      this.updatePageProgress(`正在保存 ${orders.length} 条数据...`, 'info');
      for (const order of orders) {
        try {
          await this.db.saveOrder(order);
          console.log(`已保存订单: ${order.orderId} - ${order.productId}`);
        } catch (saveError) {
          console.error(`保存订单失败: ${order.orderId}`, saveError);
          throw saveError;
        }
      }
      console.log('所有订单数据保存完成');
      this.updatePageProgress(`查询完成！获取到 ${orders.length} 条数据`, 'success');

      // 5秒后自动隐藏进度显示
      setTimeout(() => {
        this.hidePageProgress();
      }, 5000);

      return { success: true, data: orders };
    } catch (error) {
      console.error('Automation failed:', error);
      this.updatePageProgress(`查询失败: ${error.message}`, 'error');

      // 5秒后自动隐藏进度显示
      setTimeout(() => {
        this.hidePageProgress();
      }, 5000);

      return { success: false, error: error.message };
    }
  }

  async clearData() {
    try {
      await this.db.clearAll();
      console.log('所有订单数据已清空');
      return { success: true };
    } catch (error) {
      console.error('清空数据失败:', error);
      return { success: false, error: error.message };
    }
  }

  async getDataForExport() {
    try {
      const orders = await this.db.getAllOrders();
      console.log(`获取到 ${orders.length} 条数据用于导出:`, orders);

      if (orders.length === 0) {
        return { success: false, error: '没有数据可导出' };
      }

      return { success: true, data: orders };
    } catch (error) {
      console.error('获取导出数据失败:', error);
      return { success: false, error: error.message };
    }
  }
}

// 初始化订单自动化实例
const orderAutomation = new OrderAutomation();

console.log('=== 订单查询功能已加载 ===');
console.log('当前页面URL:', window.location.href);

// 监听来自popup的消息（订单查询相关）
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('收到订单查询消息:', request.action, request);
  if (request.action === 'startOrderAutomation') {
    orderAutomation.executeAutomation(request.orderId).then(sendResponse);
    return true;
  } else if (request.action === 'exportOrderData') {
    orderAutomation.getDataForExport().then(sendResponse);
    return true;
  } else if (request.action === 'clearOrderData') {
    orderAutomation.clearData().then(sendResponse);
    return true;
  }
});

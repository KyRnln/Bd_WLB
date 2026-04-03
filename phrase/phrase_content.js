// 内容脚本：快捷短语浮动选择功能
// 功能：用户在输入框输入 "/" 触发快捷短语选择浮层，支持键盘导航和筛选

(() => {
  // 检查 Chrome API 可用性
  if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return;

  const API_BASE_URL = 'https://kyrnln.cloud/api';

  // 短语数据
  let phrases = [];              // 所有短语列表
  let filteredPhrases = [];       // 筛选后的短语列表
  let activeTagId = '__ALL__';    // 当前选中的标签 ID
  let selector = null;            // 浮层 DOM 元素
  let currentInput = null;         // 当前触发浮层的输入框
  let selectedIndex = 0;           // 当前选中的短语索引
  let triggerPosition = -1;       // 用户输入 "/" 时的光标位置
  let cachedToken = null;         // 缓存的认证令牌
  let focusedInput = null;        // 当前点击聚焦的输入框

  // ========== 认证相关 ==========

  /**
   * 从 Chrome Storage 获取认证令牌
   * @returns {Promise<string|null>}
   */
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

  /**
   * 封装 API 请求，自动附加认证头
   * @param {string} endpoint - API 端点
   * @param {Object} options - fetch 选项
   * @returns {Promise<Object>} API 响应数据
   */
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
          console.warn('[Phrase Content] 用户未登录');
        }
        throw new Error(data.message || '请求失败');
      }

      return data;
    } catch (error) {
      console.error('[Phrase Content] API 请求错误:', error);
      throw error;
    }
  }

  // ========== 数据加载 ==========

  /**
   * 从服务器加载短语列表
   */
  async function loadPhrases() {
    try {
      const result = await apiRequest('/phrases');
      phrases = Array.isArray(result.data) ? result.data : [];
      filteredPhrases = getVisiblePhrases().slice();
    } catch (e) {
      console.error('[Phrase Content] 加载短语失败:', e);
      phrases = [];
      filteredPhrases = [];
    }
  }

  // ========== 样式注入 ==========

  /**
   * 向页面注入快捷短语选择浮层的 CSS 样式
   * 仅注入一次，后续调用直接返回
   */
  function injectStyles() {
    if (document.getElementById('quick-phrase-styles')) return;
    const style = document.createElement('style');
    style.id = 'quick-phrase-styles';
    style.textContent = `
      /* 浮层容器 */
      .quick-phrase-selector {
        position: fixed;
        background: #fff;
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
        min-width: 240px;
        max-width: 360px;
        max-height: 260px;
        overflow-y: auto;
        z-index: 2147483647;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        animation: qp-fade-in 0.12s ease-out;
      }
      /* 短语项 */
      .quick-phrase-selector__item {
        padding: 10px 12px;
        cursor: pointer;
        border-bottom: 1px solid #f5f5f5;
      }
      .quick-phrase-selector__item:last-child { border-bottom: none; }
      /* 悬停效果 */
      .quick-phrase-selector__item:hover {
        background: #f5f5f5;
      }
      /* 键盘/鼠标选中项 */
      .quick-phrase-selector__item.active {
        background: #e8f0ff;
      }
      .quick-phrase-selector__item.active .quick-phrase-selector__title {
        color: #1890ff;
      }
      /* 短语标题 */
      .quick-phrase-selector__title {
        font-size: 13px;
        font-weight: 500;
        color: #333;
        margin-bottom: 4px;
      }
      /* 短语内容 */
      .quick-phrase-selector__content {
        font-size: 12px;
        color: #666;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      /* 淡入动画 */
      @keyframes qp-fade-in { from{opacity:0;transform:translateY(-4px);} to{opacity:1;transform:translateY(0);} }
    `;
    document.documentElement.appendChild(style);
  }

  // ========== 位置计算 ==========

  /**
   * 获取输入框光标相对于视口的位置
   * 浮层默认显示在光标上方
   * @param {HTMLElement} elem - 输入框元素
   * @returns {{x: number, y: number}} 光标位置的坐标
   */
  function getCaretPosition(elem) {
    if (!elem) return { x: 0, y: 0 };

    // contenteditable 元素
    if (elem.isContentEditable) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0).cloneRange();
        const rect = range.getBoundingClientRect();
        if (rect && rect.width + rect.height > 0) {
          return { x: rect.left, y: rect.top }; // 光标上方
        }
      }
    }

    // 普通 input/textarea
    const rect = elem.getBoundingClientRect();
    return { x: rect.left + 10, y: rect.top - 4 };
  }

  // ========== 浮层显示/隐藏 ==========

  /**
   * 显示快捷短语选择浮层
   * @param {HTMLElement} target - 触发浮层的输入框
   */
  function showSelector(target) {
    const visible = getVisiblePhrases();
    if (!visible.length) return;

    hideSelector(); // 关闭已存在的浮层
    injectStyles(); // 确保样式已注入

    currentInput = target;
    selectedIndex = 0;
    filteredPhrases = visible.slice();

    // 创建浮层 DOM
    selector = document.createElement('div');
    selector.className = 'quick-phrase-selector';

    // 获取光标位置并显示在光标下方
    const caretPos = getCaretPosition(target);
    selector.style.left = `${caretPos.x}px`;
    selector.style.top = `${caretPos.y + 4}px`;

    // 渲染短语列表
    const listForRender = filteredPhrases.length ? filteredPhrases : [];
    selector.innerHTML = listForRender.length
      ? listForRender.map((p, idx) => `
      <div class="quick-phrase-selector__item ${idx === 0 ? 'active' : ''}" data-id="${p.id}" data-idx="${idx}">
        <div class="quick-phrase-selector__title">${escapeHtml(p.title || '未命名')}</div>
        <div class="quick-phrase-selector__content">${escapeHtml(p.content || '')}</div>
      </div>
    `).join('')
      : `<div style="padding:12px;color:#666;font-size:12px;text-align:center;">暂无匹配短语</div>`;

    // 绑定点击事件
    selector.addEventListener('click', (e) => {
      const item = e.target.closest('.quick-phrase-selector__item');
      if (!item) return;
      const idx = Number(item.dataset.idx || '0');
      setActiveIndex(idx);
      insertSelectedPhrase();
    });

    // 绑定鼠标悬停事件
    selector.addEventListener('mouseover', (e) => {
      const item = e.target.closest('.quick-phrase-selector__item');
      if (!item) return;
      const idx = Number(item.dataset.idx || '0');
      setActiveIndex(idx);
    });

    document.documentElement.appendChild(selector);
    updateActiveItem();

    // 边界检测：确保浮层在可视区域内
    requestAnimationFrame(() => {
      const box = selector.getBoundingClientRect();
      const caretPos = getCaretPosition(currentInput);
      let top = box.top;
      let left = box.left;

      // 右侧越界检测
      if (box.right > window.innerWidth - 8) {
        left = Math.max(8, window.innerWidth - 8 - box.width);
      }

      // 下方越界时显示在光标上方
      if (box.bottom > window.innerHeight - 8) {
        top = caretPos.y - box.height - 4;
      }

      selector.style.left = `${left}px`;
      selector.style.top = `${top}px`;
    });
  }

  /**
   * 隐藏并销毁快捷短语选择浮层
   */
  function hideSelector() {
    if (selector && selector.parentNode) {
      selector.parentNode.removeChild(selector);
    }
    selector = null;
    currentInput = null;
    triggerPosition = -1;
  }

  // ========== 工具函数 ==========

  /**
   * HTML 转义，防止 XSS
   * @param {string} text - 原始文本
   * @returns {string} 转义后的文本
   */
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * 获取普通输入框的光标位置
   * @param {HTMLElement} el - 输入框元素
   * @returns {number} 光标位置索引
   */
  function getCursorPos(el) {
    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
      return el.selectionStart || 0;
    }
    return 0;
  }

  // ========== 短语插入 ==========

  /**
   * 将选中的短语插入到输入框中
   * 替换 "/" 触发字符和后续的简短标识
   */
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

    // 普通 input/textarea 处理
    if (currentInput.tagName === 'TEXTAREA' || currentInput.tagName === 'INPUT') {
      const value = currentInput.value || '';
      const start = triggerPosition > 0 ? triggerPosition - 1 : 0; // 包含 "/" 的位置
      const end = currentInput.selectionEnd || start;
      const before = value.slice(0, start);       // "/" 之前的文本
      const after = value.slice(end);             // 光标后的文本
      const nextValue = `${before}${phrase.content}${after}`;
      const cursorPos = before.length + phrase.content.length;

      currentInput.value = nextValue;
      currentInput.selectionStart = currentInput.selectionEnd = cursorPos;
      currentInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    // contenteditable 处理
    else if (currentInput.isContentEditable) {
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

  // ========== 键盘事件处理 ==========

  /**
   * 处理键盘按下事件
   * - Backspace 关闭浮层
   * - 方向键导航
   * - Enter 确认选择
   * - Escape 关闭浮层
   */
  function handleKeydown(e) {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
    if (!isInput) return;

    if (selector) {
      // Backspace 关闭浮层
      if (e.key === 'Backspace') {
        hideSelector();
        return;
      }
      // 浮层打开时的键盘操作
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
  }

  // ========== 输入事件处理 ==========

  /**
   * 处理输入事件
   * - 筛选匹配的短语
   * - 当删除 "/" 时关闭浮层
   */
  function handleInput(e) {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
    if (!isInput) return;
    if (!selector) return;

    // 提取关键词并筛选
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
  }

  // ========== 选中项管理 ==========

  /**
   * 更新当前选中的列表项样式
   * 选中项滚动到可视区域
   */
  function updateActiveItem() {
    if (!selector) return;
    selector.querySelectorAll('.quick-phrase-selector__item').forEach((el, idx) => {
      if (idx === selectedIndex) el.classList.add('active');
      else el.classList.remove('active');
    });
    ensureActiveVisible();
  }

  /**
   * 设置当前选中索引
   * @param {number} idx - 新的索引
   */
  function setActiveIndex(idx) {
    selectedIndex = idx;
    updateActiveItem();
  }

  /**
   * 确保当前选中项在可视区域内
   */
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

  // ========== 筛选功能 ==========

  /**
   * 根据关键词筛选短语
   * @param {string} keyword - 筛选关键词
   */
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

    // 尝试保持之前的选中项
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

  /**
   * 重新渲染筛选后的列表
   */
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

    // 重新绑定事件
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

  // ========== 数据获取 ==========

  /**
   * 根据当前标签获取可见的短语列表
   * @returns {Array} 短语数组
   */
  function getVisiblePhrases() {
    if (activeTagId === '__ALL__') return phrases.slice();
    return phrases.filter(p => p && p.tag_id === activeTagId);
  }

  // ========== 初始化 ==========

  loadPhrases();       // 加载短语数据
  injectStyles();       // 注入样式

  // 监听认证令牌变化，重新加载数据
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.auth_token) {
      cachedToken = changes.auth_token.newValue || null;
      loadPhrases();
    }
  });

  // 监听来自 background 的快捷键消息
  chrome.runtime.onMessage.addListener((request) => {
    if (request.action === 'showPhraseSelector') {
      if (!focusedInput) return;
      triggerPosition = getCursorPos(focusedInput);
      showSelector(focusedInput);
    }
  });

  // 监听页面点击，记录当前聚焦的输入框
  document.addEventListener('mousedown', (e) => {
    const target = e.target;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      focusedInput = target;
    }
  }, true);

  // 全局监听键盘事件
  document.addEventListener('keydown', handleKeydown, true);
})();

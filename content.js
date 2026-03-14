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

  function getCreatorById(normalizedId) {
    if (!Array.isArray(creators)) return null;
    for (const c of creators) {
      const raw = c && c.id ? String(c.id) : '';
      const norm = normalizeCreatorId(raw);
      if (norm === normalizedId) return c;
    }
    return null;
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

  // 防抖函数，避免过度频繁调用
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }


  function updateTooltipContent() {
    // 查找所有arco tooltip内容元素
    const tooltipContents = document.querySelectorAll('.arco-tooltip-content-inner');

    tooltipContents.forEach(tooltipContent => {
      const text = (tooltipContent.textContent || '').trim();
      const norm = normalizeCreatorId(text);

      // 检查这个tooltip是否包含已保存的达人ID
      if (norm && getCreatorIdSet().has(norm)) {
        const creator = getCreatorById(norm);
        if (creator && creator.remark) {
          // 只显示备注内容，不显示达人ID
          if (tooltipContent.textContent !== creator.remark) {
            tooltipContent.textContent = creator.remark;
          }
        }
      }
    });
  }

  // 防抖版本的页面备注更新函数
  const debouncedUpdateCreatorRemarks = debounce(updateCreatorRemarksOnPage, 500);

  function setupCreatorObserver() {
    if (creatorObserver) creatorObserver.disconnect();
    // document_start 时 body 可能还不存在；用 documentElement 保证能挂上 observer
    const root = document.documentElement || document.body;
    if (!root) return;

    // 统一的observer，只监听必要的DOM变化
    creatorObserver = new MutationObserver((mutations) => {
      let shouldUpdateRemarks = false;

      // 检查是否有新增的达人ID元素或相关DOM变化
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          // 检查是否新增了包含达人信息的元素
          const hasNewCreatorElements = Array.from(mutation.addedNodes).some(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              return node.querySelector && (
                node.querySelector('[data-e2e="8a94f9b6-1a48-fe57"]') ||
                node.matches && node.matches('[data-e2e="8a94f9b6-1a48-fe57"]')
              );
            }
            return false;
          });

          if (hasNewCreatorElements) {
            shouldUpdateRemarks = true;
            break;
          }
        }
      }

      // 总是更新高亮和tooltip
      scheduleHighlightCreators();
      updateTooltipContent();

      // 只在必要时更新页面备注
      if (shouldUpdateRemarks) {
        debouncedUpdateCreatorRemarks();
      }
    });

    creatorObserver.observe(root, { childList: true, subtree: true });
    scheduleHighlightCreators();
  }


  function updateCreatorRemarksOnPage() {
    try {
      // 查找包含达人ID的元素
      const creatorIdElements = document.querySelectorAll('[data-e2e="8a94f9b6-1a48-fe57"]');

      if (creatorIdElements.length === 0) {
        return; // 没有找到相关元素，直接返回
      }

      creatorIdElements.forEach(element => {
        const creatorId = (element.textContent || '').trim();
        const norm = normalizeCreatorId(creatorId);

        if (norm && getCreatorIdSet().has(norm)) {
          const creator = getCreatorById(norm);

          if (creator && creator.remark) {
            // 检查是否已经添加了备注显示
            let remarkElement = element.parentNode.querySelector('.creator-page-remark-display');

            if (!remarkElement) {
              // 创建备注显示元素
              remarkElement = document.createElement('div');
              remarkElement.className = 'creator-page-remark-display';
              remarkElement.style.cssText = `
                margin-top: 8px;
                padding: 8px 12px;
                background: #f0f7ff;
                border: 1px solid #d1e9ff;
                border-radius: 6px;
                font-size: 12px;
                color: #1d5fff;
                font-weight: 500;
                word-wrap: break-word;
                white-space: pre-wrap;
                text-align: center;
                max-width: 300px;
              `;

              // 在达人ID元素之后插入备注元素
              if (element.parentNode) {
                element.parentNode.insertBefore(remarkElement, element.nextSibling);
              }
            }

            // 只在内容不同时更新
            const newContent = `📝 备注: ${creator.remark}`;
            if (remarkElement && remarkElement.textContent !== newContent) {
              remarkElement.textContent = newContent;
            }
          } else {
            // 如果没有备注，移除已存在的备注显示
            const remarkElement = element.parentNode?.querySelector('.creator-page-remark-display');
            if (remarkElement) {
              remarkElement.remove();
            }
          }
        } else {
          // 如果达人ID不匹配，移除已存在的备注显示
          const remarkElement = element.parentNode?.querySelector('.creator-page-remark-display');
          if (remarkElement) {
            remarkElement.remove();
          }
        }
      });
    } catch (error) {
      console.error('updateCreatorRemarksOnPage error:', error);
    }
  }

  // 初始化
  loadPhrases();
  injectStyles();
  installDebugFn();
  setupCreatorObserver();
  // 页面完成构建后再触发一次，避免早期未命中
  document.addEventListener('DOMContentLoaded', () => {
    scheduleHighlightCreators();
    // 延迟执行页面备注更新
    setTimeout(() => updateCreatorRemarksOnPage(), 1000);
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
      updateTooltipContent();
      // 延迟执行页面备注更新，避免阻塞
      setTimeout(() => updateCreatorRemarksOnPage(), 100);
    }
    if (selector && needRerender) {
      // 保持当前关键字过滤逻辑：这里直接按新 base 重新渲染
      selectedIndex = 0;
      filteredPhrases = getVisiblePhrases().slice();
      renderFilteredList();
    }
    if (changes.savedCreators && !selector) {
      scheduleHighlightCreators();
      updateTooltipContent();
      // 延迟执行页面备注更新，避免阻塞
      setTimeout(() => updateCreatorRemarksOnPage(), 100);
    }
  });

  document.addEventListener('keydown', handleKeydown, true);
  document.addEventListener('input', handleInput, true);
})();

// ==========================================================
// 达人ID隐藏功能
// ==========================================================
(function () {
  const BLACKLIST_STORAGE_KEY = 'creatorBlacklist';

  // 注入样式
  function injectBlacklistStyles() {
    if (document.getElementById('creator-blacklist-styles')) return;
    const style = document.createElement('style');
    style.id = 'creator-blacklist-styles';
    style.textContent = `
      .creator-blacklist-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 50px;
        height: 24px;
        margin-left: 8px;
        padding: 0 6px;
        background: #ffe0e6;
        border: 1px solid #ff0050;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 600;
        transition: all 0.3s ease;
        color: #ff0050;
        white-space: nowrap;
      }
      .creator-blacklist-btn:hover {
        background: #ffc9d9;
        border-color: #ff0050;
        color: #ff0050;
      }
      .creator-blacklist-btn.blacklisted {
        background: #f5f5f5;
        border-color: #d9d9d9;
        color: #666;
      }
      .creator-id-blacklisted {
        text-decoration: line-through !important;
        opacity: 0.25 !important;
        color: inherit !important;
      }
      /* 确保即使有悬浮效果也保持隐藏样式 */
      .creator-id-blacklisted:hover {
        text-decoration: line-through !important;
        opacity: 0.25 !important;
      }
    `;
    document.documentElement.appendChild(style);
  }

  // 加载黑名单
  function loadBlacklist() {
    return new Promise(resolve => {
      try {
        if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
          resolve([]);
          return;
        }
        chrome.storage.local.get([BLACKLIST_STORAGE_KEY], result => {
          try {
            const blacklist = result[BLACKLIST_STORAGE_KEY] || [];
            const converted = blacklist.map(item => {
              if (typeof item === 'string') {
                return { id: item, blacklistedAt: Date.now() };
              }
              return item;
            });
            resolve(converted);
          } catch (parseError) {
            console.debug('黑名单数据转换失败', parseError);
            resolve([]);
          }
        });
      } catch (error) {
        console.debug('加载黑名单失败', error);
        resolve([]);
      }
    });
  }

  // 保存黑名单
  function saveBlacklist(blacklist) {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
      return Promise.resolve();
    }
    return new Promise(resolve => {
      try {
        chrome.storage.local.set({ [BLACKLIST_STORAGE_KEY]: blacklist }, () => {
          try {
            if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
              chrome.runtime.sendMessage({ action: 'blacklistUpdated', blacklistCount: blacklist.length }).catch(() => {});
            }
          } catch (msgError) {
            console.debug('黑名单更新消息发送失败', msgError);
          }
          resolve();
        });
      } catch (storageError) {
        console.debug('黑名单保存失败', storageError);
        resolve();
      }
    });
  }

  // 获取达人ID文本
  function getCreatorIdFromElement(element) {
    const textContent = element.textContent || '';
    return textContent.trim();
  }

  // 创建隐藏按钮
  function createBlacklistButton(creatorIdElement, creatorId) {
    const btn = document.createElement('button');
    btn.className = 'creator-blacklist-btn';
    btn.textContent = '隐藏';
    btn.title = '点击隐藏此达人';
    btn.type = 'button';

    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      try {
        const blacklist = await loadBlacklist();
        const isBlacklisted = blacklist.some(item => item.id === creatorId);

        if (isBlacklisted) {
          const index = blacklist.findIndex(item => item.id === creatorId);
          if (index !== -1) {
            blacklist.splice(index, 1);
          }
          creatorIdElement.classList.remove('creator-id-blacklisted');
          btn.classList.remove('blacklisted');
          btn.textContent = '隐藏';
          btn.title = '点击隐藏此达人';
        } else {
          blacklist.push({
            id: creatorId,
            blacklistedAt: Date.now()
          });
          creatorIdElement.classList.add('creator-id-blacklisted');
          btn.classList.add('blacklisted');
          btn.textContent = '解除';
          btn.title = '点击取消隐藏';
        }

        await saveBlacklist(blacklist);
      } catch (error) {
        if (!error.message.includes('Extension context invalidated')) {
          console.error('隐藏操作出错', error);
        }
      }
    });

    return btn;
  }

  // 初始化隐藏功能
  async function initBlacklistFeature() {
    try {
      injectBlacklistStyles();

      const blacklist = await loadBlacklist();

      const observer = new MutationObserver(mutations => {
        try {
          mutations.forEach(mutation => {
            if (mutation.addedNodes.length > 0) {
              mutation.addedNodes.forEach(node => {
                try {
                  if (node.nodeType === Node.ELEMENT_NODE) {
                    const idElements = node.querySelectorAll ?
                      node.querySelectorAll('[class*="creator-info__HightBoldText"]') :
                      [];

                    idElements.forEach(el => {
                      try {
                        const text = getCreatorIdFromElement(el);
                        if (text && (text.startsWith('@') || /[a-zA-Z]/.test(text))) {
                          processCreatorIdElement(el, blacklist);
                        }
                      } catch (eErr) {}
                    });
                  }
                } catch (nodeErr) {}
              });
            }
          });
        } catch (mutationErr) {
          console.debug('MutationObserver 处理出错', mutationErr);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: false,
        characterData: false
      });

      const allIdElements = document.querySelectorAll('[class*="creator-info__HightBoldText"]');
      allIdElements.forEach(el => {
        try {
          const text = getCreatorIdFromElement(el);
          if (text && (text.startsWith('@') || /[a-zA-Z]/.test(text))) {
            processCreatorIdElement(el, blacklist);
          }
        } catch (elErr) {}
      });
    } catch (initError) {
      console.debug('隐藏功能初始化失败', initError);
    }
  }

  // 处理达人ID元素
  function processCreatorIdElement(idElement, blacklist) {
    const creatorId = getCreatorIdFromElement(idElement);

    if (!creatorId) return;

    let parentContainer = idElement.parentNode;
    const existingBtn = parentContainer?.querySelector('.creator-blacklist-btn');

    if (!existingBtn && parentContainer) {
      const btn = createBlacklistButton(idElement, creatorId);
      parentContainer.appendChild(btn);
    }

    if (blacklist.some(item => item.id === creatorId)) {
      idElement.classList.add('creator-id-blacklisted');
      idElement.style.textDecoration = 'line-through';
      idElement.style.opacity = '0.25';

      const btn = idElement.parentNode?.querySelector('.creator-blacklist-btn');
      if (btn) {
        btn.classList.add('blacklisted');
        btn.textContent = '解除';
      }

      const styleObserver = new MutationObserver(() => {
        try {
          if (!idElement.style.textDecoration.includes('line-through')) {
            idElement.style.textDecoration = 'line-through';
          }
          if (idElement.style.opacity !== '0.25') {
            idElement.style.opacity = '0.25';
          }
        } catch (e) {}
      });

      styleObserver.observe(idElement, {
        attributes: true,
        attributeFilter: ['style'],
        subtree: false
      });

      idElement.addEventListener('mouseenter', () => {
        idElement.style.textDecoration = 'line-through';
        idElement.style.opacity = '0.25';
      }, true);

      idElement.addEventListener('mouseleave', () => {
        idElement.style.textDecoration = 'line-through';
        idElement.style.opacity = '0.25';
      }, true);
    }
  }

  // 页面加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      try {
        initBlacklistFeature();
      } catch (e) {
        console.debug('隐藏功能初始化失败', e);
      }
    });
  } else {
    try {
      initBlacklistFeature();
    } catch (e) {
      console.debug('隐藏功能初始化失败', e);
    }
  }

  // 全局错误处理：捕获未处理的上下文失效错误
  window.addEventListener('unhandledrejection', event => {
    if (event.reason && event.reason.message &&
      event.reason.message.includes('Extension context invalidated')) {
      event.preventDefault();
    }
  }, { passive: false });
})();

// ==========================================================
// 达人ID隐藏功能
// ==========================================================
(function () {
  const BLACKLIST_STORAGE_KEY = 'creatorBlacklist';

  // 注入样式
  function injectBlacklistStyles() {
    if (document.getElementById('creator-blacklist-styles')) return;
    const style = document.createElement('style');
    style.id = 'creator-blacklist-styles';
    style.textContent = `
      .creator-blacklist-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 50px;
        height: 24px;
        margin-left: 8px;
        padding: 0 6px;
        background: #ffe0e6;
        border: 1px solid #ff0050;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 600;
        transition: all 0.3s ease;
        color: #ff0050;
        white-space: nowrap;
      }
      .creator-blacklist-btn:hover {
        background: #ffc9d9;
        border-color: #ff0050;
        color: #ff0050;
      }
      .creator-blacklist-btn.blacklisted {
        background: #f5f5f5;
        border-color: #d9d9d9;
        color: #666;
      }
      .creator-id-blacklisted {
        text-decoration: line-through !important;
        opacity: 0.25 !important;
        color: inherit !important;
      }
      /* 确保即使有悬浮效果也保持隐藏样式 */
      .creator-id-blacklisted:hover {
        text-decoration: line-through !important;
        opacity: 0.25 !important;
      }
    `;
    document.documentElement.appendChild(style);
  }

  // 加载黑名单
  function loadBlacklist() {
    return new Promise(resolve => {
      try {
        if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
          resolve([]);
          return;
        }
        chrome.storage.local.get([BLACKLIST_STORAGE_KEY], result => {
          try {
            const blacklist = result[BLACKLIST_STORAGE_KEY] || [];
            // 如果是旧格式（字符串数组），转换为新格式（对象数组）
            const converted = blacklist.map(item => {
              if (typeof item === 'string') {
                return { id: item, blacklistedAt: Date.now() };
              }
              return item;
            });
            resolve(converted);
          } catch (parseError) {
            // 转换失败，返回空数组
            console.debug('黑名单数据转换失败', parseError);
            resolve([]);
          }
        });
      } catch (error) {
        // 上下文失效或其他错误，返回空数组
        console.debug('加载黑名单失败', error);
        resolve([]);
      }
    });
  }

  // 保存黑名单
  function saveBlacklist(blacklist) {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
      return Promise.resolve();
    }
    return new Promise(resolve => {
      try {
        chrome.storage.local.set({ [BLACKLIST_STORAGE_KEY]: blacklist }, () => {
          // 检查上下文是否仍然有效
          try {
            if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
              chrome.runtime.sendMessage({ action: 'blacklistUpdated', blacklistCount: blacklist.length }).catch(() => {
                // popup 可能未打开或上下文失效
              });
            }
          } catch (msgError) {
            // 消息发送失败，可能是扩展上下文失效，但不需要终止执行
            console.debug('黑名单更新消息发送失败', msgError);
          }
          resolve();
        });
      } catch (storageError) {
        // 存储操作失败，但不影响页面功能
        console.debug('黑名单保存失败', storageError);
        resolve();
      }
    });
  }

  // 获取达人ID文本
  function getCreatorIdFromElement(element) {
    const textContent = element.textContent || '';
    return textContent.trim();
  }

  // 创建隐藏按钮
  function createBlacklistButton(creatorIdElement, creatorId) {
    const btn = document.createElement('button');
    btn.className = 'creator-blacklist-btn';
    btn.textContent = '隐藏';
    btn.title = '点击隐藏此达人';
    btn.type = 'button';

    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      try {
        const blacklist = await loadBlacklist();
        const isBlacklisted = blacklist.some(item => item.id === creatorId);

        if (isBlacklisted) {
          // 取消隐藏
          const index = blacklist.findIndex(item => item.id === creatorId);
          if (index !== -1) {
            blacklist.splice(index, 1);
          }
          creatorIdElement.classList.remove('creator-id-blacklisted');
          btn.classList.remove('blacklisted');
          btn.textContent = '隐藏';
          btn.title = '点击隐藏此达人';
        } else {
          // 隐藏
          blacklist.push({
            id: creatorId,
            blacklistedAt: Date.now()
          });
          creatorIdElement.classList.add('creator-id-blacklisted');
          btn.classList.add('blacklisted');
          btn.textContent = '解除';
          btn.title = '点击取消隐藏';
        }

        await saveBlacklist(blacklist);
      } catch (error) {
        // 记录错误但不影响用户交互
        if (!error.message.includes('Extension context invalidated')) {
          console.error('隐藏操作出错', error);
        }
        // 如果是上下文失效错误，静默处理，用户可以重试
      }
    });

    return btn;
  }

  // 初始化隐藏功能
  async function initBlacklistFeature() {
    try {
      injectBlacklistStyles();

      const blacklist = await loadBlacklist();

      // 使用 MutationObserver 监听DOM变化
      const observer = new MutationObserver(mutations => {
        try {
          mutations.forEach(mutation => {
            if (mutation.addedNodes.length > 0) {
              mutation.addedNodes.forEach(node => {
                try {
                  if (node.nodeType === Node.ELEMENT_NODE) {
                    // 只查找达人ID class的元素
                    const idElements = node.querySelectorAll ?
                      node.querySelectorAll('[class*="creator-info__HightBoldText"]') :
                      [];

                    idElements.forEach(el => {
                      try {
                        const text = getCreatorIdFromElement(el);
                        // 达人ID要么以@开头，要么包含字母
                        if (text && (text.startsWith('@') || /[a-zA-Z]/.test(text))) {
                          processCreatorIdElement(el, blacklist);
                        }
                      } catch (eErr) {
                        // 单个元素处理失败，继续处理其他元素
                      }
                    });
                  }
                } catch (nodeErr) {
                  // 节点处理失败，继续下一个节点
                }
              });
            }
          });
        } catch (mutationErr) {
          // MutationObserver 回调出错，但不应该导致脚本停止
          console.debug('MutationObserver 处理出错', mutationErr);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: false,
        characterData: false
      });

      // 初始化：处理已存在的所有达人ID元素
      const allIdElements = document.querySelectorAll('[class*="creator-info__HightBoldText"]');
      allIdElements.forEach(el => {
        try {
          const text = getCreatorIdFromElement(el);
          // 达人ID要么以@开头，要么包含字母
          if (text && (text.startsWith('@') || /[a-zA-Z]/.test(text))) {
            processCreatorIdElement(el, blacklist);
          }
        } catch (elErr) {
          // 单个元素处理失败，继续
        }
      });
    } catch (initError) {
      // 初始化过程中的任何错误都不应该导致脚本崩溃
      console.debug('隐藏功能初始化失败', initError);
    }
  }

  // 处理达人ID元素
  function processCreatorIdElement(idElement, blacklist) {
    // 获取达人ID
    const creatorId = getCreatorIdFromElement(idElement);

    if (!creatorId) return;

    // 检查是否已有按钮
    let parentContainer = idElement.parentNode;
    const existingBtn = parentContainer?.querySelector('.creator-blacklist-btn');

    if (!existingBtn && parentContainer) {
      // 不修改原有元素，在父级添加按钮
      const btn = createBlacklistButton(idElement, creatorId);
      parentContainer.appendChild(btn);
    }

    // 应用黑名单样式
    if (blacklist.some(item => item.id === creatorId)) {
      idElement.classList.add('creator-id-blacklisted');
      // 直接设置内联样式，以确保不被覆盖
      idElement.style.textDecoration = 'line-through';
      idElement.style.opacity = '0.25';

      const btn = idElement.parentNode?.querySelector('.creator-blacklist-btn');
      if (btn) {
        btn.classList.add('blacklisted');
        btn.textContent = '解除';
      }

      // 监听元素属性变化，如果样式被重置则恢复
      const styleObserver = new MutationObserver(() => {
        try {
          // 定期恢复样式
          if (!idElement.style.textDecoration.includes('line-through')) {
            idElement.style.textDecoration = 'line-through';
          }
          if (idElement.style.opacity !== '0.25') {
            idElement.style.opacity = '0.25';
          }
        } catch (e) {
          // 忽略错误
        }
      });

      // 观察元素的属性变化
      styleObserver.observe(idElement, {
        attributes: true,
        attributeFilter: ['style'],
        subtree: false
      });

      // 同时监听悬浮事件，防止被覆盖
      idElement.addEventListener('mouseenter', () => {
        idElement.style.textDecoration = 'line-through';
        idElement.style.opacity = '0.25';
      }, true);

      idElement.addEventListener('mouseleave', () => {
        idElement.style.textDecoration = 'line-through';
        idElement.style.opacity = '0.25';
      }, true);
    }
  }

  // 页面加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      try {
        initBlacklistFeature();
      } catch (e) {
        console.debug('隐藏功能初始化失败', e);
      }
    });
  } else {
    try {
      initBlacklistFeature();
    } catch (e) {
      console.debug('隐藏功能初始化失败', e);
    }
  }

  // 全局错误处理：捕获未处理的上下文失效错误
  window.addEventListener('unhandledrejection', event => {
    if (event.reason && event.reason.message &&
      event.reason.message.includes('Extension context invalidated')) {
      // 静默处理上下文失效错误
      event.preventDefault();
    }
  }, { passive: false });
})();

// 达人ID高亮与隐藏功能
// 功能说明：
//   - 绩效达人：红色高亮 + 加粗 (quick-creator-hit)
//   - 流失达人：绿色高亮 + 加粗 + 50%透明度 + 删除线 (quick-creator-lost)
//   - 隐藏达人：灰色 + 删除线 + 50%透明度 (creator-id-blacklisted)
// 样式实现：CSS类 + 内联样式双重保护，防止鼠标悬停时样式被页面覆盖丢失
// 更新记录：
//   - 2026-03-31: 统一三种达人的样式实现方式，均使用 CSS类 + 内联样式
//   - 修复绩效/流失达人在鼠标悬停时样式消失的问题

(function () {
  'use strict';

  if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return;

  const CREATOR_HIT_CLASS = 'quick-creator-hit';
  const TAG_COLORS = {
    '绩效达人': { bg: '#ffebee', color: '#c62828' },
    '流失达人': { bg: '#e8f5e9', color: '#2e7d32' },
    '隐藏达人': { bg: '#f5f5f5', color: '#616161' }
  };

  // 高亮样式类名映射 - 用于为不同类型达人添加对应CSS类
  const HIGHLIGHT_CLASSES = {
    performance: 'quick-creator-hit',
    lost: 'quick-creator-lost',
    hidden: 'creator-id-blacklisted'
  };



  let creators = [];
  let creatorSets = { performance: new Set(), lost: new Set(), hidden: new Set() };
  let allCreatorMap = new Map();
  let creatorObserver = null;
  let highlightScheduled = false;
  const processedHighlights = new Set();
  const processedFlexTags = new Set();
  const processedImNames = new Set();
  const processedImUnames = new Set();
  let rafId = null;

  // 注入高亮样式到页面
  function injectHighlightStyles() {
    if (document.getElementById('creator-highlight-styles')) return;
    const style = document.createElement('style');
    style.id = 'creator-highlight-styles';
    style.textContent = `
      .${CREATOR_HIT_CLASS} { color: #ff0050 !important; font-weight: 700; }
      .quick-creator-lost { color: #117a42 !important; font-weight: 700; opacity: 0.5; text-decoration: line-through; }
      .creator-blacklist-btn {
        display: inline-flex; align-items: center; justify-content: center;
        min-width: 32px; height: 18px; margin-left: 6px; padding: 0 4px;
        background: #ffe0e6; border: 1px solid #ff0050; border-radius: 100px;
        cursor: pointer; font-size: 10px; font-weight: 500; transition: all 0.3s ease;
        color: #ff0050; white-space: nowrap;
      }
      .creator-blacklist-btn:hover { background: #ffc9d9; border-color: #ff0050; color: #ff0050; }
      .creator-blacklist-btn.blacklisted { background: #f5f5f5; border-color: #d9d9d9; color: #666; }
      .creator-id-blacklisted { text-decoration: line-through !important; opacity: 0.5 !important; color: #999 !important; }
    `;
    document.documentElement.appendChild(style);
  }

  // 标准化达人ID，移除@前缀和多余空白
  function normalizeCreatorId(text) {
    return (text || '').trim().replace(/^[@＠]+/, '').trim();
  }

  // 根据达人数据构建Set集合，用于快速查找和判断
  function buildCreatorSets() {
    const performance = new Set();
    const lost = new Set();
    const hidden = new Set();
    const map = new Map();

    for (const c of creators) {
      if (!c || !c.creator_id) continue;
      const norm = normalizeCreatorId(String(c.creator_id));
      if (!norm) continue;

      map.set(norm, c);

      if (c.tag === '绩效达人') performance.add(norm);
      else if (c.tag === '流失达人') lost.add(norm);
      else if (c.tag === '隐藏达人') hidden.add(norm);
    }

    creatorSets = { performance, lost, hidden };
    allCreatorMap = map;
  }

  // 根据标准化ID获取达人完整数据
  function getCreatorById(normalizedId) {
    return allCreatorMap.get(normalizedId) || null;
  }

  const API_BASE_URL = 'https://kyrnln.cloud/api';

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

  let cachedToken = null;

  function getToken() {
    return cachedToken;
  }

  async function apiRequest(endpoint, options = {}) {
    if (!cachedToken) {
      cachedToken = await getTokenFromStorage();
    }
    const url = `${API_BASE_URL}${endpoint}`;
    const token = cachedToken;

    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          console.warn('[Creator Highlight] 用户未登录');
        }
        throw new Error(data.message || '请求失败');
      }

      return data;
    } catch (error) {
      console.error('[Creator Highlight] API 请求错误:', error);
      throw error;
    }
  }

  let cachedUserId = null;

  async function fetchCurrentUser() {
    try {
      const result = await apiRequest('/auth/me');
      if (result.success && result.user) {
        cachedUserId = result.user.id;
        return result.user;
      }
    } catch (e) {
      console.warn('[Creator Highlight] 获取当前用户信息失败:', e);
    }
    return null;
  }

  function getCurrentUserId() {
    return cachedUserId;
  }

  // 从存储加载达人数据
  async function loadCreators() {
    try {
      const currentUser = await fetchCurrentUser();
      const currentUserId = currentUser ? currentUser.id : null;

      const result = await apiRequest('/creators/all');
      const allCreators = result.data || [];

      creators = allCreators.map(creator => {
        if (creator.user_id && currentUserId && creator.user_id !== currentUserId) {
          if (!creator.tag || creator.tag !== '隐藏达人') {
            return { ...creator, tag: '隐藏达人' };
          }
        }
        return creator;
      });

      buildCreatorSets();
      scheduleHighlightCreators();
    } catch (e) {
      console.error('[Creator Highlight] 加载达人数据失败:', e);
      creators = [];
      buildCreatorSets();
    }
  }

  // 保存达人数据到服务器
  async function saveCreators() {
    // 数据已同步到服务器，此处仅做日志记录
    console.debug('[Creator Highlight] 达人数据已保存在服务器');
  }

  // 更新单个达人标签到服务器
  async function updateCreatorTag(normId, newTag) {
    const existingCreator = getCreatorById(normId);
    if (!existingCreator) return;

    try {
      if (newTag === '') {
        await apiRequest(`/creators/${existingCreator.id}`, {
          method: 'PUT',
          body: JSON.stringify({ creator_id: existingCreator.creator_id, tag: '' })
        });
      } else {
        await apiRequest(`/creators/${existingCreator.id}`, {
          method: 'PUT',
          body: JSON.stringify({ creator_id: existingCreator.creator_id, tag: newTag })
        });
      }
    } catch (e) {
      console.error('[Creator Highlight] 更新达人标签失败:', e);
    }
  }

  // 创建隐藏/解除按钮
  function createBlacklistButton(creatorIdElement, creatorId) {
    const btn = document.createElement('button');
    btn.className = 'creator-blacklist-btn';
    btn.textContent = '隐藏';
    btn.title = '点击隐藏此达人';
    btn.type = 'button';
    btn.dataset.normId = normalizeCreatorId(creatorId);
    btn.dataset.creatorId = creatorId;

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      const normId = btn.dataset.normId;
      const isCurrentlyHidden = creatorSets.hidden.has(normId);

      const allIdElements = document.querySelectorAll('[data-e2e="8a94f9b6-1a48-fe57"]');
      const matchingElements = [];
      allIdElements.forEach(el => {
        const elNorm = normalizeCreatorId(el.textContent || '');
        if (elNorm === normId) {
          matchingElements.push(el);
        }
      });

      if (isCurrentlyHidden) {
        btn.classList.remove('blacklisted');
        btn.textContent = '隐藏';
        btn.title = '点击隐藏此达人';
        matchingElements.forEach(el => {
          el.classList.remove('creator-id-blacklisted');
          el.style.textDecoration = '';
          el.style.opacity = '';
          el.style.color = '';
        });
        updateCreatorData(normId, '');
      } else {
        btn.classList.add('blacklisted');
        btn.textContent = '解除';
        btn.title = '点击取消隐藏';
        matchingElements.forEach(el => {
          el.classList.add('creator-id-blacklisted');
          el.style.textDecoration = 'line-through';
          el.style.opacity = '0.5';
          el.style.color = '#999';
        });
        updateCreatorData(normId, '隐藏达人');
      }
    });

    return btn;
  }

  // 更新达人数据（标签），并同步到服务器
  async function updateCreatorData(normId, newTag) {
    const existingCreator = getCreatorById(normId);

    if (existingCreator) {
      existingCreator.tag = newTag;
      await updateCreatorTag(normId, newTag);
      buildCreatorSets();
    } else if (newTag !== '') {
      try {
        const result = await apiRequest('/creators', {
          method: 'POST',
          body: JSON.stringify({
            creator_id: normId,
            cid: '',
            region: '',
            tag: newTag,
            remark: ''
          })
        });
        creators.push(result.data);
        buildCreatorSets();
      } catch (e) {
        console.error('[Creator Highlight] 创建达人失败:', e);
      }
    }
  }

  // 处理达人ID元素的隐藏按钮（初始化按钮状态）
  function processCreatorIdHideButton(idElement) {
    const rawCreatorId = (idElement.textContent || '').trim();
    if (!rawCreatorId) return;

    const normId = normalizeCreatorId(rawCreatorId);
    if (!normId || !rawCreatorId.startsWith('@') && !/[a-zA-Z]/.test(rawCreatorId)) return;

    const parentContainer = idElement.parentNode;
    if (!parentContainer) return;

    if (!parentContainer.querySelector('.creator-blacklist-btn')) {
      parentContainer.appendChild(createBlacklistButton(idElement, rawCreatorId));
    }

    const btn = parentContainer.querySelector('.creator-blacklist-btn');
    if (!btn) return;

    if (creatorSets.hidden.has(normId)) {
      idElement.classList.add(HIGHLIGHT_CLASSES.hidden);
      idElement.style.textDecoration = 'line-through';
      idElement.style.opacity = '0.5';
      idElement.style.color = '#999';
      btn.classList.add('blacklisted');
      btn.textContent = '解除';
      btn.title = '点击取消隐藏';
    } else if (creatorSets.performance.has(normId)) {
      idElement.classList.add(HIGHLIGHT_CLASSES.performance);
      idElement.style.color = '#ff0050';
      idElement.style.fontWeight = '700';
      btn.classList.remove('blacklisted');
      btn.textContent = '隐藏';
      btn.title = '点击隐藏此达人';
    } else if (creatorSets.lost.has(normId)) {
      idElement.classList.add(HIGHLIGHT_CLASSES.lost);
      idElement.style.color = '#117a42';
      idElement.style.fontWeight = '700';
      idElement.style.opacity = '0.5';
      idElement.style.textDecoration = 'line-through';
      btn.classList.remove('blacklisted');
      btn.textContent = '隐藏';
      btn.title = '点击隐藏此达人';
    } else {
      idElement.classList.remove(HIGHLIGHT_CLASSES.performance, HIGHLIGHT_CLASSES.lost, HIGHLIGHT_CLASSES.hidden);
      idElement.style.textDecoration = '';
      idElement.style.opacity = '';
      idElement.style.color = '';
      idElement.style.fontWeight = '';
      btn.classList.remove('blacklisted');
      btn.textContent = '隐藏';
      btn.title = '点击隐藏此达人';
    }
  }

  // 为节点应用高亮样式（绩效/流失/隐藏）
  function applyHighlight(node, norm) {
    const type = creatorSets.hidden.has(norm) ? 'hidden'
               : creatorSets.performance.has(norm) ? 'performance'
               : creatorSets.lost.has(norm) ? 'lost'
               : null;
    if (!type) return;

    node.classList.add(HIGHLIGHT_CLASSES[type]);
  }

  // 遍历容器，为达人ID添加高亮和标签
  function highlightAndTag() {
    const { performance, lost, hidden } = creatorSets;
    if (!performance.size && !lost.size && !hidden.size) return;

    const container = document.querySelector('.arco-table-body') ||
      document.querySelector('#root') || document.body;

    const targetContainers = container.querySelectorAll('.flex.flex-col.flex-1, [class*="creator-info__HightBoldText"]');
    const batchUpdates = [];

    targetContainers.forEach(el => {
      if (el.classList.contains(CREATOR_HIT_CLASS) ||
          el.classList.contains('quick-creator-lost') ||
          el.classList.contains('creator-id-blacklisted')) return;

      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable) return;
      if (el.querySelector('input, textarea, [contenteditable="true"]')) return;

      const rawText = (el.textContent || '').trim();
      if (!rawText) return;

      const norm = normalizeCreatorId(rawText);
      if (!norm) return;
      if (processedHighlights.has(el)) return;

      processedHighlights.add(el);
      batchUpdates.push({ node: el, norm });
    });

    batchUpdates.forEach(({ node, norm }) => {
      applyHighlight(node, norm);
    });

    const creatorIdElements = container.querySelectorAll('[class*="creator-info__HightBoldText"]');
    creatorIdElements.forEach(processCreatorIdHideButton);

    flexContainersLoop(container);
    imNameDivsLoop(container);
    imUnameDivsLoop(container);
  }

  // 替换达人ID下方的描述区域，用于显示达人标签
  function flexContainersLoop(container) {
    if (!allCreatorMap.size) return;

    container.querySelectorAll('.flex.flex-col.flex-1').forEach(flexCol => {
      const creatorIdDiv = flexCol.querySelector('[class*="HightBoldText"]');
      if (!creatorIdDiv) return;

      const creatorId = normalizeCreatorId(creatorIdDiv.textContent || '');
      if (!creatorId) return;

      if (processedFlexTags.has(flexCol)) return;
      processedFlexTags.add(flexCol);

      const creator = getCreatorById(creatorId);
      if (!creator || !creator.tag) return;

      const nameDiv = flexCol.querySelector('.text-neutral-text2.truncate:not([class*="HightBoldText"])');
      if (!nameDiv || nameDiv.dataset.tagReplaced === 'true') return;

      nameDiv.dataset.tagReplaced = 'true';
      const tagStyle = TAG_COLORS[creator.tag] || { bg: '#f0f0f0', color: '#333' };

      nameDiv.innerHTML = `<span style="display: inline-block; padding: 2px 8px; background: ${tagStyle.bg}; color: ${tagStyle.color}; border-radius: 4px; font-size: 12px; font-weight: 500;">${creator.tag.replace('达人', '')}</span>`;
    });
  }

  // 遍历IM消息中的名称div，为隐藏达人添加删除线
  function imNameDivsLoop(container) {
    if (!allCreatorMap.size) return;

    const cidToCreator = new Map();
    allCreatorMap.forEach((creator, id) => {
      if (creator.cid) cidToCreator.set(creator.cid.trim(), creator);
    });
    if (!cidToCreator.size) return;

    container.querySelectorAll('div[style*="-webkit-line-clamp: 1"]').forEach(nameDiv => {
      if (nameDiv.dataset.nameTagAdded === 'true') return;
      if (processedImNames.has(nameDiv)) return;
      processedImNames.add(nameDiv);

      const nameText = (nameDiv.textContent || '').trim();
      if (!nameText) return;

      const creator = cidToCreator.get(nameText);
      if (!creator || !creator.tag) return;

      nameDiv.dataset.nameTagAdded = 'true';

      if (creator.tag === '隐藏达人') {
        nameDiv.style.textDecoration = 'line-through';
        nameDiv.style.opacity = '0.5';
        nameDiv.style.color = '#999';
      }
    });
  }

  // 遍历IM消息中的用户名div，为隐藏达人添加样式和标签
  function imUnameDivsLoop(container) {
    if (!allCreatorMap.size) return;

    container.querySelectorAll('[class*="uname-"]').forEach(unameDiv => {
      if (processedImUnames.has(unameDiv)) return;
      processedImUnames.add(unameDiv);

      const creatorId = normalizeCreatorId(unameDiv.textContent || '');
      if (!creatorId) return;

      const creator = getCreatorById(creatorId);
      if (!creator || !creator.tag) return;

      if (creator.tag === '隐藏达人' && !unameDiv.dataset.hiddenStyled) {
        unameDiv.dataset.hiddenStyled = 'true';
        unameDiv.style.textDecoration = 'line-through';
        unameDiv.style.opacity = '0.5';
        unameDiv.style.color = '#999';
      }

      if (unameDiv.dataset.tagAdded === 'true') return;
      unameDiv.dataset.tagAdded = 'true';

      const tagStyle = TAG_COLORS[creator.tag] || { bg: '#f0f0f0', color: '#333' };

      const tagSpan = document.createElement('span');
      tagSpan.style.cssText = `display: inline-block; margin-right: 8px; padding: 2px 8px; background: ${tagStyle.bg}; color: ${tagStyle.color}; border-radius: 4px; font-size: 12px; font-weight: 500; vertical-align: middle; flex-shrink: 0; white-space: nowrap;`;
      tagSpan.textContent = creator.tag.replace('达人', '');

      const parentDiv = unameDiv.parentElement;
      if (parentDiv) {
        parentDiv.style.display = 'flex';
        parentDiv.style.alignItems = 'center';
        parentDiv.style.overflow = 'hidden';
        unameDiv.style.minWidth = '0';
        unameDiv.style.flex = '1';
        unameDiv.style.overflow = 'hidden';
        unameDiv.style.textOverflow = 'ellipsis';
        parentDiv.insertBefore(tagSpan, unameDiv);
      }
    });
  }

  // 延迟执行高亮任务，防止频繁触发
  function scheduleHighlightCreators() {
    if (highlightScheduled) return;
    highlightScheduled = true;

    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      rafId = null;
      highlightScheduled = false;
      highlightAndTag();
      updateTooltipContent();
    });
  }

  // 更新悬停提示内容，显示达人备注信息
  function updateTooltipContent() {
    if (!creatorSets.performance.size) return;

    document.querySelectorAll('.arco-tooltip-content-inner').forEach(tooltipContent => {
      const text = (tooltipContent.textContent || '').trim();
      const norm = normalizeCreatorId(text);

      if (norm) {
        const creator = getCreatorById(norm);
        if (creator && creator.remark && tooltipContent.textContent !== creator.remark) {
          tooltipContent.textContent = creator.remark;
        }
      }
    });
  }

  // 防抖函数
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  // 更新页面上所有达人的备注显示
  function updateCreatorRemarksOnPage() {
    try {
      const creatorIdElements = document.querySelectorAll('[data-e2e="8a94f9b6-1a48-fe57"]');
      if (!creatorIdElements.length) return;

      creatorIdElements.forEach(element => {
        const creatorId = (element.textContent || '').trim();
        const norm = normalizeCreatorId(creatorId);
        const creator = norm ? getCreatorById(norm) : null;

        let remarkElement = element.parentNode?.querySelector('.creator-page-remark-display');

        if (creator && creator.remark) {
          if (!remarkElement) {
            remarkElement = document.createElement('div');
            remarkElement.className = 'creator-page-remark-display';
            remarkElement.style.cssText = `
              margin-top: 8px; padding: 8px 12px; background: #f0f7ff;
              border: 1px solid #d1e9ff; border-radius: 6px; font-size: 12px;
              color: #1d5fff; font-weight: 500; word-wrap: break-word;
              white-space: pre-wrap; text-align: center; max-width: 300px;
            `;
            element.parentNode?.insertBefore(remarkElement, element.nextSibling);
          }
          const newContent = `备注: ${creator.remark}`;
          if (remarkElement.textContent !== newContent) {
            remarkElement.textContent = newContent;
          }
        } else if (remarkElement) {
          remarkElement.remove();
        }
      });
    } catch (error) {
      console.error('updateCreatorRemarksOnPage error:', error);
    }
  }

  const debouncedUpdateCreatorRemarks = debounce(updateCreatorRemarksOnPage, 500);

  // 设置MutationObserver监听页面DOM变化
  function setupCreatorObserver() {
    if (creatorObserver) creatorObserver.disconnect();
    const root = document.documentElement || document.body;
    if (!root) return;

    creatorObserver = new MutationObserver((mutations) => {
      let shouldUpdateRemarks = false;

      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE &&
                node.querySelector?.('[data-e2e="8a94f9b6-1a48-fe57"], [class*="creator-info__HightBoldText"]')) {
              shouldUpdateRemarks = true;
              break;
            }
          }
        }
        if (shouldUpdateRemarks) break;
      }

      scheduleHighlightCreators();
      if (shouldUpdateRemarks) debouncedUpdateCreatorRemarks();
    });

    creatorObserver.observe(root, { childList: true, subtree: true });
    scheduleHighlightCreators();
  }

  // 初始化达人高亮模块
  function init() {
    injectHighlightStyles();
    loadCreators();
    setupCreatorObserver();

    document.addEventListener('DOMContentLoaded', () => {
      scheduleHighlightCreators();
      setTimeout(updateCreatorRemarksOnPage, 1000);
    }, { once: true });

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || !changes.savedCreators) return;
      creators = Array.isArray(changes.savedCreators.newValue) ? changes.savedCreators.newValue : [];
      buildCreatorSets();
      scheduleHighlightCreators();
      updateTooltipContent();
      setTimeout(updateCreatorRemarksOnPage, 100);
    });
  }

  init();

  window.addEventListener('unhandledrejection', event => {
    if (event.reason?.message?.includes('Extension context invalidated')) {
      event.preventDefault();
    }
  }, { passive: false });
})();
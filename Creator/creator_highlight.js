// 达人ID高亮与隐藏功能

(function () {
  'use strict';

  if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return;

  const CREATOR_HIT_CLASS = 'quick-creator-hit';
  const TAG_COLORS = {
    '绩效达人': { bg: '#ffebee', color: '#c62828' },
    '流失达人': { bg: '#e8f5e9', color: '#2e7d32' },
    '隐藏达人': { bg: '#f5f5f5', color: '#616161' }
  };

  let creators = [];
  let creatorSets = { performance: new Set(), lost: new Set(), hidden: new Set() };
  let allCreatorMap = new Map();
  let creatorObserver = null;
  let highlightScheduled = false;

  function injectHighlightStyles() {
    if (document.getElementById('creator-highlight-styles')) return;
    const style = document.createElement('style');
    style.id = 'creator-highlight-styles';
    style.textContent = `
      .${CREATOR_HIT_CLASS} { color: #ff0050 !important; font-weight: 700; }
      .quick-creator-lost { color: #117a42 !important; font-weight: 700; opacity: 0.5; }
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

  function normalizeCreatorId(text) {
    return (text || '').trim().replace(/^[@＠]+/, '').trim();
  }

  function buildCreatorSets() {
    const performance = new Set();
    const lost = new Set();
    const hidden = new Set();
    const map = new Map();

    for (const c of creators) {
      if (!c || !c.id) continue;
      const norm = normalizeCreatorId(String(c.id));
      if (!norm) continue;

      map.set(norm, c);

      if (c.tag === '绩效达人') performance.add(norm);
      else if (c.tag === '流失达人') lost.add(norm);
      else if (c.tag === '隐藏达人') hidden.add(norm);
    }

    creatorSets = { performance, lost, hidden };
    allCreatorMap = map;
  }

  function getCreatorById(normalizedId) {
    return allCreatorMap.get(normalizedId) || null;
  }

  async function loadCreators() {
    try {
      const result = await new Promise(resolve =>
        chrome.storage.local.get(['savedCreators'], resolve)
      );
      creators = Array.isArray(result.savedCreators) ? result.savedCreators : [];
      buildCreatorSets();
      scheduleHighlightCreators();
    } catch (e) {
      creators = [];
      buildCreatorSets();
    }
  }

  async function saveCreators() {
    try {
      await new Promise(resolve =>
        chrome.storage.local.set({ savedCreators: creators }, resolve)
      );
      try {
        chrome.runtime.sendMessage({ action: 'creatorDataUpdated' }).catch(() => {});
      } catch (msgError) {}
    } catch (storageError) {
      console.debug('达人数据保存失败', storageError);
    }
  }

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

  function updateCreatorData(normId, newTag) {
    const existingCreator = getCreatorById(normId);
    if (newTag === '') {
      if (existingCreator) {
        existingCreator.tag = '';
        saveCreators().then(() => buildCreatorSets());
      }
    } else {
      if (existingCreator) {
        existingCreator.tag = newTag;
        saveCreators().then(() => buildCreatorSets());
      } else {
        creators.push({
          id: normId, cid: '', region: '', tag: newTag, remark: '', hiddenAt: Date.now()
        });
        saveCreators().then(() => buildCreatorSets());
      }
    }
  }

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
      idElement.classList.add('creator-id-blacklisted');
      idElement.style.textDecoration = 'line-through';
      idElement.style.opacity = '0.5';
      idElement.style.color = '#999';
      btn.classList.add('blacklisted');
      btn.textContent = '解除';
      btn.title = '点击取消隐藏';
    } else {
      idElement.classList.remove('creator-id-blacklisted');
      idElement.style.textDecoration = '';
      idElement.style.opacity = '';
      idElement.style.color = '';
      btn.classList.remove('blacklisted');
      btn.textContent = '隐藏';
      btn.title = '点击隐藏此达人';
    }
  }

  function applyHighlight(node, norm) {
    if (creatorSets.hidden.has(norm)) {
      node.classList.add('creator-id-blacklisted');
      node.style.textDecoration = 'line-through';
      node.style.opacity = '0.5';
      node.style.color = '#999';
    } else if (creatorSets.performance.has(norm)) {
      node.classList.add(CREATOR_HIT_CLASS);
    } else if (creatorSets.lost.has(norm)) {
      node.classList.add('quick-creator-lost');
    }
  }

  function highlightAndTag() {
    const { performance, lost, hidden } = creatorSets;
    if (!performance.size && !lost.size && !hidden.size) return;

    const container = document.querySelector('.arco-table-body') ||
      document.querySelector('#root') || document.body;

    const targetContainers = container.querySelectorAll('.flex.flex-col.flex-1, [class*="creator-info__HightBoldText"]');
    const relevantNodes = [];

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

      relevantNodes.push({ node: el, norm });
    });

    relevantNodes.forEach(({ node, norm }) => {
      applyHighlight(node, norm);
    });

    const creatorIdElements = container.querySelectorAll('[class*="creator-info__HightBoldText"]');
    creatorIdElements.forEach(processCreatorIdHideButton);

    flexContainersLoop(container);
    imNameDivsLoop(container);
    imUnameDivsLoop(container);
  }

  function flexContainersLoop(container) {
    if (!allCreatorMap.size) return;

    container.querySelectorAll('.flex.flex-col.flex-1').forEach(flexCol => {
      const creatorIdDiv = flexCol.querySelector('[class*="HightBoldText"]');
      if (!creatorIdDiv) return;

      const creatorId = normalizeCreatorId(creatorIdDiv.textContent || '');
      if (!creatorId) return;

      const creator = getCreatorById(creatorId);
      if (!creator || !creator.tag) return;

      const nameDiv = flexCol.querySelector('.text-neutral-text2.truncate:not([class*="HightBoldText"])');
      if (!nameDiv || nameDiv.dataset.tagReplaced === 'true') return;

      nameDiv.dataset.tagReplaced = 'true';
      const tagStyle = TAG_COLORS[creator.tag] || { bg: '#f0f0f0', color: '#333' };

      nameDiv.innerHTML = `<span style="display: inline-block; padding: 2px 8px; background: ${tagStyle.bg}; color: ${tagStyle.color}; border-radius: 4px; font-size: 12px; font-weight: 500;">${creator.tag.replace('达人', '')}</span>`;
    });
  }

  function imNameDivsLoop(container) {
    if (!allCreatorMap.size) return;

    const cidToCreator = new Map();
    allCreatorMap.forEach((creator, id) => {
      if (creator.cid) cidToCreator.set(creator.cid.trim(), creator);
    });
    if (!cidToCreator.size) return;

    container.querySelectorAll('div[style*="-webkit-line-clamp: 1"]').forEach(nameDiv => {
      if (nameDiv.dataset.nameTagAdded === 'true') return;

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

  function imUnameDivsLoop(container) {
    if (!allCreatorMap.size) return;

    container.querySelectorAll('[class*="uname-"]').forEach(unameDiv => {
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

  function scheduleHighlightCreators() {
    if (highlightScheduled) return;
    highlightScheduled = true;
    requestAnimationFrame(() => {
      highlightScheduled = false;
      highlightAndTag();
      updateTooltipContent();
    });
  }

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

  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

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
          const newContent = `📝 备注: ${creator.remark}`;
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
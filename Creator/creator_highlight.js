// 达人ID高亮与隐藏功能

(function () {
  'use strict';

  if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return;

  let creators = [];
  const CREATOR_HIT_CLASS = 'quick-creator-hit';
  let creatorObserver = null;
  let highlightScheduled = false;

  function injectHighlightStyles() {
    if (document.getElementById('creator-highlight-styles')) return;
    const style = document.createElement('style');
    style.id = 'creator-highlight-styles';
    style.textContent = `
      .${CREATOR_HIT_CLASS} {
        color: #ff0050 !important;
        font-weight: 700;
      }
      .quick-creator-lost {
        color: #117a42 !important;
        font-weight: 700;
        opacity: 0.5;
      }
      .creator-blacklist-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 32px;
        height: 18px;
        margin-left: 6px;
        padding: 0 4px;
        background: #ffe0e6;
        border: 1px solid #ff0050;
        border-radius: 100px;
        cursor: pointer;
        font-size: 10px;
        font-weight: 500;
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
        opacity: 0.5 !important;
        color: #999 !important;
      }
      .creator-id-blacklisted:hover {
        text-decoration: line-through !important;
        opacity: 0.5 !important;
      }
    `;
    document.documentElement.appendChild(style);
  }

  async function loadCreators() {
    try {
      const result = await new Promise(resolve => 
        chrome.storage.local.get(['savedCreators'], resolve)
      );
      creators = Array.isArray(result.savedCreators) ? result.savedCreators : [];
      scheduleHighlightCreators();
    } catch (e) {
      creators = [];
    }
  }

  async function saveCreators() {
    try {
      await new Promise(resolve =>
        chrome.storage.local.set({ savedCreators: creators }, resolve)
      );
      try {
        if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage({ action: 'creatorDataUpdated' }).catch(() => {});
        }
      } catch (msgError) {}
    } catch (storageError) {
      console.debug('达人数据保存失败', storageError);
    }
  }

  function normalizeCreatorId(text) {
    return (text || '')
      .trim()
      .replace(/^[@＠]+/, '')
      .trim();
  }

  function getCreatorIdSet() {
    const ids = new Set();
    if (!Array.isArray(creators)) return ids;
    for (const c of creators) {
      if (c && c.tag === '绩效达人') {
        const raw = c.id ? String(c.id) : '';
        const norm = normalizeCreatorId(raw);
        if (norm) ids.add(norm);
      }
    }
    return ids;
  }

  function getLostCreatorIdSet() {
    const ids = new Set();
    if (!Array.isArray(creators)) return ids;
    for (const c of creators) {
      if (c && c.tag === '流失达人') {
        const raw = c.id ? String(c.id) : '';
        const norm = normalizeCreatorId(raw);
        if (norm) ids.add(norm);
      }
    }
    return ids;
  }

  function getHiddenCreatorIdSet() {
    const ids = new Set();
    if (!Array.isArray(creators)) return ids;
    for (const c of creators) {
      if (c && c.tag === '隐藏达人') {
        const raw = c.id ? String(c.id) : '';
        const norm = normalizeCreatorId(raw);
        if (norm) ids.add(norm);
      }
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
        await loadCreators();
        const normId = normalizeCreatorId(creatorId);
        const existingCreator = getCreatorById(normId);
        const isHidden = existingCreator && existingCreator.tag === '隐藏达人';

        if (isHidden) {
          existingCreator.tag = '';
          creatorIdElement.classList.remove('creator-id-blacklisted');
          btn.classList.remove('blacklisted');
          btn.textContent = '隐藏';
          btn.title = '点击隐藏此达人';
        } else {
          if (existingCreator) {
            existingCreator.tag = '隐藏达人';
          } else {
            creators.push({
              id: normId,
              cid: '',
              region: '',
              tag: '隐藏达人',
              remark: '',
              hiddenAt: Date.now()
            });
          }
          creatorIdElement.classList.add('creator-id-blacklisted');
          btn.classList.add('blacklisted');
          btn.textContent = '解除';
          btn.title = '点击取消隐藏';
        }

        await saveCreators();
        scheduleHighlightCreators();
      } catch (error) {
        if (!error.message.includes('Extension context invalidated')) {
          console.error('隐藏操作出错', error);
        }
      }
    });

    return btn;
  }

  function processCreatorIdHideButton(idElement) {
    const rawCreatorId = (idElement.textContent || '').trim();
    if (!rawCreatorId) return;

    const normId = normalizeCreatorId(rawCreatorId);
    if (!normId || !rawCreatorId.startsWith('@') && !/[a-zA-Z]/.test(rawCreatorId)) return;

    let parentContainer = idElement.parentNode;
    const existingBtn = parentContainer?.querySelector('.creator-blacklist-btn');

    if (!existingBtn && parentContainer) {
      const btn = createBlacklistButton(idElement, rawCreatorId);
      parentContainer.appendChild(btn);
    }

    const hiddenIds = getHiddenCreatorIdSet();
    if (hiddenIds.has(normId)) {
      idElement.classList.add('creator-id-blacklisted');
      idElement.style.textDecoration = 'line-through';
      idElement.style.opacity = '0.5';
      idElement.style.color = '#999';

      const btn = idElement.parentNode?.querySelector('.creator-blacklist-btn');
      if (btn) {
        btn.classList.add('blacklisted');
        btn.textContent = '解除';
      }
    }
  }

  function highlightCreators() {
    const performanceIds = getCreatorIdSet();
    const lostIds = getLostCreatorIdSet();
    const hiddenIds = getHiddenCreatorIdSet();
    if (!performanceIds.size && !lostIds.size && !hiddenIds.size) return;

    const container =
      document.querySelector('.arco-table-body') ||
      document.querySelector('#root') ||
      document.body;

    const candidates = container.querySelectorAll(
      'td .arco-table-cell-wrap-value, td .arco-table-cell, td div,' +
      'a, span, div'
    );

    candidates.forEach(node => {
      if (!(node instanceof HTMLElement)) return;
      if (node.classList.contains(CREATOR_HIT_CLASS) || 
          node.classList.contains('quick-creator-lost') || 
          node.classList.contains('creator-id-blacklisted')) return;

      const rawText = (node.textContent || '').trim();
      if (!rawText) return;
      const norm = normalizeCreatorId(rawText);
      if (!norm) return;

      if (hiddenIds.has(norm)) {
        node.classList.add('creator-id-blacklisted');
        node.style.textDecoration = 'line-through';
        node.style.opacity = '0.5';
        node.style.color = '#999';
      } else if (performanceIds.has(norm)) {
        node.classList.add(CREATOR_HIT_CLASS);
      } else if (lostIds.has(norm)) {
        node.classList.add('quick-creator-lost');
      }
    });

    // 处理隐藏按钮
    const creatorIdElements = container.querySelectorAll('[class*="creator-info__HightBoldText"]');
    creatorIdElements.forEach(el => {
      processCreatorIdHideButton(el);
    });
  }

  function replaceCreatorNameWithTag() {
    const allCreators = new Map();
    if (Array.isArray(creators)) {
      for (const c of creators) {
        if (c && c.id && c.tag) {
          const norm = normalizeCreatorId(String(c.id));
          if (norm) allCreators.set(norm, c.tag);
        }
      }
    }
    if (allCreators.size === 0) return;

    const container =
      document.querySelector('.arco-table-body') ||
      document.querySelector('#root') ||
      document.body;

    // 处理达人列表页面
    const flexContainers = container.querySelectorAll('.flex.flex-col.flex-1');

    flexContainers.forEach(flexCol => {
      const creatorIdDiv = flexCol.querySelector('[class*="HightBoldText"]');
      if (!creatorIdDiv) return;

      const creatorId = normalizeCreatorId(creatorIdDiv.textContent || '');
      if (!creatorId) return;

      const tag = allCreators.get(creatorId);
      if (!tag) return;

      const nameDiv = flexCol.querySelector('.text-neutral-text2.truncate:not([class*="HightBoldText"])');
      if (!nameDiv) return;

      if (nameDiv.dataset.tagReplaced === 'true') return;

      nameDiv.dataset.tagReplaced = 'true';

      const tagColors = {
        '绩效达人': { bg: '#ffebee', color: '#c62828' },
        '流失达人': { bg: '#e8f5e9', color: '#2e7d32' },
        '隐藏达人': { bg: '#f5f5f5', color: '#616161' }
      };

      const tagStyle = tagColors[tag] || { bg: '#f0f0f0', color: '#333' };

      nameDiv.innerHTML = `<span style="
        display: inline-block;
        padding: 2px 8px;
        background: ${tagStyle.bg};
        color: ${tagStyle.color};
        border-radius: 4px;
        font-size: 12px;
        font-weight: 500;
      ">${tag.replace('达人', '')}</span>`;
    });

    // 处理 IM 页面达人名称列表
    const imNameDivs = container.querySelectorAll('div[style*="-webkit-line-clamp: 1"]');
    imNameDivs.forEach(nameDiv => {
      const nameText = (nameDiv.textContent || '').trim();
      if (!nameText) return;

      let creatorId = null;
      let tag = null;

      for (const [cId, cTag] of allCreators.entries()) {
        const creator = getCreatorById(cId);
        if (creator && creator.cid) {
          const cidName = (creator.cid || '').trim();
          if (cidName === nameText) {
            creatorId = cId;
            tag = cTag;
            break;
          }
        }
      }

      if (!tag) return;

      if (nameDiv.dataset.nameTagAdded === 'true') return;
      nameDiv.dataset.nameTagAdded = 'true';

      const isHidden = tag === '隐藏达人';
      if (isHidden) {
        nameDiv.style.textDecoration = 'line-through';
        nameDiv.style.opacity = '0.5';
        nameDiv.style.color = '#999';
      }
    });

    // 处理 IM 页面达人ID旁边显示标签
    const imUnameDivs = container.querySelectorAll('[class*="uname-"]');
    imUnameDivs.forEach(unameDiv => {
      const creatorId = normalizeCreatorId(unameDiv.textContent || '');
      if (!creatorId) return;

      const tag = allCreators.get(creatorId);
      const isHidden = tag === '隐藏达人';

      if (isHidden && !unameDiv.dataset.hiddenStyled) {
        unameDiv.dataset.hiddenStyled = 'true';
        unameDiv.style.textDecoration = 'line-through';
        unameDiv.style.opacity = '0.5';
        unameDiv.style.color = '#999';
      }

      if (!tag) return;

      if (unameDiv.dataset.tagAdded === 'true') return;
      unameDiv.dataset.tagAdded = 'true';

      const tagColors = {
        '绩效达人': { bg: '#ffebee', color: '#c62828' },
        '流失达人': { bg: '#e8f5e9', color: '#2e7d32' },
        '隐藏达人': { bg: '#f5f5f5', color: '#616161' }
      };

      const tagStyle = tagColors[tag] || { bg: '#f0f0f0', color: '#333' };

      const tagSpan = document.createElement('span');
      tagSpan.style.cssText = `
        display: inline-block;
        margin-right: 8px;
        padding: 2px 8px;
        background: ${tagStyle.bg};
        color: ${tagStyle.color};
        border-radius: 4px;
        font-size: 12px;
        font-weight: 500;
        vertical-align: middle;
        flex-shrink: 0;
        white-space: nowrap;
      `;
      tagSpan.textContent = tag.replace('达人', '');

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
      highlightCreators();
      replaceCreatorNameWithTag();
    });
  }

  function updateTooltipContent() {
    const tooltipContents = document.querySelectorAll('.arco-tooltip-content-inner');

    tooltipContents.forEach(tooltipContent => {
      const text = (tooltipContent.textContent || '').trim();
      const norm = normalizeCreatorId(text);

      if (norm && getCreatorIdSet().has(norm)) {
        const creator = getCreatorById(norm);
        if (creator && creator.remark) {
          if (tooltipContent.textContent !== creator.remark) {
            tooltipContent.textContent = creator.remark;
          }
        }
      }
    });
  }

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

  function updateCreatorRemarksOnPage() {
    try {
      const creatorIdElements = document.querySelectorAll('[data-e2e="8a94f9b6-1a48-fe57"]');

      if (creatorIdElements.length === 0) return;

      creatorIdElements.forEach(element => {
        const creatorId = (element.textContent || '').trim();
        const norm = normalizeCreatorId(creatorId);

        if (norm && getCreatorIdSet().has(norm)) {
          const creator = getCreatorById(norm);

          if (creator && creator.remark) {
            let remarkElement = element.parentNode.querySelector('.creator-page-remark-display');
            if (!remarkElement) {
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
              if (element.parentNode) {
                element.parentNode.insertBefore(remarkElement, element.nextSibling);
              }
            }
            const newContent = `📝 备注: ${creator.remark}`;
            if (remarkElement && remarkElement.textContent !== newContent) {
              remarkElement.textContent = newContent;
            }
          } else {
            const remarkElement = element.parentNode?.querySelector('.creator-page-remark-display');
            if (remarkElement) {
              remarkElement.remove();
            }
          }
        } else {
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

  const debouncedUpdateCreatorRemarks = debounce(updateCreatorRemarksOnPage, 500);

  function setupCreatorObserver() {
    if (creatorObserver) creatorObserver.disconnect();
    const root = document.documentElement || document.body;
    if (!root) return;

    creatorObserver = new MutationObserver((mutations) => {
      let shouldUpdateRemarks = false;

      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          const hasNewCreatorElements = Array.from(mutation.addedNodes).some(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              return node.querySelector && (
                node.querySelector('[data-e2e="8a94f9b6-1a48-fe57"]') ||
                node.querySelector('[class*="creator-info__HightBoldText"]') ||
                (node.matches && node.matches('[data-e2e="8a94f9b6-1a48-fe57"]'))
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

      scheduleHighlightCreators();
      updateTooltipContent();

      if (shouldUpdateRemarks) {
        debouncedUpdateCreatorRemarks();
      }
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
      setTimeout(() => updateCreatorRemarksOnPage(), 1000);
    }, { once: true });

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      if (changes.savedCreators) {
        creators = Array.isArray(changes.savedCreators.newValue) ? changes.savedCreators.newValue : [];
        scheduleHighlightCreators();
        updateTooltipContent();
        setTimeout(() => updateCreatorRemarksOnPage(), 100);
      }
    });
  }

  init();

  window.addEventListener('unhandledrejection', event => {
    if (event.reason && event.reason.message &&
      event.reason.message.includes('Extension context invalidated')) {
      event.preventDefault();
    }
  }, { passive: false });
})();

// 达人ID高亮与隐藏功能
// 功能说明：
//   - 绩效达人：红色高亮 + 加粗 (quick-creator-hit)
//   - 复联达人：红色高亮 + 加粗 (quick-creator-hit)
//   - 流失达人：绿色高亮 + 加粗 + 50%透明度 + 删除线 (quick-creator-lost)
//   - 隐藏达人：灰色 + 删除线 + 50%透明度 (creator-id-blacklisted)
// 样式实现：CSS类 + 内联样式双重保护，防止鼠标悬停时样式被页面覆盖丢失
// 更新记录：
//   - 2026-03-31: 统一三种达人的样式实现方式，均使用 CSS类 + 内联样式
//   - 修复绩效/流失达人在鼠标悬停时样式消失的问题
//   - 2026-06-10: 适配样品申请页 (sample-request) 新 DOM 结构

(function () {
  'use strict';

  if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return;

  const CREATOR_HIT_CLASS = 'quick-creator-hit';
  const TAG_COLORS = {
    '绩效达人': { bg: '#ffebee', color: '#c62828' },
    '复联达人': { bg: '#ffebee', color: '#c62828' },
    '流失达人': { bg: '#e8f5e9', color: '#2e7d32' },
    '隐藏达人': { bg: '#f5f5f5', color: '#616161' }
  };

  const HIGHLIGHT_CLASSES = {
    performance: 'quick-creator-hit',
    lost: 'quick-creator-lost',
    hidden: 'creator-id-blacklisted'
  };

  // 达人详情页的 creator ID 选择器
  const DETAIL_PAGE_SELECTOR = '[data-e2e="8a94f9b6-1a48-fe57"]';
  // 样品申请页的 creator ID 选择器
  const SAMPLE_REQUEST_SELECTOR = '[data-e2e="afc4471a-9b2c-8882"]';
  // 样品申请页的 creator 名称选择器
  const SAMPLE_REQUEST_NAME_SELECTOR = '[data-e2e="3a7a3250-d2be-fd27"]';
  const ALL_CREATOR_ID_SELECTORS = `${DETAIL_PAGE_SELECTOR}, ${SAMPLE_REQUEST_SELECTOR}`;

  function isSampleRequestPage() {
    return location.pathname.includes('/product/sample-request');
  }

  function findAllCreatorIdElements(root) {
    return (root || document).querySelectorAll(ALL_CREATOR_ID_SELECTORS);
  }

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

  function injectHighlightStyles() {
    if (document.getElementById('creator-highlight-styles')) return;
    const style = document.createElement('style');
    style.id = 'creator-highlight-styles';
    style.textContent = `
      .${CREATOR_HIT_CLASS} { color: #ff0050 !important; font-weight: 700; }
      .quick-creator-lost { color: #117a42 !important; font-weight: 700; opacity: 0.5; text-decoration: line-through; }
      .creator-blacklist-btn {
        display: inline-flex; align-items: center; justify-content: center;
        min-width: 28px; height: 22px; margin-left: 6px; padding: 0 8px;
        background: #fff; border: 1px solid #d1d5db; border-radius: 6px;
        cursor: pointer; font-size: 11px; font-weight: 500; transition: all 0.15s ease;
        color: #374151; white-space: nowrap;
      }
      .creator-blacklist-btn:hover { background: #f3f4f6; border-color: #9ca3af; }
      .creator-blacklist-btn.blacklisted { background: #f9fafb; border-color: #e5e7eb; color: #9ca3af; }
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
      if (!c || !c.creator_id) continue;
      const norm = normalizeCreatorId(String(c.creator_id));
      if (!norm) continue;

      map.set(norm, c);

      if (c.tag === '绩效达人') performance.add(norm);
      else if (c.tag === '复联达人') performance.add(norm);
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
      console.error('[Creator Highlight] 加载达人数据失败:', e);
      creators = [];
      buildCreatorSets();
    }
  }

  async function saveCreators() {
    try {
      await new Promise(resolve =>
        chrome.storage.local.set({ savedCreators: creators }, resolve)
      );
    } catch (e) {
      console.error('[Creator Highlight] 保存达人数据失败:', e);
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

      const allIdElements = findAllCreatorIdElements();
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

  async function updateCreatorData(normId, newTag) {
    const existingCreator = getCreatorById(normId);

    if (existingCreator) {
      existingCreator.tag = newTag;
      await saveCreators();
      buildCreatorSets();
    } else if (newTag !== '') {
      creators.push({
        creator_id: normId,
        cid: '',
        region: '',
        tag: newTag,
        remark: ''
      });
      await saveCreators();
      buildCreatorSets();
    }

    try {
      const result = await chrome.storage.local.get(['hiddenFeishuConfig']);
      const hiddenConfig = result.hiddenFeishuConfig;
      if (!hiddenConfig || !hiddenConfig.baseToken || !hiddenConfig.tableId) return;

      const nameField = hiddenConfig.creatorNameField || '达人名称';
      const cidField = hiddenConfig.creatorCidField || '达人CID';
      const statusField = hiddenConfig.creatorStatusField || '达人状态';
      const regionField = hiddenConfig.creatorRegionField || '地区';

      // 1. 获取飞书表中所有现有记录
      const listResult = await chrome.runtime.sendMessage({
        action: 'listBitableRecords',
        config: hiddenConfig
      });

      if (listResult?.success && listResult.records?.length > 0) {
        // 2. 清空：批量删除所有现有记录
        const recordIds = listResult.records.map(r => r.recordId).filter(Boolean);
        if (recordIds.length > 0) {
          const deleteResult = await chrome.runtime.sendMessage({
            action: 'batchDeleteBitableRecords',
            config: hiddenConfig,
            recordIds: recordIds
          });
          if (!deleteResult?.success) {
            console.error('[Creator Highlight] 飞书批量删除失败:', deleteResult?.error);
          } else {
            console.log('[Creator Highlight] 飞书已清空', deleteResult.deleted, '条记录');
          }
        }
      }

      // 3. 全量同步：将本地所有隐藏达人批量写入
      const hiddenCreators = creators.filter(c => c.tag === '隐藏达人');
      if (hiddenCreators.length > 0) {
        const records = hiddenCreators.map(c => ({
          fields: {
            [nameField]: c.creator_id || '',
            [cidField]: c.cid || '',
            [regionField]: c.region || '',
            [statusField]: c.tag || '隐藏达人',
            '备注': c.remark || ''
          }
        }));

        const createResult = await chrome.runtime.sendMessage({
          action: 'batchCreateBitableRecords',
          config: hiddenConfig,
          records: records
        });

        if (createResult?.success) {
          // 回写 recordId 到本地
          const returnedIds = createResult.recordIds || [];
          for (let i = 0; i < hiddenCreators.length; i++) {
            if (returnedIds[i]) {
              hiddenCreators[i]._feishuRecordId = returnedIds[i];
              hiddenCreators[i]._dataSourceId = 'hidden';
            }
          }
          await saveCreators();
          console.log('[Creator Highlight] 飞书已同步', createResult.created, '条隐藏达人');
        } else {
          console.error('[Creator Highlight] 飞书批量创建失败:', createResult?.error);
        }
      }
    } catch (e) {
      console.error('[Creator Highlight] 同步隐藏数据源失败:', e);
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

  function applyHighlight(node, norm) {
    const type = creatorSets.hidden.has(norm) ? 'hidden'
               : creatorSets.performance.has(norm) ? 'performance'
               : creatorSets.lost.has(norm) ? 'lost'
               : null;
    if (!type) return;

    node.classList.add(HIGHLIGHT_CLASSES[type]);
  }

  function highlightAndTag() {
    const { performance, lost, hidden } = creatorSets;
    if (!performance.size && !lost.size && !hidden.size) return;

    const container = document.querySelector('.arco-table-body') ||
      document.querySelector('#root') || document.body;

    const targetContainers = container.querySelectorAll(`.flex.flex-col.flex-1, [class*="creator-info__HightBoldText"], ${SAMPLE_REQUEST_SELECTOR}`);
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

    const creatorIdElements = container.querySelectorAll(`[class*="creator-info__HightBoldText"], ${SAMPLE_REQUEST_SELECTOR}`);
    creatorIdElements.forEach(processCreatorIdHideButton);

    flexContainersLoop(container);
    sampleRequestNameLoop(container);
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

      if (processedFlexTags.has(flexCol)) return;
      processedFlexTags.add(flexCol);

      const creator = getCreatorById(creatorId);
      if (!creator || !creator.tag) return;

      const nameDiv = flexCol.querySelector('.text-neutral-text2.truncate:not([class*="HightBoldText"])');
      if (!nameDiv || nameDiv.dataset.tagReplaced === 'true') return;

      nameDiv.dataset.tagReplaced = 'true';
      const tagStyle = TAG_COLORS[creator.tag] || { bg: '#f0f0f0', color: '#333' };

      nameDiv.innerHTML = `<span style="display: inline-block; padding: 1px 5px; background: ${tagStyle.bg}; color: ${tagStyle.color}; border: 1px solid #e0e0e0; border-radius: 4px; font-size: 12px; font-weight: 500;">${creator.tag.replace('达人', '')}</span>`;
    });
  }

  const processedSampleReqNames = new Set();
  function sampleRequestNameLoop(container) {
    if (!allCreatorMap.size) return;

    container.querySelectorAll(SAMPLE_REQUEST_NAME_SELECTOR).forEach(nameDiv => {
      if (nameDiv.dataset.tagReplaced === 'true') return;
      if (processedSampleReqNames.has(nameDiv)) return;
      processedSampleReqNames.add(nameDiv);

      // 向上找到包含 ID 元素的共同父容器
      const parentRow = nameDiv.closest('[class*="table-row"], [class*="card"], [class*="list-item"], [class*="row"]') || nameDiv.parentElement?.parentElement;
      if (!parentRow) return;

      const idDiv = parentRow.querySelector(SAMPLE_REQUEST_SELECTOR);
      if (!idDiv) return;

      const creatorId = normalizeCreatorId(idDiv.textContent || '');
      if (!creatorId) return;

      const creator = getCreatorById(creatorId);
      if (!creator || !creator.tag) return;

      nameDiv.dataset.tagReplaced = 'true';
      const tagStyle = TAG_COLORS[creator.tag] || { bg: '#f0f0f0', color: '#333' };
      nameDiv.innerHTML = `<span style="display: inline-block; padding: 1px 5px; background: ${tagStyle.bg}; color: ${tagStyle.color}; border: 1px solid #e0e0e0; border-radius: 4px; font-size: 12px; font-weight: 500;">${creator.tag.replace('达人', '')}</span>`;
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
      tagSpan.style.cssText = `display: inline-block; margin-right: 8px; padding: 1px 5px; background: ${tagStyle.bg}; color: ${tagStyle.color}; border: 1px solid #e0e0e0; border-radius: 4px; font-size: 12px; font-weight: 500; vertical-align: middle; flex-shrink: 0; white-space: nowrap;`;
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

    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      rafId = null;
      highlightScheduled = false;
      highlightAndTag();
      updateTooltipContent();
    });
  }

  function updateTooltipContent() {
    if (!allCreatorMap.size) return;

    document.querySelectorAll('.arco-tooltip-content-inner, .core-tooltip-content-inner').forEach(tooltipContent => {
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
      const creatorIdElements = findAllCreatorIdElements();
      if (!creatorIdElements.length) return;

      creatorIdElements.forEach(element => {
        // 样品申请页不注入备注显示
        if (element.matches(SAMPLE_REQUEST_SELECTOR)) return;
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
                node.querySelector?.(ALL_CREATOR_ID_SELECTORS + ', [class*="creator-info__HightBoldText"]')) {
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

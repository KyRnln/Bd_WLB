// 达人ID高亮功能

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
    const performanceIds = getCreatorIdSet();
    const lostIds = getLostCreatorIdSet();
    if (!performanceIds.size && !lostIds.size) return;

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
      if (node.classList.contains(CREATOR_HIT_CLASS) || node.classList.contains('quick-creator-lost')) return;

      const rawText = (node.textContent || '').trim();
      if (!rawText) return;
      const norm = normalizeCreatorId(rawText);
      if (!norm) return;

      if (performanceIds.has(norm)) {
        node.classList.add(CREATOR_HIT_CLASS);
      } else if (lostIds.has(norm)) {
        node.classList.add('quick-creator-lost');
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
})();

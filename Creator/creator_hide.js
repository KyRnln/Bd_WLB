// 达人ID隐藏功能

(function () {
  'use strict';

  if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return;

  let creators = [];

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
      .creator-id-blacklisted:hover {
        text-decoration: line-through !important;
        opacity: 0.25 !important;
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

  function getCreatorByNormalizedId(normalizedId) {
    if (!Array.isArray(creators)) return null;
    for (const c of creators) {
      const raw = c && c.id ? String(c.id) : '';
      const norm = normalizeCreatorId(raw);
      if (norm === normalizedId) return c;
    }
    return null;
  }

  function getCreatorIdFromElement(element) {
    const textContent = element.textContent || '';
    return textContent.trim();
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
        const existingCreator = getCreatorByNormalizedId(normId);
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
      } catch (error) {
        if (!error.message.includes('Extension context invalidated')) {
          console.error('隐藏操作出错', error);
        }
      }
    });

    return btn;
  }

  async function processCreatorIdElement(idElement) {
    const rawCreatorId = getCreatorIdFromElement(idElement);
    if (!rawCreatorId) return;

    const normId = normalizeCreatorId(rawCreatorId);

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

  async function initBlacklistFeature() {
    try {
      injectBlacklistStyles();
      await loadCreators();

      const observer = new MutationObserver(async mutations => {
        try {
          await loadCreators();
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
                        const norm = normalizeCreatorId(text);
                        if (norm && (text.startsWith('@') || /[a-zA-Z]/.test(text))) {
                          processCreatorIdElement(el);
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
      for (const el of allIdElements) {
        try {
          const text = getCreatorIdFromElement(el);
          const norm = normalizeCreatorId(text);
          if (norm && (text.startsWith('@') || /[a-zA-Z]/.test(text))) {
            await processCreatorIdElement(el);
          }
        } catch (elErr) {}
      }
    } catch (initError) {
      console.debug('隐藏功能初始化失败', initError);
    }
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.savedCreators) {
      creators = Array.isArray(changes.savedCreators.newValue) ? changes.savedCreators.newValue : [];
    }
  });

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

  window.addEventListener('unhandledrejection', event => {
    if (event.reason && event.reason.message &&
      event.reason.message.includes('Extension context invalidated')) {
      event.preventDefault();
    }
  }, { passive: false });
})();

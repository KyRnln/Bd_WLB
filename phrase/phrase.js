// 快捷短语模块

(function() {
  'use strict';

  const API_BASE_URL = 'https://kyrnln.cloud/api';
  const DEFAULT_TAG_ID = 'default';
  const PHRASE_ACTIVE_TAG_KEY = 'phrase_active_tag_id';

  let phrases = [];
  let tags = [];
  let activeTagId = DEFAULT_TAG_ID;
  let editingId = null;

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
          console.warn('[Phrase] 用户未登录');
        }
        throw new Error(data.message || '请求失败');
      }

      return data;
    } catch (error) {
      console.error('[Phrase] API 请求错误:', error);
      throw error;
    }
  }

  function getStorage() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      return chrome.storage.local;
    }
    return null;
  }

  function saveActiveTagId(tagId) {
    const storage = getStorage();
    if (storage) {
      storage.set({ [PHRASE_ACTIVE_TAG_KEY]: tagId });
    }
  }

  function loadActiveTagId() {
    return new Promise((resolve) => {
      const storage = getStorage();
      if (storage) {
        storage.get([PHRASE_ACTIVE_TAG_KEY], (result) => {
          resolve(result[PHRASE_ACTIVE_TAG_KEY] || null);
        });
      } else {
        resolve(null);
      }
    });
  }

  function showStatus(message, type = 'info', elementId = 'status') {
    let statusDiv = document.getElementById(elementId);
    if (!statusDiv) {
      statusDiv = document.getElementById('status');
    }
    if (!statusDiv) {
      console.error(`找不到状态提示元素: ${elementId}`);
      return;
    }
    statusDiv.textContent = message;
    statusDiv.className = 'status ' + type;
    statusDiv.style.display = 'block';
    setTimeout(() => {
      statusDiv.style.display = 'none';
    }, 20000);
  }

  async function loadData() {
    try {
      const [phrasesResult, tagsResult, savedTagId] = await Promise.all([
        apiRequest('/phrases'),
        apiRequest('/tags'),
        loadActiveTagId()
      ]);

      phrases = phrasesResult.data || [];
      tags = tagsResult.data || [];

      if (savedTagId && tags.some(t => String(t.id) === String(savedTagId))) {
        activeTagId = savedTagId;
      } else {
        activeTagId = tags.length > 0 ? tags[0].id : null;
      }

      renderAll();
    } catch (e) {
      console.error('加载短语失败', e);
      phrases = [];
      tags = [];
      activeTagId = DEFAULT_TAG_ID;
      renderAll();
      showStatus('加载短语数据失败: ' + e.message, 'error', 'phraseCardStatus');
    }
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function renderAll() {
    renderTagBar();
    renderTagManageBar();
    renderPhraseList();
    updateStats();
  }

  function updateStats() {
    const totalCountEl = document.getElementById('totalCount');
    const tagCountEl = document.getElementById('tagCount');

    if (totalCountEl) {
      totalCountEl.textContent = phrases.length;
    }
    if (tagCountEl) {
      const visibleCount = getVisiblePhrases().length;
      const activeTag = tags.find(t => t.id === activeTagId);
      tagCountEl.textContent = `${visibleCount} (${activeTag ? activeTag.name : '全部'})`;
    }
  }

  function getVisiblePhrases() {
    if (!activeTagId) return phrases.filter(p => p.tag_id === null || p.tag_id === undefined);
    return phrases.filter(p => String(p.tag_id) === String(activeTagId));
  }

  function renderPhraseList() {
    const phraseList = document.getElementById('phraseList');
    if (!phraseList) return;

    const list = getVisiblePhrases();
    if (!list.length) {
      phraseList.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <p>暂无快捷短语</p>
          <p style="margin-top: 8px; font-size: 12px;">点击上方"添加短语"按钮创建您的第一个快捷短语</p>
        </div>
      `;
      return;
    }

    phraseList.innerHTML = list.map(p => {
      const tag = tags.find(t => String(t.id) === String(p.tag_id));
      const tagName = tag ? tag.name : '未分类';
      return `
        <div class="phrase-item">
          <span class="phrase-tag">${escapeHtml(tagName)}</span>
          <div class="phrase-title">${escapeHtml(p.title || '未命名')}</div>
          <div class="phrase-content">${escapeHtml(p.content || '')}</div>
          <div class="phrase-actions">
            <button type="button" class="edit btn-sm secondary" data-id="${p.id}">编辑</button>
            <button type="button" class="delete btn-sm danger" data-id="${p.id}">删除</button>
          </div>
        </div>
      `;
    }).join('');

    phraseList.querySelectorAll('button.edit').forEach(btn => {
      btn.addEventListener('click', () => openEdit(btn.dataset.id));
    });
    phraseList.querySelectorAll('button.delete').forEach(btn => {
      btn.addEventListener('click', () => deletePhrase(btn.dataset.id));
    });
  }

  function renderTagBar() {
    const tagBar = document.getElementById('tagBar');
    if (!tagBar) return;

    const chips = [];
    for (const t of tags) {
      chips.push(`<button class="segment-item ${String(activeTagId) === String(t.id) ? 'active' : ''}" data-id="${t.id}">${escapeHtml(t.name)}</button>`);
    }
    tagBar.innerHTML = chips.join('');

    tagBar.querySelectorAll('.segment-item[data-id]').forEach(el => {
      el.addEventListener('click', async () => {
        const id = el.dataset.id;
        const tag = tags.find(t => String(t.id) === id);
        const tagName = tag ? tag.name : '';
        activeTagId = id;
        saveActiveTagId(id);
        renderAll();
        showStatus(`已切换到：${tagName}`, 'success', 'phraseCardStatus');
      });
    });
  }

  function renderTagManageBar() {
    const tagManageBar = document.getElementById('tagManageBar');
    if (!tagManageBar) return;
    const manageBtn = tagManageBar.querySelector('.segment-item.manage');
    manageBtn && manageBtn.addEventListener('click', () => openTagManage());
  }

  function renderPhraseTagSelect(selectedId) {
    const phraseTag = document.getElementById('phraseTag');
    if (!phraseTag) return;

    const opts = tags.map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('');
    phraseTag.innerHTML = opts;
    if (selectedId && tags.some(t => String(t.id) === String(selectedId))) {
      phraseTag.value = selectedId;
    } else if (activeTagId) {
      phraseTag.value = activeTagId;
    }
  }

  function openTagManage() {
    const tagManageDialog = document.getElementById('tagManageDialog');
    if (tagManageDialog) {
      renderTagManageList();
      tagManageDialog.classList.add('show');
    } else {
      chrome.tabs.create({ url: chrome.runtime.getURL('phrase/phrase_manage.html') });
    }
  }

  function closeTagManage() {
    const tagManageDialog = document.getElementById('tagManageDialog');
    tagManageDialog && tagManageDialog.classList.remove('show');
  }

  function renderTagManageList() {
    const tagListManage = document.getElementById('tagListManage');
    if (!tagListManage) return;

    tagListManage.innerHTML = tags.map(t => `
      <div class="phrase-item" style="flex-direction: row; align-items: center; padding: 10px 12px;">
        <div style="flex: 1;">
          <div class="phrase-title" style="margin-bottom: 2px;">${escapeHtml(t.name)}</div>
          <div class="phrase-content" style="font-size: 10px;">ID: ${t.id}</div>
        </div>
        <div class="phrase-actions" style="margin-top: 0; padding-top: 0; border-top: none;">
          <button type="button" class="tag-rename btn-sm secondary" data-id="${t.id}">重命名</button>
          <button type="button" class="tag-delete btn-sm danger" data-id="${t.id}">删除</button>
        </div>
      </div>
    `).join('');

    tagListManage.querySelectorAll('button.tag-rename').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = parseInt(btn.dataset.id);
        const tag = tags.find(x => String(x.id) === String(id));
        if (!tag) return;
        const next = prompt('请输入新的标签名称：', tag.name);
        const name = (next || '').trim();
        if (!name) return;
        try {
          await apiRequest(`/tags/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ name })
          });
          tag.name = name;
          renderAll();
          renderTagManageList();
        } catch (e) {
          showStatus('重命名失败: ' + e.message, 'error', 'phraseCardStatus');
        }
      });
    });

    tagListManage.querySelectorAll('button.tag-delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = parseInt(btn.dataset.id);
        const tag = tags.find(x => String(x.id) === String(id));
        if (!tag) return;
        if (!confirm(`确定删除标签"${tag.name}"吗？`)) return;
        try {
          await apiRequest(`/tags/${id}`, {
            method: 'DELETE'
          });
          tags = tags.filter(t => String(t.id) !== String(id));
          for (const p of phrases) {
            if (String(p.tag_id) === String(id)) p.tag_id = null;
          }
          if (String(activeTagId) === String(id)) {
            activeTagId = tags.length > 0 ? tags[0].id : null;
            saveActiveTagId(activeTagId);
          }
          await loadData();
        } catch (e) {
          showStatus('删除失败: ' + e.message, 'error', 'phraseCardStatus');
        }
      });
    });
  }

  function openEdit(id) {
    const phraseEditDialog = document.getElementById('phraseEditDialog');
    const phraseEditTitle = document.getElementById('phraseEditTitle');
    const phraseTitle = document.getElementById('phraseTitle');
    const phraseContent = document.getElementById('phraseContent');

    if (id) {
      const p = phrases.find(x => String(x.id) === String(id));
      if (!p) return;
      editingId = id;
      if (phraseEditTitle) phraseEditTitle.textContent = '编辑短语';
      renderPhraseTagSelect(p.tag_id);
      if (phraseTitle) phraseTitle.value = p.title || '';
      if (phraseContent) phraseContent.value = p.content || '';
    } else {
      editingId = null;
      if (phraseEditTitle) phraseEditTitle.textContent = '添加短语';
      renderPhraseTagSelect(activeTagId);
      if (phraseTitle) phraseTitle.value = '';
      if (phraseContent) phraseContent.value = '';
    }
    phraseEditDialog && phraseEditDialog.classList.add('show');
  }

  function closeEdit() {
    const phraseEditDialog = document.getElementById('phraseEditDialog');
    phraseEditDialog && phraseEditDialog.classList.remove('show');
    editingId = null;
  }

  async function savePhrase() {
    const phraseTag = document.getElementById('phraseTag');
    const phraseTitle = document.getElementById('phraseTitle');
    const phraseContent = document.getElementById('phraseContent');

    const tagId = phraseTag ? parseInt(phraseTag.value) : null;
    const title = phraseTitle ? phraseTitle.value.trim() : '';
    const content = phraseContent ? phraseContent.value.trim() : '';

    if (!title || !content) {
      showStatus('请填写标题和内容', 'error', 'phraseCardStatus');
      return;
    }

    try {
      if (editingId) {
        const id = editingId;
        await apiRequest(`/phrases/${id}`, {
          method: 'PUT',
          body: JSON.stringify({ tag_id: tagId, title, content })
        });
        const index = phrases.findIndex(p => String(p.id) === String(id));
        if (index >= 0) {
          phrases[index].tag_id = tagId;
          phrases[index].title = title;
          phrases[index].content = content;
        }
      } else {
        const result = await apiRequest('/phrases', {
          method: 'POST',
          body: JSON.stringify({ tag_id: tagId, title, content })
        });
        phrases.push(result.data);
      }

      closeEdit();
      renderAll();
      showStatus(editingId ? '短语已更新' : '短语已添加', 'success', 'phraseCardStatus');
    } catch (e) {
      showStatus('保存失败: ' + e.message, 'error', 'phraseCardStatus');
    }
  }

  async function deletePhrase(id) {
    const p = phrases.find(x => String(x.id) === String(id));
    if (!p) return;
    if (!confirm(`确定删除短语"${p.title}"吗？`)) return;
    try {
      await apiRequest(`/phrases/${id}`, {
        method: 'DELETE'
      });
      phrases = phrases.filter(x => String(x.id) !== String(id));
      renderAll();
      showStatus('短语已删除', 'success', 'phraseCardStatus');
    } catch (e) {
      showStatus('删除失败: ' + e.message, 'error', 'phraseCardStatus');
    }
  }

  function initPhraseModule() {
    const savePhraseBtn = document.getElementById('savePhraseBtn');
    const cancelPhraseBtn = document.getElementById('cancelPhraseBtn');
    const closeTagManageBtn = document.getElementById('closeTagManageBtn');
    const addTagBtn = document.getElementById('addTagBtn');
    const addPhraseBtn = document.getElementById('addPhraseBtn');

    if (addPhraseBtn) {
      addPhraseBtn.addEventListener('click', () => openEdit(null));
    }
    const openTagManageBtn = document.getElementById('openTagManageBtn');
    if (openTagManageBtn) {
      openTagManageBtn.addEventListener('click', () => openTagManage());
    }
    if (savePhraseBtn) {
      savePhraseBtn.addEventListener('click', savePhrase);
    }
    if (cancelPhraseBtn) {
      cancelPhraseBtn.addEventListener('click', closeEdit);
    }
    if (closeTagManageBtn) {
      closeTagManageBtn.addEventListener('click', closeTagManage);
    }
    if (addTagBtn) {
      addTagBtn.addEventListener('click', async () => {
        const name = prompt('请输入新标签名称：');
        if (!name || !name.trim()) return;
        try {
          const result = await apiRequest('/tags', {
            method: 'POST',
            body: JSON.stringify({ name: name.trim() })
          });
          tags.push(result.data);
          renderAll();
          renderTagManageList();
        } catch (e) {
          showStatus('创建标签失败: ' + e.message, 'error', 'phraseCardStatus');
        }
      });
    }

    loadData();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPhraseModule);
  } else {
    initPhraseModule();
  }

  window.PhraseModule = {
    loadData,
    renderAll,
    showStatus
  };
})();

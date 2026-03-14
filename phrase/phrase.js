// 快捷短语模块

(function() {
  'use strict';

  const DEFAULT_TAG_ID = 'default';

  function getStorage() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      return chrome.storage.local;
    }
    console.error('存储不可用，无法使用快捷短语');
    return null;
  }

  const storageAPI = getStorage();

  let phrases = [];
  let tags = [];
  let activeTagId = DEFAULT_TAG_ID;
  let editingId = null;

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
    }, 1800);
  }

  async function loadData() {
    if (!storageAPI) return;
    try {
      const result = await new Promise(resolve => 
        storageAPI.get(['savedPhrases', 'savedTags', 'activeTagId'], resolve)
      );
      phrases = result.savedPhrases || [];
      tags = Array.isArray(result.savedTags) ? result.savedTags : [];
      activeTagId = typeof result.activeTagId === 'string' ? result.activeTagId : DEFAULT_TAG_ID;
      await ensureTagsAndMigrate();
      renderAll();
    } catch (e) {
      console.error('加载短语失败', e);
      phrases = [];
      tags = [];
      activeTagId = DEFAULT_TAG_ID;
      await ensureTagsAndMigrate();
      renderAll();
    }
  }

  async function savePhrases() {
    if (!storageAPI) return;
    await new Promise(resolve => storageAPI.set({ savedPhrases: phrases }, resolve));
  }

  async function saveTags() {
    if (!storageAPI) return;
    await new Promise(resolve => storageAPI.set({ savedTags: tags }, resolve));
  }

  async function saveActiveTagId() {
    if (!storageAPI) return;
    await new Promise(resolve => storageAPI.set({ activeTagId }, resolve));
  }

  async function ensureTagsAndMigrate() {
    if (!storageAPI) return;
    let changed = false;

    if (!Array.isArray(tags) || tags.length === 0) {
      tags = [{
        id: DEFAULT_TAG_ID,
        name: '默认',
        createdAt: Date.now(),
        updatedAt: Date.now()
      }];
      changed = true;
    }

    if (!tags.some(t => t.id === DEFAULT_TAG_ID)) {
      tags.unshift({
        id: DEFAULT_TAG_ID,
        name: '默认',
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
      changed = true;
    }

    const validTagIds = new Set(tags.map(t => t.id));
    for (const p of phrases) {
      if (!p.tagId || !validTagIds.has(p.tagId)) {
        p.tagId = DEFAULT_TAG_ID;
        changed = true;
      }
    }

    if (!validTagIds.has(activeTagId)) {
      activeTagId = DEFAULT_TAG_ID;
      changed = true;
    }

    if (changed) {
      await new Promise(resolve => storageAPI.set({
        savedTags: tags,
        savedPhrases: phrases,
        activeTagId
      }, resolve));
    }
  }

  function renderAll() {
    renderTagBar();
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
      const tag = tags.find(t => t.id === p.tagId);
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

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function getVisiblePhrases() {
    return phrases.filter(p => p.tagId === activeTagId);
  }

  function renderTagBar() {
    const tagBar = document.getElementById('tagBar');
    if (!tagBar) return;
    
    const chips = [];
    for (const t of tags) {
      chips.push(`<button class="tag-chip ${activeTagId === t.id ? 'active' : ''}" data-id="${escapeHtml(t.id)}">${escapeHtml(t.name)}</button>`);
    }
    chips.push(`<button class="tag-chip manage" data-action="manage">管理</button>`);
    tagBar.innerHTML = chips.join('');

    tagBar.querySelectorAll('.tag-chip[data-id]').forEach(el => {
      el.addEventListener('click', async () => {
        const id = el.dataset.id;
        const tag = tags.find(t => t.id === id);
        const tagName = tag ? tag.name : '';
        activeTagId = id;
        await saveActiveTagId();
        renderAll();
        showStatus(`✅ 已切换到：${tagName}`, 'success', 'phraseCardStatus');
      });
    });
    const manageBtn = tagBar.querySelector('.tag-chip.manage');
    manageBtn && manageBtn.addEventListener('click', () => openTagManage());
  }

  function renderPhraseTagSelect(selectedId) {
    const phraseTag = document.getElementById('phraseTag');
    if (!phraseTag) return;
    
    const opts = tags.map(t => `<option value="${escapeHtml(t.id)}">${escapeHtml(t.name)}</option>`).join('');
    phraseTag.innerHTML = opts;
    const next = selectedId && tags.some(t => t.id === selectedId) ? selectedId : DEFAULT_TAG_ID;
    phraseTag.value = next;
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
          <div class="phrase-content" style="font-size: 10px;">ID: ${escapeHtml(t.id)}</div>
        </div>
        <div class="phrase-actions" style="margin-top: 0; padding-top: 0; border-top: none;">
          <button type="button" class="tag-rename btn-sm secondary" data-id="${escapeHtml(t.id)}">重命名</button>
          <button type="button" class="tag-delete btn-sm danger" data-id="${escapeHtml(t.id)}">删除</button>
        </div>
      </div>
    `).join('');

    tagListManage.querySelectorAll('button.tag-rename').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const tag = tags.find(x => x.id === id);
        if (!tag) return;
        const next = prompt('请输入新的标签名称：', tag.name);
        const name = (next || '').trim();
        if (!name) return;
        tag.name = name;
        tag.updatedAt = Date.now();
        await saveTags();
        renderAll();
        renderTagManageList();
      });
    });

    tagListManage.querySelectorAll('button.tag-delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        if (id === DEFAULT_TAG_ID) {
          alert('"默认"标签不可删除');
          return;
        }
        const tag = tags.find(x => x.id === id);
        if (!tag) return;
        if (!confirm(`确定删除标签"${tag.name}"吗？`)) return;

        tags = tags.filter(t => t.id !== id);
        for (const p of phrases) {
          if (p.tagId === id) p.tagId = DEFAULT_TAG_ID;
        }
        if (activeTagId === id) activeTagId = DEFAULT_TAG_ID;
        await new Promise(resolve => 
          storageAPI.set({ savedTags: tags, savedPhrases: phrases, activeTagId }, resolve)
        );
        renderAll();
        renderTagManageList();
      });
    });
  }

  function openEdit(id) {
    const phraseEditDialog = document.getElementById('phraseEditDialog');
    const phraseEditTitle = document.getElementById('phraseEditTitle');
    const phraseTitle = document.getElementById('phraseTitle');
    const phraseContent = document.getElementById('phraseContent');
    
    if (id) {
      const p = phrases.find(x => x.id === id);
      if (!p) return;
      editingId = id;
      if (phraseEditTitle) phraseEditTitle.textContent = '编辑短语';
      renderPhraseTagSelect(p.tagId);
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
  }

  async function savePhrase() {
    const phraseTag = document.getElementById('phraseTag');
    const phraseTitle = document.getElementById('phraseTitle');
    const phraseContent = document.getElementById('phraseContent');
    
    const tagId = phraseTag ? phraseTag.value : DEFAULT_TAG_ID;
    const title = phraseTitle ? phraseTitle.value.trim() : '';
    const content = phraseContent ? phraseContent.value.trim() : '';

    if (!title || !content) {
      showStatus('请填写标题和内容', 'error', 'phraseCardStatus');
      return;
    }

    if (editingId) {
      const p = phrases.find(x => x.id === editingId);
      if (p) {
        p.tagId = tagId;
        p.title = title;
        p.content = content;
        p.updatedAt = Date.now();
      }
    } else {
      phrases.push({
        id: 'phrase_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
        tagId,
        title,
        content,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
    }

    await savePhrases();
    closeEdit();
    renderAll();
    showStatus(editingId ? '✅ 短语已更新' : '✅ 短语已添加', 'success', 'phraseCardStatus');
    editingId = null;
  }

  async function deletePhrase(id) {
    const p = phrases.find(x => x.id === id);
    if (!p) return;
    if (!confirm(`确定删除短语"${p.title}"吗？`)) return;
    phrases = phrases.filter(x => x.id !== id);
    await savePhrases();
    renderAll();
    showStatus('✅ 短语已删除', 'success', 'phraseCardStatus');
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
        const newTag = {
          id: 'tag_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
          name: name.trim(),
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        tags.push(newTag);
        await saveTags();
        renderAll();
        renderTagManageList();
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

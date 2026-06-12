(function() {
  'use strict';

  const DEFAULT_TAG_ID = 'default';

  function getStorage() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      return chrome.storage.local;
    }
    console.error('存储不可用');
    return null;
  }

  const storageAPI = getStorage();

  let phrases = [];
  let tags = [];
  let activeTagId = DEFAULT_TAG_ID;
  let editingId = null;

  function showStatus(message, type = 'info') {
    const statusDiv = document.getElementById('phraseManageStatus');
    if (!statusDiv) return;
    const icons = {
      success: '<svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" style="flex-shrink:0"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>',
      error: '<svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" style="flex-shrink:0"><path stroke-linecap="round" stroke-linejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>',
      info: '<svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" style="flex-shrink:0"><path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" /></svg>'
    };
    statusDiv.innerHTML = (icons[type] || icons.info) + '<span>' + message + '</span>';
    statusDiv.className = 'status ' + type;
    statusDiv.style.display = 'flex';
    setTimeout(() => {
      statusDiv.style.display = 'none';
    }, 3000);
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
  }

  function renderTagBar() {
    const tagBar = document.getElementById('phraseTagBar');
    if (!tagBar) return;
    
    const chips = [];
    chips.push(`<button class="filter-tab ${activeTagId === '__ALL__' ? 'active' : ''}" data-id="__ALL__">全部</button>`);
    for (const t of tags) {
      chips.push(`<button class="filter-tab ${activeTagId === t.id ? 'active' : ''}" data-id="${escapeHtml(t.id)}">${escapeHtml(t.name)}</button>`);
    }
    tagBar.innerHTML = chips.join('');

    tagBar.querySelectorAll('.filter-tab[data-id]').forEach(el => {
      el.addEventListener('click', async () => {
        const id = el.dataset.id;
        activeTagId = id;
        await saveActiveTagId();
        renderAll();
      });
    });
    const wrapper = tagBar.parentElement;
    const manageBtn = wrapper.querySelector('[data-action="manage"]');
    if (manageBtn) manageBtn.addEventListener('click', () => openTagManage());
  }

  function renderPhraseList() {
    const phraseList = document.getElementById('phraseList');
    if (!phraseList) return;
    
    const list = getVisiblePhrases();
    if (!list.length) {
      phraseList.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1; text-align: center; padding: 40px 20px; color: #6b7280;">
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
            <button type="button" class="delete btn-sm btn-danger" data-id="${p.id}">删除</button>
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

  function getVisiblePhrases() {
    if (activeTagId === '__ALL__') return phrases.slice();
    return phrases.filter(p => p.tagId === activeTagId);
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function openTagManage() {
    const tagManageDialog = document.getElementById('tagManageDialog');
    if (!tagManageDialog) return;
    renderTagManageList();
    tagManageDialog.classList.add('show');
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
          <button type="button" class="tag-delete btn-sm btn-danger" data-id="${escapeHtml(t.id)}">删除</button>
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

  function renderPhraseTagSelect(selectedId) {
    const phraseTag = document.getElementById('phraseTag');
    if (!phraseTag) return;
    
    const opts = tags.map(t => `<option value="${escapeHtml(t.id)}">${escapeHtml(t.name)}</option>`).join('');
    phraseTag.innerHTML = opts;
    const next = selectedId && tags.some(t => t.id === selectedId) ? selectedId : DEFAULT_TAG_ID;
    phraseTag.value = next;
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
      renderPhraseTagSelect(activeTagId === '__ALL__' ? DEFAULT_TAG_ID : activeTagId);
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
      showStatus('请填写标题和内容', 'error');
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
    showStatus(editingId ? '短语已更新' : '短语已添加', 'success');
    editingId = null;
  }

  async function deletePhrase(id) {
    const p = phrases.find(x => x.id === id);
    if (!p) return;
    if (!confirm(`确定删除短语"${p.title}"吗？`)) return;
    phrases = phrases.filter(x => x.id !== id);
    await savePhrases();
    renderAll();
    showStatus('短语已删除', 'success');
  }

  async function exportPhrases() {
    const data = {
      phrases,
      tags,
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `phrases_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showStatus('导出成功', 'success');
  }

  async function importPhrases(file) {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      if (data.phrases && Array.isArray(data.phrases)) {
        phrases = data.phrases;
      }
      if (data.tags && Array.isArray(data.tags)) {
        tags = data.tags;
      }
      
      await savePhrases();
      await saveTags();
      await ensureTagsAndMigrate();
      renderAll();
      showStatus('导入成功', 'success');
    } catch (e) {
      console.error('导入失败', e);
      showStatus('❌ 导入失败，请检查文件格式', 'error');
    }
  }

  function init() {
    const backBtn = document.getElementById('backBtn');
    const addPhraseBtn = document.getElementById('addPhraseBtn');
    const savePhraseBtn = document.getElementById('savePhraseBtn');
    const cancelPhraseBtn = document.getElementById('cancelPhraseBtn');
    const importPhraseBtn = document.getElementById('importPhraseBtn');
    const exportPhraseBtn = document.getElementById('exportPhraseBtn');
    const phraseFileInput = document.getElementById('phraseFileInput');
    const closeTagManageBtn = document.getElementById('closeTagManageBtn');
    const addTagBtn = document.getElementById('addTagBtn');

    if (backBtn) {
      backBtn.addEventListener('click', () => {
        window.location.href = '../popup.html';
      });
    }

    if (addPhraseBtn) {
      addPhraseBtn.addEventListener('click', () => openEdit(null));
    }

    if (savePhraseBtn) {
      savePhraseBtn.addEventListener('click', savePhrase);
    }

    if (cancelPhraseBtn) {
      cancelPhraseBtn.addEventListener('click', closeEdit);
    }

    if (exportPhraseBtn) {
      exportPhraseBtn.addEventListener('click', exportPhrases);
    }

    if (importPhraseBtn && phraseFileInput) {
      importPhraseBtn.addEventListener('click', () => phraseFileInput.click());
      phraseFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          importPhrases(file);
        }
        e.target.value = '';
      });
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

    document.querySelectorAll('.dialog-mask').forEach(mask => {
      mask.addEventListener('click', (e) => {
        if (e.target === mask) mask.classList.remove('show');
      });
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.dialog-mask.show').forEach(m => m.classList.remove('show'));
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

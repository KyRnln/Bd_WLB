// 达人管理模块

(function() {
  'use strict';

  let creators = [];
  let searchResults = [];
  let editingCreatorIndex = -1;
  let activeCreatorTagId = 'all';

  function showStatus(message, type = 'info', elementId = 'creatorCardStatus') {
    let statusDiv = document.getElementById(elementId);
    if (!statusDiv) {
      statusDiv = document.getElementById('creatorCardStatus');
    }
    if (!statusDiv) {
      console.error(`找不到状态提示元素: ${elementId}`);
      return;
    }
    statusDiv.textContent = message;
    statusDiv.style.display = 'flex';
    setTimeout(() => {
      statusDiv.style.display = 'none';
    }, 20000);
  }

  async function loadData() {
    try {
      const result = await new Promise(resolve =>
        chrome.storage.local.get(['savedCreators', 'activeCreatorTagId'], resolve)
      );
      console.log('[Creator] 加载数据结果:', result);
      creators = Array.isArray(result.savedCreators) ? result.savedCreators : [];
      activeCreatorTagId = result.activeCreatorTagId || 'all';
      searchResults = [];
      console.log('[Creator] 加载了', creators.length, '个达人');
      renderTags();
      renderCreators();
    } catch (e) {
      console.error('加载数据失败', e);
      creators = [];
      activeCreatorTagId = 'all';
      searchResults = [];
      renderTags();
      renderCreators();
    }
  }

  async function saveData() {
    try {
      await new Promise(resolve =>
        chrome.storage.local.set({
          savedCreators: creators,
          activeCreatorTagId: activeCreatorTagId
        }, resolve)
      );
    } catch (e) {
      console.error('保存数据失败', e);
    }
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function renderTags() {
    const tagBar = document.getElementById('creatorTagBar');
    if (!tagBar) return;

    const uniqueTags = [...new Set(creators.map(c => c.tag).filter(t => t))];
    const allTags = [{ id: 'all', name: '全部' }, ...uniqueTags.map(t => ({ id: t, name: t }))];

    const chips = [];
    for (const t of allTags) {
      chips.push(`<button class="filter-tab ${activeCreatorTagId === t.id ? 'active' : ''}" data-id="${escapeHtml(t.id)}">${escapeHtml(t.name)}</button>`);
    }
    tagBar.innerHTML = chips.join('');

    tagBar.querySelectorAll('.filter-tab[data-id]').forEach(el => {
      el.addEventListener('click', async () => {
        const id = el.dataset.id;
        activeCreatorTagId = id;
        await saveData();
        renderTags();
        renderCreators();
        const tag = allTags.find(t => t.id === id);
        showStatus(`已切换到：${tag ? tag.name : ''}`, 'success');
      });
    });
  }

  function getFilteredCreators() {
    if (activeCreatorTagId === 'all') {
      return creators.filter(c => c.tag && c.tag.trim() !== '');
    }
    return creators.filter(c => c.tag === activeCreatorTagId);
  }

  function renderCreators() {
    const creatorSearchInput = document.getElementById('creatorSearchInput');
    const creatorSearchList = document.getElementById('creatorSearchList');

    // Update stats
    const totalCount = document.getElementById('totalCount');
    const lostCount = document.getElementById('lostCount');
    const perfCount = document.getElementById('perfCount');
    if (totalCount) totalCount.textContent = creators.length;
    if (lostCount) lostCount.textContent = creators.filter(c => c.tag === '流失达人').length;
    if (perfCount) perfCount.textContent = creators.filter(c => c.tag === '绩效达人').length;

    const creatorList = document.getElementById('creatorList');
    if (creatorList) {
      renderCreatorList();
    } else {
      renderSearchResults();
    }

    const query = creatorSearchInput ? creatorSearchInput.value.trim() : '';
    const creatorCard = document.getElementById('creatorCard');
    const phraseCard = document.getElementById('phraseCard');
    const dataCard = document.getElementById('dataCard');

    if (query && creatorSearchList) {
      if (creatorCard) creatorCard.style.display = 'block';
      if (phraseCard) phraseCard.style.display = 'none';
      if (dataCard) dataCard.style.display = 'none';
      creatorSearchList.classList.add('expanded');
    } else {
      if (creatorCard) creatorCard.style.display = 'block';
      if (phraseCard) phraseCard.style.display = 'block';
      if (dataCard) dataCard.style.display = 'block';
      if (creatorSearchList) {
        creatorSearchList.classList.remove('expanded');
      }
    }
  }

  function renderCreatorList() {
    const creatorList = document.getElementById('creatorList');
    const creatorSearchInput = document.getElementById('creatorSearchInput');

    if (!creatorList) return;

    const query = creatorSearchInput ? creatorSearchInput.value.trim().toLowerCase() : '';
    const baseList = getFilteredCreators();
    const displayList = query ? searchResults : baseList;

    if (displayList.length === 0) {
      creatorList.innerHTML = `
        <div class="empty-state">
          <p>${query ? '未找到匹配的达人' : '暂无达人数据'}</p>
        </div>
      `;
      return;
    }

    creatorList.innerHTML = displayList.map((creator, index) => {
      let tagClass = 'card-tag-default';
      let tagName = creator.tag || '未分组';
      if (creator.tag === '绩效达人') tagClass = 'card-tag-performance';
      else if (creator.tag === '流失达人') tagClass = 'card-tag-lost';

      const remarkHtml = creator.remark
        ? `<p class="card-remark-text">${escapeHtml(creator.remark)}</p>`
        : `<p class="card-remark-empty">暂无备注</p>`;

      return `
        <div class="fluent-card creator-card">
          <div class="card-top">
            <div class="card-info">
              <div class="card-creator-id">${escapeHtml(creator.creator_id)}</div>
              <p class="card-cid">CID: ${creator.cid ? escapeHtml(creator.cid) : '无'}</p>
              <div class="card-region">
                <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" /></svg>
                <span class="card-region-text">地区: ${creator.region ? escapeHtml(creator.region) : '无'}</span>
              </div>
            </div>
            <span class="card-tag ${tagClass}">${escapeHtml(tagName)}</span>
          </div>
          <div class="card-remark">
            <p class="card-remark-label">备注</p>
            ${remarkHtml}
          </div>
          <div class="card-actions">
            <button type="button" class="card-action-btn jump-creator" data-index="${index}" ${creator.cid && creator.region ? '' : 'disabled'}>跳转</button>
            <button type="button" class="card-action-btn edit-creator" data-index="${index}">编辑</button>
          </div>
        </div>
      `;
    }).join('');

    creatorList.querySelectorAll('button.edit-creator').forEach(btn => {
      btn.addEventListener('click', () => {
        const index = parseInt(btn.dataset.index, 10);
        const creator = displayList[index];
        const mainIndex = creators.findIndex(c => c.creator_id === creator.creator_id);
        if (mainIndex >= 0) {
          openCreatorEdit(mainIndex, query ? index : -1);
        }
      });
    });

    creatorList.querySelectorAll('button.jump-creator').forEach(btn => {
      btn.addEventListener('click', () => {
        const index = parseInt(btn.dataset.index, 10);
        const creator = displayList[index];
        if (creator && creator.cid && creator.region) {
          const url = `https://affiliate.tiktokshopglobalselling.com/connection/creator/detail?cid=${creator.cid}&region=${creator.region}`;
          chrome.tabs.create({ url });
        }
      });
    });
  }

  function renderSearchResults() {
    const creatorSearchResults = document.getElementById('creatorSearchResults');
    const creatorSearchList = document.getElementById('creatorSearchList');
    if (!creatorSearchResults || !creatorSearchList) return;

    if (searchResults.length === 0) {
      creatorSearchResults.classList.remove('show');
      creatorSearchList.innerHTML = '';
      const searchLabel = creatorSearchResults.querySelector('.text-sm.text-fluent-textMuted');
      if (searchLabel) searchLabel.style.display = 'none';
      return;
    }

    creatorSearchResults.classList.add('show');
    const searchLabel = creatorSearchResults.querySelector('.text-sm.text-fluent-textMuted');
    if (searchLabel) searchLabel.style.display = 'block';
    creatorSearchList.innerHTML = searchResults.map((creator, index) => {
      let tagClass = 'card-tag-default';
      let tagName = creator.tag || '未分组';
      if (creator.tag === '绩效达人') tagClass = 'card-tag-performance';
      else if (creator.tag === '流失达人') tagClass = 'card-tag-lost';

      const remarkHtml = creator.remark
        ? `<p class="card-remark-text">${escapeHtml(creator.remark)}</p>`
        : `<p class="card-remark-empty">暂无备注</p>`;

      return `
        <div class="fluent-card creator-card">
          <div class="card-top">
            <div class="card-info">
              <div class="card-creator-id">${escapeHtml(creator.creator_id)}</div>
              <p class="card-cid">CID: ${creator.cid ? escapeHtml(creator.cid) : '无'}</p>
              <div class="card-region">
                <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" /></svg>
                <span class="card-region-text">地区: ${creator.region ? escapeHtml(creator.region) : '无'}</span>
              </div>
            </div>
            <span class="card-tag ${tagClass}">${escapeHtml(tagName)}</span>
          </div>
          <div class="card-remark">
            <p class="card-remark-label">备注</p>
            ${remarkHtml}
          </div>
          <div class="card-actions">
            <button type="button" class="card-action-btn jump-creator" data-index="${index}" ${creator.cid && creator.region ? '' : 'disabled'}>跳转</button>
            <button type="button" class="card-action-btn edit-creator" data-index="${index}">编辑</button>
          </div>
        </div>
      `;
    }).join('');

    creatorSearchList.querySelectorAll('button.edit-creator').forEach(btn => {
      btn.addEventListener('click', () => {
        const index = parseInt(btn.dataset.index, 10);
        const creator = searchResults[index];
        const mainIndex = creators.findIndex(c => c.creator_id === creator.creator_id);
        if (mainIndex >= 0) {
          openCreatorEdit(mainIndex, index);
        }
      });
    });

    creatorSearchList.querySelectorAll('button.jump-creator').forEach(btn => {
      btn.addEventListener('click', () => {
        const index = parseInt(btn.dataset.index, 10);
        const creator = searchResults[index];
        if (creator && creator.cid && creator.region) {
          const url = `https://affiliate.tiktokshopglobalselling.com/connection/creator/detail?cid=${creator.cid}&region=${creator.region}`;
          chrome.tabs.create({ url });
        }
      });
    });
  }

  function openCreatorEdit(mainIndex, searchResultIndex = -1) {
    const creatorEditDialog = document.getElementById('creatorEditDialog');
    const creatorEditId = document.getElementById('creatorEditId');
    const creatorEditCid = document.getElementById('creatorEditCid');
    const creatorEditRegion = document.getElementById('creatorEditRegion');
    const creatorEditTag = document.getElementById('creatorEditTag');
    const creatorEditRemark = document.getElementById('creatorEditRemark');

    if (mainIndex < 0 || mainIndex >= creators.length) return;
    editingCreatorIndex = mainIndex;
    const creator = creators[mainIndex];
    if (creatorEditId) creatorEditId.value = creator.creator_id || '';
    if (creatorEditCid) creatorEditCid.value = creator.cid || '';
    if (creatorEditRegion) creatorEditRegion.value = creator.region || '';
    if (creatorEditTag) creatorEditTag.value = creator.tag || '';
    if (creatorEditRemark) creatorEditRemark.value = creator.remark || '';
    if (creatorEditDialog) creatorEditDialog.classList.add('show');
  }

  function closeCreatorEdit() {
    const creatorEditDialog = document.getElementById('creatorEditDialog');
    if (creatorEditDialog) creatorEditDialog.classList.remove('show');
    editingCreatorIndex = -1;
  }

  async function saveCreatorEdit() {
    const creatorEditCid = document.getElementById('creatorEditCid');
    const creatorEditRegion = document.getElementById('creatorEditRegion');
    const creatorEditTag = document.getElementById('creatorEditTag');
    const creatorEditRemark = document.getElementById('creatorEditRemark');

    if (editingCreatorIndex < 0 || editingCreatorIndex >= creators.length) return;
    const creator = creators[editingCreatorIndex];

    creator.cid = creatorEditCid ? creatorEditCid.value.trim() : '';
    creator.region = creatorEditRegion ? creatorEditRegion.value.trim() : '';
    creator.tag = creatorEditTag ? creatorEditTag.value.trim() : '';
    creator.remark = creatorEditRemark ? creatorEditRemark.value.trim() : '';

    await saveData();
    closeCreatorEdit();
    renderCreators();
    showStatus('达人信息已更新', 'success', 'creatorCardStatus');
  }

  async function deleteCreator() {
    if (editingCreatorIndex < 0 || editingCreatorIndex >= creators.length) return;
    const creator = creators[editingCreatorIndex];
    if (!confirm(`确定删除达人 "${creator.creator_id}" 吗？`)) return;

    creators = creators.filter((_, i) => i !== editingCreatorIndex);
    searchResults = searchResults.filter(c => c.creator_id !== creator.creator_id);

    await saveData();
    closeCreatorEdit();
    renderCreators();
    showStatus('达人已删除', 'success', 'creatorCardStatus');
  }

  function initCreatorModule() {
    const importCreatorBtn = document.getElementById('importCreatorBtn');
    const downloadCreatorTemplateBtn = document.getElementById('downloadCreatorTemplateBtn');
    const openCreatorManageBtn = document.getElementById('openCreatorManageBtn');
    const creatorFileInput = document.getElementById('creatorFileInput');
    const creatorSearchInput = document.getElementById('creatorSearchInput');
    const saveCreatorEditBtn = document.getElementById('saveCreatorEditBtn');
    const cancelCreatorEditBtn = document.getElementById('cancelCreatorEditBtn');
    const deleteCreatorBtn = document.getElementById('deleteCreatorBtn');

    if (openCreatorManageBtn) {
      openCreatorManageBtn.addEventListener('click', () => {
        chrome.tabs.create({ url: chrome.runtime.getURL('creator/creator.html') });
      });
    }

    if (creatorSearchInput) {
      creatorSearchInput.addEventListener('input', () => {
        const query = creatorSearchInput.value.trim().toLowerCase();
        if (!query) {
          searchResults = [];
          renderCreators();
          return;
        }

        searchResults = creators.filter(c => {
          if (c.tag === '隐藏达人') return false;
          return (c.creator_id && c.creator_id.toLowerCase().includes(query)) ||
                 (c.cid && c.cid.toLowerCase().includes(query)) ||
                 (c.region && c.region.toLowerCase().includes(query)) ||
                 (c.tag && c.tag.toLowerCase().includes(query)) ||
                 (c.remark && c.remark.toLowerCase().includes(query));
        });
        renderCreators();
      });
    }

    if (importCreatorBtn && creatorFileInput) {
      importCreatorBtn.addEventListener('click', () => creatorFileInput.click());
      creatorFileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
          const arrayBuffer = await file.arrayBuffer();
          const workbook = new ExcelJS.Workbook();
          await workbook.xlsx.load(arrayBuffer);
          const worksheet = workbook.worksheets[0];

          const newCreators = [];
          worksheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return;
            const id = row.getCell(1).value?.toString().trim();
            const cid = row.getCell(2).value?.toString().trim();
            const region = row.getCell(3).value?.toString().trim();
            const tag = row.getCell(4).value?.toString().trim();
            const remark = row.getCell(5).value?.toString().trim();
            if (id) {
              newCreators.push({ creator_id: id, cid: cid || '', region: region || '', tag: tag || '', remark: remark || '' });
            }
          });

          let updatedCount = 0;
          let addedCount = 0;

          for (const newCreator of newCreators) {
            const existingIndex = creators.findIndex(c => c.creator_id === newCreator.creator_id);
            if (existingIndex >= 0) {
              creators[existingIndex] = { ...creators[existingIndex], ...newCreator };
              updatedCount++;
            } else {
              creators.push(newCreator);
              addedCount++;
            }
          }

          await saveData();
          renderTags();
          renderCreators();

          let statusMsg = '';
          if (addedCount > 0 && updatedCount > 0) {
            statusMsg = `新增 ${addedCount} 个，更新 ${updatedCount} 个达人`;
          } else if (addedCount > 0) {
            statusMsg = `已导入 ${addedCount} 个新达人`;
          } else if (updatedCount > 0) {
            statusMsg = `已更新 ${updatedCount} 个达人`;
          } else {
            statusMsg = `导入完成`;
          }
          showStatus(statusMsg, 'success', 'creatorCardStatus');
        } catch (err) {
          console.error('导入失败', err);
          showStatus('导入失败，请检查文件格式', 'error', 'creatorCardStatus');
        }

        creatorFileInput.value = '';
      });
    }

    if (downloadCreatorTemplateBtn) {
      downloadCreatorTemplateBtn.addEventListener('click', () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('达人模板');
        worksheet.columns = [
          { header: '达人ID', key: 'id' },
          { header: 'CID', key: 'cid' },
          { header: '地区', key: 'region' },
          { header: '标签', key: 'tag' },
          { header: '备注', key: 'remark' }
        ];
        worksheet.addRow({ id: 'example_creator_id', cid: '123456789', region: 'MY', tag: 'VIP', remark: '示例备注' });

        workbook.xlsx.writeBuffer().then(buffer => {
          const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'creator_template.xlsx';
          a.click();
          URL.revokeObjectURL(url);
        });
      });
    }

    if (saveCreatorEditBtn) {
      saveCreatorEditBtn.addEventListener('click', saveCreatorEdit);
    }
    if (cancelCreatorEditBtn) {
      cancelCreatorEditBtn.addEventListener('click', closeCreatorEdit);
    }
    if (deleteCreatorBtn) {
      deleteCreatorBtn.addEventListener('click', deleteCreator);
    }

    const clearAllCreatorsBtn = document.getElementById('clearAllCreatorsBtn');
    if (clearAllCreatorsBtn) {
      clearAllCreatorsBtn.addEventListener('click', async () => {
        if (creators.length === 0) {
          showStatus('暂无达人数据', 'error');
          return;
        }
        if (!confirm(`确定删除全部 ${creators.length} 个达人吗？此操作不可恢复！`)) return;

        creators = [];
        searchResults = [];
        await saveData();
        renderCreators();
        showStatus('已删除全部达人', 'success');
      });
    }

    loadData();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCreatorModule);
  } else {
    initCreatorModule();
  }

  window.CreatorModule = {
    loadData,
    renderCreators,
    showStatus,
    getCreators: () => creators,
    getSearchResults: () => searchResults
  };
})();

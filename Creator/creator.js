// 达人管理模块

(function() {
  'use strict';

  const API_BASE_URL = 'https://kyrnln.cloud/api';

  let creators = [];
  let allCreators = [];
  let currentUserId = null;
  let searchResults = [];
  let editingCreatorIndex = -1;
  let activeCreatorTagId = 'all';

  function getToken() {
    return localStorage.getItem('auth_token');
  }

  function isLoggedIn() {
    return !!getToken();
  }

  async function apiRequest(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const token = getToken();

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
          localStorage.removeItem('auth_token');
          window.location.href = '../auth/auth.html';
        }
        throw new Error(data.message || '请求失败');
      }

      return data;
    } catch (error) {
      console.error('API 请求错误:', error);
      throw error;
    }
  }

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
    statusDiv.className = 'status ' + type;
    statusDiv.style.display = 'block';
    setTimeout(() => {
      statusDiv.style.display = 'none';
    }, 20000);
  }

  async function loadData() {
    if (!isLoggedIn()) {
      showStatus('请先登录', 'error');
      creators = [];
      allCreators = [];
      currentUserId = null;
      activeCreatorTagId = 'all';
      searchResults = [];
      renderTags();
      renderCreators();
      return;
    }

    try {
      const userResult = await apiRequest('/auth/me');
      currentUserId = userResult.success && userResult.user ? userResult.user.id : null;
      console.log('[Creator] 当前用户ID:', currentUserId);

      const result = await apiRequest('/creators/all');
      console.log('[Creator] 加载数据结果:', result);
      allCreators = result.data || [];
      creators = allCreators.filter(c => c.user_id === currentUserId);
      console.log('[Creator] 加载了', allCreators.length, '个服务器达人，其中', creators.length, '个属于当前用户');
      activeCreatorTagId = 'all';
      searchResults = [];
      renderTags();
      renderCreators();
    } catch (e) {
      console.error('加载数据失败', e);
      creators = [];
      allCreators = [];
      currentUserId = null;
      activeCreatorTagId = 'all';
      searchResults = [];
      renderTags();
      renderCreators();
      showStatus('加载达人数据失败: ' + e.message, 'error', 'creatorCardStatus');
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

    const uniqueTags = [...new Set(allCreators.map(c => c.tag).filter(t => t))];
    const allTags = [{ id: 'all', name: '全部' }, ...uniqueTags.map(t => ({ id: t, name: t }))];

    const chips = [];
    for (const t of allTags) {
      chips.push(`<button class="segment-item ${activeCreatorTagId === t.id ? 'active' : ''}" data-id="${escapeHtml(t.id)}">${escapeHtml(t.name)}</button>`);
    }
    tagBar.innerHTML = chips.join('');

    tagBar.querySelectorAll('.segment-item[data-id]').forEach(el => {
      el.addEventListener('click', async () => {
        const id = el.dataset.id;
        activeCreatorTagId = id;
        localStorage.setItem('activeCreatorTagId', id);
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
    const creatorPreview = document.getElementById('creatorPreview');
    const creatorSearchInput = document.getElementById('creatorSearchInput');
    const creatorSearchList = document.getElementById('creatorSearchList');

    if (creatorPreview) {
      if (creators.length) {
        const performanceCount = creators.filter(c => c.tag === '绩效达人').length;
        const lostCount = creators.filter(c => c.tag === '流失达人').length;
        const hiddenCount = creators.filter(c => c.tag === '隐藏达人').length;

        let statsHtml = `<div class="creator-stats">`;
        statsHtml += `<div class="stat-item"><span class="stat-label">总计</span><span class="stat-value">${creators.length}</span></div>`;
        if (performanceCount > 0) {
          statsHtml += `<div class="stat-item performance"><span class="stat-label">绩效达人</span><span class="stat-value">${performanceCount}</span></div>`;
        }
        if (lostCount > 0) {
          statsHtml += `<div class="stat-item lost"><span class="stat-label">流失达人</span><span class="stat-value">${lostCount}</span></div>`;
        }
        if (hiddenCount > 0) {
          statsHtml += `<div class="stat-item hidden"><span class="stat-label">隐藏达人</span><span class="stat-value">${hiddenCount}</span></div>`;
        }
        statsHtml += `</div>`;

        creatorPreview.innerHTML = statsHtml;
        creatorPreview.className = 'mt-2';
      } else {
        creatorPreview.textContent = '尚未导入达人，点击"导入 XLSX"上传 creator_id/creator_cid/region_code';
        creatorPreview.className = 'mt-2 text-base text-muted text-left';
      }
    }

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
    const totalCount = document.getElementById('totalCount');
    const searchCount = document.getElementById('searchCount');
    const creatorSearchInput = document.getElementById('creatorSearchInput');

    if (!creatorList) return;

    const query = creatorSearchInput ? creatorSearchInput.value.trim().toLowerCase() : '';
    const baseList = getFilteredCreators();
    const displayList = query ? searchResults : baseList;

    if (totalCount) totalCount.textContent = allCreators.length;
    if (searchCount) searchCount.textContent = query ? searchResults.length : '-';

    if (displayList.length === 0) {
      creatorList.innerHTML = `
        <div class="empty-state">
          <p>${query ? '未找到匹配的达人' : '暂无达人数据'}</p>
        </div>
      `;
      return;
    }

    creatorList.innerHTML = displayList.map((creator, index) => {
      let tagClass = '';
      if (creator.tag === '绩效达人') tagClass = 'performance';
      else if (creator.tag === '流失达人') tagClass = 'lost';
      else if (creator.tag === '隐藏达人') tagClass = 'hidden';

      return `
        <div class="creator-item">
          <div class="creator-info">
            <div class="creator-main">
              <div class="creator-id">${escapeHtml(creator.creator_id)}</div>
              <div class="creator-meta">
                ${creator.cid ? `CID: ${escapeHtml(creator.cid)}` : '无CID'}
                ${creator.region ? ` • REG: ${escapeHtml(creator.region)}` : ''}
              </div>
              ${creator.tag ? `<div class="creator-tag ${tagClass}">${escapeHtml(creator.tag)}</div>` : ''}
            </div>
            <div class="creator-actions">
              <button type="button" class="jump-creator btn-sm" data-index="${index}" ${creator.cid && creator.region ? '' : 'disabled'}>跳转</button>
              <button type="button" class="edit-creator btn-sm" data-index="${index}">编辑</button>
            </div>
          </div>
          ${creator.remark ? `<div class="creator-remark">备注: ${escapeHtml(creator.remark)}</div>` : ''}
        </div>
      `;
    }).join('');

    creatorList.querySelectorAll('button.edit-creator').forEach(btn => {
      btn.addEventListener('click', () => {
        const index = parseInt(btn.dataset.index, 10);
        const creator = displayList[index];
        const mainIndex = creators.findIndex(c => c.id === creator.id);
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
      return;
    }

    creatorSearchResults.classList.add('show');
    creatorSearchList.innerHTML = searchResults.map((creator, index) => {
      const isLost = creator.tag === '流失达人';
      const itemClass = isLost ? 'creator-item lost' : 'creator-item';
      const tagHtml = creator.tag ? `<span class="creator-tag-badge ${isLost ? 'lost' : 'performance'}">${escapeHtml(creator.tag)}</span>` : '';

      return `
        <div class="${itemClass}">
          <div class="creator-info">
            <div class="creator-main">
              <div class="creator-id">${escapeHtml(creator.creator_id)} ${tagHtml}</div>
              <div class="creator-meta">
                ${creator.cid ? `CID: ${escapeHtml(creator.cid)}` : '无CID'}
                ${creator.region ? ` • REG: ${escapeHtml(creator.region)}` : ''}
              </div>
            </div>
            <div class="creator-actions">
              <button type="button" class="jump-creator btn-sm ${creator.cid && creator.region ? 'danger' : 'muted'}" data-index="${index}" ${creator.cid && creator.region ? '' : 'disabled'}>跳转</button>
              <button type="button" class="edit-creator btn-sm secondary" data-index="${index}">编辑</button>
            </div>
          </div>
          ${creator.remark ? `<div class="creator-remark">备注: ${escapeHtml(creator.remark)}</div>` : ''}
        </div>
      `;
    }).join('');

    creatorSearchList.querySelectorAll('button.edit-creator').forEach(btn => {
      btn.addEventListener('click', () => {
        const index = parseInt(btn.dataset.index, 10);
        const creator = searchResults[index];
        const mainIndex = creators.findIndex(c => c.id === creator.id);
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

    const updatedData = {
      creator_id: creator.creator_id,
      cid: creatorEditCid ? creatorEditCid.value.trim() : '',
      region: creatorEditRegion ? creatorEditRegion.value.trim() : '',
      tag: creatorEditTag ? creatorEditTag.value.trim() : '',
      remark: creatorEditRemark ? creatorEditRemark.value.trim() : ''
    };

    try {
      await apiRequest(`/creators/${creator.id}`, {
        method: 'PUT',
        body: JSON.stringify(updatedData)
      });

      creator.cid = updatedData.cid;
      creator.region = updatedData.region;
      creator.tag = updatedData.tag;
      creator.remark = updatedData.remark;

      closeCreatorEdit();
      renderCreators();
      showStatus('达人信息已更新', 'success', 'creatorCardStatus');
    } catch (e) {
      console.error('更新失败', e);
      showStatus('更新失败: ' + e.message, 'error', 'creatorCardStatus');
    }
  }

  async function deleteCreator() {
    if (editingCreatorIndex < 0 || editingCreatorIndex >= creators.length) return;
    const creator = creators[editingCreatorIndex];
    if (!confirm(`确定删除达人 "${creator.creator_id}" 吗？`)) return;

    try {
      await apiRequest(`/creators/${creator.id}`, {
        method: 'DELETE'
      });

      creators = creators.filter((_, i) => i !== editingCreatorIndex);
      searchResults = searchResults.filter(c => c.id !== creator.id);

      closeCreatorEdit();
      renderCreators();
      showStatus('达人已删除', 'success', 'creatorCardStatus');
    } catch (e) {
      console.error('删除失败', e);
      showStatus('删除失败: ' + e.message, 'error', 'creatorCardStatus');
    }
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
        chrome.tabs.create({ url: chrome.runtime.getURL('Creator/creator.html') });
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
          let failedCount = 0;

          for (const newCreator of newCreators) {
            try {
              const existingIndex = creators.findIndex(c => c.creator_id === newCreator.creator_id);
              if (existingIndex >= 0) {
                await apiRequest(`/creators/${creators[existingIndex].id}`, {
                  method: 'PUT',
                  body: JSON.stringify(newCreator)
                });
                creators[existingIndex] = { ...creators[existingIndex], ...newCreator };
                updatedCount++;
              } else {
                const result = await apiRequest('/creators', {
                  method: 'POST',
                  body: JSON.stringify(newCreator)
                });
                creators.push(result.data);
                addedCount++;
              }
            } catch (err) {
              console.error(`处理达人 ${newCreator.creator_id} 失败:`, err);
              failedCount++;
            }
          }

          renderTags();
          renderCreators();

          let statusMsg = '';
          if (addedCount > 0 && updatedCount > 0) {
            statusMsg = `新增 ${addedCount} 个，更新 ${updatedCount} 个达人`;
          } else if (addedCount > 0) {
            statusMsg = `已导入 ${addedCount} 个新达人`;
          } else if (updatedCount > 0) {
            statusMsg = `已更新 ${updatedCount} 个达人`;
          } else if (failedCount > 0) {
            statusMsg = `导入完成，但有 ${failedCount} 个达人处理失败`;
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

        let deletedCount = 0;
        let failedCount = 0;

        for (const creator of creators) {
          try {
            await apiRequest(`/creators/${creator.id}`, {
              method: 'DELETE'
            });
            deletedCount++;
          } catch (err) {
            console.error(`删除达人 ${creator.creator_id} 失败:`, err);
            failedCount++;
          }
        }

        creators = [];
        searchResults = [];
        renderCreators();
        showStatus(deletedCount > 0 ? `已删除 ${deletedCount} 个达人` : '删除完成', 'success');
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

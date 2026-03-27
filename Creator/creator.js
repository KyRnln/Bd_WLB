// 达人管理模块

(function() {
  'use strict';

  function getStorage() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      return chrome.storage.local;
    }
    console.error('存储不可用');
    return null;
  }

  const storageAPI = getStorage();

  let creators = [];
  let searchResults = [];
  let editingCreatorIndex = -1;
  let activeCreatorTagId = 'all';

  function showStatus(message, type = 'info', elementId = 'status') {
    // 显示状态提示信息
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

  // 从Chrome存储加载达人数据
  async function loadData() {
    if (!storageAPI) {
      console.error('[Creator] 存储API不可用');
      return;
    }
    try {
      const result = await new Promise(resolve => 
        storageAPI.get(['savedCreators', 'activeCreatorTagId'], resolve)
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

  // HTML转义，防止XSS攻击
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // 渲染标签筛选栏，根据已有达人标签生成可点击的标签按钮
  function renderTags() {
    const tagBar = document.getElementById('creatorTagBar');
    if (!tagBar) return;

    const uniqueTags = [...new Set(creators.map(c => c.tag).filter(t => t))];
    const allTags = [{ id: 'all', name: '全部' }, ...uniqueTags.map(t => ({ id: t, name: t }))];

    const chips = [];
    for (const t of allTags) {
      chips.push(`<button class="tag-chip ${activeCreatorTagId === t.id ? 'active' : ''}" data-id="${escapeHtml(t.id)}">${escapeHtml(t.name)}</button>`);
    }
    tagBar.innerHTML = chips.join('');

    tagBar.querySelectorAll('.tag-chip[data-id]').forEach(el => {
      el.addEventListener('click', async () => {
        const id = el.dataset.id;
        activeCreatorTagId = id;
        await saveActiveTagId();
        renderTags();
        renderCreators();
        const tag = allTags.find(t => t.id === id);
        showStatus(`✅ 已切换到：${tag ? tag.name : ''}`, 'success');
      });
    });
  }

  // 保存当前选中的标签ID到存储
  async function saveActiveTagId() {
    await new Promise(resolve => storageAPI.set({ activeCreatorTagId }, resolve));
  }

  // 获取当前标签筛选后的达人列表
  function getFilteredCreators() {
    if (activeCreatorTagId === 'all') {
      return creators.filter(c => c.tag && c.tag.trim() !== '');
    }
    return creators.filter(c => c.tag === activeCreatorTagId);
  }

  // 渲染达人列表主视图，根据搜索状态显示不同内容
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

  // 渲染达人列表（全部/筛选模式）
  function renderCreatorList() {
    const creatorList = document.getElementById('creatorList');
    const totalCount = document.getElementById('totalCount');
    const searchCount = document.getElementById('searchCount');
    const creatorSearchInput = document.getElementById('creatorSearchInput');

    if (!creatorList) return;

    const query = creatorSearchInput ? creatorSearchInput.value.trim().toLowerCase() : '';
    const baseList = getFilteredCreators();
    const displayList = query ? searchResults : baseList;

    if (totalCount) totalCount.textContent = creators.filter(c => c.tag && c.tag.trim() !== '').length;
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
              <div class="creator-id">${escapeHtml(creator.id)}</div>
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

  // 渲染搜索结果列表（搜索模式）
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
              <div class="creator-id">${escapeHtml(creator.id)} ${tagHtml}</div>
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

  // 打开达人编辑弹窗，填充当前达人数据
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
    if (creatorEditId) creatorEditId.value = creator.id || '';
    if (creatorEditCid) creatorEditCid.value = creator.cid || '';
    if (creatorEditRegion) creatorEditRegion.value = creator.region || '';
    if (creatorEditTag) creatorEditTag.value = creator.tag || '';
    if (creatorEditRemark) creatorEditRemark.value = creator.remark || '';
    if (creatorEditDialog) creatorEditDialog.classList.add('show');
  }

  // 关闭达人编辑弹窗
  function closeCreatorEdit() {
    const creatorEditDialog = document.getElementById('creatorEditDialog');
    if (creatorEditDialog) creatorEditDialog.classList.remove('show');
    editingCreatorIndex = -1;
  }

  // 保存编辑后的达人信息到存储
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

    await new Promise(resolve => storageAPI.set({ savedCreators: creators }, resolve));
    closeCreatorEdit();
    renderCreators();
    showStatus('✅ 达人信息已更新', 'success', 'creatorCardStatus');
  }

  // 删除当前编辑的达人
  async function deleteCreator() {
    if (editingCreatorIndex < 0 || editingCreatorIndex >= creators.length) return;
    const creator = creators[editingCreatorIndex];
    if (!confirm(`确定删除达人 "${creator.id}" 吗？`)) return;

    creators = creators.filter((_, i) => i !== editingCreatorIndex);
    searchResults = searchResults.filter(c => c.id !== creator.id);

    await new Promise(resolve => storageAPI.set({ savedCreators: creators }, resolve));
    closeCreatorEdit();
    renderCreators();
    showStatus('✅ 达人已删除', 'success', 'creatorCardStatus');
  }

  // 初始化达人管理模块，绑定所有事件监听器
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

    // 搜索达人
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
          return (c.id && c.id.toLowerCase().includes(query)) ||
                 (c.cid && c.cid.toLowerCase().includes(query)) ||
                 (c.region && c.region.toLowerCase().includes(query)) ||
                 (c.tag && c.tag.toLowerCase().includes(query)) ||
                 (c.remark && c.remark.toLowerCase().includes(query));
        });
        renderCreators();
      });
    }

    // 导入达人
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
              newCreators.push({ id, cid: cid || '', region: region || '', tag: tag || '', remark: remark || '' });
            }
          });

          let updatedCount = 0;
          let addedCount = 0;

          for (const newCreator of newCreators) {
            const existingIndex = creators.findIndex(c => c.id === newCreator.id);
            if (existingIndex >= 0) {
              creators[existingIndex] = { ...creators[existingIndex], ...newCreator };
              updatedCount++;
            } else {
              creators.push(newCreator);
              addedCount++;
            }
          }

          await new Promise(resolve => storageAPI.set({ savedCreators: creators }, resolve));
          renderTags();
          renderCreators();
          
          let statusMsg = '';
          if (addedCount > 0 && updatedCount > 0) {
            statusMsg = `✅ 新增 ${addedCount} 个，更新 ${updatedCount} 个达人`;
          } else if (addedCount > 0) {
            statusMsg = `✅ 已导入 ${addedCount} 个新达人`;
          } else if (updatedCount > 0) {
            statusMsg = `✅ 已更新 ${updatedCount} 个达人`;
          } else {
            statusMsg = `✅ 导入完成`;
          }
          showStatus(statusMsg, 'success', 'creatorCardStatus');
        } catch (err) {
          console.error('导入失败', err);
          showStatus('导入失败，请检查文件格式', 'error', 'creatorCardStatus');
        }

        creatorFileInput.value = '';
      });
    }

    // 下载模板
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

    // 编辑达人弹窗
    if (saveCreatorEditBtn) {
      saveCreatorEditBtn.addEventListener('click', saveCreatorEdit);
    }
    if (cancelCreatorEditBtn) {
      cancelCreatorEditBtn.addEventListener('click', closeCreatorEdit);
    }
    if (deleteCreatorBtn) {
      deleteCreatorBtn.addEventListener('click', deleteCreator);
    }

    // 删除全部达人
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
        await new Promise(resolve => storageAPI.set({ savedCreators: creators }, resolve));
        renderCreators();
        showStatus('✅ 已删除全部达人', 'success');
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

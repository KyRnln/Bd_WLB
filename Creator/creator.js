// 达人管理模块

(function() {
  'use strict';

  let creators = [];
  let searchResults = [];
  let editingCreatorIndex = -1;
  let activeCreatorTagId = 'all';
  let feishuConfigs = [];
  let hiddenFeishuConfig = null;

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

  const _escapeMap = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const _escapeRe = /[&<>"']/g;
  function escapeHtml(text) {
    return text.replace(_escapeRe, ch => _escapeMap[ch]);
  }

  function extractFieldValue(val) {
    if (val === null || val === undefined) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'number') return String(val);
    if (Array.isArray(val)) {
      return val.map(v => extractFieldValue(v)).filter(v => v).join(', ');
    }
    if (typeof val === 'object') {
      if (val.text !== undefined) return String(val.text);
      if (val.name !== undefined) return String(val.name);
      if (val.link !== undefined) return String(val.link);
      if (val.number !== undefined) return String(val.number);
      return JSON.stringify(val);
    }
    return String(val);
  }

  let _tagBarDelegated = false;
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

    if (!_tagBarDelegated) {
      _tagBarDelegated = true;
      tagBar.addEventListener('click', async (e) => {
        const btn = e.target.closest('.filter-tab[data-id]');
        if (!btn) return;
        const id = btn.dataset.id;
        activeCreatorTagId = id;
        await saveData();
        renderTags();
        renderCreators();
        const tag = allTags.find(t => t.id === id);
        showStatus(`已切换到：${tag ? tag.name : ''}`, 'success');
      });
    }
  }

  function getFilteredCreators() {
    if (activeCreatorTagId === 'all') {
      return creators.filter(c => c.tag && c.tag.trim() !== '');
    }
    return creators.filter(c => c.tag === activeCreatorTagId);
  }

  let _statsCache = { total: 0, lost: 0, perf: 0, reconnect: 0, _version: -1 };
  function updateStats() {
    if (_statsCache._version === creators.length) return;
    _statsCache.total = creators.length;
    _statsCache.lost = 0;
    _statsCache.perf = 0;
    _statsCache.reconnect = 0;
    for (let i = 0; i < creators.length; i++) {
      if (creators[i].tag === '流失达人') _statsCache.lost++;
      else if (creators[i].tag === '绩效达人') _statsCache.perf++;
      else if (creators[i].tag === '复联达人') _statsCache.reconnect++;
    }
    _statsCache._version = creators.length;
  }

  function renderCreators() {
    const creatorSearchInput = document.getElementById('creatorSearchInput');
    const creatorSearchList = document.getElementById('creatorSearchList');

    updateStats();
    const totalCount = document.getElementById('totalCount');
    const lostCount = document.getElementById('lostCount');
    const perfCount = document.getElementById('perfCount');
    const reconnectCount = document.getElementById('reconnectCount');
    if (totalCount) totalCount.textContent = _statsCache.total;
    if (lostCount) lostCount.textContent = _statsCache.lost;
    if (perfCount) perfCount.textContent = _statsCache.perf;
    if (reconnectCount) reconnectCount.textContent = _statsCache.reconnect;

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

  let _creatorListDelegated = false;
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
      if (creator.tag === '绩效达人' || creator.tag === '复联达人') tagClass = 'card-tag-performance';
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
            <button type="button" class="card-action-btn jump-creator" data-creator-id="${escapeHtml(creator.creator_id)}" data-cid="${escapeHtml(creator.cid || '')}" data-region="${escapeHtml(creator.region || '')}" ${creator.cid && creator.region ? '' : 'disabled'}>跳转</button>
            <button type="button" class="card-action-btn edit-creator" data-creator-id="${escapeHtml(creator.creator_id)}">编辑</button>
          </div>
        </div>
      `;
    }).join('');

    if (!_creatorListDelegated) {
      _creatorListDelegated = true;
      creatorList.addEventListener('click', (e) => {
        const editBtn = e.target.closest('button.edit-creator');
        if (editBtn) {
          const creatorId = editBtn.dataset.creatorId;
          if (!creatorId) return;
          const mainIndex = creators.findIndex(c => c.creator_id === creatorId);
          if (mainIndex >= 0) {
            openCreatorEdit(mainIndex);
          }
          return;
        }
        const jumpBtn = e.target.closest('button.jump-creator');
        if (jumpBtn) {
          const cid = jumpBtn.dataset.cid;
          const region = jumpBtn.dataset.region;
          if (cid && region) {
            const url = `https://affiliate.tiktokshopglobalselling.com/connection/creator/detail?cid=${cid}&region=${region}`;
            chrome.tabs.create({ url });
          }
        }
      });
    }
  }

  let _searchListDelegated = false;
  function renderSearchResults() {
    const creatorSearchResults = document.getElementById('creatorSearchResults');
    const creatorSearchList = document.getElementById('creatorSearchList');
    if (!creatorSearchResults || !creatorSearchList) return;

    if (searchResults.length === 0) {
      creatorSearchResults.classList.remove('show');
      creatorSearchList.innerHTML = '';
      const searchLabel = document.getElementById('searchResultLabel');
      if (searchLabel) searchLabel.style.display = 'none';
      return;
    }

    creatorSearchResults.classList.add('show');
    const searchLabel = document.getElementById('searchResultLabel');
    if (searchLabel) {
      searchLabel.textContent = `搜索结果（${searchResults.length} 条记录）：`;
      searchLabel.style.display = 'block';
    }
    creatorSearchList.innerHTML = searchResults.map((creator, index) => {
      let tagClass = 'card-tag-default';
      let tagName = creator.tag || '未分组';
      if (creator.tag === '绩效达人' || creator.tag === '复联达人') tagClass = 'card-tag-performance';
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
            <button type="button" class="card-action-btn jump-creator" data-creator-id="${escapeHtml(creator.creator_id)}" data-cid="${escapeHtml(creator.cid || '')}" data-region="${escapeHtml(creator.region || '')}" ${creator.cid && creator.region ? '' : 'disabled'}>跳转</button>
            <button type="button" class="card-action-btn edit-creator" data-creator-id="${escapeHtml(creator.creator_id)}">编辑</button>
          </div>
        </div>
      `;
    }).join('');

    if (!_searchListDelegated) {
      _searchListDelegated = true;
      creatorSearchList.addEventListener('click', (e) => {
        const editBtn = e.target.closest('button.edit-creator');
        if (editBtn) {
          const creatorId = editBtn.dataset.creatorId;
          if (!creatorId) return;
          const mainIndex = creators.findIndex(c => c.creator_id === creatorId);
          if (mainIndex >= 0) {
            openCreatorEdit(mainIndex);
          }
          return;
        }
        const jumpBtn = e.target.closest('button.jump-creator');
        if (jumpBtn) {
          const cid = jumpBtn.dataset.cid;
          const region = jumpBtn.dataset.region;
          if (cid && region) {
            const url = `https://affiliate.tiktokshopglobalselling.com/connection/creator/detail?cid=${cid}&region=${region}`;
            chrome.tabs.create({ url });
          }
        }
      });
    }
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

    updateRegionSelectOptions();

    if (creatorEditId) creatorEditId.value = creator.creator_id || '';
    if (creatorEditCid) creatorEditCid.value = creator.cid || '';
    if (creatorEditRegion) creatorEditRegion.value = creator.region || '';
    if (creatorEditTag) creatorEditTag.value = creator.tag || '';
    if (creatorEditRemark) creatorEditRemark.value = creator.remark || '';
    if (creatorEditDialog) creatorEditDialog.classList.add('show');
  }

  function updateRegionSelectOptions() {
    const select = document.getElementById('creatorEditRegion');
    if (!select) return;
    const currentValue = select.value;
    const options = ['MY', 'PH', 'SG', 'TH', 'ID', 'VN'];
    select.innerHTML = '<option value="">请选择地区</option>';
    for (const opt of options) {
      const optionEl = document.createElement('option');
      optionEl.value = opt;
      optionEl.textContent = opt;
      select.appendChild(optionEl);
    }
    if (currentValue) select.value = currentValue;
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

    const config = getFeishuConfigForDataSource(creator._dataSourceId);
    if (config && config.baseToken) {
      try {
        let recordId = creator._feishuRecordId;
        if (!recordId) {
          const nameField = config.creatorNameField || '达人名称';
          const findResult = await chrome.runtime.sendMessage({
            action: 'findBitableRecordByField',
            config: config,
            fieldName: nameField,
            fieldValue: creator.creator_id
          });
          if (findResult?.success && findResult.recordId) {
            recordId = findResult.recordId;
            creator._feishuRecordId = recordId;
            await saveData();
          } else if (!findResult?.success) {
            console.error('[Creator] 查找飞书记录失败:', findResult);
          }
        }
        if (recordId) {
          const nameField = config.creatorNameField || '达人名称';
          const cidField = config.creatorCidField || '达人CID';
          const statusField = config.creatorStatusField || '达人状态';
          const fields = {
            [nameField]: creator.creator_id,
            [cidField]: creator.cid || '',
            [statusField]: creator.tag || '',
            '备注': creator.remark || ''
          };
          const response = await chrome.runtime.sendMessage({
            action: 'updateBitableRecord',
            config: config,
            recordId: recordId,
            fields: fields
          });
          if (response?.success) {
            showStatus('达人信息已更新（含飞书同步）', 'success', 'creatorCardStatus');
          } else {
            console.error('[Creator] 飞书更新记录失败, 完整响应:', response);
            showStatus('本地已更新，飞书同步失败：' + (response?.error || '未知错误'), 'info', 'creatorCardStatus');
          }
          return;
        }
      } catch (err) {
        console.error('[Creator] 飞书更新记录异常:', err);
        showStatus('本地已更新，飞书同步失败：' + err.message, 'info', 'creatorCardStatus');
        return;
      }
    }

    showStatus('达人信息已更新', 'success', 'creatorCardStatus');
  }

  async function deleteCreator() {
    if (editingCreatorIndex < 0 || editingCreatorIndex >= creators.length) return;
    const creator = creators[editingCreatorIndex];
    if (!confirm(`确定删除达人 "${creator.creator_id}" 吗？`)) return;

    const feishuRecordId = creator._feishuRecordId;
    const config = getFeishuConfigForDataSource(creator._dataSourceId);

    creators = creators.filter((_, i) => i !== editingCreatorIndex);
    searchResults = searchResults.filter(c => c.creator_id !== creator.creator_id);

    await saveData();
    closeCreatorEdit();
    renderCreators();

    if (config && config.baseToken && feishuRecordId) {
      try {
        const response = await chrome.runtime.sendMessage({
          action: 'deleteBitableRecord',
          config: config,
          recordId: feishuRecordId
        });
        if (response?.success) {
          showStatus('达人已删除（含飞书同步）', 'success', 'creatorCardStatus');
        } else {
          console.error('[Creator] 飞书删除记录失败, 完整响应:', response);
          showStatus('本地已删除，飞书同步失败：' + (response?.error || '未知错误'), 'info', 'creatorCardStatus');
        }
        return;
      } catch (err) {
        console.error('[Creator] 飞书删除记录异常:', err);
        showStatus('本地已删除，飞书同步失败：' + err.message, 'info', 'creatorCardStatus');
        return;
      }
    }

    showStatus('达人已删除', 'success', 'creatorCardStatus');
  }

  function getFeishuConfigForDataSource(dataSourceId) {
    if (!dataSourceId) return null;
    if (dataSourceId === 'hidden') return hiddenFeishuConfig;
    return feishuConfigs.find(c => c.id === dataSourceId) || null;
  }

  async function loadFeishuConfigs() {
    try {
      const result = await new Promise(resolve =>
        chrome.storage.local.get(['feishuConfigs', 'feishuConfig', 'hiddenFeishuConfig'], resolve)
      );
      if (result.feishuConfigs) {
        feishuConfigs = result.feishuConfigs;
      } else {
        feishuConfigs = [];
        if (result.feishuConfig) {
          feishuConfigs.push({
            id: Date.now().toString() + '_1',
            remark: '绩效达人',
            ...result.feishuConfig
          });
        }
        if (result.hiddenFeishuConfig) {
          feishuConfigs.push({
            id: Date.now().toString() + '_2',
            remark: '隐藏达人',
            ...result.hiddenFeishuConfig
          });
        }
        if (feishuConfigs.length > 0) {
          await saveFeishuConfigsToStorage();
          chrome.storage.local.remove(['feishuConfig', 'hiddenFeishuConfig']);
        }
      }
    } catch (e) {
      console.error('加载飞书配置失败', e);
      feishuConfigs = [];
    }
  }

  async function saveFeishuConfigsToStorage() {
    try {
      await new Promise(resolve =>
        chrome.storage.local.set({ feishuConfigs }, resolve)
      );
    } catch (e) {
      console.error('保存飞书配置失败', e);
    }
  }

  async function loadHiddenFeishuConfig() {
    try {
      const result = await new Promise(resolve =>
        chrome.storage.local.get(['hiddenFeishuConfig'], resolve)
      );
      hiddenFeishuConfig = result.hiddenFeishuConfig || null;
    } catch (e) {
      console.error('加载隐藏达人配置失败', e);
      hiddenFeishuConfig = null;
    }
  }

  async function saveHiddenFeishuConfigToStorage() {
    try {
      await new Promise(resolve =>
        chrome.storage.local.set({ hiddenFeishuConfig }, resolve)
      );
    } catch (e) {
      console.error('保存隐藏达人配置失败', e);
    }
  }

  function parseFeishuUrl(url) {
    const result = { baseToken: '', tableId: '', wikiToken: '', isWiki: false };
    if (!url) return result;
    try {
      const u = new URL(url);
      const baseMatch = u.pathname.match(/\/base\/([A-Za-z0-9]+)/);
      const wikiMatch = u.pathname.match(/\/wiki\/([A-Za-z0-9]+)/);
      if (baseMatch) {
        result.baseToken = baseMatch[1];
      } else if (wikiMatch) {
        result.wikiToken = wikiMatch[1];
        result.isWiki = true;
      }
      const tableParam = u.searchParams.get('table');
      if (tableParam) result.tableId = tableParam;
    } catch (e) {}
    return result;
  }

  function renderDataSourcePanels() {
    const container = document.getElementById('dialogPanelContainer');
    if (!container) return;

    if (feishuConfigs.length === 0) {
      container.innerHTML = '<p style="text-align: center; color: var(--text-muted, #888); padding: 24px 0;">暂无数据源，点击下方「添加数据源」按钮添加</p>';
      return;
    }

    let html = '';
    for (const config of feishuConfigs) {
      const remark = config.remark || '未命名数据源';
      html += `
        <details class="panel" style="margin-bottom: 12px;" data-id="${escapeHtml(config.id)}">
          <summary class="custom-summary" style="cursor: pointer; padding: 8px 0; list-style: none; display: flex; align-items: center; gap: 8px;">
            <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" /></svg>
            <span style="flex: 1;" class="panel-remark">${escapeHtml(remark)}</span>
            <svg class="chevron-icon h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
          </summary>
          <div class="panel-content" style="padding: 12px 0; overflow: hidden;">
            <p style="font-size: 13px; color: var(--text-muted, #888); margin-bottom: 16px; line-height: 1.5;">
              配置飞书多维表格信息，通过字段名匹配导入达人数据：<br>
              <strong>达人名称字段</strong>：用于匹配达人ID<br>
              <strong>达人CID字段</strong>：用于匹配达人CID<br>
              其他字段（地区、标签、备注）将自动导入
            </p>
            <label>备注名称</label>
            <input type="text" class="ds-field ds-remark" value="${escapeHtml(config.remark || '')}" placeholder="输入数据源备注名称" />
            <label>App ID</label>
            <input type="text" class="ds-field ds-appId" value="${escapeHtml(config.appId || '')}" placeholder="cli_xxxxxxxxxxxxx" />
            <label>App Secret</label>
            <input type="password" class="ds-field ds-appSecret" value="${escapeHtml(config.appSecret || '')}" placeholder="输入飞书应用的 App Secret" />
            <label>飞书多维表格 URL</label>
            <input type="text" class="ds-field ds-feishuUrl" value="${escapeHtml(config.feishuUrl || '')}" placeholder="https://xxx.feishu.cn/base/BASCxxxxx?table=tblxxx" />
            <p style="font-size: 12px; color: var(--text-muted, #888); margin: 8px 0 8px 0;">
              支持多维表格直链（/base/）和 Wiki 链接（/wiki/），系统将自动解析 Base Token 和 Table ID
            </p>
            <label>达人名称字段名</label>
            <input type="text" class="ds-field ds-nameField" value="${escapeHtml(config.creatorNameField || '达人名称')}" placeholder="达人名称" />
            <label>达人CID字段名</label>
            <input type="text" class="ds-field ds-cidField" value="${escapeHtml(config.creatorCidField || '达人CID')}" placeholder="达人CID" />
            <label>达人状态字段名（作为标签）</label>
            <input type="text" class="ds-field ds-statusField" value="${escapeHtml(config.creatorStatusField || '达人状态')}" placeholder="达人状态" />
            <label>地区代码</label>
            <select class="ds-field ds-regionCode">
              <option value="">请选择地区</option>
              <option value="MY"${config.regionCode === 'MY' ? ' selected' : ''}>MY</option>
              <option value="SG"${config.regionCode === 'SG' ? ' selected' : ''}>SG</option>
              <option value="TH"${config.regionCode === 'TH' ? ' selected' : ''}>TH</option>
              <option value="PH"${config.regionCode === 'PH' ? ' selected' : ''}>PH</option>
            </select>
            <div class="flex gap-3 mt-3 w-full" style="min-width: 0; gap: 8px;">
              <button class="btn-sm btn-primary ds-import-btn" style="flex:1;">导入数据</button>
              <button class="btn-sm ds-save-btn">保存配置</button>
              <button class="btn-sm ds-delete-btn" style="color: var(--stat-perf-text); border-color: rgba(255, 100, 100, 0.3);">删除</button>
            </div>
          </div>
        </details>
      `;
    }
    container.innerHTML = html;
  }

  function addNewDataSource() {
    const newConfig = {
      id: Date.now().toString(),
      remark: '新数据源',
      appId: '',
      appSecret: '',
      feishuUrl: '',
      baseToken: '',
      tableId: '',
      wikiToken: '',
      isWiki: false,
      creatorNameField: '达人名称',
      creatorCidField: '达人CID',
      creatorStatusField: '达人状态',
      regionCode: ''
    };
    feishuConfigs.push(newConfig);
    saveFeishuConfigsToStorage();
    renderDataSourcePanels();
    const container = document.getElementById('dialogPanelContainer');
    if (container) {
      const newPanel = container.querySelector(`details[data-id="${newConfig.id}"]`);
      if (newPanel) newPanel.setAttribute('open', '');
    }
    showStatus('已添加新数据源，请填写配置信息', 'success', 'creatorCardStatus');
  }

  function getPanelConfig(detailsEl) {
    const id = detailsEl.dataset.id;
    const inputs = detailsEl.querySelectorAll('.ds-field');
    const getVal = (className) => {
      const input = detailsEl.querySelector('.' + className);
      return input ? input.value.trim() : '';
    };
    return {
      id: id,
      remark: getVal('ds-remark') || '未命名数据源',
      appId: getVal('ds-appId'),
      appSecret: getVal('ds-appSecret'),
      feishuUrl: getVal('ds-feishuUrl'),
      creatorNameField: getVal('ds-nameField') || '达人名称',
      creatorCidField: getVal('ds-cidField') || '达人CID',
      creatorStatusField: getVal('ds-statusField') || '达人状态',
      regionCode: getVal('ds-regionCode')
    };
  }

  async function handleSaveDataSource(detailsEl) {
    const panelConfig = getPanelConfig(detailsEl);
    const id = panelConfig.id;
    const index = feishuConfigs.findIndex(c => c.id === id);
    if (index === -1) {
      showStatus('数据源不存在', 'error', 'creatorCardStatus');
      return;
    }

    const feishuUrl = panelConfig.feishuUrl;
    if (!panelConfig.appId || !panelConfig.appSecret || !feishuUrl) {
      showStatus('请填写 App ID、App Secret 和飞书多维表格 URL', 'error', 'creatorCardStatus');
      return;
    }

    const parsed = parseFeishuUrl(feishuUrl);
    if (!parsed.baseToken && !parsed.wikiToken) {
      showStatus('飞书多维表格 URL 格式不正确，请检查', 'error', 'creatorCardStatus');
      return;
    }
    if (!parsed.tableId) {
      showStatus('URL 中未找到 Table ID，请检查链接是否包含 ?table=tblxxx 参数', 'error', 'creatorCardStatus');
      return;
    }

    feishuConfigs[index] = {
      ...feishuConfigs[index],
      ...panelConfig,
      baseToken: parsed.baseToken,
      tableId: parsed.tableId,
      wikiToken: parsed.wikiToken,
      isWiki: parsed.isWiki
    };

    if (parsed.isWiki) {
      showStatus('正在解析 wiki 链接，请稍候...', 'info', 'creatorCardStatus');
      try {
        const response = await chrome.runtime.sendMessage({
          action: 'resolveWikiToken',
          config: { appId: panelConfig.appId, appSecret: panelConfig.appSecret },
          wikiToken: parsed.wikiToken
        });
        if (response && response.success) {
          feishuConfigs[index].baseToken = response.baseToken;
          showStatus('Wiki 链接解析成功，配置已保存', 'success', 'creatorCardStatus');
        } else {
          showStatus('Wiki 链接解析失败：' + (response?.error || '未知错误') + '，可手动填写 Base Token', 'error', 'creatorCardStatus');
        }
      } catch (err) {
        showStatus('Wiki 链接解析异常：' + err.message + '，可手动填写 Base Token', 'error', 'creatorCardStatus');
      }
    }

    await saveFeishuConfigsToStorage();
    renderDataSourcePanels();
    showStatus('数据源配置已保存', 'success', 'creatorCardStatus');
  }

  async function handleDeleteDataSource(detailsEl) {
    const id = detailsEl.dataset.id;
    const config = feishuConfigs.find(c => c.id === id);
    const remark = config ? (config.remark || '未命名') : '未命名';
    if (!confirm(`确定删除数据源「${remark}」吗？`)) return;

    feishuConfigs = feishuConfigs.filter(c => c.id !== id);
    await saveFeishuConfigsToStorage();
    renderDataSourcePanels();
    showStatus('数据源已删除', 'success', 'creatorCardStatus');
  }

  async function handleImportFromDataSource(detailsEl) {
    const id = detailsEl.dataset.id;
    const config = feishuConfigs.find(c => c.id === id);
    if (!config) {
      showStatus('数据源不存在', 'error', 'creatorCardStatus');
      return;
    }
    if (!config.baseToken) {
      showStatus('Base Token 未配置，请先保存配置', 'error', 'creatorCardStatus');
      return;
    }

    const progressBar = document.getElementById('importProgressBar');
    const progressFill = document.getElementById('importProgressFill');
    const progressText = document.getElementById('importProgressText');
    if (progressBar) progressBar.style.display = 'flex';
    if (progressFill) progressFill.style.width = '10%';
    if (progressText) progressText.textContent = '正在连接飞书...';

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'listBitableRecords',
        config: config
      });

      if (!response || !response.success) {
        throw new Error(response?.error || '获取飞书数据失败');
      }

      if (progressFill) progressFill.style.width = '60%';
      if (progressText) progressText.textContent = '正在解析数据...';

      const records = response.records || [];
      const nameField = config.creatorNameField || '达人名称';
      const cidField = config.creatorCidField || '达人CID';
      const statusField = config.creatorStatusField || '达人状态';
      const regionCode = config.regionCode || '';
      const newCreators = [];

      if (records.length > 0) {
        const sampleFields = Object.keys(records[0].fields || {});
        console.log('[Creator] 飞书多维表格可用字段:', sampleFields);
        console.log('[Creator] 配置的达人名称字段:', nameField);
        console.log('[Creator] 配置的达人CID字段:', cidField);
        console.log('[Creator] 配置的达人状态字段:', statusField);
        if (!sampleFields.includes(nameField)) {
          console.warn('[Creator] 警告: 配置的达人名称字段 "' + nameField + '" 不在可用字段列表中');
        }
        if (!sampleFields.includes(statusField)) {
          console.warn('[Creator] 警告: 配置的达人状态字段 "' + statusField + '" 不在可用字段列表中');
        }
      }

      for (const item of records) {
        const fields = item.fields || {};
        const name = extractFieldValue(fields[nameField]);
        if (!name) continue;

        const nameStr = name.trim();
        if (!nameStr) continue;

        const cid = extractFieldValue(fields[cidField]);
        const tag = extractFieldValue(fields[statusField]);
        const region = regionCode;
        const remark = extractFieldValue(fields['备注']);

        newCreators.push({
          creator_id: nameStr,
          cid: cid,
          region: region,
          tag: tag,
          remark: remark,
          _feishuRecordId: item.recordId || null,
          _dataSourceId: config.id
        });
      }

      if (progressFill) progressFill.style.width = '80%';
      if (progressText) progressText.textContent = `正在写入数据（${newCreators.length} 条）...`;

      creators = creators.filter(c => c._dataSourceId !== config.id);
      creators = creators.concat(newCreators);
      searchResults = [];

      await saveData();
      renderTags();
      renderCreators();

      if (progressFill) progressFill.style.width = '100%';
      if (progressText) progressText.textContent = '导入完成';

      showStatus(`飞书导入完成：共 ${newCreators.length} 条达人`, 'success', 'creatorCardStatus');
    } catch (err) {
      console.error('飞书导入失败', err);
      showStatus('飞书导入失败：' + err.message, 'error', 'creatorCardStatus');
    } finally {
      setTimeout(() => {
        if (progressBar) progressBar.style.display = 'none';
        if (progressFill) progressFill.style.width = '0%';
        if (progressText) progressText.textContent = '0%';
      }, 2000);
    }
  }

  function openFeishuConfigDialog() {
    const dialog = document.getElementById('feishuConfigDialog');
    if (!dialog) return;
    dialog.classList.add('show');
    renderDataSourcePanels();
  }

  function closeFeishuConfigDialog() {
    const dialog = document.getElementById('feishuConfigDialog');
    if (!dialog) return;
    dialog.classList.remove('show');
  }

  function handleConfigHidden() {
    openHiddenConfigDialog();
  }

  async function handleImportHidden() {
    if (!hiddenFeishuConfig || !hiddenFeishuConfig.baseToken) {
      showStatus('请先配置隐藏达人的飞书数据源', 'error', 'creatorCardStatus');
      return;
    }

    const progressBar = document.getElementById('importProgressBar');
    const progressFill = document.getElementById('importProgressFill');
    const progressText = document.getElementById('importProgressText');
    if (progressBar) progressBar.style.display = 'flex';
    if (progressFill) progressFill.style.width = '0%';
    if (progressText) progressText.textContent = '正在从隐藏达人数据源导入...';

    let totalImported = 0;

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'listBitableRecords',
        config: hiddenFeishuConfig
      });

      if (!response || !response.success) {
        throw new Error(response?.error || '获取飞书数据失败');
      }

      const records = response.records || [];
      const nameField = hiddenFeishuConfig.creatorNameField || '达人名称';
      const cidField = hiddenFeishuConfig.creatorCidField || '达人CID';
      const statusField = hiddenFeishuConfig.creatorStatusField || '达人状态';
      const remark = hiddenFeishuConfig.remark || '隐藏达人';
      const newCreators = [];

      for (const item of records) {
        const fields = item.fields || {};
        const name = extractFieldValue(fields[nameField]);
        if (!name) continue;
        const nameStr = name.trim();
        if (!nameStr) continue;

        newCreators.push({
          creator_id: nameStr,
          cid: extractFieldValue(fields[cidField]),
          region: '',
          tag: extractFieldValue(fields[statusField]) || '隐藏达人',
          remark: extractFieldValue(fields['备注']) || remark,
          _feishuRecordId: item.recordId || null,
          _dataSourceId: 'hidden'
        });
      }

      if (progressFill) progressFill.style.width = '60%';
      if (progressText) progressText.textContent = `处理 ${newCreators.length} 条隐藏达人数据...`;

      creators = creators.filter(c => c._dataSourceId !== 'hidden');
      creators = creators.concat(newCreators);
      totalImported = newCreators.length;

      searchResults = [];
      await saveData();
      renderTags();
      renderCreators();

      if (progressFill) progressFill.style.width = '100%';
      if (progressText) progressText.textContent = '导入完成';

      showStatus(`隐藏达人导入完成：共 ${totalImported} 条`, 'success', 'creatorCardStatus');
    } catch (err) {
      console.error('[Creator] 隐藏达人导入失败', err);
      showStatus('隐藏达人导入失败：' + err.message, 'error', 'creatorCardStatus');
    } finally {
      setTimeout(() => {
        if (progressBar) progressBar.style.display = 'none';
        if (progressFill) progressFill.style.width = '0%';
        if (progressText) progressText.textContent = '0%';
      }, 3000);
    }
  }

  function openHiddenConfigDialog() {
    const dialog = document.getElementById('hiddenConfigDialog');
    if (!dialog) return;
    dialog.classList.add('show');

    if (hiddenFeishuConfig) {
      document.getElementById('hiddenConfigRemark').value = hiddenFeishuConfig.remark || '';
      document.getElementById('hiddenConfigAppId').value = hiddenFeishuConfig.appId || '';
      document.getElementById('hiddenConfigAppSecret').value = hiddenFeishuConfig.appSecret || '';
      document.getElementById('hiddenConfigUrl').value = hiddenFeishuConfig.feishuUrl || '';
      document.getElementById('hiddenConfigNameField').value = hiddenFeishuConfig.creatorNameField || '达人名称';
      document.getElementById('hiddenConfigCidField').value = hiddenFeishuConfig.creatorCidField || '达人CID';
      document.getElementById('hiddenConfigStatusField').value = hiddenFeishuConfig.creatorStatusField || '达人状态';
    }
  }

  function closeHiddenConfigDialog() {
    const dialog = document.getElementById('hiddenConfigDialog');
    if (!dialog) return;
    dialog.classList.remove('show');
  }

  async function saveHiddenConfig() {
    const appId = document.getElementById('hiddenConfigAppId').value.trim();
    const appSecret = document.getElementById('hiddenConfigAppSecret').value.trim();
    const feishuUrl = document.getElementById('hiddenConfigUrl').value.trim();
    const remark = document.getElementById('hiddenConfigRemark').value.trim() || '隐藏达人';
    const creatorNameField = document.getElementById('hiddenConfigNameField').value.trim() || '达人名称';
    const creatorCidField = document.getElementById('hiddenConfigCidField').value.trim() || '达人CID';
    const creatorStatusField = document.getElementById('hiddenConfigStatusField').value.trim() || '达人状态';

    if (!feishuUrl) {
      showStatus('请输入飞书多维表格 URL', 'error', 'creatorCardStatus');
      return;
    }

    const parsed = parseFeishuUrl(feishuUrl);
    if (!parsed.baseToken && !parsed.wikiToken) {
      showStatus('无法解析飞书链接，请检查 URL 格式', 'error', 'creatorCardStatus');
      return;
    }

    let baseToken = parsed.baseToken;
    let tableId = parsed.tableId;

    if (parsed.isWiki && !baseToken) {
      try {
        const response = await chrome.runtime.sendMessage({
          action: 'resolveWikiToken',
          wikiToken: parsed.wikiToken
        });
        if (response && response.success && response.baseToken) {
          baseToken = response.baseToken;
        } else {
          baseToken = parsed.wikiToken;
        }
      } catch (e) {
        baseToken = parsed.wikiToken;
      }
    }

    hiddenFeishuConfig = {
      appId,
      appSecret,
      feishuUrl,
      baseToken,
      tableId,
      remark,
      creatorNameField,
      creatorCidField,
      creatorStatusField
    };

    await saveHiddenFeishuConfigToStorage();
    closeHiddenConfigDialog();
    showStatus('隐藏达人配置已保存', 'success', 'creatorCardStatus');
  }

  async function handleImportFromFeishu() {
    if (feishuConfigs.length === 0) {
      showStatus('暂无数据源，请先配置飞书数据源', 'error', 'creatorCardStatus');
      return;
    }

    const progressBar = document.getElementById('importProgressBar');
    const progressFill = document.getElementById('importProgressFill');
    const progressText = document.getElementById('importProgressText');
    if (progressBar) progressBar.style.display = 'flex';

    let totalImported = 0;
    let totalErrors = 0;

    for (let i = 0; i < feishuConfigs.length; i++) {
      const config = feishuConfigs[i];
      const remark = config.remark || '未命名';

      if (!config.baseToken) {
        console.warn(`[Creator] 数据源「${remark}」未配置 Base Token，跳过`);
        totalErrors++;
        continue;
      }

      if (progressFill) progressFill.style.width = `${Math.round((i / feishuConfigs.length) * 80)}%`;
      if (progressText) progressText.textContent = `正在从「${remark}」导入...`;

      try {
        const response = await chrome.runtime.sendMessage({
          action: 'listBitableRecords',
          config: config
        });

        if (!response || !response.success) {
          console.error(`[Creator] 数据源「${remark}」获取失败:`, response?.error);
          totalErrors++;
          continue;
        }

        const records = response.records || [];
        const nameField = config.creatorNameField || '达人名称';
        const cidField = config.creatorCidField || '达人CID';
        const statusField = config.creatorStatusField || '达人状态';
        const regionCode = config.regionCode || '';
        const newCreators = [];

        for (const item of records) {
          const fields = item.fields || {};
          const name = extractFieldValue(fields[nameField]);
          if (!name) continue;
          const nameStr = name.trim();
          if (!nameStr) continue;

          newCreators.push({
            creator_id: nameStr,
            cid: extractFieldValue(fields[cidField]),
            region: regionCode,
            tag: extractFieldValue(fields[statusField]),
            remark: extractFieldValue(fields['备注']),
            _feishuRecordId: item.recordId || null,
            _dataSourceId: config.id
          });
        }

        creators = creators.filter(c => c._dataSourceId !== config.id);
        creators = creators.concat(newCreators);
        totalImported += newCreators.length;

        if (progressFill) progressFill.style.width = `${Math.round(((i + 1) / feishuConfigs.length) * 80)}%`;
        if (progressText) progressText.textContent = `「${remark}」导入 ${newCreators.length} 条`;
      } catch (err) {
        console.error(`[Creator] 数据源「${remark}」导入异常:`, err);
        totalErrors++;
      }
    }

    searchResults = [];
    await saveData();
    renderTags();
    renderCreators();

    if (progressFill) progressFill.style.width = '100%';
    if (progressText) progressText.textContent = '导入完成';

    const msg = `飞书导入完成：共 ${totalImported} 条达人` + (totalErrors > 0 ? `，${totalErrors} 个数据源失败` : '');
    showStatus(msg, totalErrors > 0 ? 'info' : 'success', 'creatorCardStatus');

    setTimeout(() => {
      if (progressBar) progressBar.style.display = 'none';
      if (progressFill) progressFill.style.width = '0%';
      if (progressText) progressText.textContent = '0%';
    }, 3000);
  }

  function initCreatorModule() {
    const openCreatorManageBtn = document.getElementById('openCreatorManageBtn');
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
      let _searchTimer = null;
      creatorSearchInput.addEventListener('input', () => {
        clearTimeout(_searchTimer);
        _searchTimer = setTimeout(() => {
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
        }, 200);
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

    const importFeishuBtn = document.getElementById('importFeishuBtn');
    if (importFeishuBtn) {
      importFeishuBtn.addEventListener('click', handleImportFromFeishu);
    }

    const configFeishuBtn = document.getElementById('configFeishuBtn');
    if (configFeishuBtn) {
      configFeishuBtn.addEventListener('click', openFeishuConfigDialog);
    }

    const importHiddenBtn = document.getElementById('importHiddenBtn');
    if (importHiddenBtn) {
      importHiddenBtn.addEventListener('click', handleImportHidden);
    }

    const configHiddenBtn = document.getElementById('configHiddenBtn');
    if (configHiddenBtn) {
      configHiddenBtn.addEventListener('click', handleConfigHidden);
    }

    const closeHiddenConfigBtn = document.getElementById('closeHiddenConfigBtn');
    if (closeHiddenConfigBtn) {
      closeHiddenConfigBtn.addEventListener('click', closeHiddenConfigDialog);
    }

    const saveHiddenConfigBtn = document.getElementById('saveHiddenConfigBtn');
    if (saveHiddenConfigBtn) {
      saveHiddenConfigBtn.addEventListener('click', saveHiddenConfig);
    }

    const closeFeishuConfigBtn = document.getElementById('closeFeishuConfigBtn');
    if (closeFeishuConfigBtn) {
      closeFeishuConfigBtn.addEventListener('click', closeFeishuConfigDialog);
    }

    const dialogAddDataSourceBtn = document.getElementById('dialogAddDataSourceBtn');
    if (dialogAddDataSourceBtn) {
      dialogAddDataSourceBtn.addEventListener('click', addNewDataSource);
    }

    const dialogPanelContainer = document.getElementById('dialogPanelContainer');
    if (dialogPanelContainer) {
      dialogPanelContainer.addEventListener('click', async (e) => {
        const detailsEl = e.target.closest('details.panel');
        if (!detailsEl) return;

        if (e.target.closest('.ds-save-btn')) {
          e.preventDefault();
          await handleSaveDataSource(detailsEl);
        } else if (e.target.closest('.ds-delete-btn')) {
          e.preventDefault();
          await handleDeleteDataSource(detailsEl);
        } else if (e.target.closest('.ds-import-btn')) {
          e.preventDefault();
          await handleImportFromDataSource(detailsEl);
        }
      });
    }

    loadHiddenFeishuConfig();
    loadFeishuConfigs().then(() => {
      renderDataSourcePanels();
    });
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
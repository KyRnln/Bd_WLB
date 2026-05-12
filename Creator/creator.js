// 达人管理模块

(function() {
  'use strict';

  let creators = [];
  let searchResults = [];
  let editingCreatorIndex = -1;
  let activeCreatorTagId = 'all';
  let feishuConfig = null;
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

  let _statsCache = { total: 0, lost: 0, perf: 0, _version: -1 };
  function updateStats() {
    if (_statsCache._version === creators.length) return;
    _statsCache.total = creators.length;
    _statsCache.lost = 0;
    _statsCache.perf = 0;
    for (let i = 0; i < creators.length; i++) {
      if (creators[i].tag === '流失达人') _statsCache.lost++;
      else if (creators[i].tag === '绩效达人') _statsCache.perf++;
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
    if (totalCount) totalCount.textContent = _statsCache.total;
    if (lostCount) lostCount.textContent = _statsCache.lost;
    if (perfCount) perfCount.textContent = _statsCache.perf;

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

    if (!_creatorListDelegated) {
      _creatorListDelegated = true;
      creatorList.addEventListener('click', (e) => {
        const editBtn = e.target.closest('button.edit-creator');
        if (editBtn) {
          const index = parseInt(editBtn.dataset.index, 10);
          const creator = displayList[index];
          if (!creator) return;
          const mainIndex = creators.findIndex(c => c.creator_id === creator.creator_id);
          if (mainIndex >= 0) {
            openCreatorEdit(mainIndex, query ? index : -1);
          }
          return;
        }
        const jumpBtn = e.target.closest('button.jump-creator');
        if (jumpBtn) {
          const index = parseInt(jumpBtn.dataset.index, 10);
          const creator = displayList[index];
          if (creator && creator.cid && creator.region) {
            const url = `https://affiliate.tiktokshopglobalselling.com/connection/creator/detail?cid=${creator.cid}&region=${creator.region}`;
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

    if (!_searchListDelegated) {
      _searchListDelegated = true;
      creatorSearchList.addEventListener('click', (e) => {
        const editBtn = e.target.closest('button.edit-creator');
        if (editBtn) {
          const index = parseInt(editBtn.dataset.index, 10);
          const creator = searchResults[index];
          if (!creator) return;
          const mainIndex = creators.findIndex(c => c.creator_id === creator.creator_id);
          if (mainIndex >= 0) {
            openCreatorEdit(mainIndex, index);
          }
          return;
        }
        const jumpBtn = e.target.closest('button.jump-creator');
        if (jumpBtn) {
          const index = parseInt(jumpBtn.dataset.index, 10);
          const creator = searchResults[index];
          if (creator && creator.cid && creator.region) {
            const url = `https://affiliate.tiktokshopglobalselling.com/connection/creator/detail?cid=${creator.cid}&region=${creator.region}`;
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

    const config = getFeishuConfigForTag(creator.tag);
    if (config) {
      try {
        let row = creator._feishuRow;
        if (!row) {
          const findResult = await chrome.runtime.sendMessage({
            action: 'findFeishuRowByCreatorId',
            config: config,
            creatorId: creator.creator_id
          });
          if (findResult?.success && findResult.row > 0) {
            row = findResult.row;
            creator._feishuRow = row;
            await saveData();
          } else if (!findResult?.success) {
            console.error('[Creator] 查找飞书行号失败:', findResult);
          }
        }
        if (row) {
          const values = [creator.creator_id, creator.cid || '', creator.region || '', creator.tag || '', creator.remark || ''];
          const response = await chrome.runtime.sendMessage({
            action: 'updateFeishuSheetRow',
            config: config,
            row: row,
            values: values
          });
          if (response?.success) {
            showStatus('达人信息已更新（含飞书同步）', 'success', 'creatorCardStatus');
          } else {
            console.error('[Creator] 飞书更新行失败, 完整响应:', response);
            showStatus('本地已更新，飞书同步失败：' + (response?.error || '未知错误'), 'info', 'creatorCardStatus');
          }
          return;
        }
      } catch (err) {
        console.error('[Creator] 飞书更新行异常:', err);
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

    const feishuRow = creator._feishuRow;

    creators = creators.filter((_, i) => i !== editingCreatorIndex);
    searchResults = searchResults.filter(c => c.creator_id !== creator.creator_id);

    await saveData();
    closeCreatorEdit();
    renderCreators();

    const config = getFeishuConfigForTag(creator.tag);
    if (config && feishuRow) {
      try {
        const values = ['', '', '', '', ''];
        const response = await chrome.runtime.sendMessage({
          action: 'updateFeishuSheetRow',
          config: config,
          row: feishuRow,
          values: values
        });
        if (response?.success) {
          showStatus('达人已删除（含飞书同步）', 'success', 'creatorCardStatus');
        } else {
          console.error('[Creator] 飞书删除行（清空）失败, 完整响应:', response);
          showStatus('本地已删除，飞书同步失败：' + (response?.error || '未知错误'), 'info', 'creatorCardStatus');
        }
        return;
      } catch (err) {
        console.error('[Creator] 飞书删除行（清空）异常:', err);
        showStatus('本地已删除，飞书同步失败：' + err.message, 'info', 'creatorCardStatus');
        return;
      }
    }

    showStatus('达人已删除', 'success', 'creatorCardStatus');
  }

  async function loadFeishuConfig() {
    try {
      const result = await new Promise(resolve =>
        chrome.storage.local.get(['feishuConfig'], resolve)
      );
      feishuConfig = result.feishuConfig || null;
    } catch (e) {
      console.error('加载飞书配置失败', e);
      feishuConfig = null;
    }
  }

  async function saveFeishuConfigToStorage() {
    try {
      await new Promise(resolve =>
        chrome.storage.local.set({ feishuConfig }, resolve)
      );
    } catch (e) {
      console.error('保存飞书配置失败', e);
    }
  }

  function parseFeishuUrl(url) {
    const result = { spreadsheetToken: '', range: 'A:E' };
    if (!url) return result;

    const match = url.match(/sheets\/([^\/?]+)/);
    if (!match) return result;
    result.spreadsheetToken = match[1];

    const sheetMatch = url.match(/[?&]sheet=([^&]+)/);
    if (sheetMatch) {
      result.range = sheetMatch[1] + '!A:E';
    }

    return result;
  }

  function openFeishuConfig() {
    const dialog = document.getElementById('feishuConfigDialog');
    if (!dialog) return;
    document.getElementById('feishuAppId').value = feishuConfig?.appId || '';
    document.getElementById('feishuAppSecret').value = feishuConfig?.appSecret || '';
    document.getElementById('feishuUrl').value = feishuConfig?.feishuUrl || '';
    dialog.classList.add('show');
  }

  function closeFeishuConfig() {
    const dialog = document.getElementById('feishuConfigDialog');
    if (dialog) dialog.classList.remove('show');
  }

  async function handleSaveFeishuConfig() {
    const appId = document.getElementById('feishuAppId').value.trim();
    const appSecret = document.getElementById('feishuAppSecret').value.trim();
    const feishuUrl = document.getElementById('feishuUrl').value.trim();

    if (!appId || !appSecret || !feishuUrl) {
      showStatus('请填写 App ID、App Secret 和飞书表格 URL', 'error', 'creatorCardStatus');
      return;
    }

    const parsed = parseFeishuUrl(feishuUrl);
    if (!parsed.spreadsheetToken) {
      showStatus('飞书表格 URL 格式不正确，请检查', 'error', 'creatorCardStatus');
      return;
    }

    feishuConfig = {
      appId,
      appSecret,
      feishuUrl,
      spreadsheetToken: parsed.spreadsheetToken,
      range: parsed.range
    };
    await saveFeishuConfigToStorage();
    closeFeishuConfig();
    showStatus('飞书配置已保存', 'success', 'creatorCardStatus');
  }

  async function handleImportFromFeishu() {
    if (!feishuConfig) {
      showStatus('请先在「飞书配置」中设置飞书信息', 'error', 'creatorCardStatus');
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
        action: 'fetchFeishuSheetData',
        config: feishuConfig
      });

      if (!response || !response.success) {
        throw new Error(response?.error || '获取飞书数据失败');
      }

      if (progressFill) progressFill.style.width = '60%';
      if (progressText) progressText.textContent = '正在解析数据...';

      const rows = response.data || [];
      const newCreators = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (i === 0) continue;
        const id = row[0]?.toString().trim();
        if (!id) continue;
        newCreators.push({
          creator_id: id,
          cid: (row[1]?.toString().trim()) || '',
          region: (row[2]?.toString().trim()) || '',
          tag: (row[3]?.toString().trim()) || '',
          remark: (row[4]?.toString().trim()) || '',
          _feishuRow: i + 1
        });
      }

      if (progressFill) progressFill.style.width = '80%';
      if (progressText) progressText.textContent = `正在写入数据（${newCreators.length} 条）...`;

      creators = newCreators;
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

  function getFeishuConfigForTag(tag) {
    return tag === '隐藏达人' && hiddenFeishuConfig ? hiddenFeishuConfig : feishuConfig;
  }

  async function loadHiddenFeishuConfig() {
    try {
      const result = await new Promise(resolve =>
        chrome.storage.local.get(['hiddenFeishuConfig'], resolve)
      );
      hiddenFeishuConfig = result.hiddenFeishuConfig || null;
    } catch (e) {
      console.error('加载隐藏数据源配置失败', e);
      hiddenFeishuConfig = null;
    }
  }

  async function saveHiddenFeishuConfigToStorage() {
    try {
      await new Promise(resolve =>
        chrome.storage.local.set({ hiddenFeishuConfig }, resolve)
      );
    } catch (e) {
      console.error('保存隐藏数据源配置失败', e);
    }
  }

  function openHiddenFeishuConfig() {
    const dialog = document.getElementById('hiddenFeishuConfigDialog');
    if (!dialog) return;
    document.getElementById('hiddenFeishuAppId').value = hiddenFeishuConfig?.appId || '';
    document.getElementById('hiddenFeishuAppSecret').value = hiddenFeishuConfig?.appSecret || '';
    document.getElementById('hiddenFeishuUrl').value = hiddenFeishuConfig?.feishuUrl || '';
    dialog.classList.add('show');
  }

  function closeHiddenFeishuConfig() {
    const dialog = document.getElementById('hiddenFeishuConfigDialog');
    if (dialog) dialog.classList.remove('show');
  }

  async function handleSaveHiddenFeishuConfig() {
    const appId = document.getElementById('hiddenFeishuAppId').value.trim();
    const appSecret = document.getElementById('hiddenFeishuAppSecret').value.trim();
    const feishuUrl = document.getElementById('hiddenFeishuUrl').value.trim();

    if (!appId || !appSecret || !feishuUrl) {
      showStatus('请填写 App ID、App Secret 和飞书表格 URL', 'error', 'creatorCardStatus');
      return;
    }

    const parsed = parseFeishuUrl(feishuUrl);
    if (!parsed.spreadsheetToken) {
      showStatus('飞书表格 URL 格式不正确，请检查', 'error', 'creatorCardStatus');
      return;
    }

    hiddenFeishuConfig = {
      appId,
      appSecret,
      feishuUrl,
      spreadsheetToken: parsed.spreadsheetToken,
      range: parsed.range
    };
    await saveHiddenFeishuConfigToStorage();
    closeHiddenFeishuConfig();
    showStatus('隐藏数据源配置已保存', 'success', 'creatorCardStatus');
  }

  async function handleImportFromHiddenFeishu() {
    if (!hiddenFeishuConfig) {
      showStatus('请先在「隐藏数据源」中设置飞书信息', 'error', 'creatorCardStatus');
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
        action: 'fetchFeishuSheetData',
        config: hiddenFeishuConfig
      });

      if (!response || !response.success) {
        throw new Error(response?.error || '获取飞书数据失败');
      }

      if (progressFill) progressFill.style.width = '60%';
      if (progressText) progressText.textContent = '正在解析数据...';

      const rows = response.data || [];

      creators = creators.filter(c => c.tag !== '隐藏达人');

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (i === 0) continue;
        const id = row[0]?.toString().trim();
        if (!id) continue;

        creators.push({
          creator_id: id,
          cid: (row[1]?.toString().trim()) || '',
          region: (row[2]?.toString().trim()) || '',
          tag: '隐藏达人',
          remark: (row[4]?.toString().trim()) || '',
          _feishuRow: i + 1
        });
      }

      if (progressFill) progressFill.style.width = '80%';
      if (progressText) progressText.textContent = `正在写入数据...`;

      await saveData();
      renderTags();
      renderCreators();

      if (progressFill) progressFill.style.width = '100%';
      if (progressText) progressText.textContent = '导入完成';

      showStatus(`隐藏数据源同步完成：共 ${rows.length - 1} 条`, 'success', 'creatorCardStatus');
    } catch (err) {
      console.error('隐藏数据源导入失败', err);
      showStatus('隐藏数据源导入失败：' + err.message, 'error', 'creatorCardStatus');
    } finally {
      setTimeout(() => {
        if (progressBar) progressBar.style.display = 'none';
        if (progressFill) progressFill.style.width = '0%';
        if (progressText) progressText.textContent = '0%';
      }, 2000);
    }
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

    const importFeishuBtn = document.getElementById('importFeishuBtn');
    if (importFeishuBtn) {
      importFeishuBtn.addEventListener('click', handleImportFromFeishu);
    }

    const configFeishuBtn = document.getElementById('configFeishuBtn');
    if (configFeishuBtn) {
      configFeishuBtn.addEventListener('click', openFeishuConfig);
    }

    const saveFeishuConfigBtn = document.getElementById('saveFeishuConfigBtn');
    const cancelFeishuConfigBtn = document.getElementById('cancelFeishuConfigBtn');
    if (saveFeishuConfigBtn) {
      saveFeishuConfigBtn.addEventListener('click', handleSaveFeishuConfig);
    }
    if (cancelFeishuConfigBtn) {
      cancelFeishuConfigBtn.addEventListener('click', closeFeishuConfig);
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

    const configHiddenFeishuBtn = document.getElementById('configHiddenFeishuBtn');
    if (configHiddenFeishuBtn) {
      configHiddenFeishuBtn.addEventListener('click', openHiddenFeishuConfig);
    }

    const importHiddenFeishuBtn = document.getElementById('importHiddenFeishuBtn');
    if (importHiddenFeishuBtn) {
      importHiddenFeishuBtn.addEventListener('click', handleImportFromHiddenFeishu);
    }

    const saveHiddenFeishuConfigBtn = document.getElementById('saveHiddenFeishuConfigBtn');
    const cancelHiddenFeishuConfigBtn = document.getElementById('cancelHiddenFeishuConfigBtn');
    if (saveHiddenFeishuConfigBtn) {
      saveHiddenFeishuConfigBtn.addEventListener('click', handleSaveHiddenFeishuConfig);
    }
    if (cancelHiddenFeishuConfigBtn) {
      cancelHiddenFeishuConfigBtn.addEventListener('click', closeHiddenFeishuConfig);
    }

    loadFeishuConfig();
    loadHiddenFeishuConfig();
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

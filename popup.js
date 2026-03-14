// Popup 仅保留快捷短语功能

function getStorage() {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    return chrome.storage.local;
  }
  console.error('存储不可用，无法使用快捷短语');
  return null;
}

document.addEventListener('DOMContentLoaded', () => {
  const storageAPI = getStorage();
  if (!storageAPI) return;

  // 工具按钮导航
  const btnCover = document.getElementById('btnCover');
  const btnCid = document.getElementById('btnCid');
  const btnCidToName = document.getElementById('btnCidToName');
  const btnOrder = document.getElementById('btnOrder');

  if (btnCover) {
    btnCover.addEventListener('click', () => {
      window.location.href = 'cover/cover.html';
    });
  }
  if (btnCid) {
    btnCid.addEventListener('click', () => {
      window.location.href = 'username_avatarcid/username_avatarcid.html';
    });
  }
  if (btnCidToName) {
    btnCidToName.addEventListener('click', () => {
      window.location.href = 'cid_to_name/cid_to_name.html';
    });
  }
  if (btnOrder) {
    btnOrder.addEventListener('click', () => {
      window.location.href = 'order/order.html';
    });
  }

  // 界面元素
  const tagBar = document.getElementById('tagBar');
  const tagManageDialog = document.getElementById('tagManageDialog');
  const tagListManage = document.getElementById('tagListManage');
  const closeTagManageBtn = document.getElementById('closeTagManageBtn');
  const addTagBtn = document.getElementById('addTagBtn');
  const phraseList = document.getElementById('phraseList');
  const addPhraseBtn = document.getElementById('addPhraseBtn');
  const phraseEditDialog = document.getElementById('phraseEditDialog');
  const phraseEditTitle = document.getElementById('phraseEditTitle');
  const phraseTag = document.getElementById('phraseTag');
  const phraseTitle = document.getElementById('phraseTitle');
  const phraseContent = document.getElementById('phraseContent');
  const savePhraseBtn = document.getElementById('savePhraseBtn');
  const cancelPhraseBtn = document.getElementById('cancelPhraseBtn');
  const importCreatorBtn = document.getElementById('importCreatorBtn');
  const downloadCreatorTemplateBtn = document.getElementById('downloadCreatorTemplateBtn');
  const creatorFileInput = document.getElementById('creatorFileInput');
  const creatorStats = document.getElementById('creatorStats');
  const creatorPreview = document.getElementById('creatorPreview');
  const creatorSearchInput = document.getElementById('creatorSearchInput');
  const creatorSearchResults = document.getElementById('creatorSearchResults');
  const creatorSearchList = document.getElementById('creatorSearchList');
  const creatorEditDialog = document.getElementById('creatorEditDialog');
  const creatorEditId = document.getElementById('creatorEditId');
  const creatorEditCid = document.getElementById('creatorEditCid');
  const creatorEditRegion = document.getElementById('creatorEditRegion');
  const creatorEditRemark = document.getElementById('creatorEditRemark');
  const saveCreatorEditBtn = document.getElementById('saveCreatorEditBtn');
  const cancelCreatorEditBtn = document.getElementById('cancelCreatorEditBtn');
  const deleteCreatorBtn = document.getElementById('deleteCreatorBtn');
  const clearAllDataBtn = document.getElementById('clearAllDataBtn');
  const backupBtn = document.getElementById('backupBtn');
  const initAppBtn = document.getElementById('initAppBtn');
  const backupDialog = document.getElementById('backupDialog');
  const exportDataBtn = document.getElementById('exportDataBtn');
  const importDataFile = document.getElementById('importDataFile');
  const importDataBtn = document.getElementById('importDataBtn');
  const closeBackupDialogBtn = document.getElementById('closeBackupDialogBtn');
  const openPhraseManageBtn = document.getElementById('openPhraseManageBtn');

  // WebDAV
  const webdavUrl = document.getElementById('webdavUrl');
  const webdavUsername = document.getElementById('webdavUsername');
  const webdavPassword = document.getElementById('webdavPassword');
  const backupToWebdavBtn = document.getElementById('backupToWebdavBtn');
  const restoreFromWebdavBtn = document.getElementById('restoreFromWebdavBtn');
  const webdavStatus = document.getElementById('webdavStatus');

  // 订单查询相关元素
  const orderIdInput = document.getElementById('orderId');
  const startOrderQueryBtn = document.getElementById('startOrderQueryBtn');
  const stopOrderQueryBtn = document.getElementById('stopOrderQueryBtn');

  // ===== 工具卡片选项卡切换 =====
  const tabOrder = document.getElementById('tabOrder');
  const tabCid = document.getElementById('tabCid');
  const tabCover = document.getElementById('tabCover');
  const tabCidToName = document.getElementById('tabCidToName');

  const panelOrder = document.getElementById('panelOrder');
  const panelCid = document.getElementById('panelCid');
  const panelCover = document.getElementById('panelCover');
  const panelCidToName = document.getElementById('panelCidToName');

  function resetAllTabs() {
    [tabOrder, tabCid, tabCover, tabCidToName].forEach(tab => {
      if (tab) {
        tab.style.color = '#666';
        tab.style.borderBottom = '2px solid transparent';
        tab.style.background = 'transparent';
      }
    });
    [panelOrder, panelCid, panelCover, panelCidToName].forEach(panel => {
      if (panel) {
        panel.style.display = 'none';
      }
    });
  }

  function activateTab(tab, panel) {
    if (!tab || !panel) return;
    resetAllTabs();
    tab.style.color = '#1a365d';
    tab.style.borderBottom = '2px solid #ff0050';
    tab.style.background = '#fff';
    panel.style.display = 'block';
  }

  if (tabOrder && tabCid && panelOrder && panelCid) {
    tabOrder.addEventListener('click', () => activateTab(tabOrder, panelOrder));
    tabCid.addEventListener('click', () => activateTab(tabCid, panelCid));
    if (tabCover && panelCover) {
      tabCover.addEventListener('click', () => activateTab(tabCover, panelCover));
    }
    if (tabCidToName && panelCidToName) {
      tabCidToName.addEventListener('click', () => activateTab(tabCidToName, panelCidToName));
    }
    // 初始化激活第一个标签页
    if (tabCover && panelCover) {
      activateTab(tabCover, panelCover);
    }
  }

  let phrases = [];
  let tags = [];
  let activeTagId = '__ALL__';
  let editingId = null;
  let creators = []; // {id: string, cid?: string, region?: string, remark?: string}
  let searchResults = [];
  let editingCreatorIndex = -1;
  const DEFAULT_TAG_ID = 'default';

  // 状态提示
  function showStatus(message, type = 'info', elementId = 'status') {
    let statusDiv = document.getElementById(elementId);
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

  // 加载/保存
  async function loadData() {
    try {
      const result = await new Promise(resolve => storageAPI.get(['savedPhrases', 'savedTags', 'activeTagId', 'savedCreators', 'webdavConfig', 'creatorBlacklist'], resolve));
      phrases = result.savedPhrases || [];
      tags = Array.isArray(result.savedTags) ? result.savedTags : [];
      activeTagId = typeof result.activeTagId === 'string' ? result.activeTagId : '__ALL__';
      creators = Array.isArray(result.savedCreators) ? result.savedCreators : [];
      window.creatorBlacklist = Array.isArray(result.creatorBlacklist) ? result.creatorBlacklist : [];

      if (result.webdavConfig) {
        if (webdavUrl) webdavUrl.value = result.webdavConfig.url || 'https://dav.jianguoyun.com/dav/';
        if (webdavUsername) webdavUsername.value = result.webdavConfig.username || '';
        if (webdavPassword) webdavPassword.value = result.webdavConfig.password || '';
      }

      searchResults = [];
      await ensureTagsAndMigrate();
      renderAll();
    } catch (e) {
      console.error('加载短语失败', e);
      phrases = [];
      tags = [];
      activeTagId = '__ALL__';
      creators = [];
      window.creatorBlacklist = [];
      searchResults = [];
      await ensureTagsAndMigrate();
      renderAll();
    }
  }

  async function savePhrases() {
    await new Promise(resolve => storageAPI.set({ savedPhrases: phrases }, resolve));
  }

  async function saveTags() {
    await new Promise(resolve => storageAPI.set({ savedTags: tags }, resolve));
  }

  async function saveActiveTagId() {
    await new Promise(resolve => storageAPI.set({ activeTagId }, resolve));
  }

  async function ensureTagsAndMigrate() {
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

    // 旧短语补 tagId
    const validTagIds = new Set(tags.map(t => t.id));
    for (const p of phrases) {
      if (!p.tagId || !validTagIds.has(p.tagId)) {
        p.tagId = DEFAULT_TAG_ID;
        changed = true;
      }
    }

    // activeTagId 校正
    if (activeTagId !== '__ALL__' && !validTagIds.has(activeTagId)) {
      activeTagId = '__ALL__';
      changed = true;
    }

    if (changed) {
      await new Promise(resolve => storageAPI.set({
        savedTags: tags,
        savedPhrases: phrases,
        activeTagId,
        savedCreators: creators
      }, resolve));
    }
  }

  function renderAll() {
    renderTagBar();
    if (phraseList) renderPhraseList();
    renderCreators();
  }

  // 渲染列表
  function renderPhraseList() {
    if (!phraseList) return;
    const list = getVisiblePhrases();
    if (!list.length) {
      phraseList.innerHTML = `
        <div class="empty-state" style="padding: 24px 16px;">
          <p style="font-size: 14px; color: #666;">暂无快捷短语</p>
          <p style="font-size: 12px; color: #999; margin-top: 5px;">点击上方"添加短语"按钮创建您的第一个快捷短语</p>
        </div>
      `;
      return;
    }

    phraseList.innerHTML = list.map(p => `
      <div class="phrase-item" style="display:flex;align-items:center;padding:12px;border:1px solid #eee;border-radius:6px;margin-bottom:8px;background:#fafafa;">
        <div style="flex:1;overflow:hidden;">
          <div style="font-weight:600;font-size:14px;color:#333;margin-bottom:4px;">${escapeHtml(p.title || '未命名')}</div>
          <div style="font-size:12px;color:#666;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(p.content || '')}</div>
          </div>
        <div style="display:flex;gap:6px;margin-left:10px;">
          <button type="button" class="edit" data-id="${p.id}" style="background:#007bff;color:#fff;border:none;border-radius:4px;padding:6px 10px;cursor:pointer;font-size:11px;">编辑</button>
          <button type="button" class="delete" data-id="${p.id}" style="background:#dc3545;color:#fff;border:none;border-radius:4px;padding:6px 10px;cursor:pointer;font-size:11px;">删除</button>
          </div>
        </div>
    `).join('');

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
    if (activeTagId === '__ALL__') return phrases.slice();
    return phrases.filter(p => p.tagId === activeTagId);
  }

  function renderTagBar() {
    if (!tagBar) return;
    const chips = [];
    chips.push(`<div class="tag-chip ${activeTagId === '__ALL__' ? 'active' : ''}" data-id="__ALL__">全部</div>`);
    for (const t of tags) {
      chips.push(`<div class="tag-chip ${activeTagId === t.id ? 'active' : ''}" data-id="${escapeHtml(t.id)}">${escapeHtml(t.name)}</div>`);
    }
    chips.push(`<div class="tag-chip manage" data-action="manage">管理</div>`);
    tagBar.innerHTML = chips.join('');

    tagBar.querySelectorAll('.tag-chip[data-id]').forEach(el => {
      el.addEventListener('click', async () => {
        const id = el.dataset.id;
        const tagName = id === '__ALL__' ? '全部' : (tags.find(t => t.id === id)?.name || '');
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
    if (!phraseTag) return;
    const opts = tags.map(t => `<option value="${escapeHtml(t.id)}">${escapeHtml(t.name)}</option>`).join('');
    phraseTag.innerHTML = opts;
    const next = selectedId && tags.some(t => t.id === selectedId) ? selectedId : DEFAULT_TAG_ID;
    phraseTag.value = next;
  }

  function openTagManage() {
    renderTagManageList();
    tagManageDialog && tagManageDialog.classList.add('show');
  }

  function closeTagManage() {
    tagManageDialog && tagManageDialog.classList.remove('show');
  }

  function renderTagManageList() {
    if (!tagListManage) return;
    tagListManage.innerHTML = tags.map(t => `
      <div class="phrase-item" style="display:flex;align-items:center;padding:10px;border:1px solid #eee;border-radius:8px;margin-bottom:8px;background:#fafafa;">
        <div style="flex:1;overflow:hidden;">
          <div style="font-weight:600;font-size:13px;color:#333;">${escapeHtml(t.name)}</div>
          <div style="font-size:11px;color:#888;margin-top:2px;">ID: ${escapeHtml(t.id)}</div>
        </div>
        <div style="display:flex;gap:6px;margin-left:10px;">
          <button type="button" class="tag-rename" data-id="${escapeHtml(t.id)}" style="background:#007bff;color:#fff;border:none;border-radius:6px;padding:6px 10px;cursor:pointer;font-size:11px;">重命名</button>
          <button type="button" class="tag-delete" data-id="${escapeHtml(t.id)}" style="background:#dc3545;color:#fff;border:none;border-radius:6px;padding:6px 10px;cursor:pointer;font-size:11px;">删除</button>
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

        // 删除标签，短语转移到默认
        tags = tags.filter(t => t.id !== id);
        for (const p of phrases) {
          if (p.tagId === id) p.tagId = DEFAULT_TAG_ID;
        }
        if (activeTagId === id) activeTagId = '__ALL__';
        await new Promise(resolve => storageAPI.set({ savedTags: tags, savedPhrases: phrases, activeTagId }, resolve));
        renderAll();
        renderTagManageList();
      });
    });
  }

  function renderCreators() {
    if (creatorPreview) {
      if (creators.length) {
        const blacklistCount = (window.creatorBlacklist || []).length;
        const blacklistText = blacklistCount > 0 ? `，已隐藏 ${blacklistCount} 个达人` : '';
        creatorPreview.textContent = `${creators.length} 个达人已导入${blacklistText}`;
        creatorPreview.style.cssText = `
          margin-top: 8px;
          font-size: 12px;
          color: #1d5fff;
          font-weight: 600;
          text-align: center;
          padding: 6px 10px;
          background: #f0f7ff;
          border-radius: 6px;
        `;
      } else {
        creatorPreview.textContent = '尚未导入达人，点击"导入 CSV"上传 creator_id/creator_cid/region_code';
        creatorPreview.style.cssText = `
          margin-top: 8px;
          font-size: 12px;
          color: #666;
          text-align: left;
        `;
      }
    }
    renderSearchResults();

    // 控制卡片显示/隐藏
    const query = creatorSearchInput ? creatorSearchInput.value.trim() : '';
    const creatorCard = document.getElementById('creatorCard');
    const phraseCard = document.getElementById('phraseCard');
    const orderCard = document.getElementById('orderCard');
    const dataCard = document.getElementById('dataCard');
    const creatorSearchList = document.getElementById('creatorSearchList');

    if (query) {
      // 有搜索内容时，只显示达人管理卡片，并扩大搜索结果区域
      if (creatorCard) creatorCard.style.display = 'block';
      if (phraseCard) phraseCard.style.display = 'none';
      if (orderCard) orderCard.style.display = 'none';
      if (dataCard) dataCard.style.display = 'none';
      // 扩大搜索结果高度以利用更多空间
      if (creatorSearchList) {
        creatorSearchList.style.maxHeight = '400px';
      }
    } else {
      // 无搜索内容时，显示所有卡片，恢复原始高度
      if (creatorCard) creatorCard.style.display = 'block';
      if (phraseCard) phraseCard.style.display = 'block';
      if (orderCard) orderCard.style.display = 'block';
      if (dataCard) dataCard.style.display = 'block';
      // 恢复原始高度
      if (creatorSearchList) {
        creatorSearchList.style.maxHeight = '120px';
      }
    }
  }

  function renderSearchResults() {
    if (!creatorSearchResults || !creatorSearchList) return;

    if (searchResults.length === 0) {
      creatorSearchResults.style.display = 'none';
      return;
    }

    creatorSearchResults.style.display = 'block';
    creatorSearchList.innerHTML = searchResults.map((creator, index) => `
      <div class="creator-item" style="display:flex;flex-direction:column;padding:8px;margin-bottom:6px;border-radius:6px;background:#fef2f2;border:1px solid #fecaca;">
        <div style="display:flex;align-items:center;margin-bottom:4px;">
          <div style="flex:1;overflow:hidden;">
            <div style="font-weight:600;font-size:12px;color:#333;">${escapeHtml(creator.id)}</div>
            <div style="font-size:11px;color:#666;margin-top:1px;">
              ${creator.cid ? `CID: ${escapeHtml(creator.cid)}` : '无CID'}
              ${creator.region ? ` • REG: ${escapeHtml(creator.region)}` : ''}
            </div>
          </div>
          <div style="display:flex;gap:3px;">
            <button type="button" class="jump-creator ${creator.cid && creator.region ? '' : 'disabled'}" data-index="${index}" style="background:${creator.cid && creator.region ? '#dc2626' : '#ccc'};color:#fff;border:none;border-radius:12px;padding:3px 8px;cursor:${creator.cid && creator.region ? 'pointer' : 'not-allowed'};font-size:10px;">跳转</button>
            <button type="button" class="edit-creator" data-index="${index}" style="background:#0369a1;color:#fff;border:none;border-radius:12px;padding:3px 8px;cursor:pointer;font-size:10px;">编辑</button>
          </div>
        </div>
        ${creator.remark ? `<div style="font-size:10px;color:#7f1d1d;background:#fee2e2;padding:3px 6px;border-radius:3px;border-left:2px solid #dc2626;">备注: ${escapeHtml(creator.remark)}</div>` : ''}
      </div>
    `).join('');

    creatorSearchList.querySelectorAll('button.edit-creator').forEach(btn => {
      btn.addEventListener('click', () => openEditCreator(parseInt(btn.dataset.index)));
    });

    creatorSearchList.querySelectorAll('button.jump-creator').forEach(btn => {
      btn.addEventListener('click', () => jumpToCreator(parseInt(btn.dataset.index)));
    });
  }

  function parseCsvLine(line) {
    // 简化 CSV：支持逗号/分号/tab 分隔，不支持引号转义（后续可迭代）
    return line.split(/[,;\t]/).map(x => (x || '').trim());
  }

  function normalizeHeaderKey(key) {
    return (key || '').trim().toLowerCase();
  }

  function parseCsvToCreators(text) {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (!lines.length) return [];

    const firstRow = parseCsvLine(lines[0]);
    const headerKeys = firstRow.map(normalizeHeaderKey);
    const hasHeader = headerKeys.includes('creator_id') || headerKeys.includes('creator_cid') || headerKeys.includes('id') || headerKeys.includes('cid') || headerKeys.includes('remark');

    let idIdx = 0;
    let cidIdx = 1;
    let regionIdx = 2;
    let remarkIdx = 3;
    let start = 0;
    if (hasHeader) {
      start = 1;
      const idxCreatorId = headerKeys.indexOf('creator_id');
      const idxId = headerKeys.indexOf('id');
      idIdx = idxCreatorId >= 0 ? idxCreatorId : (idxId >= 0 ? idxId : 0);

      const idxCreatorCid = headerKeys.indexOf('creator_cid');
      const idxCid = headerKeys.indexOf('cid');
      cidIdx = idxCreatorCid >= 0 ? idxCreatorCid : (idxCid >= 0 ? idxCid : 1);

      const idxRegion = headerKeys.indexOf('region_code');
      const idxRegion2 = headerKeys.indexOf('region');
      regionIdx = idxRegion >= 0 ? idxRegion : (idxRegion2 >= 0 ? idxRegion2 : 2);

      const idxRemark = headerKeys.indexOf('remark');
      remarkIdx = idxRemark >= 0 ? idxRemark : 3;
    }

    const out = [];
    for (let i = start; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i]);
      const id = (cols[idIdx] || '').trim();
      const cid = (cols[cidIdx] || '').trim();
      const region = (cols[regionIdx] || '').trim();
      const remark = (cols[remarkIdx] || '').trim();
      if (!id) continue;
      const item = cid ? { id, cid } : { id };
      if (region) item.region = region;
      if (remark) item.remark = remark;
      out.push(item);
    }
    return out;
  }

  function dedupeCreators(list) {
    const seen = new Set();
    const res = [];
    for (const c of list) {
      if (!c || !c.id) continue;
      const key = c.id;
      if (seen.has(key)) continue;
      seen.add(key);
      const cid = c.cid ? String(c.cid).trim() : '';
      const region = c.region ? String(c.region).trim() : '';
      const remark = c.remark ? String(c.remark).trim() : '';
      const item = { id: key };
      if (cid) item.cid = cid;
      if (region) item.region = region;
      if (remark) item.remark = remark;
      res.push(item);
    }
    return res;
  }

  async function importCreatorsFromCsv(file) {
    if (!file) return;
    const text = await file.text();
    const parsed = parseCsvToCreators(text);
    if (!parsed.length) {
      alert('未解析到有效的达人ID');
      return;
    }

    // 增量更新逻辑
    let addedCount = 0;
    let updatedCount = 0;
    const newCreators = dedupeCreators(parsed);

    for (const newCreator of newCreators) {
      const existingIndex = creators.findIndex(c => c.id === newCreator.id);
      if (existingIndex >= 0) {
        // 更新存在的达人信息 (如果 CSV 中有新字段则覆盖)
        if (newCreator.cid) creators[existingIndex].cid = newCreator.cid;
        if (newCreator.region) creators[existingIndex].region = newCreator.region;
        if (newCreator.remark) creators[existingIndex].remark = newCreator.remark;
        updatedCount++;
      } else {
        // 追加新达人
        creators.push(newCreator);
        addedCount++;
      }
    }

    await new Promise(resolve => storageAPI.set({ savedCreators: creators }, resolve));
    renderCreators();

    if (addedCount > 0 || updatedCount > 0) {
      showStatus(`✅ 成功导入: 新增 ${addedCount} 个，更新 ${updatedCount} 个`, 'success', 'creatorCardStatus');
    } else {
      showStatus(`✅ 无新数据导入，均已存在`, 'info', 'creatorCardStatus');
    }
  }

  async function importCreatorsFromXlsx(file) {
    if (!file) return;

    if (typeof ExcelJS === 'undefined') {
      alert('ExcelJS库未加载');
      return;
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(arrayBuffer);

      const sheet = workbook.getWorksheet(1);
      if (!sheet) {
        alert('未找到工作表');
        return;
      }

      const headers = [];
      const firstRow = sheet.getRow(1);
      firstRow.eachCell(cell => {
        headers.push(cell.value ? cell.value.toString().toLowerCase().trim() : '');
      });

      const idIdx = headers.findIndex(h => h === 'creator_id' || h === 'id');
      const cidIdx = headers.findIndex(h => h === 'creator_cid' || h === 'cid');
      const regionIdx = headers.findIndex(h => h === 'region_code' || h === 'region');
      const remarkIdx = headers.findIndex(h => h === 'remark');

      if (idIdx === -1) {
        alert('模板中未找到 creator_id 列');
        return;
      }

      const parsed = [];
      sheet.eachRow((row, rowNum) => {
        if (rowNum === 1) return;
        const cells = row.values;
        const id = cells[idIdx + 1] ? cells[idIdx + 1].toString().trim() : '';
        if (!id) return;

        parsed.push({
          id: id,
          cid: cidIdx >= 0 && cells[cidIdx + 1] ? cells[cidIdx + 1].toString().trim() : '',
          region: regionIdx >= 0 && cells[regionIdx + 1] ? cells[regionIdx + 1].toString().trim() : '',
          remark: remarkIdx >= 0 && cells[remarkIdx + 1] ? cells[remarkIdx + 1].toString().trim() : '',
        });
      });

      if (!parsed.length) {
        alert('未解析到有效的达人ID');
        return;
      }

      let addedCount = 0;
      let updatedCount = 0;
      const newCreators = dedupeCreators(parsed);

      for (const newCreator of newCreators) {
        const existingIndex = creators.findIndex(c => c.id === newCreator.id);
        if (existingIndex >= 0) {
          if (newCreator.cid) creators[existingIndex].cid = newCreator.cid;
          if (newCreator.region) creators[existingIndex].region = newCreator.region;
          if (newCreator.remark) creators[existingIndex].remark = newCreator.remark;
          updatedCount++;
        } else {
          creators.push(newCreator);
          addedCount++;
        }
      }

      await new Promise(resolve => storageAPI.set({ savedCreators: creators }, resolve));
      renderCreators();

      if (addedCount > 0 || updatedCount > 0) {
        showStatus(`✅ 成功导入: 新增 ${addedCount} 个，更新 ${updatedCount} 个`, 'success', 'creatorCardStatus');
      } else {
        showStatus(`✅ 无新数据导入，均已存在`, 'info', 'creatorCardStatus');
      }
    } catch (error) {
      console.error('导入Excel失败:', error);
      alert('导入失败: ' + error.message);
    }
  }

  function searchCreators(query) {
    if (!query.trim()) {
      searchResults = [];
      return;
    }

    const lowerQuery = query.toLowerCase().trim();
    searchResults = creators.filter(creator =>
      creator.id.toLowerCase().includes(lowerQuery) ||
      (creator.cid && creator.cid.toLowerCase().includes(lowerQuery)) ||
      (creator.region && creator.region.toLowerCase().includes(lowerQuery)) ||
      (creator.remark && creator.remark.toLowerCase().includes(lowerQuery))
    );
  }

  function openEditCreator(index) {
    if (index < 0 || index >= searchResults.length) return;
    const creator = searchResults[index];
    editingCreatorIndex = creators.findIndex(c => c.id === creator.id);

    if (editingCreatorIndex === -1) return;

    creatorEditId.value = creator.id;
    creatorEditCid.value = creator.cid || '';
    creatorEditRegion.value = creator.region || '';
    creatorEditRemark.value = creator.remark || '';
    creatorEditDialog && creatorEditDialog.classList.add('show');
  }

  function closeEditCreator() {
    creatorEditDialog && creatorEditDialog.classList.remove('show');
    editingCreatorIndex = -1;
  }

  async function saveCreatorEdit() {
    if (editingCreatorIndex === -1) return;

    const cid = creatorEditCid.value.trim();
    const region = creatorEditRegion.value.trim();
    const remark = creatorEditRemark.value.trim();

    creators[editingCreatorIndex] = {
      id: creators[editingCreatorIndex].id,
      cid: cid || undefined,
      region: region || undefined,
      remark: remark || undefined
    };

    await new Promise(resolve => storageAPI.set({ savedCreators: creators }, resolve));
    searchCreators(creatorSearchInput.value);
    renderCreators();
    showStatus('✅ 已更新达人信息', 'success', 'creatorCardStatus');
    closeEditCreator();
  }

  async function deleteCreator() {
    if (editingCreatorIndex === -1) return;

    if (!confirm(`确定删除达人"${creators[editingCreatorIndex].id}"吗？`)) return;

    creators.splice(editingCreatorIndex, 1);
    await new Promise(resolve => storageAPI.set({ savedCreators: creators }, resolve));
    searchCreators(creatorSearchInput.value);
    renderCreators();
    showStatus('✅ 已删除达人', 'success', 'creatorCardStatus');
    closeEditCreator();
  }

  // 备份相关功能
  function openBackupDialog() {
    backupDialog && backupDialog.classList.add('show');
  }

  function closeBackupDialog() {
    backupDialog && backupDialog.classList.remove('show');
  }

  async function exportData() {
    try {
      const data = {
        version: '1.0',
        exportTime: new Date().toISOString(),
        phrases: phrases,
        tags: tags,
        activeTagId: activeTagId,
        creators: creators,
        creatorBlacklist: window.creatorBlacklist || []
      };

      const jsonString = JSON.stringify(data, null, 2);
      // 添加UTF-8 BOM确保中文字符正确显示
      const BOM = '\uFEFF';
      const jsonWithBOM = BOM + jsonString;
      const blob = new Blob([jsonWithBOM], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `商务WLB插件数据备份_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setTimeout(() => URL.revokeObjectURL(url), 500);
      showStatus('✅ 数据已导出', 'success', 'dataCardStatus');
      closeBackupDialog();
    } catch (error) {
      console.error('导出数据失败:', error);
      showStatus('❌ 导出数据失败', 'error', 'dataCardStatus');
    }
  }

  async function importData() {
    const file = importDataFile.files[0];
    if (!file) {
      showStatus('⚠️ 请选择要导入的文件', 'error', 'dataCardStatus');
      return;
    }

    if (!confirm('导入数据将覆盖所有现有数据，确定要继续吗？')) {
      return;
    }

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      // 验证数据格式
      if (!data.version || !data.phrases || !data.tags || !data.creators) {
        throw new Error('数据格式不正确');
      }

      // 恢复数据
      phrases = data.phrases || [];
      tags = data.tags || [];
      activeTagId = data.activeTagId || '__ALL__';
      creators = data.creators || [];
      const creatorBlacklist = data.creatorBlacklist || [];
      searchResults = [];

      // 保存到存储
      await new Promise(resolve => storageAPI.set({
        savedPhrases: phrases,
        savedTags: tags,
        activeTagId: activeTagId,
        savedCreators: creators,
        creatorBlacklist: creatorBlacklist
      }, resolve));

      // 重新渲染
      renderAll();

      showStatus('✅ 数据已导入', 'success');
      closeBackupDialog();

      // 清空文件选择
      importDataFile.value = '';
    } catch (error) {
      console.error('导入数据失败:', error);
      showStatus('❌ 导入数据失败，请检查文件格式', 'error', 'dataCardStatus');
    }
  }

  // WebDAV 保存配置
  async function saveWebdavConfig() {
    const config = {
      url: webdavUrl.value.trim() || 'https://dav.jianguoyun.com/dav/',
      username: webdavUsername.value.trim(),
      password: webdavPassword.value.trim()
    };
    await new Promise(resolve => storageAPI.set({ webdavConfig: config }, resolve));
    return config;
  }

  // WebDAV 备份
  async function backupToWebdav() {
    const config = await saveWebdavConfig();

    if (!config.username || !config.password) {
      showStatus('⚠️ 请输入WebDAV账号和密码', 'error', 'webdavStatus');
      return;
    }

    try {
      backupToWebdavBtn.disabled = true;
      backupToWebdavBtn.textContent = '备份中...';

      const data = {
        version: '1.0',
        exportTime: new Date().toISOString(),
        phrases: phrases,
        tags: tags,
        activeTagId: activeTagId,
        creators: creators,
        creatorBlacklist: window.creatorBlacklist || []
      };

      const jsonString = JSON.stringify(data, null, 2);
      const BOM = '\uFEFF';
      const jsonWithBOM = BOM + jsonString;

      const baseUrl = config.url.endsWith('/') ? config.url : config.url + '/';
      const fileUrl = baseUrl + 'Bd_WLB_backup.json';

      const auth = btoa(`${config.username}:${config.password}`);

      const response = await fetch(fileUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json;charset=utf-8'
        },
        body: jsonWithBOM
      });

      if (response.ok || response.status === 201 || response.status === 204) {
        showStatus('✅ 成功备份到WebDAV', 'success', 'webdavStatus');
      } else {
        throw new Error(`HTTP Error: ${response.status}`);
      }
    } catch (error) {
      console.error('WebDAV备份失败:', error);
      showStatus('❌ 备份失败，请检查账号密码或网络', 'error', 'webdavStatus');
    } finally {
      backupToWebdavBtn.disabled = false;
      backupToWebdavBtn.textContent = '备份到WebDAV';
    }
  }

  // WebDAV 恢复
  async function restoreFromWebdav() {
    const config = await saveWebdavConfig();

    if (!config.username || !config.password) {
      showStatus('⚠️ 请输入WebDAV账号和密码', 'error', 'webdavStatus');
      return;
    }

    if (!confirm('从WebDAV恢复将覆盖所有现有数据，确定要继续吗？')) {
      return;
    }

    try {
      restoreFromWebdavBtn.disabled = true;
      restoreFromWebdavBtn.textContent = '恢复中...';

      const baseUrl = config.url.endsWith('/') ? config.url : config.url + '/';
      const fileUrl = baseUrl + 'Bd_WLB_backup.json';

      const auth = btoa(`${config.username}:${config.password}`);

      const response = await fetch(fileUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${auth}`
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('云端未找到备份文件(Bd_WLB_backup.json)');
        }
        throw new Error(`HTTP Error: ${response.status}`);
      }

      const text = await response.text();
      // Remove BOM if present
      const cleanText = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
      const data = JSON.parse(cleanText);

      if (!data.version || !data.phrases || !data.tags || !data.creators) {
        throw new Error('数据格式不正确');
      }

      phrases = data.phrases || [];
      tags = data.tags || [];
      activeTagId = data.activeTagId || '__ALL__';
      creators = data.creators || [];
      const creatorBlacklist = data.creatorBlacklist || [];
      searchResults = [];

      await new Promise(resolve => storageAPI.set({
        savedPhrases: phrases,
        savedTags: tags,
        activeTagId: activeTagId,
        savedCreators: creators,
        creatorBlacklist: creatorBlacklist
      }, resolve));

      renderAll();
      showStatus('✅ 成功从WebDAV恢复', 'success', 'webdavStatus');

      // 添加一个延迟关闭弹窗的体验优化
      setTimeout(() => {
        closeBackupDialog();
      }, 1500);

    } catch (error) {
      console.error('WebDAV恢复失败:', error);
      showStatus(`❌ 恢复失败: ${error.message || '请检查账号密码或网络'}`, 'error', 'webdavStatus');
    } finally {
      restoreFromWebdavBtn.disabled = false;
      restoreFromWebdavBtn.textContent = '从WebDAV恢复';
    }
  }

  function jumpToCreator(index) {
    if (index < 0 || index >= searchResults.length) return;

    const creator = searchResults[index];

    if (!creator.cid || !creator.region) {
      showStatus('⚠️ 缺少CID或地区代码，无法跳转', 'error', 'creatorCardStatus');
      return;
    }

    const url = `https://affiliate.tiktokshopglobalselling.com/connection/creator/detail?cid=${encodeURIComponent(creator.cid)}&shop_region=${encodeURIComponent(creator.region)}`;

    window.open(url, '_blank', 'noopener,noreferrer');
    showStatus('✅ 已打开达人详情页面', 'success');
  }

  function downloadTextFile(filename, text) {
    // 添加UTF-8 BOM确保中文字符正确显示
    const BOM = '\uFEFF';
    const textWithBOM = BOM + text;
    const blob = new Blob([textWithBOM], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  function openCreate() {
    editingId = null;
    phraseEditTitle && (phraseEditTitle.textContent = '添加短语');
    renderPhraseTagSelect(activeTagId !== '__ALL__' ? activeTagId : DEFAULT_TAG_ID);
    phraseTitle && (phraseTitle.value = '');
    phraseContent && (phraseContent.value = '');
    phraseEditDialog && phraseEditDialog.classList.add('show');
    phraseTitle && phraseTitle.focus();
  }

  // 新增
  addPhraseBtn && addPhraseBtn.addEventListener('click', () => {
    if (!tags.length) {
      openTagManage();
      alert('请先添加一个标签，然后再添加短语。');
      return;
    }
    openCreate();
  });

  function openEdit(id) {
    const phrase = phrases.find(p => p.id === id);
    if (!phrase) return;
    editingId = id;
    phraseEditTitle && (phraseEditTitle.textContent = '编辑短语');
    renderPhraseTagSelect(phrase.tagId || DEFAULT_TAG_ID);
    phraseTitle && (phraseTitle.value = phrase.title);
    phraseContent && (phraseContent.value = phrase.content);
    phraseEditDialog && phraseEditDialog.classList.add('show');
    phraseTitle && phraseTitle.focus();
  }

  async function deletePhrase(id) {
    const phrase = phrases.find(p => p.id === id);
    if (!phrase) return;
    if (!confirm(`确定删除短语"${phrase.title}"吗？`)) return;
    phrases = phrases.filter(p => p.id !== id);
    await savePhrases();
    renderPhraseList();
    showStatus('✅ 已删除', 'success', 'phraseCardStatus');
  }

  // 保存
  savePhraseBtn && savePhraseBtn.addEventListener('click', async () => {
    const tagId = (phraseTag && phraseTag.value) || '';
    const title = (phraseTitle && phraseTitle.value.trim()) || '';
    const content = (phraseContent && phraseContent.value.trim()) || '';

    if (!tagId || !tags.some(t => t.id === tagId)) {
      alert('请选择标签');
      phraseTag && phraseTag.focus();
      return;
    }
    if (!title) {
      alert('请输入短语标题');
      phraseTitle && phraseTitle.focus();
      return;
    }
    if (!content) {
      alert('请输入短语内容');
      phraseContent && phraseContent.focus();
      return;
    }

    if (editingId) {
      const idx = phrases.findIndex(p => p.id === editingId);
      if (idx >= 0) {
        phrases[idx] = { ...phrases[idx], tagId, title, content, updatedAt: Date.now() };
      }
    } else {
      phrases.push({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
        tagId,
        title,
        content,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
    }

    await savePhrases();
    phraseEditDialog && phraseEditDialog.classList.remove('show');
    renderAll();
    showStatus(editingId ? '✅ 已更新' : '✅ 已添加', 'success', 'phraseCardStatus');
    editingId = null;
  });

  cancelPhraseBtn && cancelPhraseBtn.addEventListener('click', () => {
    phraseEditDialog && phraseEditDialog.classList.remove('show');
    editingId = null;
  });

  phraseEditDialog && phraseEditDialog.addEventListener('click', (e) => {
    if (e.target === phraseEditDialog) {
      phraseEditDialog.classList.remove('show');
      editingId = null;
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (phraseEditDialog && phraseEditDialog.classList.contains('show')) {
        phraseEditDialog.classList.remove('show');
        editingId = null;
      } else if (tagManageDialog && tagManageDialog.classList.contains('show')) {
        closeTagManage();
      }
    }
  });

  // 标签管理事件
  closeTagManageBtn && closeTagManageBtn.addEventListener('click', closeTagManage);
  tagManageDialog && tagManageDialog.addEventListener('click', (e) => {
    if (e.target === tagManageDialog) closeTagManage();
  });
  addTagBtn && addTagBtn.addEventListener('click', async () => {
    const nameRaw = prompt('请输入标签名称：', '');
    const name = (nameRaw || '').trim();
    if (!name) return;
    const id = 't_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    tags.push({ id, name, createdAt: Date.now(), updatedAt: Date.now() });
    await saveTags();
    renderAll();
    renderTagManageList();
  });

  //LSX 导入 达人 X
  importCreatorBtn && importCreatorBtn.addEventListener('click', () => {
    creatorFileInput && creatorFileInput.click();
  });
  creatorFileInput && creatorFileInput.addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    await importCreatorsFromXlsx(file);
    e.target.value = '';
  });
  downloadCreatorTemplateBtn && downloadCreatorTemplateBtn.addEventListener('click', async () => {
    if (typeof ExcelJS === 'undefined') {
      alert('ExcelJS库未加载');
      return;
    }
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('达人模板');
    sheet.columns = [
      { header: 'creator_id', key: 'id', width: 20 },
      { header: 'creator_cid', key: 'cid', width: 20 },
      { header: 'region_code', key: 'region', width: 15 },
      { header: 'remark', key: 'remark', width: 25 },
    ];
    const headerRow = sheet.getRow(1);
    headerRow.eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A365D' } };
    });
    sheet.addRow({ id: 'example_creator_001', cid: 'example_cid_001', region: 'US', remark: '示例备注' });
    const buf = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'creator_template.xlsx';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showStatus('✅ 已下载模板', 'success');
  });

  // 达人搜索 - 实时动态匹配
  creatorSearchInput && creatorSearchInput.addEventListener('input', () => {
    const query = creatorSearchInput.value;
    searchCreators(query);
    renderCreators();

    // 控制卡片显示/隐藏
    const creatorCard = document.getElementById('creatorCard');
    const phraseCard = document.getElementById('phraseCard');
    const orderCard = document.getElementById('orderCard');
    const dataCard = document.getElementById('dataCard');
    const creatorSearchList = document.getElementById('creatorSearchList');

    if (query.trim()) {
      // 有搜索内容时，只显示达人管理卡片，并扩大搜索结果区域
      if (creatorCard) creatorCard.style.display = 'block';
      if (phraseCard) phraseCard.style.display = 'none';
      if (orderCard) orderCard.style.display = 'none';
      if (dataCard) dataCard.style.display = 'none';
      // 扩大搜索结果高度以利用更多空间
      if (creatorSearchList) {
        creatorSearchList.style.maxHeight = '400px';
      }
    } else {
      // 无搜索内容时，显示所有卡片，恢复原始高度
      if (creatorCard) creatorCard.style.display = 'block';
      if (phraseCard) phraseCard.style.display = 'block';
      if (orderCard) orderCard.style.display = 'block';
      if (dataCard) dataCard.style.display = 'block';
      // 恢复原始高度
      if (creatorSearchList) {
        creatorSearchList.style.maxHeight = '120px';
      }
    }
  });

  // 达人编辑
  saveCreatorEditBtn && saveCreatorEditBtn.addEventListener('click', saveCreatorEdit);
  cancelCreatorEditBtn && cancelCreatorEditBtn.addEventListener('click', closeEditCreator);
  deleteCreatorBtn && deleteCreatorBtn.addEventListener('click', deleteCreator);

  creatorEditDialog && creatorEditDialog.addEventListener('click', (e) => {
    if (e.target === creatorEditDialog) {
      closeEditCreator();
    }
  });

  // 备份功能
  backupBtn && backupBtn.addEventListener('click', openBackupDialog);
  closeBackupDialogBtn && closeBackupDialogBtn.addEventListener('click', closeBackupDialog);
  exportDataBtn && exportDataBtn.addEventListener('click', exportData);
  importDataBtn && importDataBtn.addEventListener('click', importData);

  backupDialog && backupDialog.addEventListener('click', (e) => {
    if (e.target === backupDialog) {
      closeBackupDialog();
    }
  });

  // WebDAV 事件
  backupToWebdavBtn && backupToWebdavBtn.addEventListener('click', backupToWebdav);
  restoreFromWebdavBtn && restoreFromWebdavBtn.addEventListener('click', restoreFromWebdav);

  clearAllDataBtn && clearAllDataBtn.addEventListener('click', async () => {
    const ok = confirm('确定清除全部数据吗？这将删除：短语、标签、当前标签选择、达人列表、隐藏达人信息等。该操作不可撤销。');
    if (!ok) return;
    await new Promise(resolve => storageAPI.remove(['savedPhrases', 'savedTags', 'activeTagId', 'savedCreators', 'creatorBlacklist'], resolve));

    // 重置内存态并重新初始化默认标签
    phrases = [];
    tags = [];
    activeTagId = '__ALL__';
    creators = [];
    window.creatorBlacklist = [];
    searchResults = [];
    await ensureTagsAndMigrate();
    renderAll();
    showStatus('✅ 已清除全部数据', 'success', 'dataCardStatus');
  });

  initAppBtn && initAppBtn.addEventListener('click', async () => {
    const ok = confirm('确定重置应用状态吗？这将清除：订单查询状态、CID查询状态、视频封面状态、通过CID查达人状态等。该操作不可撤销。');
    if (!ok) return;

    try {
      // 清除订单相关数据
      await new Promise(resolve => storageAPI.remove(['orderQueryOrders', 'orderQueryState', 'orderQueryProgress'], resolve));

      // 清除CID相关数据
      await new Promise(resolve => storageAPI.remove(['tiktokCidToNameResults'], resolve));

      // 清除视频封面相关数据
      await new Promise(resolve => storageAPI.remove(['coverResults'], resolve));

      // 清除订单查询状态
      await chrome.runtime.sendMessage({ action: 'clearOrderQueryState' });

      // 重置内存态
      cidToNameResults = [];
      orderQueryOrders = [];

      // 恢复输入界面
      switchToInputMode();

      // 清除进度显示
      const progressDiv = document.getElementById('orderProgressDisplay');
      if (progressDiv) {
        progressDiv.remove();
      }

      // 清除所有面板的进度显示
      const cidProgressDiv = document.getElementById('cidProgressDisplay');
      if (cidProgressDiv) {
        cidProgressDiv.remove();
      }

      const coverProgressDiv = document.getElementById('coverProgressDisplay');
      if (coverProgressDiv) {
        coverProgressDiv.remove();
      }

      const cidToNameProgressDiv = document.getElementById('cidToNameProgressDisplay');
      if (cidToNameProgressDiv) {
        cidToNameProgressDiv.remove();
      }

      showStatus('✅ 应用状态已重置，所有功能已恢复初始状态', 'success', 'dataCardStatus');

      // 1.5秒后恢复输入界面
      setTimeout(() => {
        switchToInputMode();
      }, 1500);

    } catch (error) {
      console.error('重置应用状态失败:', error);
      showStatus('❌ 重置失败: ' + error.message, 'error', 'dataCardStatus');
    }
  });

  openPhraseManageBtn && openPhraseManageBtn.addEventListener('click', () => {
    const url = chrome.runtime.getURL('phrase_manage.html');
    window.open(url, '_blank', 'noopener');
  });


  loadData();

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'blacklistUpdated') {
      const storageAPI = getStorage();
      if (storageAPI) {
        storageAPI.get(['creatorBlacklist'], result => {
          window.creatorBlacklist = Array.isArray(result.creatorBlacklist) ? result.creatorBlacklist : [];
          renderCreators();
        });
      }
    }
  });
});
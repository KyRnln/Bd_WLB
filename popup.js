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
      const result = await new Promise(resolve => storageAPI.get(['savedPhrases', 'savedTags', 'activeTagId', 'savedCreators', 'webdavConfig'], resolve));
      phrases = result.savedPhrases || [];
      tags = Array.isArray(result.savedTags) ? result.savedTags : [];
      activeTagId = typeof result.activeTagId === 'string' ? result.activeTagId : '__ALL__';
      creators = Array.isArray(result.savedCreators) ? result.savedCreators : [];

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
        creatorPreview.textContent = `${creators.length} 个达人已导入`;
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
        creators: creators
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
      searchResults = [];

      // 保存到存储
      await new Promise(resolve => storageAPI.set({
        savedPhrases: phrases,
        savedTags: tags,
        activeTagId: activeTagId,
        savedCreators: creators
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
        creators: creators
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
      searchResults = [];

      await new Promise(resolve => storageAPI.set({
        savedPhrases: phrases,
        savedTags: tags,
        activeTagId: activeTagId,
        savedCreators: creators
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
    const ok = confirm('确定清除全部数据吗？这将删除：短语、标签、当前标签选择、达人列表等。该操作不可撤销。');
    if (!ok) return;
    await new Promise(resolve => storageAPI.remove(['savedPhrases', 'savedTags', 'activeTagId', 'savedCreators'], resolve));

    // 重置内存态并重新初始化默认标签
    phrases = [];
    tags = [];
    activeTagId = '__ALL__';
    creators = [];
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

  // ===== 订单查询功能 =====

  // 检测浏览器类型
  function detectBrowser() {
    const userAgent = navigator.userAgent;
    if (userAgent.includes('Edg/')) {
      return 'edge';
    } else if (userAgent.includes('Chrome/')) {
      return 'chrome';
    } else {
      return 'other';
    }
  }

  // Edge专用下载方法
  async function downloadWithEdge(blob, filename, progressCallback) {
    console.log('使用Edge专用下载方法...');

    try {
      const url = URL.createObjectURL(blob);

      // 方法1: 直接在新标签页打开，让用户手动保存
      console.log('Edge: 在新标签页打开文件供手动保存');
      const newTab = window.open(url, '_blank');
      if (newTab) {
        console.log('Edge: 新标签页已打开');
        return; // 成功打开新标签页
      }

      // 方法2: 如果新标签页失败，尝试iframe方法
      console.log('Edge: 新标签页失败，尝试iframe方法');
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = url;

      document.body.appendChild(iframe);

      return new Promise((resolve, reject) => {
        iframe.onload = () => {
          try {
            console.log('Edge: iframe加载完成，尝试创建下载链接');

            // 创建一个临时的a标签来触发下载
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.style.display = 'none';

            // 尝试多种方式触发下载
            const triggerDownload = () => {
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
            };

            // 延迟执行，确保元素已添加到DOM
            setTimeout(triggerDownload, 100);

            console.log('Edge: 下载链接已创建并点击');
            resolve();
          } catch (error) {
            console.warn('Edge: iframe方法失败，但文件已在新标签页打开');
            resolve(); // 就算出错，文件也可能已经在新标签页打开了
          } finally {
            setTimeout(() => {
              if (document.body.contains(iframe)) {
                document.body.removeChild(iframe);
              }
              URL.revokeObjectURL(url);
            }, 1000);
          }
        };

        iframe.onerror = () => {
          console.warn('Edge: iframe加载失败');
          setTimeout(() => {
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }
            URL.revokeObjectURL(url);
            reject(new Error('Edge下载方法失败'));
          }, 1000);
        };

        // 设置超时
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
            URL.revokeObjectURL(url);
            reject(new Error('Edge下载超时'));
          }
        }, 15000);
      });

    } catch (error) {
      console.error('Edge专用下载方法失败:', error);
      throw error;
    }
  }

  // Excel下载功能
  async function downloadOrderCSV(orders, progressCallback) {
    console.log('开始生成Excel文件，数据条数:', orders.length);

    if (progressCallback) progressCallback(10, '正在准备数据...');

    if (progressCallback) progressCallback(30, '正在生成Excel内容...');

    if (typeof ExcelJS === 'undefined') {
      console.error('ExcelJS库未加载');
      return { success: false, error: 'ExcelJS库未加载' };
    }

    try {
      if (progressCallback) progressCallback(50, '正在创建工作簿...');

      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('订单数据');

      sheet.columns = [
        { header: '达人ID', key: 'creatorId', width: 15 },
        { header: '产品ID', key: 'productId', width: 15 },
        { header: '订单ID', key: 'orderId', width: 25 },
        { header: '状态', key: 'status', width: 12 },
        { header: '时间', key: 'timestamp', width: 20 },
      ];

      const headerRow = sheet.getRow(1);
      headerRow.height = 20;
      headerRow.eachCell(cell => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A365D' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      });

      for (let i = 0; i < orders.length; i++) {
        if (progressCallback) {
          const progress = Math.round(50 + (i / orders.length) * 40);
          progressCallback(progress, `正在处理第 ${i + 1}/${orders.length} 条数据...`);
        }

        const order = orders[i];
        sheet.addRow({
          creatorId: (order.creatorId || '').replace(/^@/, ''),
          productId: order.productId || '',
          orderId: order.orderId || '',
          status: order.status || '',
          timestamp: order.timestamp || '',
        });
      }

      sheet.columns.forEach(column => {
        column.width = Math.max(column.width, 10);
      });

      if (progressCallback) progressCallback(90, '正在准备下载文件...');

      const filename = `orders_${new Date().toISOString().split('T')[0]}.xlsx`;

      const buf = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);

      await new Promise(resolve => setTimeout(resolve, 100));
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      console.log('Excel下载成功');
      if (progressCallback) progressCallback(100, '下载完成！');
      return { success: true, method: 'xlsx' };

    } catch (error) {
      if (error.message === '用户停止了操作') {
        throw error;
      }
      console.error('Excel生成失败:', error);
      return { success: false, error: error.message };
    }
  }

  // 清空订单数据
  async function clearOrderData(tabId) {
    console.log('开始清空订单IndexedDB数据...');
    console.log('tabId:', tabId);

    try {
      let contentScriptReady = await checkContentScript(tabId);
      console.log('contentScriptReady:', contentScriptReady);
      if (!contentScriptReady) {
        const injected = await injectContentScript(tabId);
        console.log('injectContentScript结果:', injected);
        if (!injected) {
          console.warn('无法初始化扩展，跳过数据清理');
          return false;
        }
      }

      console.log('发送clearOrderData消息...');
      const response = await chrome.tabs.sendMessage(tabId, {
        action: 'clearOrderData'
      });
      console.log('clearOrderData响应:', response);

      if (response.success) {
        console.log('IndexedDB数据已清空');
        return true;
      } else {
        console.warn('清空数据响应失败:', response.error);
        return false;
      }
    } catch (error) {
      console.error('清空数据过程出错:', error);
      return false;
    }
  }

  // 检查content script是否已加载
  async function checkContentScript(tabId) {
    try {
      await chrome.tabs.sendMessage(tabId, { action: 'ping' });
      return true;
    } catch (error) {
      return false;
    }
  }

  // 手动注入content script
  async function injectContentScript(tabId) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['content.js']
      });
      await new Promise(resolve => setTimeout(resolve, 1000));
      return true;
    } catch (error) {
      console.error('注入content script失败:', error);
      return false;
    }
  }

  // 切换到进度显示模式
  function switchToProgressMode() {
    const inputGroup = orderIdInput.parentElement;

    // 隐藏textarea
    orderIdInput.style.display = 'none';

    // 创建进度显示div
    const progressDiv = document.createElement('div');
    progressDiv.id = 'orderProgressDisplay';
    progressDiv.style.cssText = `
      width: 100%;
      padding: 10px;
      border: 1px solid #ddd;
      border-radius: 8px;
      font-size: 13px;
      font-family: monospace;
      min-height: 120px;
      box-sizing: border-box;
      background-color: #f8f9fa;
      color: #333;
      white-space: pre-line;
    `;
    progressDiv.textContent = '正在准备查询...\n请稍候...';

    // 替换textarea
    inputGroup.replaceChild(progressDiv, orderIdInput);
  }

  // 恢复到输入模式
  function switchToInputMode() {
    console.log('switchToInputMode被调用');
    const inputGroup = document.querySelector('.input-group');
    const progressDiv = document.getElementById('orderProgressDisplay');

    console.log('元素检查 - inputGroup:', !!inputGroup, 'progressDiv:', !!progressDiv, 'orderIdInput:', !!orderIdInput);

    if (inputGroup && orderIdInput) {
      if (progressDiv) {
        console.log('找到进度显示div，开始替换...');
        try {
          inputGroup.replaceChild(orderIdInput, progressDiv);
          console.log('元素替换成功');
        } catch (error) {
          console.error('替换元素失败:', error);
          inputGroup.appendChild(orderIdInput);
        }
      } else {
        console.log('进度显示div不存在，确保输入框在DOM中');
        if (!inputGroup.contains(orderIdInput)) {
          inputGroup.appendChild(orderIdInput);
        }
      }
      orderIdInput.style.display = 'block';
      console.log('输入框已恢复显示');
    } else {
      console.error('无法恢复输入模式，缺少必需的元素');
    }
  }

  // 更新进度显示
  function updateProgressDisplay(message) {
    const progressDiv = document.getElementById('orderProgressDisplay');
    if (progressDiv) {
      progressDiv.textContent = message;
    }
    // 保存进度到storage，实现持久化
    if (storageAPI) {
      storageAPI.set({ 'orderQueryProgress': message });
    }
  }

  // 恢复进度显示
  function restoreProgressDisplay() {
    if (!storageAPI) return;
    storageAPI.get(['orderQueryProgress', 'orderQueryState'], (result) => {
      // 只有当查询真的在进行中时才显示进度模式
      const isQueryRunning = result.orderQueryState && result.orderQueryState.isRunning;

      if (result.orderQueryProgress && isQueryRunning) {
        console.log('检测到查询正在进行，恢复进度显示');
        // 检查是否已经在进度显示模式
        const progressDiv = document.getElementById('orderProgressDisplay');
        if (!progressDiv) {
          switchToProgressMode();
        }
        updateProgressDisplay(result.orderQueryProgress);
      } else {
        console.log('查询未在进行中，清除进度状态');
        // 查询未在进行中，清除进度并确保输入框可见
        clearProgressDisplay();
        switchToInputMode();
      }
    });
  }

  // 清除进度显示
  function clearProgressDisplay() {
    console.log('clearProgressDisplay被调用');
    if (storageAPI) {
      storageAPI.remove(['orderQueryProgress']);
    }
    const progressDiv = document.getElementById('orderProgressDisplay');
    if (progressDiv) {
      console.log('找到进度显示div，准备移除');
      const inputGroup = document.querySelector('.input-group');
      if (inputGroup && inputGroup.contains(progressDiv)) {
        progressDiv.remove();
        console.log('进度显示div已移除');
      }
    } else {
      console.log('没有找到进度显示div');
    }
  }

  // 开始订单查询
  // 订单查询停止标志
  let shouldStopOrderQuery = false;

  startOrderQueryBtn && startOrderQueryBtn.addEventListener('click', async function () {
    const inputText = orderIdInput.value.trim();
    if (!inputText) {
      showStatus('请输入订单号', 'error');
      return;
    }

    const orderIds = [...new Set(
      inputText.split('\n')
        .map(id => id.trim())
        .filter(id => id.length > 0)
    )];

    if (orderIds.length === 0) {
      showStatus('请输入有效的订单号', 'error');
      return;
    }

    const inputLines = inputText.split('\n').filter(line => line.trim().length > 0).length;
    console.log(`用户输入了 ${inputLines} 行，去重后得到 ${orderIds.length} 个订单ID`);
    console.log('去重前的订单ID:', inputLines);
    console.log('去重后的订单ID:', orderIds);

    // 重置停止标志
    shouldStopOrderQuery = false;
    startOrderQueryBtn.disabled = true;
    startOrderQueryBtn.textContent = '查询中...';
    // 显示停止按钮
    if (stopOrderQueryBtn) {
      stopOrderQueryBtn.style.display = 'flex';
    }

    // 切换到进度显示模式
    switchToProgressMode();
    updateProgressDisplay(`准备查询 ${orderIds.length} 个订单...\n请稍候...`);

    const ORDER_QUERY_URL = 'affiliate.tiktokshopglobalselling.com/product/sample-request';

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      // 检查当前页面是否为目标页面
      const currentUrl = tab.url || '';
      const isTargetPage = currentUrl.includes(ORDER_QUERY_URL);

      let contentScriptReady = await checkContentScript(tab.id);

      if (!contentScriptReady) {
        updateProgressDisplay('正在初始化扩展...\n请稍候...');
        contentScriptReady = await injectContentScript(tab.id);

        if (!contentScriptReady) {
          throw new Error('无法在当前页面加载扩展，请刷新页面后重试');
        }
      }

      // 如果不在目标页面，点击样品申请菜单
      if (!isTargetPage) {
        updateProgressDisplay('正在切换到样品申请页面...\n请稍候...');

        try {
          const clickResult = await chrome.tabs.sendMessage(tab.id, {
            action: 'clickSampleRequestMenu'
          });
          console.log('点击样品申请菜单结果:', clickResult);
        } catch (clickError) {
          console.warn('点击菜单失败，可能需要手动切换页面');
        }

        // 等待页面切换
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // 重新检查 content script（页面可能已切换）
      contentScriptReady = await checkContentScript(tab.id);
      if (!contentScriptReady) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        contentScriptReady = await checkContentScript(tab.id);
      }

      // 调用background.js的订单查询API
      const startResponse = await chrome.runtime.sendMessage({
        action: 'startOrderQuery',
        tabId: tab.id,
        orderIds: orderIds
      });

      if (!startResponse.success) {
        throw new Error(startResponse.error || '启动订单查询失败');
      }

      console.log('订单查询已启动，开始监听状态...');

      // 使用chrome.storage.onChanged监听器来实时更新前端状态
      // 不再使用pollOrderQueryStatus函数，避免popup失去焦点时卡住

    } catch (error) {
      updateProgressDisplay(`查询失败\n${error.message}`);
      showStatus('查询失败：' + error.message, 'error', 'orderPanelStatus');
    } finally {
      shouldStopOrderQuery = false;
      startOrderQueryBtn.disabled = false;
      startOrderQueryBtn.textContent = '开始查询并下载';
      // 隐藏停止按钮
      if (stopOrderQueryBtn) {
        stopOrderQueryBtn.style.display = 'none';
      }
      // 延迟恢复输入界面，给用户时间查看结果
      setTimeout(() => {
        switchToInputMode();
        // 恢复输入界面后清除进度
        clearProgressDisplay();
      }, 5000);
    }
  });

  // 轮询订单查询状态
  async function pollOrderQueryStatus(totalOrders, tabId) {
    let lastProcessedCount = 0;
    let lastMessage = '';
    let stoppedByUser = false;

    while (true) {
      await new Promise(resolve => setTimeout(resolve, 500));

      const statusResponse = await chrome.runtime.sendMessage({ action: 'getOrderQueryStatus' });
      if (!statusResponse.success || !statusResponse.state) {
        console.warn('获取订单查询状态失败:', statusResponse);
        continue;
      }

      const state = statusResponse.state;
      console.log('订单查询状态:', state);

      // 检查是否用户请求停止
      if (shouldStopOrderQuery) {
        if (!state.isRunning) {
          console.log('订单查询已停止');
          updateProgressDisplay(`查询已停止\n已处理 ${lastProcessedCount}/${totalOrders} 个订单`);
          showStatus(`查询已停止，已处理 ${lastProcessedCount}/${totalOrders} 个订单`, 'info', 'orderPanelStatus');
          stoppedByUser = true;
          break;
        } else {
          console.log('等待查询停止...');
          continue;
        }
      }

      // 更新进度显示
      if (state.currentOrderId !== lastMessage) {
        lastMessage = state.currentOrderId;
        const progressPercent = Math.round((state.currentIndex / totalOrders) * 100);
        updateProgressDisplay(`查询进度: ${progressPercent}% (${state.currentIndex}/${totalOrders})\n当前处理: ${state.currentOrderId}\n${state.message || '请稍候...'}`);
        showStatus(`查询进度: ${progressPercent}% - 处理: ${state.currentOrderId}`, 'info', 'orderPanelStatus');
      }

      // 检查是否完成
      if (!state.isRunning) {
        console.log('订单查询完成');

        if (state.allOrders && state.allOrders.length > 0) {
          updateProgressDisplay('正在生成并下载Excel文件...\n请稍候...');

          let downloadResult;
          try {
            downloadResult = await chrome.runtime.sendMessage({ action: 'exportOrderData' });
          } catch (exportError) {
            console.error('导出失败:', exportError);
            downloadResult = { success: false, error: exportError.message || '导出失败' };
          }

          if (downloadResult.success) {
            console.log('XLSX下载成功:', downloadResult);
            console.log('开始清理数据...');

            if (shouldStopOrderQuery) {
              console.log('用户在数据清理前停止了查询');
              updateProgressDisplay('已跳过数据清理');
              showStatus('查询已停止，已跳过数据清理', 'info', 'orderPanelStatus');
            } else {
              updateProgressDisplay('XLSX文件已下载，正在清理数据...\n请稍候...');

              try {
                console.log('调用clearOrderData...');
                await clearOrderData(tabId);
                console.log('clearOrderData完成');
                updateProgressDisplay('操作完成！\n✅ 已导出XLSX\n✅ 已清理数据');
                showStatus('操作完成！已导出XLSX并清理数据', 'success', 'orderPanelStatus');
              } catch (clearError) {
                console.error('数据清理失败:', clearError);
                updateProgressDisplay('XLSX已下载，但数据清理失败\n请手动清理临时数据');
                showStatus('XLSX已下载，但数据清理失败，请手动清理', 'info', 'orderPanelStatus');
              }
            }
          } else {
            console.error('XLSX下载失败:', downloadResult.error);
            showStatus('查询成功但导出失败，请检查浏览器下载权限', 'error');
          }
        } else {
          let resultMessage = `查询完成，但未获取到有效数据`;
          if (state.failedOrders && state.failedOrders.length > 0) {
            resultMessage += `\n失败详情: ${state.failedOrders.join('; ')}`;
          }
          updateProgressDisplay(`查询完成\n${resultMessage}`);
          showStatus(resultMessage, 'error', 'orderPanelStatus');
        }

        // 清理状态
        console.log('调用clearOrderQueryState...');
        await chrome.runtime.sendMessage({ action: 'clearOrderQueryState' });
        console.log('clearOrderQueryState完成');
        break;
      }

      lastProcessedCount = state.processedCount;
    }

    // 恢复输入界面
    console.log('恢复输入界面...');
    switchToInputMode();
    clearProgressDisplay();
    console.log('输入界面已恢复');
  }

  // 停止查询按钮事件
  stopOrderQueryBtn && stopOrderQueryBtn.addEventListener('click', async function () {
    shouldStopOrderQuery = true;
    if (stopOrderQueryBtn) {
      stopOrderQueryBtn.disabled = true;
      stopOrderQueryBtn.textContent = '正在停止...';
    }
    updateProgressDisplay('正在停止查询...\n请稍候...');
    showStatus('正在停止查询...', 'info', 'orderPanelStatus');

    // 调用background.js停止订单查询
    await chrome.runtime.sendMessage({ action: 'stopOrderQuery' });
  });

  // 监听storage变化，实时更新前端状态
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.orderQueryState) {
      const newState = changes.orderQueryState.newValue;
      if (newState && newState.isRunning) {
        // 更新进度显示
        updateProgressDisplay(`查询进度: ${newState.progress}% (${newState.currentIndex}/${newState.total || 0})\n当前处理: ${newState.currentOrderId}\n${newState.message || '请稍候...'}`);
        showStatus(`查询进度: ${newState.progress}% - 处理: ${newState.currentOrderId}`, 'info', 'orderPanelStatus');
      } else if (newState && !newState.isRunning) {
        // 查询完成或停止
        console.log('订单查询状态变化:', newState);

        // 保存tabId用于后续操作
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          const savedTabId = tabs[0] ? tabs[0].id : null;

          // 如果有数据，自动下载Excel，否则直接恢复界面
          if (newState.allOrders && newState.allOrders.length > 0) {
            console.log('检测到订单查询完成，开始下载Excel...');
            downloadAndCleanup(newState.allOrders, savedTabId, newState.failedOrders);
          } else {
            console.log('没有订单数据，直接恢复输入界面');
            downloadAndCleanup([], savedTabId, newState.failedOrders);
          }
        });
      }
    }
  });

  // 下载并清理订单数据
  async function downloadAndCleanup(orders, tabId, failedOrders) {
    console.log('开始执行downloadAndCleanup，订单数量:', orders.length);

    if (orders.length > 0) {
      updateProgressDisplay('正在生成并下载Excel文件...\n请稍候...');

      let downloadResult;
      try {
        downloadResult = await chrome.runtime.sendMessage({ action: 'exportOrderData' });
      } catch (exportError) {
        console.error('导出失败:', exportError);
        downloadResult = { success: false, error: exportError.message || '导出失败' };
      }

      if (downloadResult.success) {
        console.log('XLSX下载成功:', downloadResult);

        updateProgressDisplay('XLSX文件已下载，正在清理数据...\n请稍候...');

        const cleared = await clearOrderData(tabId);

        if (cleared) {
          updateProgressDisplay('操作完成！\n✅ 已导出XLSX\n✅ 已清理数据');
          showStatus('操作完成！已导出XLSX并清理数据', 'success', 'orderPanelStatus');
        } else {
          updateProgressDisplay('XLSX已下载，但数据清理失败\n请手动清理临时数据');
          showStatus('XLSX已下载，但数据清理失败，请手动清理', 'info', 'orderPanelStatus');
        }
      } else {
        console.error('XLSX下载失败:', downloadResult.error);
        showStatus('查询成功但导出失败，请检查浏览器下载权限', 'error');
      }
    } else {
      let resultMessage = `查询完成，但未获取到有效数据`;
      if (failedOrders && failedOrders.length > 0) {
        resultMessage += `\n失败详情: ${failedOrders.join('; ')}`;
      }
      updateProgressDisplay(`查询完成\n${resultMessage}`);
      showStatus(resultMessage, 'error', 'orderPanelStatus');
    }

    // 清理状态
    await chrome.runtime.sendMessage({ action: 'clearOrderQueryState' });

    // 3秒后恢复输入界面
    console.log('3秒后恢复输入界面...');
    setTimeout(() => {
      console.log('执行恢复输入界面');
      switchToInputMode();
      clearProgressDisplay();
      console.log('输入界面已恢复');
    }, 3000);
  }

  // ===== 批量获取CID功能 =====

  // 恢复订单查询的进度显示
  restoreProgressDisplay();

  loadData();
});

// ===== 批量获取CID卡片交互 =====
(function () {
  document.addEventListener('DOMContentLoaded', () => {
    const cidCreatorInput = document.getElementById('cidCreatorInput');
    const cidSearchBtn = document.getElementById('cidSearchBtn');
    const cidStopBtn = document.getElementById('cidStopBtn');
    const cidExportBtn = document.getElementById('cidExportBtn');
    const cidClearBtn = document.getElementById('cidClearBtn');
    const cidResultsDiv = document.getElementById('cidResults');
    const cidProgressBar = document.getElementById('cidProgressBar');
    const cidProgressFill = document.getElementById('cidProgressFill');

    if (!cidSearchBtn) return; // 元素不存在则退出

    function updateCidStatus(message, type = 'info') {
      const cidStatusDiv = document.getElementById('cidPanelStatus');
      if (!cidStatusDiv) {
        console.error('找不到CID状态提示元素');
        return;
      }
      cidStatusDiv.textContent = message;
      const colors = {
        info: { bg: '#eef4ff', color: '#2b4acb' },
        success: { bg: '#e7f8ec', color: '#117a42' },
        error: { bg: '#fdecea', color: '#c0392b' },
      };
      const c = colors[type] || colors.info;
      cidStatusDiv.style.background = c.bg;
      cidStatusDiv.style.color = c.color;
      cidStatusDiv.style.display = 'block';
    }

    function displayCidResults(results) {
      if (!cidResultsDiv || !results || results.length === 0) {
        if (cidResultsDiv) cidResultsDiv.style.display = 'none';
        return;
      }
      cidResultsDiv.innerHTML = results.map(r => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 10px;border-bottom:1px solid #eef0ff;font-size:11px;font-family:monospace;">
          <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#333;">${r.id || ''}</span>
          <span style="flex:1;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:${r.cid ? '#1d5fff' : '#e53e3e'};">${r.cid || (r.error || '获取失败')}</span>
        </div>
      `).join('');
      cidResultsDiv.style.display = 'block';
    }

    // 状态轮询
    let pollInterval = null;

    function startPolling() {
      if (pollInterval) return;
      pollInterval = setInterval(async () => {
        try {
          const resp = await chrome.runtime.sendMessage({ action: 'getBatchSearchStatus' });
          if (resp.success && resp.status) updateBatchUI(resp.status);
        } catch (e) { }
      }, 500);
    }

    function stopPolling() {
      if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
    }

    function updateBatchUI(status) {
      if (!status) return;
      const { status: s, currentIndex, total, successCount, failCount, currentCreatorId, results } = status;

      if (s === 'running') {
        const pct = total > 0 ? Math.round((currentIndex / total) * 100) : 0;
        if (cidProgressFill) cidProgressFill.style.width = `${pct}%`;
        if (cidProgressBar) cidProgressBar.style.display = 'block';
        updateCidStatus(`正在处理 ${currentIndex}/${total}：${currentCreatorId || ''}  ✅${successCount} ❌${failCount}`, 'info');
        if (cidSearchBtn) { cidSearchBtn.style.display = 'none'; }
        if (cidStopBtn) { cidStopBtn.style.display = ''; cidStopBtn.disabled = false; cidStopBtn.textContent = '停止搜索'; }
      } else if (s === 'completed') {
        if (cidProgressFill) cidProgressFill.style.width = '100%';
        updateCidStatus(`完成！共 ${total} 个 · 成功 ${successCount} · 失败 ${failCount}`, successCount > 0 ? 'success' : 'error');
        if (cidSearchBtn) { cidSearchBtn.style.display = ''; cidSearchBtn.disabled = false; cidSearchBtn.textContent = '开始获取'; }
        if (cidStopBtn) { cidStopBtn.style.display = 'none'; }
        stopPolling();
        if (Array.isArray(results)) displayCidResults(results);
        setTimeout(() => { if (cidProgressBar) cidProgressBar.style.display = 'none'; }, 3000);
      } else if (s === 'error') {
        updateCidStatus(`出错: ${status.error || '未知错误'}`, 'error');
        if (cidSearchBtn) { cidSearchBtn.style.display = ''; cidSearchBtn.disabled = false; cidSearchBtn.textContent = '开始获取'; }
        if (cidStopBtn) { cidStopBtn.style.display = 'none'; }
        if (cidProgressBar) cidProgressBar.style.display = 'none';
        stopPolling();
      }
    }

    // 批量获取CID
    cidSearchBtn.addEventListener('click', async () => {
      const inputText = (cidCreatorInput.value || '').trim();
      if (!inputText) { updateCidStatus('请输入达人ID（每行一个）', 'error'); return; }

      const creatorIds = inputText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      if (creatorIds.length === 0) { updateCidStatus('请输入至少一个达人ID', 'error'); return; }

      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.url || !tab.url.includes('affiliate.tiktokshopglobalselling.com')) {
          updateCidStatus('⚠️ 请先打开 TikTok Shop 达人管理页面，再使用此功能', 'error');
          return;
        }

        await chrome.runtime.sendMessage({ action: 'clearBatchSearchStatus' });

        const resp = await chrome.runtime.sendMessage({
          action: 'startBatchSearch',
          creatorIds,
          tabId: tab.id
        });

        if (resp.success) {
          startPolling();
          updateCidStatus('批量搜索已启动，关闭弹窗后仍会继续执行...', 'info');
          if (cidProgressBar) { cidProgressBar.style.display = 'block'; }
          if (cidProgressFill) cidProgressFill.style.width = '0%';
        } else {
          updateCidStatus(resp.error || '启动失败', 'error');
        }
      } catch (err) {
        updateCidStatus('启动失败，请检查页面是否正确加载', 'error');
      }
    });

    if (cidStopBtn) {
      cidStopBtn.addEventListener('click', async () => {
        cidStopBtn.disabled = true;
        cidStopBtn.textContent = '正在停止...';
        await chrome.runtime.sendMessage({ action: 'stopBatchSearch' });
      });
    }

    // 导出Excel
    cidExportBtn.addEventListener('click', async () => {
      try {
        updateCidStatus('正在导出...', 'info');
        const resp = await chrome.runtime.sendMessage({ action: 'exportExcel' });
        if (resp.success) {
          updateCidStatus('✅ XLSX导出成功', 'success');
        } else {
          updateCidStatus(resp.error || '❌ 导出失败', 'error');
        }
      } catch (e) {
        updateCidStatus('❌ 导出失败', 'error');
      }
    });

    // 清除数据
    cidClearBtn.addEventListener('click', async () => {
      if (!confirm('确定清除所有已获取的CID数据吗？此操作不可恢复！')) return;
      try {
        updateCidStatus('正在清除...', 'info');
        const resp = await chrome.runtime.sendMessage({ action: 'clearData' });
        if (resp.success) {
          updateCidStatus('✅ 数据已清除', 'success');
          if (cidResultsDiv) { cidResultsDiv.innerHTML = ''; cidResultsDiv.style.display = 'none'; }
        } else {
          updateCidStatus(resp.error || '❌ 清除失败', 'error');
        }
      } catch (e) {
        updateCidStatus('❌ 清除失败', 'error');
      }
    });

    // 初始化：加载已有结果 + 检查是否有进行中的搜索
    (async () => {
      try {
        const [storedResp, statusResp] = await Promise.all([
          chrome.runtime.sendMessage({ action: 'getStoredResults' }),
          chrome.runtime.sendMessage({ action: 'getBatchSearchStatus' })
        ]);
        if (storedResp.success && storedResp.results && storedResp.results.length > 0) {
          displayCidResults(storedResp.results);
        }
        if (statusResp.success && statusResp.status && statusResp.status.status === 'running') {
          startPolling();
          updateBatchUI(statusResp.status);
        }
      } catch (e) { }
    })();

    // popup关闭时停止轮询
    // popup关闭时停止轮询
    window.addEventListener('beforeunload', stopPolling);
  });

  // ============================================================
  // 获取 TikTok 视频封面功能区
  // ============================================================
  document.addEventListener('DOMContentLoaded', () => {
    const coverUrlInput = document.getElementById('coverUrlInput');
    const coverFetchBtn = document.getElementById('coverFetchBtn');
    const coverClearBtn = document.getElementById('coverClearBtn');
    const coverExportBtn = document.getElementById('coverExportBtn');
    const coverProgressBar = document.getElementById('coverProgressBar');
    const coverProgressFill = document.getElementById('coverProgressFill');
    const coverProgressText = document.getElementById('coverProgressText');
    const coverStatsRow = document.getElementById('coverStatsRow');
    const coverStatTotal = document.getElementById('coverStatTotal');
    const coverStatSuccess = document.getElementById('coverStatSuccess');
    const coverStatError = document.getElementById('coverStatError');
    const coverResults = document.getElementById('coverResults');

    let coverDataList = [];
    const CONCURRENT_REQUESTS = 3;

    function isValidTikTokUrl(url) {
      try {
        const u = new URL(url);
        return u.hostname.includes('tiktok.com');
      } catch {
        return false;
      }
    }

    function parseCoverUrls(text) {
      return text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    }

    async function fetchTikTokCover(videoUrl) {
      if (!isValidTikTokUrl(videoUrl)) {
        return { url: videoUrl, thumbnailUrl: '', title: '', status: 'error', error: '无效格式' };
      }
      const apiUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(videoUrl)}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      try {
        const response = await fetch(apiUrl, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        return {
          url: videoUrl,
          thumbnailUrl: data.thumbnail_url || '',
          title: data.title || '(无标题)',
          author: data.author_name || '',
          status: 'success'
        };
      } catch (err) {
        clearTimeout(timeoutId);
        const message = err.name === 'AbortError' ? '超时' : err.message;
        return { url: videoUrl, thumbnailUrl: '', title: '', status: 'error', error: message };
      }
    }

    function updateCoverProgress(current, total) {
      const pct = total === 0 ? 0 : Math.round((current / total) * 100);
      if (coverProgressFill) coverProgressFill.style.width = `${pct}%`;
      if (coverProgressText) coverProgressText.textContent = `${current}/${total}`;
    }

    function renderCoverCard(item, index) {
      if (!coverResults) return;
      const card = document.createElement('div');
      const isError = item.status === 'error';
      const bgColor = isError ? '#fdecea' : '#fff';
      const borderColor = isError ? '#f5c6cb' : '#e0e6ff';

      card.style.cssText = `display:flex; padding:8px; border:1px solid ${borderColor}; border-radius:6px; background:${bgColor}; gap:10px;`;

      const thumbHtml = (item.status === 'success' && item.thumbnailUrl)
        ? `<img src="${item.thumbnailUrl}" style="width:40px;height:71px;object-fit:cover;border-radius:4px;cursor:pointer;" onclick="window.open('${item.thumbnailUrl}', '_blank')" title="点击查看大图" />`
        : `<div style="width:40px;height:71px;background:#f0f0f0;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:16px;">${isError ? '⚠️' : '🖼️'}</div>`;

      const btnStyle = "background:#f0f4ff; color:#0369a1; border:1px solid #bae6fd; padding:3px 8px; border-radius:12px; font-size:10px; cursor:pointer;";
      const actionsHtml = item.status === 'success'
        ? `<div style="display:flex;gap:4px;margin-top:4px;">
             <button class="copy-cv" data-txt="${item.thumbnailUrl}" style="${btnStyle}">复制封面链</button>
             <button class="copy-cv" data-txt="${item.url}" style="${btnStyle}">复制视频链</button>
           </div>`
        : '';

      const titleColor = isError ? '#c0392b' : '#333';
      const titleText = isError ? `错误: ${item.error}` : item.title;

      card.innerHTML = `
        <div style="flex:none">${thumbHtml}</div>
        <div style="flex:1; overflow:hidden; display:flex; flex-direction:column; justify-content:center;">
          <div style="font-size:10px;color:#888;margin-bottom:2px;">#${index + 1}</div>
          <div style="font-size:12px;font-weight:600;color:${titleColor};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${item.title}">${titleText}</div>
          <div style="font-size:10px;color:#666;font-family:monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${item.url}</div>
          ${actionsHtml}
        </div>
      `;

      card.querySelectorAll('.copy-cv').forEach(btn => {
        btn.addEventListener('click', async () => {
          try {
            await navigator.clipboard.writeText(btn.dataset.txt);
            const oldTxt = btn.textContent;
            btn.textContent = '已复制';
            btn.style.background = '#dcfce7';
            btn.style.color = '#15803d';
            setTimeout(() => { btn.textContent = oldTxt; btn.style.background = '#f0f4ff'; btn.style.color = '#0369a1'; }, 1500);
          } catch (e) { }
        });
      });

      coverResults.appendChild(card);
    }

    function updateCoverStats() {
      if (!coverStatsRow) return;
      const total = coverDataList.length;
      const successCount = coverDataList.filter(r => r.status === 'success').length;
      const errorCount = total - successCount;
      if (coverStatTotal) coverStatTotal.textContent = `总计: ${total}`;
      if (coverStatSuccess) coverStatSuccess.textContent = `成功: ${successCount}`;
      if (coverStatError) coverStatError.textContent = `失败: ${errorCount}`;
      if (coverExportBtn) {
        coverExportBtn.style.display = successCount > 0 ? 'inline-block' : 'none';
      }
    }

    async function startFetchCover() {
      if (!coverUrlInput) return;
      const rawText = coverUrlInput.value.trim();
      if (!rawText) return;

      const urls = parseCoverUrls(rawText);
      if (!urls.length) return;

      coverDataList = [];
      if (coverResults) coverResults.innerHTML = '';
      if (coverFetchBtn) {
        coverFetchBtn.disabled = true;
        coverFetchBtn.textContent = '正在获取...';
        coverFetchBtn.style.opacity = '0.7';
      }
      if (coverProgressBar) coverProgressBar.style.display = 'flex';
      if (coverStatsRow) coverStatsRow.style.display = 'flex';
      if (coverExportBtn) coverExportBtn.style.display = 'none';
      updateCoverProgress(0, urls.length);

      let completed = 0;
      for (let i = 0; i < urls.length; i += CONCURRENT_REQUESTS) {
        const batch = urls.slice(i, i + CONCURRENT_REQUESTS);
        const batchResults = await Promise.all(batch.map(url => fetchTikTokCover(url)));

        batchResults.forEach((res, j) => {
          coverDataList.push(res);
          completed++;
          updateCoverProgress(completed, urls.length);
          renderCoverCard(res, coverDataList.length - 1);
          updateCoverStats();
        });
      }

      if (coverFetchBtn) {
        coverFetchBtn.disabled = false;
        coverFetchBtn.textContent = '再次获取';
        coverFetchBtn.style.opacity = '1';
      }
    }

    // ==== ExcelJS ====
    async function fetchImageAsBuffer(url) {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return resp.arrayBuffer();
    }

    function guessImageExtension(url) {
      const lower = url.toLowerCase().split('?')[0];
      if (lower.endsWith('.png')) return 'png';
      if (lower.endsWith('.gif')) return 'gif';
      return 'jpeg';
    }

    async function exportCoverExcel() {
      if (!coverDataList.length || typeof ExcelJS === 'undefined') {
        if (typeof ExcelJS === 'undefined') alert('ExcelJS 加载失败');
        return;
      }
      const successOnly = coverDataList.filter(r => r.status === 'success');
      if (!successOnly.length) return;

      const btnOldTxt = coverExportBtn.textContent;
      coverExportBtn.disabled = true;
      coverExportBtn.textContent = '正在打包导出...';

      try {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('TikTok封面');

        sheet.columns = [
          { header: '序号', key: 'idx', width: 6 },
          { header: '封面', key: 'cover', width: 20 },
          { header: '视频标题', key: 'title', width: 35 },
          { header: '作者', key: 'author', width: 15 },
          { header: '视频链接', key: 'url', width: 50 },
        ];

        const headerRow = sheet.getRow(1);
        headerRow.height = 20;
        headerRow.eachCell(cell => {
          cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A365D' } };
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        });

        // TikTok thumbnails are typically 720×1280, but we should respect the actual
        // dimensions of the fetched image so the exported worksheets don’t squish them.
        // We'll compute display width based on the cover column width and then scale the
        // height according to the original aspect ratio.  Row height in points is pixels *
        // 0.75 (1pt = 1.333px).
        const colCover = sheet.getColumn('cover');
        // record baseline column width in case we resize it later; this width will be
        // used to compute the display pixel width for every image, ensuring the
        // calculation is stable across rows.
        const BASE_COVER_WIDTH_UNITS = colCover && colCover.width ? colCover.width : 20;
        colCover.width = BASE_COVER_WIDTH_UNITS;
        const DISPLAY_W_PX_BASE = BASE_COVER_WIDTH_UNITS * 7; // px approximation
        // row height (pt) will be calculated later per‑row once we know the image aspect ratio
        let ROW_HEIGHT_PT = null;

        for (let i = 0; i < successOnly.length; i++) {
          const item = successOnly[i];
          const rowNum = i + 2;
          const row = sheet.getRow(rowNum);
          // row height will be updated once we know the actual image ratio

          row.getCell('idx').value = i + 1;
          row.getCell('title').value = item.title;
          row.getCell('author').value = item.author || '';
          row.getCell('url').value = { text: item.url, hyperlink: item.url };

          ['idx', 'title', 'author', 'url'].forEach(key => {
            row.getCell(key).alignment = {
              vertical: 'middle',
              horizontal: key === 'idx' ? 'center' : 'left',
              wrapText: true
            };
          });

          if (item.thumbnailUrl) {
            try {
              const buf = await fetchImageAsBuffer(item.thumbnailUrl);
              const ext = guessImageExtension(item.thumbnailUrl);

              // create an Image object to read natural dimensions
              const blob = new Blob([buf]);
              const img = new Image();
              const imgLoaded = new Promise((resolve, reject) => {
                img.onload = () => resolve();
                img.onerror = () => reject(new Error('图片加载失败'));
              });
              img.src = URL.createObjectURL(blob);
              await imgLoaded;
              const origW = img.naturalWidth || DISPLAY_W_PX;
              const origH = img.naturalHeight || DISPLAY_W_PX;
              URL.revokeObjectURL(img.src);

              const ratio = origH / origW;
              // compute display width based on the fixed base column size rather than
              // the mutable current width; this prevents compounding shrinkage when we
              // adjust the column later.
              const displayW = Math.round(DISPLAY_W_PX_BASE * 0.5);
              const displayH = Math.round(displayW * ratio);
              ROW_HEIGHT_PT = displayH * 0.75;
              row.height = ROW_HEIGHT_PT;

              // adjust column to at least fit this image; do not shrink it once enlarged
              const newColWidth = Math.ceil(displayW / 7);
              if (newColWidth > colCover.width) {
                colCover.width = newColWidth;
              }

              const imageId = workbook.addImage({ buffer: buf, extension: ext });
              sheet.addImage(imageId, {
                tl: { col: 1, row: rowNum - 1 },
                ext: { width: displayW, height: displayH },
                editAs: 'oneCell'
              });
            } catch (e) {
              // fallback row height if we failed to load or calculate image size (scaled down by half)
              const DISPLAY_W_PX_CURRENT = (colCover.width || 20) * 7;
              row.height = (DISPLAY_W_PX_CURRENT * 0.5) * 0.75;
              row.getCell('cover').value = '加载失败';
              row.getCell('cover').alignment = { vertical: 'middle', horizontal: 'center' };
            }
          }
          row.commit();
        }

        const buf = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tiktok_covers_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);

      } catch (err) {
        console.error(err);
        alert('导出失败: ' + err.message);
      } finally {
        coverExportBtn.disabled = false;
        coverExportBtn.textContent = btnOldTxt;
      }
    }

    if (coverFetchBtn) coverFetchBtn.addEventListener('click', startFetchCover);
    if (coverExportBtn) coverExportBtn.addEventListener('click', exportCoverExcel);
    if (coverClearBtn) coverClearBtn.addEventListener('click', () => {
      if (coverUrlInput) coverUrlInput.value = '';
      coverDataList = [];
      if (coverResults) coverResults.innerHTML = '';
      if (coverProgressBar) coverProgressBar.style.display = 'none';
      if (coverStatsRow) coverStatsRow.style.display = 'none';
      if (coverExportBtn) coverExportBtn.style.display = 'none';
      if (coverFetchBtn) {
        coverFetchBtn.textContent = '获取封面';
        coverFetchBtn.style.opacity = '1';
        coverUrlInput.focus();
      }
    });

    if (coverUrlInput) {
      coverUrlInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          startFetchCover();
        }
      });
    }
  });
})();

// ============================================================
// 通过CID查达人 功能区 (移植自 CID_NAME)
// ============================================================
(function () {
  let db;
  let dbInitPromise = null;
  const DB_NAME = 'TikTokCreatorDB';
  const STORE_NAME = 'creators';
  const DB_VERSION = 1;
  let results = [];
  let batchQueryInProgress = false;
  let statusPollInterval = null;

  function initIndexedDB() {
    if (dbInitPromise) return dbInitPromise;
    dbInitPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => { dbInitPromise = null; reject(request.error); };
      request.onsuccess = () => { db = request.result; dbInitPromise = null; resolve(db); };
      request.onupgradeneeded = (event) => {
        db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
          objectStore.createIndex('cid', 'cid', { unique: false });
          objectStore.createIndex('region', 'region', { unique: false });
          objectStore.createIndex('username', 'username', { unique: false });
          objectStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
    return dbInitPromise;
  }

  async function getExistingData(cid) {
    if (!db) await initIndexedDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const objectStore = transaction.objectStore(STORE_NAME);
      const index = objectStore.index('cid');
      const request = index.get(cid);
      request.onsuccess = (event) => resolve(event.target.result || null);
      request.onerror = (event) => reject(event.target.error);
    });
  }

  async function addResult(cid, region, username, avatarUrl) {
    if (!db) await initIndexedDB();
    const existingData = await getExistingData(cid);
    if (existingData) return;

    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const objectStore = transaction.objectStore(STORE_NAME);
    const data = {
      id: Date.now(),
      cid: cid,
      region: region,
      username: username,
      avatarUrl: avatarUrl || '',
      timestamp: new Date().toISOString()
    };

    return new Promise((resolve, reject) => {
      const request = objectStore.add(data);
      request.onsuccess = () => {
        results.push(data);
        updateResultsDisplay();
        saveResults();
        resolve();
      };
      request.onerror = (event) => {
        reject(event.target.error);
      };
    });
  }

  async function loadResults() {
    try {
      if (!db) await initIndexedDB();
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const objectStore = transaction.objectStore(STORE_NAME);
      const request = objectStore.getAll();
      const allData = await new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      results = allData;
      updateResultsDisplay();
    } catch (error) {
      console.error('加载结果失败:', error);
    }
  }

  function saveResults() {
    chrome.storage.local.set({ 'tiktokCidToNameResults': results });
  }

  function updateResultsDisplay() {
    const resultsDiv = document.getElementById('cidToNameResults');
    if (!resultsDiv) return;
    resultsDiv.innerHTML = '';

    if (results.length === 0) {
      resultsDiv.innerHTML = '<div style="padding:10px;text-align:center;color:#999;font-size:12px;">暂无数据</div>';
      return;
    }

    results.slice().reverse().forEach(result => {
      const resultDiv = document.createElement('div');
      resultDiv.style.cssText = 'display:flex;align-items:center;padding:8px;border:1px solid #e0e6ff;border-radius:6px;background:#f9f9f9;';
      const avatarHtml = result.avatarUrl
        ? `<img src="${result.avatarUrl}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;margin-right:10px;">`
        : '<div style="width:40px;height:40px;border-radius:50%;background:#eee;margin-right:10px;display:flex;align-items:center;justify-content:center;font-size:12px;color:#999;">无图</div>';
      resultDiv.innerHTML = `
        ${avatarHtml}
        <div style="flex:1;overflow:hidden;font-size:12px;color:#333;">
          <div><strong style="color:#1a365d;">CID:</strong> ${result.cid} | <strong style="color:#1a365d;">地区:</strong> ${result.region}</div>
          <div style="margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"><strong style="color:#1a365d;">用户名:</strong> ${result.username}</div>
          <div style="color:#999;font-size:10px;margin-top:2px;">${new Date(result.timestamp).toLocaleString()}</div>
        </div>
      `;
      resultsDiv.appendChild(resultDiv);
    });
  }

  async function clearAllIndexedDBData() {
    if (!db) return;
    try {
      await new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const objectStore = transaction.objectStore(STORE_NAME);
        const request = objectStore.clear();
        request.onsuccess = () => {
          results = [];
          updateResultsDisplay();
          saveResults();
          resolve();
        };
        request.onerror = (e) => reject(e.target.error);
      });
      showStatus('✅ 所有数据已清空', 'success');
    } catch (e) {
      showStatus('❌ 清空数据失败', 'error');
    }
  }

  function showStatus(message, type = 'info') {
    const statusDiv = document.getElementById('cidToNamePanelStatus');
    if (!statusDiv) return;
    statusDiv.textContent = message;
    statusDiv.className = 'status ' + type;
    statusDiv.style.display = 'block';
    if (type !== 'info') {
      setTimeout(() => statusDiv.style.display = 'none', 3000);
    }
  }

  async function exportToExcel(data) {
    if (data.length === 0) return;
    if (typeof ExcelJS === 'undefined') {
      alert('ExcelJS 库未加载，无法导出');
      return;
    }

    const btnOldTxt = document.getElementById('cidToNameExportBtn').textContent;
    const btn = document.getElementById('cidToNameExportBtn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = '正在打包导出...';
    }

    try {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('达人数据');

      sheet.columns = [
        { header: '序号', key: 'idx', width: 8 },
        { header: '头像', key: 'avatar', width: 14 },
        { header: 'CID', key: 'cid', width: 25 },
        { header: '地区', key: 'region', width: 10 },
        { header: '用户名', key: 'username', width: 25 },
        { header: '查询时间', key: 'timestamp', width: 20 },
      ];

      const headerRow = sheet.getRow(1);
      headerRow.height = 20;
      headerRow.eachCell(cell => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4CAF50' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      });

      const IMG_H_PX = 80;
      const ROW_HEIGHT_PT = IMG_H_PX * 0.75; // pt = px * 0.75

      for (let i = 0; i < data.length; i++) {
        const rowData = data[i];
        const rowNum = i + 2;
        const row = sheet.getRow(rowNum);
        row.height = ROW_HEIGHT_PT;

        row.getCell('idx').value = i + 1;
        row.getCell('cid').value = rowData.cid;
        row.getCell('region').value = rowData.region;
        row.getCell('username').value = rowData.username;
        row.getCell('timestamp').value = new Date(rowData.timestamp).toLocaleString();

        ['idx', 'cid', 'region', 'username', 'timestamp'].forEach(key => {
          row.getCell(key).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        });

        if (rowData.avatarUrl) {
          try {
            const resp = await fetch(rowData.avatarUrl);
            if (resp.ok) {
              const buf = await resp.arrayBuffer();
              // guess ext
              let ext = 'jpeg';
              if (rowData.avatarUrl.toLowerCase().includes('.png')) ext = 'png';
              else if (rowData.avatarUrl.toLowerCase().includes('.gif')) ext = 'gif';

              const imageId = workbook.addImage({ buffer: buf, extension: ext });
              sheet.addImage(imageId, {
                tl: { col: 1, row: rowNum - 1 },
                br: { col: 2, row: rowNum },
                editAs: 'oneCell' // 尺寸与单元格保持一致，防止溢出
              });
            } else {
              row.getCell('avatar').value = '加载失败';
              row.getCell('avatar').alignment = { vertical: 'middle', horizontal: 'center' };
            }
          } catch (e) {
            row.getCell('avatar').value = '加载失败';
            row.getCell('avatar').alignment = { vertical: 'middle', horizontal: 'center' };
          }
        }
        row.commit();
      }

      const buf = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tiktok_cid2name_${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('导出失败', err);
      alert('导出失败: ' + err.message);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = btnOldTxt;
      }
    }
  }



  function updateBatchQueryUI(status) {
    if (status.isRunning) {
      showStatus(`批量查询进行中: 正在处理 ${status.currentIndex}/${status.total} - CID: ${status.currentCid} (成功: ${status.successCount}, 失败: ${status.failCount})`, 'info');
    } else if (status.error) {
      showStatus(`❌ 批量查询出错: ${status.error}`, 'error');
    }
  }

  function startStatusPolling() {
    if (statusPollInterval) clearInterval(statusPollInterval);
    statusPollInterval = setInterval(async () => {
      try {
        const response = await chrome.runtime.sendMessage({ action: 'getBatchQueryStatus_cidToName' });
        if (response.success && response.status) {
          updateBatchQueryUI(response.status);
          if (!response.status.isRunning) {
            clearInterval(statusPollInterval);
            statusPollInterval = null;
            batchQueryInProgress = false;

            if (Array.isArray(response.status.results)) {
              const uniqueResults = new Map();
              for (const result of response.status.results) {
                if (result.username && result.username !== '查询失败') {
                  uniqueResults.set(result.cid, {
                    cid: result.cid,
                    region: result.region,
                    username: result.username,
                    avatarUrl: result.avatarUrl || ''
                  });
                }
              }
              for (const [cid, result] of uniqueResults) {
                await addResult(result.cid, result.region, result.username, result.avatarUrl);
              }
            }
            await chrome.runtime.sendMessage({ action: 'clearBatchQueryStatus_cidToName' });
            showStatus(`✅ 批量查询完成！成功 ${response.status.successCount} 个，失败 ${response.status.failCount} 个`, 'success');
            document.getElementById('cidToNameSearchBtn').disabled = false;
            document.getElementById('cidToNameSearchBtn').textContent = '批量查询';
          }
        }
      } catch (error) {
        console.error('轮询状态失败:', error);
      }
    }, 1000);
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const searchBtn = document.getElementById('cidToNameSearchBtn');
    const exportBtn = document.getElementById('cidToNameExportBtn');
    const clearBtn = document.getElementById('cidToNameClearBtn');
    const inputArea = document.getElementById('cidToNameInput');
    const regionSelect = document.getElementById('cidToNameRegion');

    loadResults();

    chrome.storage.local.get(['savedCidToNameInput', 'savedCidToNameRegion'], (res) => {
      if (res.savedCidToNameInput) inputArea.value = res.savedCidToNameInput;
      if (res.savedCidToNameRegion) regionSelect.value = res.savedCidToNameRegion;
    });

    inputArea.addEventListener('input', () => chrome.storage.local.set({ savedCidToNameInput: inputArea.value }));
    regionSelect.addEventListener('change', () => chrome.storage.local.set({ savedCidToNameRegion: regionSelect.value }));

    if (exportBtn) exportBtn.addEventListener('click', () => {
      if (results.length === 0) showStatus('❌ 没有可导出的数据', 'error');
      else exportToExcel(results);
    });

    if (clearBtn) clearBtn.addEventListener('click', async () => {
      if (confirm('确定要清空所有通过CID查达人的数据吗？此操作不可撤销。')) {
        await clearAllIndexedDBData();
      }
    });

    if (searchBtn) searchBtn.addEventListener('click', async () => {
      if (batchQueryInProgress) {
        alert('批量查询正在进行中，请等待完成。');
        return;
      }

      const region = regionSelect.value;
      const cids = inputArea.value.split('\n').map(cid => cid.trim()).filter(cid => cid.length > 0);

      if (cids.length === 0) {
        showStatus('⚠️ 请输入要批量查询的CID', 'error');
        return;
      }

      batchQueryInProgress = true;
      searchBtn.disabled = true;
      searchBtn.textContent = '查询中...';

      try {
        // 批量查询在后台自行打开新标签页执行，不依赖当前活动标签。去掉之前的
        // content script 检查，避免在无可用 tab 或权限不足时出错。
        const response = await chrome.runtime.sendMessage({
          action: 'startBatchQuery_cidToName',
          cids: cids,
          region: region
        });

        if (response.success) {
          startStatusPolling();
        } else {
          showStatus('❌ 批量查询启动失败: ' + response.error, 'error');
          batchQueryInProgress = false;
          searchBtn.disabled = false;
          searchBtn.textContent = '批量查询';
        }
      } catch (error) {
        console.error('batch query start error', error);
        showStatus('❌ 批量查询发生错误', 'error');
        batchQueryInProgress = false;
        searchBtn.disabled = false;
        searchBtn.textContent = '批量查询';
      }
    });
  });

  window.addEventListener('focus', async () => {
    try {
      if (!db) await initIndexedDB();
      await loadResults();
    } catch (e) { }
  });

})();
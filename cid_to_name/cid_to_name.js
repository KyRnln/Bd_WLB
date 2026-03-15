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
      resultsDiv.innerHTML = '<div class="empty-state">暂无数据</div>';
      return;
    }

    results.slice().reverse().forEach(result => {
      const resultDiv = document.createElement('div');
      resultDiv.className = 'result-item';
      const avatarHtml = result.avatarUrl
        ? `<img src="${result.avatarUrl}" class="result-avatar">`
        : '<div class="result-avatar-placeholder">无图</div>';
      resultDiv.innerHTML = `
        ${avatarHtml}
        <div class="result-content">
          <div class="result-line">
            <span class="result-label">CID:</span> ${result.cid} | 
            <span class="result-label">地区:</span> ${result.region}
          </div>
          <div class="result-line" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
            <span class="result-label">用户名:</span> ${result.username}
          </div>
          <div class="result-time">${new Date(result.timestamp).toLocaleString()}</div>
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
    if (type !== 'info') {
      setTimeout(() => statusDiv.className = 'status', 3000);
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
      const ROW_HEIGHT_PT = IMG_H_PX * 0.75;

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
              let ext = 'jpeg';
              if (rowData.avatarUrl.toLowerCase().includes('.png')) ext = 'png';
              else if (rowData.avatarUrl.toLowerCase().includes('.gif')) ext = 'gif';

              const imageId = workbook.addImage({ buffer: buf, extension: ext });
              sheet.addImage(imageId, {
                tl: { col: 1, row: rowNum - 1 },
                br: { col: 2, row: rowNum },
                editAs: 'oneCell'
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
      showStatus('✅ XLSX导出成功', 'success');
    } catch (err) {
      console.error('导出失败', err);
      alert('导出失败: ' + err.message);
      showStatus('❌ 导出失败', 'error');
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
        if (response && response.success && response.status) {
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
            const searchBtn = document.getElementById('cidToNameSearchBtn');
            const stopBtn = document.getElementById('cidToNameStopBtn');
            searchBtn.disabled = false;
            searchBtn.textContent = '批量查询';
            searchBtn.style.display = 'inline-block';
            stopBtn.style.display = 'none';
          }
        }
      } catch (error) {
        console.error('轮询状态失败:', error);
      }
    }, 1000);
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const searchBtn = document.getElementById('cidToNameSearchBtn');
    const stopBtn = document.getElementById('cidToNameStopBtn');
    const exportBtn = document.getElementById('cidToNameExportBtn');
    const clearBtn = document.getElementById('cidToNameClearBtn');
    const inputArea = document.getElementById('cidToNameInput');
    const regionSelect = document.getElementById('cidToNameRegion');
    const backBtn = document.getElementById('backBtn');

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

    async function stopBatchQuery() {
      try {
        await chrome.runtime.sendMessage({ action: 'stopBatchQuery_cidToName' });
        showStatus('正在停止...', 'info');
        stopBtn.disabled = true;
        stopBtn.textContent = '停止中...';
      } catch (e) {
        console.error('停止失败:', e);
      }
    }

    if (stopBtn) stopBtn.addEventListener('click', stopBatchQuery);

    function resetQueryUI() {
      searchBtn.disabled = false;
      searchBtn.textContent = '批量查询';
      searchBtn.style.display = 'inline-block';
      stopBtn.style.display = 'none';
      stopBtn.disabled = false;
      stopBtn.textContent = '停止';
    }

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
      searchBtn.style.display = 'none';
      stopBtn.style.display = 'inline-block';

      try {
        const response = await chrome.runtime.sendMessage({
          action: 'startBatchQuery_cidToName',
          cids: cids,
          region: region
        });

        if (response && response.success) {
          startStatusPolling();
        } else {
          showStatus('❌ 批量查询启动失败: ' + (response?.error || '未知错误'), 'error');
          batchQueryInProgress = false;
          resetQueryUI();
        }
      } catch (error) {
        console.error('batch query start error', error);
        showStatus('❌ 批量查询发生错误', 'error');
        batchQueryInProgress = false;
        resetQueryUI();
      }
    });

    window.addEventListener('focus', async () => {
      try {
        if (!db) await initIndexedDB();
        await loadResults();
      } catch (e) { }
    });

    // 初始化：检查是否有正在运行的任务或已完成的结果
    async function checkRunningTask() {
      try {
        const response = await chrome.runtime.sendMessage({ action: 'getBatchQueryStatus_cidToName' });
        if (response && response.success && response.status) {
          const status = response.status;
          if (status.isRunning) {
            batchQueryInProgress = true;
            searchBtn.style.display = 'none';
            stopBtn.style.display = 'inline-block';
            startStatusPolling();
          } else if (Array.isArray(status.results) && status.results.length > 0) {
            // 任务已完成但有未处理的结果
            const uniqueResults = new Map();
            for (const result of status.results) {
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
            showStatus(`✅ 已恢复 ${uniqueResults.size} 条查询结果`, 'success');
            await chrome.runtime.sendMessage({ action: 'clearBatchQueryStatus_cidToName' });
          }
        }
      } catch (e) {
        console.error('检查任务状态失败:', e);
      }
    }

    checkRunningTask();

    backBtn.addEventListener('click', () => {
      window.location.href = '../popup.html';
    });
  });
})();

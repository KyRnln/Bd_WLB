document.addEventListener('DOMContentLoaded', () => {
  const cidCreatorInput = document.getElementById('cidCreatorInput');
  const cidSearchBtn = document.getElementById('cidSearchBtn');
  const cidStopBtn = document.getElementById('cidStopBtn');
  const cidExportBtn = document.getElementById('cidExportBtn');
  const cidClearBtn = document.getElementById('cidClearBtn');
  const cidResultsDiv = document.getElementById('cidResults');
  const cidProgressBar = document.getElementById('cidProgressBar');
  const cidProgressFill = document.getElementById('cidProgressFill');
  const backBtn = document.getElementById('backBtn');

  function showStatus(message, type = 'info') {
    const statusDiv = document.getElementById('cidPanelStatus');
    statusDiv.textContent = message;
    statusDiv.className = 'status ' + type;
    setTimeout(() => {
      statusDiv.className = 'status';
    }, 3000);
  }

  function displayCidResults(results) {
    if (!results || results.length === 0) {
      cidResultsDiv.classList.remove('show');
      return;
    }
    cidResultsDiv.innerHTML = results.map(r => `
      <div class="result-row">
        <span class="result-id">${r.id || ''}</span>
        <span class="result-cid ${r.cid ? 'success' : 'error'}">${r.cid || (r.error || '获取失败')}</span>
      </div>
    `).join('');
    cidResultsDiv.classList.add('show');
  }

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
      cidProgressFill.style.width = `${pct}%`;
      cidProgressBar.classList.add('show');
      showStatus(`正在处理 ${currentIndex}/${total}：${currentCreatorId || ''}  ✅${successCount} ❌${failCount}`, 'info');
      cidSearchBtn.style.display = 'none';
      cidStopBtn.style.display = 'block';
      cidStopBtn.disabled = false;
      cidStopBtn.textContent = '停止搜索';
    } else if (s === 'completed') {
      cidProgressFill.style.width = '100%';
      showStatus(`完成！共 ${total} 个 · 成功 ${successCount} · 失败 ${failCount}`, successCount > 0 ? 'success' : 'error');
      cidSearchBtn.style.display = 'block';
      cidSearchBtn.disabled = false;
      cidSearchBtn.textContent = '开始获取';
      cidStopBtn.style.display = 'none';
      stopPolling();
      if (Array.isArray(results)) displayCidResults(results);
      setTimeout(() => { cidProgressBar.classList.remove('show'); }, 3000);
    } else if (s === 'error') {
      showStatus(`出错: ${status.error || '未知错误'}`, 'error');
      cidSearchBtn.style.display = 'block';
      cidSearchBtn.disabled = false;
      cidSearchBtn.textContent = '开始获取';
      cidStopBtn.style.display = 'none';
      cidProgressBar.classList.remove('show');
      stopPolling();
    }
  }

  async function exportCreatorExcel() {
    try {
      showStatus('正在获取数据...', 'info');

      const resp = await chrome.runtime.sendMessage({ action: 'getStoredResults' });
      if (!resp.success || !resp.results || resp.results.length === 0) {
        showStatus('❌ 没有可导出的数据', 'error');
        return;
      }

      if (typeof ExcelJS === 'undefined') {
        showStatus('❌ ExcelJS 加载失败', 'error');
        return;
      }

      const creators = resp.results;
      showStatus('正在打包导出...', 'info');

      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('达人信息');

      sheet.columns = [
        { header: '序号', key: 'idx', width: 6 },
        { header: '头像', key: 'avatar', width: 15 },
        { header: '达人 ID', key: 'id', width: 20 },
        { header: 'CID', key: 'cid', width: 20 },
        { header: '获取时间', key: 'time', width: 25 },
      ];

      const headerRow = sheet.getRow(1);
      headerRow.height = 20;
      headerRow.eachCell(cell => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A365D' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      });

      const colAvatar = sheet.getColumn('avatar');
      const BASE_AVATAR_WIDTH_UNITS = colAvatar && colAvatar.width ? colAvatar.width : 15;
      colAvatar.width = BASE_AVATAR_WIDTH_UNITS;
      const DISPLAY_W_PX_BASE = BASE_AVATAR_WIDTH_UNITS * 7;

      for (let i = 0; i < creators.length; i++) {
        const creator = creators[i];
        const rowNum = i + 2;
        const row = sheet.getRow(rowNum);

        row.getCell('idx').value = i + 1;
        row.getCell('id').value = creator.id || '';
        row.getCell('cid').value = creator.cid || '';
        row.getCell('time').value = creator.timestamp ? new Date(creator.timestamp).toLocaleString('zh-CN') : '';

        ['idx', 'id', 'cid', 'time'].forEach(key => {
          row.getCell(key).alignment = {
            vertical: 'middle',
            horizontal: key === 'idx' ? 'center' : 'left',
            wrapText: true
          };
        });

        if (creator.avatarBase64) {
          try {
            const b64str = creator.avatarBase64.replace(/^data:[^;]+;base64,/, '');
            const bin = atob(b64str);
            const bytes = new Uint8Array(bin.length);
            for (let j = 0; j < bin.length; j++) bytes[j] = bin.charCodeAt(j);
            const buf = bytes.buffer;

            const blob = new Blob([buf]);
            const img = new Image();
            const imgLoaded = new Promise((resolve, reject) => {
              img.onload = () => resolve();
              img.onerror = () => reject(new Error('图片加载失败'));
            });
            img.src = URL.createObjectURL(blob);
            await imgLoaded;
            const origW = img.naturalWidth || DISPLAY_W_PX_BASE;
            const origH = img.naturalHeight || DISPLAY_W_PX_BASE;
            URL.revokeObjectURL(img.src);

            const ratio = origH / origW;
            const displayW = Math.round(DISPLAY_W_PX_BASE * 0.5);
            const displayH = Math.round(displayW * ratio);
            row.height = displayH * 0.75;

            const newColWidth = Math.ceil(displayW / 7);
            if (newColWidth > colAvatar.width) {
              colAvatar.width = newColWidth;
            }

            const ext = creator.avatarBase64.includes('image/png') ? 'png' : 'jpeg';
            const imageId = workbook.addImage({ buffer: buf, extension: ext });
            sheet.addImage(imageId, {
              tl: { col: 1, row: rowNum - 1 },
              ext: { width: displayW, height: displayH },
              editAs: 'oneCell'
            });
          } catch (e) {
            console.error('添加头像失败:', e);
            row.height = DISPLAY_W_PX_BASE * 0.5 * 0.75;
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
      a.download = `tiktok_creators_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);

      showStatus('✅ XLSX导出成功', 'success');
    } catch (e) {
      console.error('导出失败:', e);
      showStatus('❌ 导出失败: ' + e.message, 'error');
    }
  }

  cidSearchBtn.addEventListener('click', async () => {
    const inputText = (cidCreatorInput.value || '').trim();
    if (!inputText) { showStatus('请输入达人ID（每行一个）', 'error'); return; }

    const creatorIds = inputText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (creatorIds.length === 0) { showStatus('请输入至少一个达人ID', 'error'); return; }

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.url || !tab.url.includes('affiliate.tiktokshopglobalselling.com')) {
        showStatus('⚠️ 请先打开 TikTok Shop 达人管理页面，再使用此功能', 'error');
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
        showStatus('批量搜索已启动，关闭弹窗后仍会继续执行...', 'info');
        cidProgressBar.classList.add('show');
        cidProgressFill.style.width = '0%';
      } else {
        showStatus(resp.error || '启动失败', 'error');
      }
    } catch (err) {
      showStatus('启动失败，请检查页面是否正确加载', 'error');
    }
  });

  cidStopBtn.addEventListener('click', async () => {
    cidStopBtn.disabled = true;
    cidStopBtn.textContent = '正在停止...';
    await chrome.runtime.sendMessage({ action: 'stopBatchSearch' });
  });

  cidExportBtn.addEventListener('click', exportCreatorExcel);

  cidClearBtn.addEventListener('click', async () => {
    if (!confirm('确定清除所有已获取的CID数据吗？此操作不可恢复！')) return;
    try {
      showStatus('正在清除...', 'info');
      const resp = await chrome.runtime.sendMessage({ action: 'clearData' });
      if (resp.success) {
        showStatus('✅ 数据已清除', 'success');
        cidResultsDiv.innerHTML = '';
        cidResultsDiv.classList.remove('show');
      } else {
        showStatus(resp.error || '❌ 清除失败', 'error');
      }
    } catch (e) {
      showStatus('❌ 清除失败', 'error');
    }
  });

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

  window.addEventListener('beforeunload', stopPolling);

  backBtn.addEventListener('click', () => {
    window.location.href = '../popup.html';
  });
});

document.addEventListener('DOMContentLoaded', () => {
  const coverUrlInput = document.getElementById('coverUrlInput');
  const coverFetchBtn = document.getElementById('coverFetchBtn');
  const coverClearBtn = document.getElementById('coverClearBtn');
  const coverStopBtn = document.getElementById('coverStopBtn');
  const coverExportBtn = document.getElementById('coverExportBtn');
  const coverProgressBar = document.getElementById('coverProgressBar');
  const coverProgressFill = document.getElementById('coverProgressFill');
  const coverProgressText = document.getElementById('coverProgressText');
  const coverStatsRow = document.getElementById('coverStatsRow');
  const coverStatTotal = document.getElementById('coverStatTotal');
  const coverStatSuccess = document.getElementById('coverStatSuccess');
  const coverStatError = document.getElementById('coverStatError');
  const coverResults = document.getElementById('coverResults');
  const backBtn = document.getElementById('backBtn');
  const coverDescription = document.getElementById('coverDescription');

  let coverDataList = [];
  let statusPollInterval = null;

  function showStatus(message, type = 'info') {
    const statusDiv = document.getElementById('coverPanelStatus');
    statusDiv.textContent = message;
    statusDiv.className = 'status ' + type;
    setTimeout(() => {
      statusDiv.className = 'status';
    }, 3000);
  }

  function parseCoverUrls(text) {
    return text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  }

  function updateCoverProgress(current, total) {
    const pct = total === 0 ? 0 : Math.round((current / total) * 100);
    coverProgressFill.style.width = `${pct}%`;
    coverProgressText.textContent = `${current}/${total}`;
  }

  function renderCoverCard(item, index) {
    const card = document.createElement('div');
    card.className = `result-card ${item.status === 'error' ? 'error' : ''}`;

    const thumbHtml = (item.status === 'success' && item.thumbnailUrl)
      ? `<img src="${item.thumbnailUrl}" class="thumbnail" onclick="window.open('${item.thumbnailUrl}', '_blank')" title="点击查看大图" />`
      : `<div class="thumbnail-placeholder">${item.status === 'error' ? '[错误]' : '[图片]'}</div>`;

    const actionsHtml = item.status === 'success'
      ? `<div class="result-actions">
           <button class="action-btn" data-txt="${item.thumbnailUrl}">复制封面链</button>
           <button class="action-btn" data-txt="${item.url}">复制视频链</button>
         </div>`
      : item.errorDetail 
        ? `<div class="result-actions">
             <button class="action-btn error-detail-btn" style="background:#fdecea;color:#c0392b;border-color:#f5c6cb;">查看详情</button>
           </div>`
        : '';

    const titleText = item.status === 'error' ? `错误: ${item.error}` : item.title;
    const titleClass = item.status === 'error' ? 'result-title error' : 'result-title';

    card.innerHTML = `
      ${thumbHtml}
      <div class="result-content">
        <div class="result-index">#${index + 1}</div>
        <div class="${titleClass}" title="${item.title || ''}">${titleText}</div>
        <div class="result-url">${item.url}</div>
        ${actionsHtml}
      </div>
    `;

    card.querySelectorAll('.action-btn:not(.error-detail-btn)').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(btn.dataset.txt);
          const oldTxt = btn.textContent;
          btn.textContent = '已复制';
          btn.style.background = '#dcfce7';
          btn.style.color = '#15803d';
          setTimeout(() => { 
            btn.textContent = oldTxt; 
            btn.style.background = '#f0f4ff'; 
            btn.style.color = '#0369a1'; 
          }, 1500);
        } catch (e) { }
      });
    });

    if (item.status === 'error' && item.errorDetail) {
      const detailBtn = card.querySelector('.error-detail-btn');
      if (detailBtn) {
        detailBtn.addEventListener('click', () => {
          alert(`错误详情:\n\n${item.errorDetail}\n\n视频链接: ${item.url}`);
        });
      }
    }

    coverResults.appendChild(card);
  }

  function updateCoverStats() {
    const total = coverDataList.length;
    const successCount = coverDataList.filter(r => r.status === 'success').length;
    const errorCount = total - successCount;
    coverStatTotal.textContent = `总计: ${total}`;
    coverStatSuccess.textContent = `成功: ${successCount}`;
    coverStatError.textContent = `失败: ${errorCount}`;
    coverExportBtn.style.display = successCount > 0 ? 'inline-block' : 'none';
  }

  async function loadResultsFromStorage() {
    try {
      const result = await chrome.storage.local.get('coverFetchResults');
      if (result.coverFetchResults && result.coverFetchResults.length > 0) {
        coverDataList = result.coverFetchResults;
        coverResults.innerHTML = '';
        coverDataList.forEach((item, index) => {
          renderCoverCard(item, index);
        });
        updateCoverStats();
        if (coverDataList.length > 0) {
          coverStatsRow.classList.add('show');
          coverExportBtn.style.display = coverDataList.some(r => r.status === 'success') ? 'inline-block' : 'none';
        }
      }
    } catch (e) {
      console.error('[Cover] 加载结果失败:', e);
    }
  }

  async function startFetchCover() {
    const rawText = coverUrlInput.value.trim();
    if (!rawText) {
      showStatus('请输入视频链接', 'error');
      return;
    }

    const urls = parseCoverUrls(rawText);
    if (!urls.length) {
      showStatus('请输入有效的视频链接', 'error');
      return;
    }

    console.log('[Cover] 开始批量获取，共', urls.length, '个链接');

    coverDataList = [];
    coverResults.innerHTML = '';
    coverFetchBtn.disabled = true;
    coverFetchBtn.textContent = '正在获取...';
    coverFetchBtn.style.opacity = '0.7';
    coverClearBtn.style.display = 'none';
    coverStopBtn.style.display = 'inline-block';
    coverProgressBar.classList.add('show');
    coverStatsRow.classList.add('show');
    coverExportBtn.style.display = 'none';
    updateCoverProgress(0, urls.length);

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'startCoverFetch',
        urls: urls
      });

      if (response && response.success) {
        startStatusPolling(urls.length);
      } else {
        showStatus('启动失败: ' + (response?.error || '未知错误'), 'error');
        coverProgressBar.classList.remove('show');
        coverDescription.style.display = 'block';
        resetFetchUI();
      }
    } catch (error) {
      console.error('[Cover] 启动失败:', error);
      showStatus('启动失败: ' + error.message, 'error');
      coverProgressBar.classList.remove('show');
      coverDescription.style.display = 'block';
      resetFetchUI();
    }
  }

  async function stopFetchCover() {
    try {
      await chrome.runtime.sendMessage({ action: 'stopCoverFetch' });
      showStatus('正在停止...', 'info');
      coverStopBtn.disabled = true;
      coverStopBtn.textContent = '停止中...';
    } catch (e) {
      console.error('[Cover] 停止失败:', e);
    }
  }

  function startStatusPolling(total) {
    if (statusPollInterval) clearInterval(statusPollInterval);
    
    statusPollInterval = setInterval(async () => {
      try {
        const response = await chrome.runtime.sendMessage({ action: 'getCoverFetchStatus' });
        if (response && response.success && response.status) {
          const status = response.status;
          
          updateCoverProgress(status.currentIndex, status.total);
          
          if (status.status === 'running') {
            coverFetchBtn.textContent = `${status.currentIndex}/${status.total} 成功${status.successCount} 失败${status.failCount}`;
          } else if (status.status === 'completed' || status.status === 'error') {
            clearInterval(statusPollInterval);
            statusPollInterval = null;
            
            const resultsResponse = await chrome.runtime.sendMessage({ action: 'getCoverFetchResults' });
            if (resultsResponse && resultsResponse.success && resultsResponse.results) {
              coverDataList = resultsResponse.results;
              coverResults.innerHTML = '';
              coverDataList.forEach((item, index) => {
                renderCoverCard(item, index);
              });
              updateCoverStats();
            }
            
            if (status.status === 'error') {
              showStatus('获取失败: ' + (status.error || '未知错误'), 'error');
            } else {
              const errorCount = coverDataList.filter(r => r.status === 'error').length;
              const successCount = coverDataList.filter(r => r.status === 'success').length;
              if (errorCount > 0) {
                showStatus(`完成！成功${successCount}个，失败${errorCount}个`, successCount > 0 ? 'info' : 'error');
              } else {
                showStatus(`全部成功！共${successCount}个`, 'success');
              }
            }
            
            resetFetchUI();
          }
        }
      } catch (error) {
        console.error('[Cover] 轮询状态失败:', error);
      }
    }, 500);
  }

  function resetFetchUI() {
    coverFetchBtn.disabled = false;
    coverFetchBtn.textContent = '再次获取';
    coverFetchBtn.style.opacity = '1';
    coverClearBtn.style.display = 'inline-block';
    coverStopBtn.style.display = 'none';
    coverStopBtn.disabled = false;
    coverStopBtn.textContent = '停止';
  }

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
    if (!successOnly.length) {
      showStatus('没有可导出的数据', 'error');
      return;
    }

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

      const colCover = sheet.getColumn('cover');
      const BASE_COVER_WIDTH_UNITS = colCover && colCover.width ? colCover.width : 20;
      colCover.width = BASE_COVER_WIDTH_UNITS;
      const DISPLAY_W_PX_BASE = BASE_COVER_WIDTH_UNITS * 7;

      for (let i = 0; i < successOnly.length; i++) {
        const item = successOnly[i];
        const rowNum = i + 2;
        const row = sheet.getRow(rowNum);

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
      showStatus('XLSX导出成功！', 'success');

    } catch (err) {
      console.error(err);
      alert('导出失败: ' + err.message);
      showStatus('导出失败: ' + err.message, 'error');
    } finally {
      coverExportBtn.disabled = false;
      coverExportBtn.textContent = btnOldTxt;
    }
  }

  coverFetchBtn.addEventListener('click', startFetchCover);
  coverExportBtn.addEventListener('click', exportCoverExcel);
  coverStopBtn.addEventListener('click', stopFetchCover);
  coverClearBtn.addEventListener('click', async () => {
    coverUrlInput.value = '';
    coverDataList = [];
    coverResults.innerHTML = '';
    coverProgressBar.classList.remove('show');
    coverStatsRow.classList.remove('show');
    coverExportBtn.style.display = 'none';
    coverFetchBtn.textContent = '获取封面';
    coverFetchBtn.style.opacity = '1';
    await chrome.runtime.sendMessage({ action: 'clearCoverFetchStatus' });
  });

  coverUrlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      startFetchCover();
    }
  });

  backBtn.addEventListener('click', () => {
    window.location.href = '../popup.html';
  });

  // 初始化：检查是否有正在运行的任务或已完成的结果
  async function checkRunningTask() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getCoverFetchStatus' });
      if (response && response.success && response.status) {
        const status = response.status;
        if (status.status === 'running') {
          coverFetchBtn.disabled = true;
          coverFetchBtn.style.opacity = '0.7';
          coverClearBtn.style.display = 'none';
          coverStopBtn.style.display = 'inline-block';
          coverDescription.style.display = 'none';
          coverProgressBar.classList.add('show');
          coverStatsRow.classList.add('show');
          startStatusPolling(status.total);
        } else if (status.status === 'completed' && Array.isArray(status.results) && status.results.length > 0) {
          // 任务已完成但有未处理的结果
          coverDataList = status.results;
          coverResults.innerHTML = '';
          coverDataList.forEach((item, index) => {
            renderCoverCard(item, index);
          });
          updateCoverStats();
          coverStatsRow.classList.add('show');
          coverExportBtn.style.display = coverDataList.some(r => r.status === 'success') ? 'inline-block' : 'none';
          showStatus(`已恢复 ${coverDataList.length} 条获取结果`, 'success');
          await chrome.runtime.sendMessage({ action: 'clearCoverFetchStatus' });
        } else {
          await loadResultsFromStorage();
        }
      } else {
        await loadResultsFromStorage();
      }
    } catch (e) {
      console.error('[Cover] 检查任务状态失败:', e);
      await loadResultsFromStorage();
    }
  }

  checkRunningTask();
});

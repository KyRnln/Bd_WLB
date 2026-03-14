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
  const backBtn = document.getElementById('backBtn');

  let coverDataList = [];
  const CONCURRENT_REQUESTS = 3;

  function showStatus(message, type = 'info') {
    const statusDiv = document.getElementById('coverPanelStatus');
    statusDiv.textContent = message;
    statusDiv.className = 'status ' + type;
    setTimeout(() => {
      statusDiv.className = 'status';
    }, 3000);
  }

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
      return { url: videoUrl, thumbnailUrl: '', title: '', status: 'error', error: '无效格式', errorDetail: 'URL格式不正确，必须是有效的TikTok链接' };
    }
    const apiUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(videoUrl)}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      console.log('[Cover] 正在请求:', apiUrl);
      const response = await fetch(apiUrl, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      console.log('[Cover] 响应状态:', response.status, response.statusText);
      console.log('[Cover] Content-Type:', response.headers.get('content-type'));
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        console.error('[Cover] HTTP错误响应:', errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText}${errorText ? ' - ' + errorText.substring(0, 200) : ''}`);
      }
      
      const contentType = response.headers.get('content-type') || '';
      const responseText = await response.text();
      
      if (contentType.includes('text/html') || responseText.trim().startsWith('<!DOCTYPE') || responseText.trim().startsWith('<html')) {
        console.error('[Cover] 返回HTML而非JSON:', responseText.substring(0, 500));
        
        let regionError = 'TikTok返回了HTML页面而非数据';
        if (responseText.includes('discontinued operating TikTok in Hong Kong')) {
          regionError = 'TikTok已停止在香港地区的服务，无法获取视频信息';
        } else if (responseText.includes('not available') || responseText.includes('不可用')) {
          regionError = 'TikTok在当前地区不可用';
        }
        
        throw new Error(`地区限制: ${regionError}。请尝试使用VPN切换到其他地区（如美国、日本等）后重试。`);
      }
      
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseErr) {
        console.error('[Cover] JSON解析失败，原始内容:', responseText.substring(0, 500));
        throw new Error(`JSON解析失败: 服务器返回了非JSON格式的内容`);
      }
      
      console.log('[Cover] API返回数据:', data);
      
      return {
        url: videoUrl,
        thumbnailUrl: data.thumbnail_url || '',
        title: data.title || '(无标题)',
        author: data.author_name || '',
        status: 'success'
      };
    } catch (err) {
      clearTimeout(timeoutId);
      console.error('[Cover] 请求失败:', err);
      
      let message = err.message;
      let detail = err.stack || String(err);
      
      if (err.name === 'AbortError') {
        message = '请求超时 (10秒)';
        detail = 'TikTok API响应时间过长，请检查网络连接或稍后重试';
      } else if (err.message.includes('地区限制')) {
        message = err.message;
        detail = '您当前所在的地区可能无法访问TikTok服务。\n\n解决方案:\n1. 使用VPN切换到美国、日本、新加坡等地区\n2. 确保网络可以正常访问TikTok\n3. 尝试使用代理服务器';
      } else if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        message = '网络请求失败';
        detail = '可能是CORS限制或网络问题。TikTok oEmbed API可能需要在特定环境下访问。\n错误详情: ' + err.message;
      } else if (err.message.includes('CORS')) {
        message = 'CORS跨域错误';
        detail = '浏览器安全策略阻止了请求。TikTok API可能不允许从此扩展直接访问。';
      } else if (err.message.includes('JSON解析失败')) {
        message = '数据格式错误';
        detail = err.message + '\n\n这通常表示TikTok返回了错误页面而非数据，可能是地区限制导致。';
      }
      
      return { 
        url: videoUrl, 
        thumbnailUrl: '', 
        title: '', 
        status: 'error', 
        error: message,
        errorDetail: detail
      };
    }
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
      : `<div class="thumbnail-placeholder">${item.status === 'error' ? '⚠️' : '🖼️'}</div>`;

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
    console.log('[Cover] 链接列表:', urls);

    coverDataList = [];
    coverResults.innerHTML = '';
    coverFetchBtn.disabled = true;
    coverFetchBtn.textContent = '正在获取...';
    coverFetchBtn.style.opacity = '0.7';
    coverProgressBar.classList.add('show');
    coverStatsRow.classList.add('show');
    coverExportBtn.style.display = 'none';
    updateCoverProgress(0, urls.length);

    let completed = 0;
    for (let i = 0; i < urls.length; i += CONCURRENT_REQUESTS) {
      const batch = urls.slice(i, i + CONCURRENT_REQUESTS);
      console.log('[Cover] 处理批次', Math.floor(i / CONCURRENT_REQUESTS) + 1, ':', batch);
      
      const batchResults = await Promise.all(batch.map(url => fetchTikTokCover(url)));

      batchResults.forEach((res, j) => {
        coverDataList.push(res);
        completed++;
        updateCoverProgress(completed, urls.length);
        renderCoverCard(res, coverDataList.length - 1);
        updateCoverStats();
      });
    }

    coverFetchBtn.disabled = false;
    coverFetchBtn.textContent = '再次获取';
    coverFetchBtn.style.opacity = '1';
    
    const successCount = coverDataList.filter(r => r.status === 'success').length;
    const errorCount = coverDataList.length - successCount;
    
    if (errorCount > 0) {
      const errorTypes = {};
      coverDataList.filter(r => r.status === 'error').forEach(r => {
        const key = r.error || '未知错误';
        errorTypes[key] = (errorTypes[key] || 0) + 1;
      });
      const errorSummary = Object.entries(errorTypes).map(([k, v]) => `${k}(${v}个)`).join(', ');
      showStatus(`完成！成功${successCount}个，失败${errorCount}个: ${errorSummary}`, successCount > 0 ? 'info' : 'error');
      console.log('[Cover] 错误汇总:', errorTypes);
    } else {
      showStatus(`全部成功！共${successCount}个`, 'success');
    }
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
  coverClearBtn.addEventListener('click', () => {
    coverUrlInput.value = '';
    coverDataList = [];
    coverResults.innerHTML = '';
    coverProgressBar.classList.remove('show');
    coverStatsRow.classList.remove('show');
    coverExportBtn.style.display = 'none';
    coverFetchBtn.textContent = '获取封面';
    coverFetchBtn.style.opacity = '1';
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
});

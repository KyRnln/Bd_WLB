// 获取封面 - 后台模块

let coverFetchState = {
  isRunning: false,
  currentIndex: 0,
  total: 0,
  successCount: 0,
  failCount: 0,
  results: [],
  shouldStop: false
};

// 初始化：从 storage 恢复状态
async function initCoverFetchState() {
  const stored = await chrome.storage.local.get('coverFetchState');
  if (stored.coverFetchState) {
    coverFetchState = { ...coverFetchState, ...stored.coverFetchState };
  }
}
initCoverFetchState();

async function saveCoverFetchState() {
  await chrome.storage.local.set({ coverFetchState });
}

function isValidTikTokUrl(url) {
  try {
    const u = new URL(url);
    return u.hostname.includes('tiktok.com');
  } catch {
    return false;
  }
}

async function fetchTikTokCover(videoUrl) {
  if (!isValidTikTokUrl(videoUrl)) {
    return { url: videoUrl, thumbnailUrl: '', title: '', status: 'error', error: '无效格式', errorDetail: 'URL格式不正确，必须是有效的TikTok链接' };
  }
  const apiUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(videoUrl)}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(apiUrl, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`HTTP ${response.status}: ${response.statusText}${errorText ? ' - ' + errorText.substring(0, 200) : ''}`);
    }
    
    const contentType = response.headers.get('content-type') || '';
    const responseText = await response.text();
    
    if (contentType.includes('text/html') || responseText.trim().startsWith('<!DOCTYPE') || responseText.trim().startsWith('<html')) {
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
      throw new Error(`JSON解析失败: 服务器返回了非JSON格式的内容`);
    }
    
    return {
      url: videoUrl,
      thumbnailUrl: data.thumbnail_url || '',
      title: data.title || '(无标题)',
      author: data.author_name || '',
      status: 'success'
    };
  } catch (err) {
    clearTimeout(timeoutId);
    
    let message = err.message;
    let detail = err.stack || String(err);
    
    if (err.name === 'AbortError') {
      message = '请求超时 (15秒)';
      detail = 'TikTok API响应时间过长，请检查网络连接或稍后重试';
    } else if (err.message.includes('地区限制')) {
      message = err.message;
      detail = '您当前所在的地区可能无法访问TikTok服务。';
    } else if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
      message = '网络请求失败';
      detail = '可能是网络问题。错误详情: ' + err.message;
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

async function updateCoverFetchStatus(status) {
  await chrome.storage.local.set({ coverFetchStatus: status });
}

async function executeCoverFetch(urls) {
  coverFetchState.isRunning = true;
  coverFetchState.shouldStop = false;
  coverFetchState.currentIndex = 0;
  coverFetchState.total = urls.length;
  coverFetchState.successCount = 0;
  coverFetchState.failCount = 0;
  coverFetchState.results = [];

  await saveCoverFetchState();

  await updateCoverFetchStatus({
    status: 'running',
    currentIndex: 0,
    total: urls.length,
    successCount: 0,
    failCount: 0
  });

  await chrome.storage.local.set({ coverFetchResults: [] });

  const CONCURRENT_REQUESTS = 3;

  for (let i = 0; i < urls.length; i += CONCURRENT_REQUESTS) {
    if (coverFetchState.shouldStop) {
      break;
    }

    const batch = urls.slice(i, i + CONCURRENT_REQUESTS);
    const batchResults = await Promise.all(batch.map(url => fetchTikTokCover(url)));

    for (const res of batchResults) {
      coverFetchState.results.push(res);
      coverFetchState.currentIndex++;
      if (res.status === 'success') {
        coverFetchState.successCount++;
      } else {
        coverFetchState.failCount++;
      }
    }

    // 每批次处理后保存状态和结果到 storage
    await saveCoverFetchState();
    await chrome.storage.local.set({ coverFetchResults: coverFetchState.results });

    await updateCoverFetchStatus({
      status: 'running',
      currentIndex: coverFetchState.currentIndex,
      total: coverFetchState.total,
      successCount: coverFetchState.successCount,
      failCount: coverFetchState.failCount
    });
  }

  coverFetchState.isRunning = false;
  
  await saveCoverFetchState();
  
  await updateCoverFetchStatus({
    status: 'completed',
    currentIndex: coverFetchState.currentIndex,
    total: coverFetchState.total,
    successCount: coverFetchState.successCount,
    failCount: coverFetchState.failCount,
    results: coverFetchState.results
  });

  await chrome.storage.local.set({ coverFetchResults: coverFetchState.results });
}

async function handleCoverMessage(request) {
  switch (request.action) {
    case 'startCoverFetch': {
      if (coverFetchState.isRunning) {
        return { success: false, error: '已有任务在运行中' };
      }
      const urls = Array.isArray(request.urls) ? request.urls : [];
      if (urls.length === 0) {
        return { success: false, error: '请输入有效的视频链接' };
      }

      executeCoverFetch(urls).catch(err => {
        console.error('[Cover后台] 获取封面失败:', err);
        coverFetchState.isRunning = false;
        updateCoverFetchStatus({
          status: 'error',
          error: err?.message || String(err),
          currentIndex: coverFetchState.currentIndex,
          total: coverFetchState.total
        });
      });
      return { success: true, message: '封面获取已启动' };
    }
    case 'getCoverFetchStatus': {
      const status = await chrome.storage.local.get('coverFetchStatus');
      const results = await chrome.storage.local.get('coverFetchResults');
      const statusData = status.coverFetchStatus || null;
      if (statusData && statusData.status === 'completed') {
        statusData.results = results.coverFetchResults || [];
      }
      return { success: true, status: statusData };
    }
    case 'stopCoverFetch': {
      coverFetchState.shouldStop = true;
      return { success: true };
    }
    case 'getCoverFetchResults': {
      const results = await chrome.storage.local.get('coverFetchResults');
      return { success: true, results: results.coverFetchResults || [] };
    }
    case 'clearCoverFetchStatus': {
      coverFetchState = {
        isRunning: false,
        currentIndex: 0,
        total: 0,
        successCount: 0,
        failCount: 0,
        results: [],
        shouldStop: false
      };
      await chrome.storage.local.remove(['coverFetchStatus', 'coverFetchResults', 'coverFetchState']);
      return { success: true };
    }
  }
  return null;
}

export { handleCoverMessage };
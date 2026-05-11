let _listRecordsFn = null;
let _uploadCoverFn = null;

let bitableState = {
  scanDone: false,
  records: [],
  processing: false,
  shouldStop: false,
  currentIndex: 0,
  total: 0,
  successCount: 0,
  failCount: 0
};

async function initBitableCoverState() {
  const stored = await chrome.storage.local.get('bitableCoverState');
  if (stored.bitableCoverState) {
    bitableState = { ...bitableState, ...stored.bitableCoverState };
  }
}
initBitableCoverState();

async function saveBitableCoverState() {
  await chrome.storage.local.set({ bitableCoverState: bitableState });
}

async function updateBitableCoverStatus(status) {
  await chrome.storage.local.set({ bitableCoverStatus: status });
}

async function scanBitableRecords(config) {
  bitableState.scanDone = false;
  bitableState.records = [];
  bitableState.currentIndex = 0;
  bitableState.total = 0;
  bitableState.successCount = 0;
  bitableState.failCount = 0;
  await saveBitableCoverState();
  await updateBitableCoverStatus({ status: 'scanning', progressText: '正在扫描...' });

  try {
    const response = await _listRecordsFn(config);
    if (!response || !response.success) {
      throw new Error(response?.error || '读取失败');
    }

    const videoField = config.videoLinkField || '视频链接';
    const coverField = config.coverField || '视频封面';

    const records = response.records
      .map(item => {
        const rawLink = item.fields[videoField];
        let videoUrl = '';
        if (typeof rawLink === 'string' && rawLink) {
          const mdMatch = rawLink.match(/\[([^\]]*)\]\(([^)]+)\)/);
          videoUrl = mdMatch ? mdMatch[2].trim() : rawLink.trim();
        } else if (rawLink && typeof rawLink === 'object') {
          videoUrl = rawLink.link || rawLink.text || '';
        }
        const coverVal = item.fields[coverField];
        const hasCover = coverVal !== null && coverVal !== undefined &&
          (Array.isArray(coverVal) ? coverVal.length > 0 : !!coverVal);
        return {
          recordId: item.recordId,
          videoUrl,
          hasCover,
          status: videoUrl && !hasCover ? 'pending' : 'skipped',
          thumbnailUrl: '',
          error: hasCover ? '已有封面' : (!videoUrl ? '无视频链接' : '')
        };
      })
      .filter(r => r.status === 'pending');

    bitableState.records = records;
    bitableState.total = records.length;
    bitableState.scanDone = true;
    await saveBitableCoverState();
    await updateBitableCoverStatus({ status: 'scan_done', total: records.length });
  } catch (err) {
    bitableState.scanDone = true;
    await saveBitableCoverState();
    await updateBitableCoverStatus({ status: 'error', error: err.message });
  }
}

async function executeBitableProcess(config) {
  const pending = bitableState.records.filter(r => r.status === 'pending');
  if (pending.length === 0) return;

  bitableState.processing = true;
  bitableState.shouldStop = false;
  bitableState.currentIndex = 0;
  bitableState.total = pending.length;
  bitableState.successCount = 0;
  bitableState.failCount = 0;
  await saveBitableCoverState();
  await updateBitableCoverStatus({
    status: 'processing',
    currentIndex: 0,
    total: pending.length,
    successCount: 0,
    failCount: 0
  });

  for (let i = 0; i < pending.length; i++) {
    if (bitableState.shouldStop) break;

    const record = pending[i];
    const recordIdx = bitableState.records.indexOf(record);
    if (recordIdx >= 0) bitableState.records[recordIdx].status = 'processing';

    try {
      const response = await _uploadCoverFn(config, record.recordId, record.videoUrl);
      if (response && response.success) {
        if (recordIdx >= 0) {
          bitableState.records[recordIdx].status = 'success';
          bitableState.records[recordIdx].thumbnailUrl = response.thumbnailUrl;
        }
        bitableState.successCount++;
      } else {
        if (recordIdx >= 0) {
          bitableState.records[recordIdx].status = 'error';
          bitableState.records[recordIdx].error = response?.error || '未知错误';
        }
        bitableState.failCount++;
      }
    } catch (err) {
      if (recordIdx >= 0) {
        bitableState.records[recordIdx].status = 'error';
        bitableState.records[recordIdx].error = err.message;
      }
      bitableState.failCount++;
    }

    bitableState.currentIndex++;
    await saveBitableCoverState();
    await updateBitableCoverStatus({
      status: 'processing',
      currentIndex: bitableState.currentIndex,
      total: bitableState.total,
      successCount: bitableState.successCount,
      failCount: bitableState.failCount
    });
  }

  bitableState.processing = false;
  await saveBitableCoverState();
  await updateBitableCoverStatus({
    status: 'completed',
    currentIndex: bitableState.currentIndex,
    total: bitableState.total,
    successCount: bitableState.successCount,
    failCount: bitableState.failCount,
    records: bitableState.records
  });
}

async function handleBitableCoverMessage(request, listRecordsFn, uploadCoverFn) {
  _listRecordsFn = listRecordsFn;
  _uploadCoverFn = uploadCoverFn;

  switch (request.action) {
    case 'startBitableCoverScan': {
      if (bitableState.processing) {
        return { success: false, error: '已有处理任务在运行中' };
      }
      if (!request.config || !request.config.baseToken) {
        return { success: false, error: '请先配置飞书信息' };
      }
      scanBitableRecords(request.config).catch(err => {
        console.error('[Bitable后台] 扫描失败:', err);
        updateBitableCoverStatus({ status: 'error', error: err?.message || String(err) });
      });
      return { success: true, message: '扫描已启动' };
    }
    case 'getBitableCoverStatus': {
      const stored = await chrome.storage.local.get('bitableCoverStatus');
      const statusData = stored.bitableCoverStatus || null;
      if (statusData && (statusData.status === 'scan_done' || statusData.status === 'completed')) {
        statusData.records = bitableState.records;
      }
      return { success: true, status: statusData };
    }
    case 'startBitableCoverProcess': {
      if (bitableState.processing) {
        return { success: false, error: '已有任务在运行中' };
      }
      if (!bitableState.scanDone || bitableState.records.length === 0) {
        return { success: false, error: '请先扫描记录' };
      }
      if (!request.config || !request.config.baseToken) {
        return { success: false, error: '请先配置飞书信息' };
      }
      executeBitableProcess(request.config).catch(err => {
        console.error('[Bitable后台] 处理失败:', err);
        bitableState.processing = false;
        updateBitableCoverStatus({ status: 'error', error: err?.message || String(err) });
      });
      return { success: true, message: '处理已启动' };
    }
    case 'stopBitableCoverProcess': {
      bitableState.shouldStop = true;
      return { success: true };
    }
    case 'clearBitableCoverStatus': {
      bitableState = {
        scanDone: false,
        records: [],
        processing: false,
        shouldStop: false,
        currentIndex: 0,
        total: 0,
        successCount: 0,
        failCount: 0
      };
      await chrome.storage.local.remove(['bitableCoverState', 'bitableCoverStatus']);
      return { success: true };
    }
  }
  return null;
}

export { handleBitableCoverMessage };

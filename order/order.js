document.addEventListener('DOMContentLoaded', async () => {
  const orderIdInput = document.getElementById('orderIdInput');
  const startOrderQueryBtn = document.getElementById('startOrderQueryBtn');
  const stopOrderQueryBtn = document.getElementById('stopOrderQueryBtn');
  const inputArea = document.getElementById('inputArea');
  const progressDisplay = document.getElementById('progressDisplay');
  const orderProgressBar = document.getElementById('orderProgressBar');
  const orderProgressFill = document.getElementById('orderProgressFill');
  const backBtn = document.getElementById('backBtn');

  let shouldStopOrderQuery = false;

  function showStatus(message, type = 'info') {
    const statusDiv = document.getElementById('orderPanelStatus');
    if (!statusDiv) return;
    statusDiv.textContent = message;
    statusDiv.className = 'status ' + type;
    setTimeout(() => {
      statusDiv.className = 'status';
    }, 3000);
  }

  function switchToProgressMode() {
    if (orderDescription) orderDescription.style.display = 'none';
    if (orderProgressBar) orderProgressBar.classList.add('show');
  }

  function switchToInputMode() {
    if (orderDescription) orderDescription.style.display = 'block';
    if (orderProgressBar) orderProgressBar.classList.remove('show');
  }

  function updateProgressDisplay(message, current = 0, total = 0) {
    if (orderProgressText) orderProgressText.textContent = `${current}/${total}`;
    const pct = total === 0 ? 0 : Math.round((current / total) * 100);
    if (orderProgressFill) orderProgressFill.style.width = `${pct}%`;
    showStatus(message, 'info');
  }

  function clearProgressDisplay() {
    if (orderProgressFill) orderProgressFill.style.width = '0%';
    if (orderProgressText) orderProgressText.textContent = '0/0';
  }

  async function checkContentScript(tabId) {
    try {
      const response = await chrome.tabs.sendMessage(tabId, { action: 'ping' });
      return response && response.success;
    } catch (e) {
      return false;
    }
  }

  async function injectContentScript(tabId) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['content.js']
      });
      await new Promise(resolve => setTimeout(resolve, 500));
      return await checkContentScript(tabId);
    } catch (e) {
      console.error('注入content script失败:', e);
      return false;
    }
  }

  async function clearOrderData(tabId) {
    try {
      if (tabId) {
        await chrome.tabs.sendMessage(tabId, { action: 'clearOrderData' });
      }
      return true;
    } catch (e) {
      console.error('清理数据失败:', e);
      return false;
    }
  }

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
          updateProgressDisplay('操作完成！\n已导出XLSX\n已清理数据');
          showStatus('操作完成！已导出XLSX并清理数据', 'success');
        } else {
          updateProgressDisplay('XLSX已下载，但数据清理失败\n请手动清理临时数据');
          showStatus('XLSX已下载，但数据清理失败，请手动清理', 'info');
        }
      } else {
        console.error('XLSX下载失败:', downloadResult.error);
        updateProgressDisplay(`导出失败\n${downloadResult.error || '未知错误'}`);
        showStatus('查询成功但导出失败，请检查浏览器下载权限', 'error');
      }
    } else {
      let resultMessage = `查询完成，但未获取到有效数据`;
      if (failedOrders && failedOrders.length > 0) {
        resultMessage += `\n失败详情: ${failedOrders.join('; ')}`;
      }
      updateProgressDisplay(`查询完成\n${resultMessage}`);
      showStatus(resultMessage, 'error');
    }

    await chrome.runtime.sendMessage({ action: 'clearOrderQueryState' });

    console.log('3秒后恢复输入界面...');
    setTimeout(() => {
      console.log('执行恢复输入界面');
      switchToInputMode();
      clearProgressDisplay();
      console.log('输入界面已恢复');
    }, 3000);
  }

  startOrderQueryBtn.addEventListener('click', async () => {
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

    shouldStopOrderQuery = false;
    startOrderQueryBtn.disabled = true;
    startOrderQueryBtn.textContent = '查询中...';

    if (stopOrderQueryBtn) {
      stopOrderQueryBtn.style.display = 'flex';
    }

    switchToProgressMode();
    updateProgressDisplay(`准备查询 ${orderIds.length} 个订单...\n请稍候...`);

    const ORDER_QUERY_URL = 'affiliate.tiktokshopglobalselling.com/product/sample-request';

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

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

        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      contentScriptReady = await checkContentScript(tab.id);
      if (!contentScriptReady) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        contentScriptReady = await checkContentScript(tab.id);
      }

      const startResponse = await chrome.runtime.sendMessage({
        action: 'startOrderQuery',
        tabId: tab.id,
        orderIds: orderIds
      });

      if (!startResponse.success) {
        throw new Error(startResponse.error || '启动订单查询失败');
      }

      console.log('订单查询已启动，开始监听状态...');

    } catch (error) {
      updateProgressDisplay(`查询失败\n${error.message}`);
      showStatus('查询失败：' + error.message, 'error');
      shouldStopOrderQuery = false;
      startOrderQueryBtn.disabled = false;
      startOrderQueryBtn.textContent = '开始查询并下载';
      if (stopOrderQueryBtn) {
        stopOrderQueryBtn.style.display = 'none';
      }
      setTimeout(() => {
        switchToInputMode();
        clearProgressDisplay();
      }, 5000);
    }
  });

  stopOrderQueryBtn.addEventListener('click', async () => {
    shouldStopOrderQuery = true;
    if (stopOrderQueryBtn) {
      stopOrderQueryBtn.disabled = true;
      stopOrderQueryBtn.textContent = '正在停止...';
    }
    updateProgressDisplay('正在停止查询...\n请稍候...');
    showStatus('正在停止查询...', 'info');

    await chrome.runtime.sendMessage({ action: 'stopOrderQuery' });
  });

  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.orderQueryState) {
      const newState = changes.orderQueryState.newValue;
      if (newState && newState.isRunning) {
        const progressPercent = Math.round((newState.currentIndex / (newState.total || 1)) * 100);
        orderProgressFill.style.width = `${progressPercent}%`;
        updateProgressDisplay(`查询进度: ${progressPercent}% (${newState.currentIndex}/${newState.total || 0})\n当前处理: ${newState.currentOrderId}\n${newState.message || '请稍候...'}`);
        showStatus(`查询进度: ${progressPercent}% - 处理: ${newState.currentOrderId}`, 'info');
      } else if (newState && !newState.isRunning) {
        console.log('订单查询状态变化:', newState);

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          const savedTabId = tabs[0] ? tabs[0].id : null;

          if (newState.allOrders && newState.allOrders.length > 0) {
            console.log('检测到订单查询完成，开始下载Excel...');
            downloadAndCleanup(newState.allOrders, savedTabId, newState.failedOrders);
          } else {
            console.log('没有订单数据，直接恢复输入界面');
            downloadAndCleanup([], savedTabId, newState.failedOrders);
          }
        });

        shouldStopOrderQuery = false;
        startOrderQueryBtn.disabled = false;
        startOrderQueryBtn.textContent = '开始查询并下载';
        if (stopOrderQueryBtn) {
          stopOrderQueryBtn.style.display = 'none';
        }
      }
    }
  });

  backBtn.addEventListener('click', () => {
    window.location.href = '../popup.html';
  });

  // 初始化：检查是否有正在运行的任务或已完成的结果
  async function checkRunningTask() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getOrderQueryStatus' });
      if (response && response.success && response.state) {
        const state = response.state;
        if (state.isRunning) {
          shouldStopOrderQuery = false;
          startOrderQueryBtn.disabled = true;
          startOrderQueryBtn.textContent = '查询中...';
          if (stopOrderQueryBtn) {
            stopOrderQueryBtn.style.display = 'flex';
          }
          switchToProgressMode();
          updateProgressDisplay(`查询进度: (${state.currentIndex}/${state.total || 0})`, state.currentIndex, state.total || 0);
        } else if (state.allOrders && state.allOrders.length > 0) {
          // 任务已完成但有未处理的结果
          showStatus(`已恢复 ${state.allOrders.length} 条查询结果，正在导出...`, 'success');
          switchToProgressMode();
          updateProgressDisplay('正在恢复结果并导出...\n请稍候...');
          await downloadAndCleanup(state.allOrders, null, state.failedOrders);
          await chrome.runtime.sendMessage({ action: 'clearOrderQueryState' });
        }
      }
    } catch (e) {
      console.error('检查任务状态失败:', e);
    }
  }

  checkRunningTask();
});

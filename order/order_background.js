// 订单查询 - 后台模块

let orderQueryState = {
  isRunning: false,
  shouldStop: false,
  currentIndex: 0,
  total: 0,
  processedCount: 0,
  failedCount: 0,
  currentOrderId: '',
  progress: 0,
  message: '',
  allOrders: [],
  failedOrders: []
};

async function executeOrderQuery(tabId, orderIds) {
  for (let i = 0; i < orderIds.length; i++) {
    if (orderQueryState.shouldStop) {
      console.log('[订单查询] 用户停止了查询');
      break;
    }

    const orderId = String(orderIds[i] || '').trim();
    if (!orderId) continue;

    orderQueryState.currentIndex = i + 1;
    orderQueryState.currentOrderId = orderId;
    orderQueryState.progress = Math.round(((i + 1) / orderIds.length) * 100);
    orderQueryState.message = `正在查询: ${orderId}`;
    await chrome.storage.local.set({ orderQueryState });

    try {
      const response = await chrome.tabs.sendMessage(tabId, {
        action: 'startOrderAutomation',
        orderId: orderId
      });

      if (response.success && response.data && response.data.length > 0) {
        orderQueryState.processedCount++;
        orderQueryState.allOrders.push(...response.data);
        console.log(`[订单查询] 订单 ${orderId} 处理成功，获取 ${response.data.length} 条数据`);
      } else {
        orderQueryState.failedCount++;
        orderQueryState.failedOrders.push(`${orderId}: ${response.error || '未找到相关数据'}`);
        console.warn(`[订单查询] 订单 ${orderId} 查询失败:`, response.error);
      }
    } catch (error) {
      orderQueryState.failedCount++;
      orderQueryState.failedOrders.push(`${orderId}: ${error.message}`);
      console.error(`[订单查询] 订单 ${orderId} 处理出错:`, error);
    }

    await chrome.storage.local.set({ orderQueryState });

    if (i < orderIds.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  orderQueryState.isRunning = false;
  orderQueryState.currentOrderId = '';
  orderQueryState.message = orderQueryState.shouldStop ? '查询已停止' : '查询完成';
  await chrome.storage.local.set({ orderQueryState });

  if (orderQueryState.allOrders.length > 0) {
    await chrome.storage.local.set({ orderQueryOrders: orderQueryState.allOrders });
  }
}

async function generateOrderXlsx(orders) {
  const headers = ['达人ID', '产品ID', '订单ID', '状态', '时间'];

  let excelContent = '<?xml version="1.0"?>\n';
  excelContent += '<?mso-application progid="Excel.Sheet"?>\n';
  excelContent += '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"\n';
  excelContent += ' xmlns:o="urn:schemas-microsoft-com:office:office"\n';
  excelContent += ' xmlns:x="urn:schemas-microsoft-com:office:excel"\n';
  excelContent += ' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">\n';
  excelContent += ' <Styles>\n';
  excelContent += '  <Style ss:ID="Default" ss:Name="Normal">\n';
  excelContent += '   <Alignment ss:Vertical="Center"/>\n';
  excelContent += '   <Font ss:FontName="宋体" x:CharSet="134" ss:Size="11"/>\n';
  excelContent += '  </Style>\n';
  excelContent += '  <Style ss:ID="s16">\n';
  excelContent += '   <Font ss:FontName="宋体" x:CharSet="134" ss:Size="11" ss:Bold="1"/>\n';
  excelContent += '  </Style>\n';
  excelContent += ' </Styles>\n';
  excelContent += ' <Worksheet ss:Name="订单数据">\n';
  excelContent += '  <Table ss:ExpandedColumnCount="5" ss:ExpandedRowCount="' + (orders.length + 1) + '" x:FullColumns="1" x:FullRows="1">\n';
  excelContent += '   <Column ss:Width="100"/>\n';
  excelContent += '   <Column ss:Width="100"/>\n';
  excelContent += '   <Column ss:Width="120"/>\n';
  excelContent += '   <Column ss:Width="80"/>\n';
  excelContent += '   <Column ss:Width="140"/>\n';

  excelContent += '   <Row ss:StyleID="s16">\n';
  headers.forEach(header => {
    excelContent += '    <Cell><Data ss:Type="String">' + header + '</Data></Cell>\n';
  });
  excelContent += '   </Row>\n';

  for (let i = 0; i < orders.length; i++) {
    const order = orders[i];
    excelContent += '   <Row>\n';
    excelContent += '    <Cell><Data ss:Type="String">' + ((order.creatorId || '').replace(/^@/, '') || '') + '</Data></Cell>\n';
    excelContent += '    <Cell><Data ss:Type="String">' + (order.productId || '') + '</Data></Cell>\n';
    excelContent += '    <Cell><Data ss:Type="String">' + (order.orderId || '') + '</Data></Cell>\n';
    excelContent += '    <Cell><Data ss:Type="String">' + (order.status || '') + '</Data></Cell>\n';
    excelContent += '    <Cell><Data ss:Type="String">' + (order.timestamp || '') + '</Data></Cell>\n';
    excelContent += '   </Row>\n';
  }

  excelContent += '  </Table>\n';
  excelContent += ' </Worksheet>\n';
  excelContent += '</Workbook>';

  const encoder = new TextEncoder();
  const data = encoder.encode(excelContent);

  const filename = `orders_${new Date().toISOString().split('T')[0]}.xlsx`;

  return {
    success: true,
    data: data,
    filename: filename,
    method: 'data'
  };
}

async function handleOrderMessage(request, downloadExcel) {
  switch (request.action) {
    case 'startOrderQuery': {
      if (orderQueryState.isRunning) {
        return { success: false, error: '订单查询已在运行中' };
      }
      const orderIds = Array.isArray(request.orderIds) ? request.orderIds : [];
      const tabId = Number(request.tabId);
      if (orderIds.length === 0) return { success: false, error: '请输入有效的订单ID列表' };
      if (!tabId) return { success: false, error: '无法获取当前tabId' };

      orderQueryState = {
        isRunning: true,
        shouldStop: false,
        currentIndex: 0,
        total: orderIds.length,
        processedCount: 0,
        failedCount: 0,
        currentOrderId: '',
        progress: 0,
        message: '查询已启动',
        allOrders: [],
        failedOrders: []
      };
      await chrome.storage.local.set({ orderQueryState });

      executeOrderQuery(tabId, orderIds).catch(err => {
        console.error('订单查询执行失败:', err);
        orderQueryState.isRunning = false;
        orderQueryState.error = err?.message || String(err);
        chrome.storage.local.set({ orderQueryState });
      });
      return { success: true, message: '订单查询已启动' };
    }
    case 'getOrderQueryStatus': {
      const state = await chrome.storage.local.get('orderQueryState');
      return { success: true, state: state.orderQueryState || null };
    }
    case 'stopOrderQuery': {
      orderQueryState.shouldStop = true;
      await chrome.storage.local.set({ orderQueryState });
      return { success: true };
    }
    case 'clearOrderQueryState': {
      orderQueryState = {
        isRunning: false,
        shouldStop: false,
        currentIndex: 0,
        total: 0,
        processedCount: 0,
        failedCount: 0,
        currentOrderId: '',
        progress: 0,
        message: '',
        allOrders: [],
        failedOrders: []
      };
      await chrome.storage.local.remove('orderQueryState');
      return { success: true };
    }
    case 'exportOrderData': {
      const orders = await chrome.storage.local.get('orderQueryOrders');
      const allOrders = orders.orderQueryOrders || [];
      if (!allOrders.length) return { success: false, error: '没有数据可以导出' };
      const xlsxResult = await generateOrderXlsx(allOrders);
      if (!xlsxResult.success) return { success: false, error: xlsxResult.error };
      await downloadExcel(xlsxResult.data, xlsxResult.filename);
      return { success: true };
    }
    case 'clearOrderData': {
      await chrome.storage.local.remove(['orderQueryOrders', 'orderQueryState']);
      return { success: true };
    }
  }
  return null;
}

export { handleOrderMessage };

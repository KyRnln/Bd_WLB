class OrderDatabase {
  constructor() {
    this.dbName = 'OrderQueryDB';
    this.version = 2;
    this.storeName = 'orders';
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        const oldVersion = event.oldVersion;

        console.log(`[Order] 数据库升级: 从版本 ${oldVersion} 升级到版本 ${this.version}`);

        if (db.objectStoreNames.contains(this.storeName)) {
          db.deleteObjectStore(this.storeName);
        }

        const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
        store.createIndex('orderId', 'orderId', { unique: false });
        store.createIndex('creatorId', 'creatorId', { unique: false });
        store.createIndex('productId', 'productId', { unique: false });
        store.createIndex('orderProduct', ['orderId', 'productId'], { unique: true });

        console.log('[Order] 数据库结构升级完成');
      };
    });
  }

  async saveOrder(orderData) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put(orderData);

      request.onsuccess = () => {
        console.log(`[Order] 成功保存记录: ${orderData.orderId} - ${orderData.productId}`);
        resolve();
      };
      request.onerror = () => {
        console.error(`[Order] 保存记录失败: ${orderData.orderId} - ${orderData.productId}`, request.error);
        reject(request.error);
      };
    });
  }

  async getAllOrders() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        const result = request.result;
        console.log(`[Order] 从IndexedDB获取到 ${result.length} 条记录:`, result);
        resolve(result);
      };
      request.onerror = () => {
        console.error('[Order] 获取所有订单失败:', request.error);
        reject(request.error);
      };
    });
  }

  async clearAll() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

const ORDER_SELECTORS = {
  allTab: 'div.m4b-tabs-pane-title-content',
  creatorSelect: 'span.arco-select-view-value',
  orderIdOption: 'li.arco-select-option.m4b-select-option',
  searchInput: 'input[data-tid="m4b_input_search"]',
  searchButton: 'svg.arco-icon-search',
  tableRows: 'tbody tr.arco-table-tr',
  creatorId: '.creator-info__HightBoldText-lfMAmF',
  productId: '.arco-typography.text-body-s-regular.text-neutral-text3',
  orderId: 'span[data-e2e].truncate',
  status: '.product-status-info__StyledTag-hrmRnJ .content .text div'
};

class OrderAutomation {
  constructor() {
    this.db = new OrderDatabase();
    this.db.init();
    this.progressElement = null;
  }

  updatePageProgress(message, type = 'info') {
    this.createGlobalProgress(message, type);
  }

  createGlobalProgress(message = '', type = 'info') {
    let progressContainer = document.getElementById('order-query-progress');
    if (!progressContainer) {
      progressContainer = document.createElement('div');
      progressContainer.id = 'order-query-progress';
      progressContainer.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(255, 255, 255, 0.95);
        border: 2px solid #007bff;
        border-radius: 8px;
        padding: 12px 16px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        font-family: Arial, sans-serif;
        font-size: 14px;
        color: #333;
        max-width: 400px;
        text-align: center;
      `;
      document.body.appendChild(progressContainer);
    }

    if (message) {
      progressContainer.innerHTML = this.createProgressHtml(message, type);
      progressContainer.style.display = 'block';
    }
  }

  createProgressHtml(message, type) {
    const iconMap = {
      'info': '🔄',
      'success': '✅',
      'error': '❌',
      'warning': '⚠️'
    };

    const icon = iconMap[type] || iconMap.info;

    return `
      <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
        <span style="font-size: 16px;">${icon}</span>
        <span style="flex: 1; text-align: center;">${message}</span>
      </div>
    `;
  }

  hidePageProgress() {
    try {
      if (this.progressElement) {
        this.progressElement.style.display = 'none';
      }

      const globalProgress = document.getElementById('order-query-progress');
      if (globalProgress) {
        globalProgress.style.display = 'none';
      }
    } catch (error) {
      console.error('[Order] 隐藏进度显示失败:', error);
    }
  }

  findElement(selector) {
    return document.querySelector(selector);
  }

  async waitForElement(selector, timeout = 5000) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      const element = this.findElement(selector);
      if (element) {
        return element;
      }
      await this.sleep(100);
    }
    throw new Error(`Element not found: ${selector}`);
  }

  async waitForClickable(selector, timeout = 5000) {
    const element = await this.waitForElement(selector, timeout);
    if (!element) {
      throw new Error(`Element is null: ${selector}`);
    }

    let attempts = 0;
    while (attempts < 50) {
      if (!element.disabled && element.offsetParent !== null) {
        return element;
      }
      await this.sleep(100);
      attempts++;
    }
    throw new Error(`Element not clickable: ${selector}`);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async clickElement(selector) {
    console.log(`[Order] Attempting to click element: ${selector}`);

    const element = await this.waitForClickable(selector, 5000);

    if (!element) {
      throw new Error(`Element is null, cannot click: ${selector}`);
    }

    if (typeof element.click !== 'function') {
      throw new Error(`Element.click is not a function. Element type: ${element.constructor.name}, selector: ${selector}`);
    }

    console.log('[Order] Clicking element:', element);
    element.click();
    await this.sleep(500);
  }

  async triggerEnterKey(selector) {
    console.log(`[Order] Triggering Enter key on selector: ${selector}`);

    let element = await this.waitForElement(selector, 3000).catch(() => null);

    if (!element) {
      console.log('[Order] 原选择器未找到输入框，尝试其他选择器...');

      const searchSelectors = [
        'input[data-tid="m4b_input_search"]',
        'input[placeholder*="订单"]',
        'input[placeholder*="搜索"]',
        'input[type="text"]',
        'input:not([type="hidden"])',
        'input'
      ];

      for (const searchSelector of searchSelectors) {
        try {
          console.log(`[Order] 尝试选择器: ${searchSelector}`);
          const elements = document.querySelectorAll(searchSelector);

          for (const el of elements) {
            if (el.offsetParent !== null && el.clientWidth > 100) {
              element = el;
              console.log(`[Order] 使用选择器 "${searchSelector}" 找到输入框:`, element);
              break;
            }
          }

          if (element) break;
        } catch (e) {
          console.log(`[Order] 选择器 "${searchSelector}" 无效:`, e.message);
        }
      }

      if (!element) {
        console.log('[Order] 尝试通用输入框查找...');
        const allInputs = document.querySelectorAll('input[type="text"], input:not([type])');

        const candidates = Array.from(allInputs)
          .filter(input => {
            const rect = input.getBoundingClientRect();
            return input.offsetParent !== null &&
              rect.width > 150 && rect.height > 20 &&
              !input.disabled && !input.readOnly;
          })
          .sort((a, b) => {
            const aInForm = a.closest('form') !== null;
            const bInForm = b.closest('form') !== null;
            if (aInForm && !bInForm) return -1;
            if (!aInForm && bInForm) return 1;

            const aArea = a.offsetWidth * a.offsetHeight;
            const bArea = b.offsetWidth * b.offsetHeight;
            return bArea - aArea;
          });

        if (candidates.length > 0) {
          element = candidates[0];
          console.log('[Order] 使用通用查找找到输入框:', element);
        }
      }
    }

    if (!element) {
      console.log(`[Order] 未找到输入框用于Enter键: ${selector}，跳过搜索触发`);
      return;
    }

    console.log('[Order] Found input element for Enter:', element);

    const enterEvent = new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true
    });

    element.dispatchEvent(enterEvent);
    await this.sleep(500);

    console.log('[Order] Enter key triggered');
  }

  async inputText(selector, text) {
    console.log(`[Order] Inputting text "${text}" into selector: ${selector}`);

    let element = await this.waitForElement(selector, 3000).catch(() => null);

    if (!element) {
      console.log('[Order] 原选择器未找到搜索输入框，尝试其他选择器...');

      const searchSelectors = [
        'input[data-tid="m4b_input_search"]',
        'input[placeholder*="订单"]',
        'input[placeholder*="搜索"]',
        'input[placeholder*="order"]',
        'input[placeholder*="search"]',
        'input[type="text"]',
        'input:not([type="hidden"])',
        'input'
      ];

      for (const searchSelector of searchSelectors) {
        try {
          console.log(`[Order] 尝试选择器: ${searchSelector}`);
          const elements = document.querySelectorAll(searchSelector);

          for (const el of elements) {
            if (el.offsetParent !== null && el.clientWidth > 100) {
              element = el;
              console.log(`[Order] 使用选择器 "${searchSelector}" 找到搜索输入框:`, element);
              break;
            }
          }

          if (element) break;
        } catch (e) {
          console.log(`[Order] 选择器 "${searchSelector}" 无效:`, e.message);
        }
      }

      if (!element) {
        console.log('[Order] 尝试通用输入框查找...');
        const allInputs = document.querySelectorAll('input[type="text"], input:not([type])');

        const candidates = Array.from(allInputs)
          .filter(input => {
            const rect = input.getBoundingClientRect();
            return input.offsetParent !== null &&
              rect.width > 150 && rect.height > 20 &&
              !input.disabled && !input.readOnly;
          })
          .sort((a, b) => {
            const aInForm = a.closest('form') !== null;
            const bInForm = b.closest('form') !== null;
            if (aInForm && !bInForm) return -1;
            if (!aInForm && bInForm) return 1;

            const aArea = a.offsetWidth * a.offsetHeight;
            const bArea = b.offsetWidth * b.offsetHeight;
            return bArea - aArea;
          });

        if (candidates.length > 0) {
          element = candidates[0];
          console.log('[Order] 使用通用查找找到输入框:', element);
        }
      }
    }

    if (!element) {
      console.log(`[Order] 未找到输入框: ${selector}，跳过输入步骤`);
      return;
    }

    console.log('[Order] Found input element:', element);

    element.value = '';
    element.focus();

    element.value = text;

    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));

    await this.sleep(300);
  }

  findElementByText(selector, text) {
    const elements = document.querySelectorAll(selector);
    for (const element of elements) {
      if (element.textContent.includes(text)) {
        return element;
      }
    }
    return null;
  }

  async getTableData(filterOrderId = null) {
    console.log('[Order] === 开始获取表格数据 ===');
    console.log('[Order] 过滤订单ID:', filterOrderId);
    console.log('[Order] 当前页面URL:', window.location.href);

    await this.sleep(2000);

    const rows = document.querySelectorAll(ORDER_SELECTORS.tableRows);
    console.log(`[Order] 发现 ${rows.length} 行数据`);

    const orders = [];
    const orderGroups = new Map();

    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex];

      try {
        let orderElement = row.querySelector('td.arco-table-td:nth-child(3) [class*="creator-product-info__ProductInfoWrap"] [class*="text-neutral-text3"] span[data-e2e].truncate');

        if (!orderElement) {
          orderElement = row.querySelector('td:nth-child(3) span[data-e2e].truncate');
        }

        if (!orderElement) {
          const allOrderSpans = row.querySelectorAll('span[data-e2e].truncate');
          for (const span of allOrderSpans) {
            if (span.textContent.includes('订单 ID：') || /^\d{18,}$/.test(span.textContent.trim())) {
              orderElement = span;
              break;
            }
          }
        }

        if (orderElement) {
          let orderId = '';
          if (orderElement.textContent.includes('订单 ID：')) {
            orderId = orderElement.textContent.replace('订单 ID：', '').trim();
          } else {
            orderId = orderElement.textContent.trim();
          }

          if (orderId) {
            if (!orderGroups.has(orderId)) {
              orderGroups.set(orderId, []);
            }
            orderGroups.get(orderId).push(row);
          }
        }
      } catch (error) {
        console.error(`[Order] 分析第 ${rowIndex + 1} 行时出错:`, error);
      }
    }

    console.log(`[Order] 分组完成: 发现 ${orderGroups.size} 个不同订单ID`);

    let filteredGroups = orderGroups;
    if (filterOrderId) {
      filteredGroups = new Map();
      if (orderGroups.has(filterOrderId)) {
        filteredGroups.set(filterOrderId, orderGroups.get(filterOrderId));
      } else {
        return [];
      }
    }

    if (filteredGroups.size === 0) {
      return [];
    }

    for (const [orderId, orderRows] of filteredGroups) {
      for (let i = 0; i < orderRows.length; i++) {
        const row = orderRows[i];
        const isMultiProduct = orderRows.length > 1;

        try {
          const creatorElement = row.querySelector('[class*="creator-info__HightBoldText"]');

          let productElement = null;
          const arcoTypographyElements = row.querySelectorAll('[class*="arco-typography"]');
          for (const element of arcoTypographyElements) {
            if (element.textContent.includes('ID:')) {
              productElement = element;
              break;
            }
          }
          const statusElement = row.querySelector('[class*="product-status-info__StyledTag"] [class*="text"] div');

          let creatorId = '';
          let productId = '';
          let status = '';

          if (creatorElement) {
            creatorId = creatorElement.textContent.trim();
          }

          if (productElement) {
            productId = productElement.textContent.replace('ID: ', '').trim();
          }

          if (statusElement) {
            status = statusElement.textContent.trim();
          }

          const orderData = {
            id: `${orderId}_${productId}`,
            creatorId,
            productId,
            orderId,
            status,
            productIndex: isMultiProduct ? i + 1 : null,
            totalProducts: orderRows.length,
            timestamp: new Date().toISOString()
          };

          orders.push(orderData);

        } catch (error) {
          console.error(`[Order] 处理订单 ${orderId} 行 ${i + 1} 时出错:`, error);
        }
      }
    }

    console.log(`[Order] 总共处理了 ${orders.length} 条记录`);

    return orders;
  }

  async clickSampleRequestMenu() {
    console.log('[Order] === 点击样品申请菜单 ===');
    try {
      const menuSelectors = [
        '.m4b-menu-title',
        'div.m4b-menu-title',
        '[class*="m4b-menu-title"]',
        'div[class*="menu-title"]',
        '.side-menu-item',
        '[class*="side-menu"]'
      ];

      let menuElement = null;
      for (const selector of menuSelectors) {
        const elements = document.querySelectorAll(selector);
        for (const el of elements) {
          if (el.textContent && el.textContent.includes('样品申请')) {
            menuElement = el;
            break;
          }
        }
        if (menuElement) break;
      }

      if (!menuElement) {
        const allDivs = document.querySelectorAll('div');
        for (const div of allDivs) {
          if (div.textContent && div.textContent.trim() === '样品申请') {
            menuElement = div;
            break;
          }
        }
      }

      if (menuElement) {
        menuElement.click();
        await this.sleep(2000);
        return { success: true, message: '已点击样品申请菜单', url: window.location.href };
      } else {
        const targetUrl = 'https://affiliate.tiktokshopglobalselling.com/product/sample-request';
        window.location.href = targetUrl;
        await this.sleep(3000);
        return { success: true, message: '已导航到样品申请页面', url: window.location.href };
      }
    } catch (error) {
      console.error('[Order] 点击样品申请菜单失败:', error);
      return { success: false, error: error.message };
    }
  }

  async clickCreatorMenu() {
    console.log('[Order] === 点击达人管理菜单 ===');
    try {
      const menuSelectors = [
        '.m4b-menu-title',
        'div.m4b-menu-title',
        '[class*="m4b-menu-title"]',
        'div[class*="menu-title"]',
        '.side-menu-item',
        '[class*="side-menu"]'
      ];

      let menuElement = null;
      for (const selector of menuSelectors) {
        const elements = document.querySelectorAll(selector);
        for (const el of elements) {
          if (el.textContent && el.textContent.includes('达人管理')) {
            menuElement = el;
            break;
          }
        }
        if (menuElement) break;
      }

      if (!menuElement) {
        const allDivs = document.querySelectorAll('div');
        for (const div of allDivs) {
          if (div.textContent && div.textContent.trim() === '达人管理') {
            menuElement = div;
            break;
          }
        }
      }

      if (menuElement) {
        menuElement.click();
        await this.sleep(2000);
        return { success: true, message: '已点击达人管理菜单', url: window.location.href };
      } else {
        const targetUrl = 'https://affiliate.tiktokshopglobalselling.com/connection/creator-management';
        window.location.href = targetUrl;
        await this.sleep(3000);
        return { success: true, message: '已导航到达人管理页面', url: window.location.href };
      }
    } catch (error) {
      console.error('[Order] 点击达人管理菜单失败:', error);
      return { success: false, error: error.message };
    }
  }

  async executeAutomation(orderId) {
    console.log(`[Order] === 开始执行自动化流程，订单ID: ${orderId} ===`);
    try {
      this.updatePageProgress(`开始查询订单: ${orderId}`, 'info');

      try {
        let allTabElement = this.findElementByText(ORDER_SELECTORS.allTab, '全部');

        if (!allTabElement) {
          const allSelectors = ['div[role="tab"]', '.arco-tabs-tab-title', 'span', 'div'];

          for (const selector of allSelectors) {
            const elements = document.querySelectorAll(selector);
            for (const element of elements) {
              if (element.textContent && element.textContent.trim() === '全部') {
                allTabElement = element;
                break;
              }
            }
            if (allTabElement) break;
          }
        }

        if (allTabElement) {
          if (typeof allTabElement.click === 'function') {
            allTabElement.click();
            await this.sleep(500);
          }
        }
      } catch (tabError) {
        console.log('[Order] 查找"全部"标签时出错，但继续执行查询:', tabError.message);
      }

      this.updatePageProgress('正在选择达人昵称字段...', 'info');
      const creatorSelectElement = this.findElementByText(ORDER_SELECTORS.creatorSelect, '达人昵称');
      if (creatorSelectElement) {
        if (typeof creatorSelectElement.click === 'function') {
          creatorSelectElement.click();
          await this.sleep(500);
        }
      }

      this.updatePageProgress('正在选择订单ID搜索方式...', 'info');
      const orderIdOptionElement = this.findElementByText(ORDER_SELECTORS.orderIdOption, '订单 ID');
      if (orderIdOptionElement) {
        if (typeof orderIdOptionElement.click === 'function') {
          orderIdOptionElement.click();
          await this.sleep(500);
        }
      }

      this.updatePageProgress('正在输入订单号...', 'info');
      try {
        await this.inputText(ORDER_SELECTORS.searchInput, orderId);
      } catch (inputError) {
        this.updatePageProgress('直接查询数据...', 'info');
      }

      this.updatePageProgress('正在执行搜索...', 'info');
      let searchTriggered = false;

      try {
        await this.triggerEnterKey(ORDER_SELECTORS.searchInput);
        searchTriggered = true;
      } catch (enterError) {
        try {
          const searchButton = this.findElement(ORDER_SELECTORS.searchButton);
          if (searchButton) {
            searchButton.click();
            await this.sleep(500);
            searchTriggered = true;
          }
        } catch (buttonError) {
          console.log('[Order] 搜索按钮点击失败，直接获取数据');
        }
      }

      if (!searchTriggered) {
        this.updatePageProgress('正在获取数据...', 'info');
      }

      this.updatePageProgress('正在获取查询结果...', 'info');
      const orders = await this.getTableData(orderId);

      this.updatePageProgress(`正在保存 ${orders.length} 条数据...`, 'info');
      for (const order of orders) {
        try {
          await this.db.saveOrder(order);
        } catch (saveError) {
          console.error(`[Order] 保存订单失败: ${order.orderId}`, saveError);
          throw saveError;
        }
      }

      this.updatePageProgress(`查询完成！获取到 ${orders.length} 条数据`, 'success');

      setTimeout(() => {
        this.hidePageProgress();
      }, 5000);

      return { success: true, data: orders };
    } catch (error) {
      console.error('[Order] Automation failed:', error);
      this.updatePageProgress(`查询失败: ${error.message}`, 'error');

      setTimeout(() => {
        this.hidePageProgress();
      }, 5000);

      return { success: false, error: error.message };
    }
  }

  async clearData() {
    try {
      await this.db.clearAll();
      console.log('[Order] 所有订单数据已清空');
      return { success: true };
    } catch (error) {
      console.error('[Order] 清空数据失败:', error);
      return { success: false, error: error.message };
    }
  }

  async getDataForExport() {
    try {
      const orders = await this.db.getAllOrders();
      console.log(`[Order] 获取到 ${orders.length} 条数据用于导出:`, orders);

      if (orders.length === 0) {
        return { success: false, error: '没有数据可导出' };
      }

      return { success: true, data: orders };
    } catch (error) {
      console.error('[Order] 获取导出数据失败:', error);
      return { success: false, error: error.message };
    }
  }
}

const orderAutomation = new OrderAutomation();

console.log('[Order] 订单查询功能已加载');

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[Order] 收到消息:', request.action, request);
  if (request.action === 'ping') {
    sendResponse({ success: true });
    return false;
  } else if (request.action === 'clickSampleRequestMenu') {
    orderAutomation.clickSampleRequestMenu().then(sendResponse);
    return true;
  } else if (request.action === 'clickCreatorMenu') {
    orderAutomation.clickCreatorMenu().then(sendResponse);
    return true;
  } else if (request.action === 'startOrderAutomation') {
    orderAutomation.executeAutomation(request.orderId).then(sendResponse);
    return true;
  } else if (request.action === 'exportOrderData') {
    orderAutomation.getDataForExport().then(sendResponse);
    return true;
  } else if (request.action === 'clearOrderData') {
    orderAutomation.clearData().then(sendResponse);
    return true;
  }
});

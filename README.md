# 商务WLB插件

> 工作是为了更好的生活

## 项目简介

商务WLB插件是一款Chrome浏览器扩展程序，主要面向TikTok平台商家和创作者，帮助提升工作效率。

## 主要功能

### 快捷短语
- 在任意输入框输入 `/` 即可快速唤起短语选择器
- 支持短语分类标签管理
- 常用短语一键插入，提高回复效率

### 订单查询与导出
- 通过订单ID查询达人履约情况
- 支持将查询结果导出为XLSX文件
- 方便数据分析和记录

### 达人信息批量获取
- 输入达人ID批量获取头像及CID
- 可在达人管理页面使用此功能
- 提高达人管理效率

### 达人隐藏管理
- 在达人列表中点击达人ID旁的隐藏按钮
- 隐藏后达人ID显示中间划线且透明度为25%，便于区分
- 隐藏信息数据持久化保存，即使关闭浏览器也不会丢失
- 隐藏数据与项目备份整合，支持导出/导入和WebDAV云同步
- 达人管理页面实时显示已隐藏的达人数量

### 创作者管理
- 记录和管理TikTok创作者信息
- 快速查看和调用创作者数据

### 本地数据存储
- 所有数据保存在浏览器本地存储中
- 支持数据导出和导入备份

## 技术架构

```
├── manifest.json              # Chrome扩展配置文件 (Manifest V3)
├── background.js              # 后台服务 Worker - 处理消息、管理创作者数据、订单查询
├── content.js                 # 内容脚本 - 实现页面交互、订单查询自动化
├── popup.html                 # 扩展弹窗界面 - 快捷短语和工具入口
├── popup.js                   # 弹窗逻辑 - 短语管理、达人管理、界面交互
├── phrase_manage.html         # 短语管理页面 - 专门的短语编辑界面
├── page_bridge.js             # 页面桥接脚本 - 用于调试和页面间通信
├── migrate.js                 # 数据迁移工具 - 管理本地数据格式升级
├── libs/
│   └── exceljs.min.js        # ExcelJS 库 - 用于生成 xlsx 格式文件
├── icon128.png               # 扩展图标 (128x128)
├── icon48.png                # 扩展图标 (48x48)
├── icon32.png                # 扩展图标 (32x32)
├── icon16.png                # 扩展图标 (16x16)
└── README.md                 # 项目说明文档
```

### 核心技术栈
- **Chrome扩展 API (Manifest V3)** - 使用最新的扩展规范
- **原生JavaScript ES6+** - 无框架依赖，使用现代JS特性如Promise、async/await
- **HTML5 + CSS3** - 响应式界面设计
- **IndexedDB** - 浏览器内置数据库，用于存储订单和创作者数据
- **chrome.storage.local** - Chrome扩展本地存储API，用于短语和标签数据
- **ExcelJS** - 用于生成 xlsx 格式的 Excel 文件
- **DOM API** - 操作页面元素，实现自动化功能
- **MutationObserver** - 监听页面DOM变化，动态注入功能
- **Fetch API** - 处理网络请求
- **Canvas API** - 图片处理（如头像转换为base64）

### 实现方式

#### 1. 快捷短语功能
- **触发机制**: 监听输入框按键事件，检测"/"字符触发
- **UI渲染**: 动态创建浮层选择器，使用CSS样式定制外观
- **数据管理**: 通过chrome.storage.local存储短语和标签数据
- **搜索算法**: 实现模糊匹配算法，支持标题和内容搜索

#### 2. 内容脚本(content.js)
- **页面注入**: 在页面加载时注入样式和事件监听器
- **自动填充**: 监听特定输入框，支持自动填充功能
- **DOM操作**: 通过CSS选择器和XPath定位页面元素
- **事件监听**: 监听页面点击、键盘输入等事件

#### 3. 订单查询自动化
- **定时轮询**: 实现智能轮询机制，定期检查订单状态
- **表单操作**: 自动填充订单号并触发搜索
- **数据提取**: 解析表格数据，提取达人履约信息
- **状态跟踪**: 记录查询进度和结果状态

#### 4. 达人信息批量获取
- **批量处理**: 逐个处理达人ID列表，控制请求频率
- **页面交互**: 自动在页面中搜索达人信息
- **错误处理**: 对每个查询进行独立的错误处理
- **结果汇总**: 收集所有查询结果并展示统计信息

#### 5. 数据持久化策略
- **IndexedDB**: 存储大量结构化数据（订单、创作者信息）
- **chrome.storage.local**: 存储配置和小量数据（短语、标签）
- **数据迁移**: 实现从旧版存储格式到新版的自动迁移
- **备份恢复**: 支持数据导出为JSON格式，便于备份

#### 6. 消息传递系统
- **跨上下文通信**: background.js与content.js之间的消息传递
- **异步响应**: 使用Promise处理异步消息响应
- **错误处理**: 完善的消息处理错误捕获机制

#### 7. XLSX 导出系统
- **统一导出接口**: 所有导出功能通过 background.js 的消息处理
- **生成函数**:
  - `generateXlsx(creators)` - 生成达人CID的xlsx文件（带头像）
  - `generateOrderXlsx(orders)` - 生成订单数据的xlsx文件
- **下载函数**: `downloadExcel(data, customFilename)` - 触发浏览器下载
- **消息调用**:
  - `exportExcel` - 导出达人数据
  - `exportOrderData` - 导出订单数据

#### 8. 上下文失效处理
- **问题说明**: Chrome扩展重新加载时，content script上下文会失效
- **解决方案**: 使用 `safeSendMessage` 和 `safeSendMessagePromise` 方法
- **实现位置**: TikTokShopCidExtractor 类中

#### 9. 用户界面优化
- **响应式设计**: 适配不同尺寸的弹窗界面
- **动画效果**: 使用CSS动画增强用户体验
- **选项卡切换**: 实现功能模块的选项卡切换
- **进度显示**: 实时显示长时间操作的进度

#### 10. 达人头像动态尺寸导出 (ExcelJS)
- **问题背景**: OOXML格式会根据单元格尺寸自动缩放图片，导致头像显示比例失真
- **解决方案**: 使用ExcelJS库的`ext`属性精确控制图片尺寸，而非依赖单元格大小
- **实现流程**:
  1. **Base64转Buffer**: 将存储的base64头像数据转换为ArrayBuffer
  2. **读取原始尺寸**: 通过HTML Image对象的`naturalWidth`和`naturalHeight`获取图片真实像素尺寸
  3. **比例计算**: 计算头像高宽比 `ratio = origH / origW`，防止图片变形
  4. **动态显示尺寸**: 根据基础宽度动态计算显示尺寸
     ```javascript
     const DISPLAY_W_PX_BASE = 15 * 7; // 约105像素基础宽度
     const displayW = Math.round(DISPLAY_W_PX_BASE * 0.5); // 缩小50%约52像素
     const displayH = Math.round(displayW * ratio); // 根据比例计算高度
     ```
  5. **行高适配**: 根据图片显示高度调整Excel行高
     ```javascript
     row.height = displayH * 0.75; // Excel行高单位转换系数
     ```
  6. **精确插入**: 使用`ext`属性精确指定图片尺寸（单位为像素）
     ```javascript
     sheet.addImage(imageId, {
       tl: { col: 1, row: rowNum - 1 },
       ext: { width: displayW, height: displayH }, // ← 精确控制
       editAs: 'oneCell'
     });
     ```
- **关键特性**:
  - 自动适应各种纵横比的头像（正方形、竖长、横长等）
  - 防止图片阻挡相邻列数据（使用`oneCell`锚点）
  - 错误处理：加载失败时显示提示文本，不中断导出过程
- **实现位置**: popup.js:2152 (`exportCreatorExcel` 函数)

#### 11. 前后端状态同步机制 (v1.2新增)
- **状态管理架构**：
  - background.js负责订单查询逻辑和状态管理
  - 使用`chrome.storage.local`作为状态共享机制
  - popup.js通过`chrome.storage.onChanged`监听状态变化
  - 实现了真正的前后端解耦和实时同步
- **状态监听优化**：
  - background.js将查询状态实时写入`chrome.storage.local`
  - popup.js通过监听storage变化自动更新UI
  - 移除了依赖轮询的机制，避免popup失去焦点时卡住
  - 查询完成后自动下载XLSX文件并清理临时数据
- **实现代码示例**：
  ```javascript
  // background.js - 更新状态
  chrome.storage.local.set({ orderQueryState: newState });
  
  // popup.js - 监听状态变化
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.orderQueryState) {
      const newState = changes.orderQueryState.newValue;
      // 更新UI
    }
  });
  ```

#### 12. 达人隐藏功能 (v1.3新增，v1.4优化)
- **功能概述**：
  - 在达人列表中识别达人ID元素，动态注入隐藏按钮
  - 点击按钮可将达人加入隐藏列表，再次点击可解除隐藏
  - 支持跨标签页共享隐藏信息，实时同步
  - 隐藏信息与项目备份数据整合，支持导出/导入和WebDAV云同步
  - 在达人管理页面显示已隐藏的达人数量统计

- **实现架构**：
  - **content.js**: 页面脚本，负责隐藏UI交互和按钮注入 (content.js:2146-2467)
  - **popup.js**: 扩展弹窗，负责显示隐藏统计信息和备份整合 (popup.js:149, 386, 766-826, 874, 958-966, 1252-1259)
  - **chrome.storage.local**: 隐藏信息持久化存储（键：`creatorBlacklist`）
  
- **核心实现流程**：
  
  1. **达人ID元素识别** (content.js:2257)
     - CSS选择器：`[class*="creator-info__HightBoldText"]` - 精确定位达人ID元素
     - 文本验证：使用正则表达式验证 `/[a-zA-Z]/` - 确保包含字母（排除纯数字如粉丝数）
     - DOM监听：使用`MutationObserver`监听页面变化，动态处理新增的表格行
     - 点击位置：找出达人ID元素的父节点，避免嵌套过深导致选择器复杂
  
  2. **按钮注入和样式** (content.js:2152-2194)
     - **按钮元素**：`<button class="creator-blacklist-btn" title="点击隐藏此达人">隐藏</button>`
     - **样式注入**：自动在`<head>`中注入样式表，避免重复注入
     - **样式定义** (v1.4优化)：
       - 默认状态（未隐藏）：`background: #ffe0e6, border: #ff0050, color: #ff0050`（红色 - 表示可操作）
       - 悬停状态：`background: #ffc9d9, border: #ff0050, color: #ff0050`（深红色）
       - 隐藏状态：`.blacklisted` → `background: #f5f5f5, border: #d9d9d9, color: #666`（灰色 - 表示已隐藏）
     - **放置策略**：直接追加到ID元素的父节点，避免破坏原有DOM结构
  
  3. **隐藏/解除隐藏逻辑** (content.js:2278-2312)
     ```javascript
     btn.addEventListener('click', async (e) => {
       e.preventDefault();
       e.stopPropagation();
       
       const blacklist = await loadBlacklist();
       const isBlacklisted = blacklist.some(item => item.id === creatorId);
       
       if (isBlacklisted) {
         // ← 解除隐藏
         blacklist = blacklist.filter(item => item.id !== creatorId);
         creatorIdElement.classList.remove('creator-id-blacklisted');
         btn.classList.remove('blacklisted');
         btn.textContent = '隐藏';
         btn.title = '点击隐藏此达人';
       } else {
         // ← 隐藏
         blacklist.push({ id: creatorId, blacklistedAt: Date.now() });
         creatorIdElement.classList.add('creator-id-blacklisted');
         btn.classList.add('blacklisted');
         btn.textContent = '解除';
         btn.title = '点击取消隐藏';
       }
       
       await saveBlacklist(blacklist);
     });
     ```
     - **状态切换**：点击时自动查询当前隐藏状态，智能判断添加或删除
     - **样式同步**：动态添加/移除`.creator-id-blacklisted`和`.blacklisted`类
     - **按钮反馈**：按钮文本和标题随状态变化，给用户清晰的视觉反馈
  
  4. **隐藏数据存储与备份整合** (content.js:2237-2263, popup.js:758-826, 858-905, 930-989)
     - **存储格式**：对象数组 `[{ id: string, blacklistedAt: number }, ...]`
     - **存储键**：`chrome.storage.local['creatorBlacklist']`
     - **自动转换**：加载时自动将旧格式（字符串数组）转换为新格式（对象数组）
     - **跨页面同步**：保存时通过`chrome.runtime.sendMessage`通知popup.js更新UI
     - **备份整合** (v1.4新增)：
       ```javascript
       // 导出备份时包含隐藏信息
       const data = {
         version: '1.0',
         exportTime: new Date().toISOString(),
         phrases: phrases,
         tags: tags,
         activeTagId: activeTagId,
         creators: creators,
         creatorBlacklist: window.creatorBlacklist || []  // ← v1.4新增
       };
       
       // 导入备份时恢复隐藏信息
       const creatorBlacklist = data.creatorBlacklist || [];
       await storageAPI.set({
         creatorBlacklist: creatorBlacklist
       });
       ```
     - **WebDAV云同步** (v1.4新增)：隐藏信息随完整备份上传到云端，从云端恢复时自动恢复隐藏列表
     - **清除所有数据**：清除数据时同时清除隐藏信息
  
  5. **达人ID视觉标记** (content.js:2185, 2408-2428, CSS)
     - **样式类**：`.creator-id-blacklisted`
     - **CSS定义** (v1.4增强)：
       ```css
       .creator-id-blacklisted {
         text-decoration: line-through !important;  /* 中间划线效果 */
         opacity: 0.25 !important;                  /* 降低到25%透明度 */
         color: inherit !important;
       }
       .creator-id-blacklisted:hover {
         text-decoration: line-through !important;  /* hover时保持隐藏效果 */
         opacity: 0.25 !important;
       }
       ```
     - **样式保护机制** (v1.4新增，三层防护)：
       - L1: 内联样式 - 直接设置`element.style.textDecoration`和`element.style.opacity`
       - L2: MutationObserver - 监听元素属性变化，自动恢复被修改的样式
       - L3: 事件监听 - 在mouseenter/mouseleave时主动重新应用样式
       ```javascript
       // 防止TikTok悬浮气泡覆盖隐藏样式
       idElement.style.textDecoration = 'line-through';
       idElement.style.opacity = '0.25';
       
       const styleObserver = new MutationObserver(() => {
         if (!idElement.style.textDecoration.includes('line-through')) {
           idElement.style.textDecoration = 'line-through';
         }
         if (idElement.style.opacity !== '0.25') {
           idElement.style.opacity = '0.25';
         }
       });
       
       idElement.addEventListener('mouseenter', () => {
         idElement.style.textDecoration = 'line-through';
         idElement.style.opacity = '0.25';
       }, true);
       ```
     - **效果**：被隐藏的达人ID显示为删除线并变淡，易于区分，且不会被第三方脚本或悬浮效果破坏
  
  6. **popup.js统计显示** (popup.js:151, 386-387, 2032-2040)
     - **加载隐藏列表**：在`loadData()`中读取`creatorBlacklist`数据
       ```javascript
       window.creatorBlacklist = Array.isArray(result.creatorBlacklist) 
         ? result.creatorBlacklist : [];
       ```
     - **动态计数显示**：
       ```javascript
       const blacklistCount = (window.creatorBlacklist || []).length;
       const blacklistText = blacklistCount > 0 
         ? `，已隐藏 ${blacklistCount} 个达人` : '';
       creatorPreview.textContent = 
         `${creators.length} 个达人已导入${blacklistText}`;
       ```
     - **UI更新**：在达人管理页面上方显示 `1451 个达人已导入，已隐藏 5 个达人`
     - **实时监听**：监听来自content.js的`blacklistUpdated`消息，自动刷新统计
       ```javascript
       chrome.runtime.onMessage.addListener((request, sender) => {
         if (request.action === 'blacklistUpdated') {
           // 重新加载隐藏列表数据并更新UI
           storageAPI.get(['creatorBlacklist'], result => {
             window.creatorBlacklist = Array.isArray(result.creatorBlacklist) 
               ? result.creatorBlacklist : [];
             renderCreators();
           });
         }
       });
       ```

- **工作流程总结**：
  1. ✅ **初始化阶段**：页面加载时，content.js执行初始化，注入样式和事件监听
  2. ✅ **识别阶段**：扫描页面中所有达人ID元素，验证是否为有效ID
  3. ✅ **注入阶段**：在每个达人ID旁边注入隐藏按钮，加载现有隐藏列表数据
  4. ✅ **样式同步**：将已隐藏的ID立即应用删除线和透明度样式，并激活三层防护机制
  5. ✅ **交互阶段**：用户点击按钮，触发隐藏/解除隐藏逻辑
  6. ✅ **存储阶段**：更改后的隐藏列表保存到`chrome.storage.local`
  7. ✅ **同步阶段**：发送消息给popup.js，更新统计显示
  8. ✅ **备份整合** (v1.4新增)：导出/导入备份时自动包含隐藏信息，WebDAV云端同步隐藏状态
  9. ✅ **持久化**：隐藏数据随浏览器关闭保存，刷新页面自动恢复

- **数据持久化特性**：
  - 隐藏数据存储在`chrome.storage.local`，浏览器本地化存储，关闭后保留
  - 支持跨标签页共享，一个标签页的隐藏操作通过消息机制立即影响其他标签页和popup
  - 与达人管理数据（`savedCreators`）分开存储，互不影响
  - 格式演进：自动将旧格式转换为新格式，确保向后兼容
  - **备份多通道** (v1.4新增)：
    - **本地备份**：通过导出按钮下载JSON备份文件，包含完整隐藏列表
    - **WebDAV云备份**：定期或手动上传到坚果云等WebDAV服务，实现多设备同步
    - **自动恢复**：导入备份或从云端恢复时，自动还原所有隐藏设置

## 开发者说明

### background.js 消息处理

扩展使用消息机制进行前后端通信，所有消息在 `handleMessage` 函数中处理：

```javascript
// popup.js / content.js 调用示例
const response = await chrome.runtime.sendMessage({ action: 'xxx', ...params });
```

#### 可用消息列表

| 消息 action | 参数 | 返回值 | 说明 |
|-------------|------|--------|------|
| `startOrderQuery` | `orderIds: string[]` | `{ success: true }` | 开始订单查询 |
| `stopOrderQuery` | - | `{ success: true }` | 停止订单查询 |
| `getOrderQueryStatus` | - | `OrderQueryState` | 获取订单查询状态 |
| `clearOrderQueryState` | - | `{ success: true }` | 清理订单查询状态 |
| `exportOrderData` | - | `{ success: true/false, error? }` | 导出订单数据为XLSX |
| `clearOrderData` | - | `{ success: true }` | 清理订单数据 |
| `exportExcel` | - | `{ success: true/false, error? }` | 导出达人CID为XLSX |
| `clearData` | - | `{ success: true }` | 清理达人数据 |
| `openTab` | `url: string` | `{ success: true, tabId }` | 打开新标签页 |
| `closeTab` | `tabId: number` | `{ success: true }` | 关闭标签页 |
| `startWaitingForCid` | `query: string, timeoutMs: number` | `{ success: true, cid, sourceUrl }` | 等待CID响应 |
| `installNetworkHook` | - | `{ success: true }` | 安装网络钩子 |
| `hookCandidates` | `url: string, candidates: string[]` | - | 接收CID候选 |
| `clickSampleRequestMenu` | - | `{ success: true/false }` | 点击样品申请菜单 |
| `clickCreatorMenu` | - | `{ success: true/false }` | 点击达人管理菜单 |

### 页面菜单自动点击功能

为确保在正确的页面执行操作，订单查询和批量查询功能实现了自动点击左侧菜单的功能。

#### clickSampleRequestMenu (样品申请菜单)
- **位置**: content.js:1386 (OrderAutomation 类)
- **功能**: 点击左侧菜单切换到样品申请页面
- **目标URL**: `affiliate.tiktokshopglobalselling.com/product/sample-request`
- **实现逻辑**:
  1. 使用多种选择器查找样品申请菜单元素
  2. 点击菜单后等待页面加载
  3. 等待URL变化确认页面切换成功

#### clickCreatorMenu (达人管理菜单)
- **位置**: content.js:1443 (OrderAutomation 类)
- **功能**: 点击左侧菜单切换到达人管理页面
- **目标URL**: `affiliate.tiktokshopglobalselling.com/connection/creator-management`
- **实现逻辑**:
  1. 使用多种选择器查找达人管理菜单元素
  2. 点击菜单后等待页面加载
  3. 等待URL变化确认页面切换成功

#### popup.js 菜单点击调用
- **位置**: popup.js:1740 (订单查询), popup.js:2868 (批量查询)
- **调用流程**:
  1. 检查当前页面URL是否为目标页面
  2. 如不是，发送消息点击对应菜单
  3. 等待2秒页面切换
  4. 重新检查content script是否准备好
  5. 继续执行后续操作

### XLSX 导出函数

#### generateXlsx(creators)
- **位置**: background.js:648
- **参数**: `creators` - 达人对象数组
- **返回**: `Uint8Array` - xlsx 文件的二进制数据
- **用途**: 生成达人CID的xlsx文件（带头像）

#### generateOrderXlsx(orders)
- **位置**: background.js:858
- **参数**: `orders` - 订单对象数组
- **返回**: `{ success: true, data: Uint8Array, filename: string }`
- **用途**: 生成订单数据的xlsx文件

#### downloadExcel(data, customFilename)
- **位置**: background.js:723
- **参数**: 
  - `data`: `Uint8Array` - xlsx 文件数据
  - `customFilename`: `string` - 自定义文件名（可选）
- **返回**: `Promise<void>`
- **用途**: 触发浏览器下载

### content.js 上下文安全方法

#### safeSendMessage(message)
- **位置**: content.js:1640 (TikTokShopCidExtractor 类)
- **参数**: `message` - 要发送的消息对象
- **用途**: 安全发送消息，捕获上下文失效异常

#### safeSendMessagePromise(message)
- **位置**: content.js:1650
- **参数**: `message` - 要发送的消息对象
- **返回**: `Promise` - 消息响应或错误响应
- **用途**: 安全发送需要等待响应的消息

### popup.js ExcelJS 导出函数

#### downloadOrderCSV(orders, progressCallback)
- **位置**: popup.js:1418
- **参数**:
  - `orders`: 订单数组
  - `progressCallback`: 进度回调函数
- **返回**: `{ success: true/false, error? }`
- **备注**: 目前主要通过 background.js 的 exportOrderData 调用

#### importCreatorsFromXlsx(file)
- **位置**: popup.js:588
- **参数**: `file` - xlsx 文件对象
- **用途**: 从 xlsx 文件导入达人数据

### storage 键值说明

| 键名 | 类型 | 说明 |
|------|------|------|
| `orderQueryState` | Object | 订单查询状态 |
| `orderQueryOrders` | Array | 订单查询结果 |
| `savedCreators` | Array | 已保存的达人数据 |
| `savedPhrases` | Array | 已保存的短语数据 |
| `phraseTags` | Array | 短语标签 |
| `creatorBlacklist` | Array | 达人黑名单 - 格式：`[{ id: string, blacklistedAt: number }, ...]` |

## 快速开始

### 安装扩展

1. 打开Chrome浏览器，访问 `chrome://extensions/`
2. 开启「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择项目文件夹

## 支持的网站

- tiktok.com
- ads.tiktok.com
- seller.tiktokshopglobalselling.com
- affiliate.tiktokshopglobalselling.com
- 所有HTTP/HTTPS网站

## 版本

当前版本: 1.4

## 更新日志

### v1.4 (2026-03-03)

#### 功能更新
- **达人隐藏功能UI优化与架构完善**
  - 将按钮符号从"✕"和"✓"改为更清晰的文字标签"隐藏"和"解除"
  - 调整按钮样式：红色表示"隐藏"操作，灰色表示"已隐藏"状态
  - 增加按钮宽度和内间距，提升用户体验
  - 改进CSS specificity防止TikTok悬浮气泡覆盖隐藏样式

- **隐藏信息与项目备份系统整合**
  - 隐藏信息集成到导出/导入功能中
  - 隐藏信息随其他数据一起备份和恢复
  - WebDAV云端备份包含完整的隐藏列表
  - 多设备之间隐藏状态自动同步
  - 清除所有数据时同时清除隐藏信息

- **元素样式保护增强**
  - 使用内联样式（element.style）覆盖外部CSS
  - 监听元素属性变化，自动恢复被修改的隐藏样式
  - 在mouseenter/mouseleave事件时主动重新应用样式
  - 防止第三方脚本或TikTok自身的样式变化破坏隐藏效果

#### 技术改进
- **备份系统数据结构扩展**
  - exportData()和importData()添加creatorBlacklist字段
  - WebDAV备份(backupToWebdav)包含隐藏信息
  - WebDAV恢复(restoreFromWebdav)恢复隐藏信息
  - 数据版本号保持1.0，保证向后兼容性

- **达人隐藏功能实现优化**
  - processCreatorIdElement()函数增强样式保护机制
  - 实现三层防护：内联样式、MutationObserver、事件监听
  - 防止样式被DOM更新或第三方脚本覆盖

- **代码文本统一**
  - 将所有用户界面文本"拉黑"改为"隐藏"
  - 将统计文本"已封锁"改为"已隐藏"
  - popup.js中已隐藏达人数量统计精确反映实时状态

#### 已知问题修复
- 修复页面刷新后已隐藏达人仍显示"✓"符号的问题
- 修复隐藏样式在元素hover时被TikTok悬浮气泡覆盖的问题

### v1.3 (2026-03-03)

#### 功能更新
- **达人隐藏管理功能**（新增）
  - 在达人列表中识别并标记达人ID元素，动态注入隐藏按钮
  - 点击达人ID旁的隐藏按钮，可将达人加入隐藏列表
  - 隐藏后达人ID显示中间划线（strikethrough）且透明度降至25%，视觉上易于区分
  - 再次点击可取消隐藏，ID恢复原样
  - 隐藏数据持久化存储在浏览器，即使关闭或重启浏览器也保留
  - 达人管理面板实时显示已隐藏达人数量：`1451 个达人已导入，已隐藏 5 个达人`
  - 支持跨标签页共享，一个标签页的隐藏操作立即影响其他标签页

- **全面支持 XLSX 格式导出**：将所有 CSV 导出功能改为 XLSX 格式
  - 订单查询导出：CSV → XLSX
  - 达人管理导入/导出：CSV → XLSX
  - 达人模板下载：CSV → XLSX
  - 视频封面导出：CSV → XLSX
  - CID查达人导出：CSV → XLSX

#### 技术改进
- **达人隐藏功能实现**：
  - 使用`MutationObserver`监听DOM变化，动态处理表格行的加载
  - 精确的CSS选择器和正则验证，确保只匹配达人ID（排除粉丝数等数字）
  - 消息机制实现popup与content.js之间的隐藏列表数据同步
  - 灵活的隐藏列表数据结构：`{ id: string, blacklistedAt: timestamp }`，支持格式演进
  - 隐藏列表与达人管理数据分离存储，互不影响

- **引入 ExcelJS 库**：使用 exceljs.min.js 库生成专业的 xlsx 格式文件
- **达人管理功能升级**：
  - 支持 XLSX 格式模板下载
  - 支持 XLSX 格式数据导入
  - 导入时支持增量更新（已存在的达人会自动更新信息）
- **UI 文本更新**：所有用户可见的"Excel"文本统一改为"XLSX"
- **XLSX 导出系统重构**：
  - 导出功能移至 background.js 处理，避免 popup 上下文失效导致的问题
  - 使用消息机制调用：`chrome.runtime.sendMessage({ action: 'exportOrderData' })`
  - 统一使用 `downloadExcel(data, customFilename)` 函数处理下载
  - 修复文件名问题：订单导出使用 `orders_日期.xlsx`，达人导出使用 `tiktok_cid_日期.xlsx`
  - 视频封面导出：改用实际缩略图比例动态计算行高，防止 720×1280 封面被挤压导致高度异常
  - 达人头像导出：改为ExcelJS库处理，动态读取原始图片尺寸，根据实际比例计算行高，保证头像显示比例正确
  - 修复“通过CID获取达人”批量查询启动错误：移除对当前活动标签和内容脚本的依赖，避免在无可用页面时触发异常
- **上下文失效处理**：
  - 在 TikTokShopCidExtractor 类中添加 `safeSendMessage` 和 `safeSendMessagePromise` 方法
  - 优雅处理 "Extension context invalidated" 错误

#### 已知问题修复
- 移除了未使用的短语 CSV 导入导出相关代码

### v1.2 (2026-02-28)

#### 新增功能
- **初始化应用按钮**：在"数据管理"卡片中添加了"初始化应用"按钮，用于重置第二个卡片（综合工具卡片）的功能状态
  - 清除订单查询状态、CID查询状态、视频封面状态、通过CID查达人状态
  - 重置内存态数据
  - 恢复输入界面
  - 清除所有面板的进度显示

#### 优化改进
- **前端状态实时更新**：修复了前端页面不更新的问题
  - 使用`chrome.storage.onChanged`监听器替代轮询机制
  - 即使popup失去焦点也能实时更新前端状态
  - 避免了因popup失去焦点导致的卡住问题
- **订单查询状态监听优化**：
  - background.js将查询状态实时写入`chrome.storage.local`
  - popup.js通过监听storage变化自动更新UI
  - 查询完成后自动下载XLSX文件并清理临时数据
  - 移除了依赖`pollOrderQueryStatus`函数的轮询机制

#### 技术改进
- **状态管理架构**：
  - background.js负责订单查询逻辑和状态管理
  - 使用`chrome.storage.local`作为状态共享机制
  - popup.js通过`chrome.storage.onChanged`监听状态变化
  - 实现了真正的前后端解耦和实时同步

#### 已知问题
- popup关闭后，`chrome.storage.onChanged`监听器会失效，需要重新打开popup才能继续监听
- 解决方案：考虑使用background.js作为状态中心，通过消息传递更新popup UI

#### 开发者说明
- **前端状态更新机制**：
  ```javascript
  // background.js - 更新状态
  chrome.storage.local.set({ orderQueryState: newState });
  
  // popup.js - 监听状态变化
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.orderQueryState) {
      const newState = changes.orderQueryState.newValue;
      // 更新UI
    }
  });
  ```
- **初始化应用功能**：
  - 只重置第二个卡片（综合工具卡片）的功能状态
  - 不影响短语、达人等其他数据
  - 通过`chrome.storage.remove()`清除相关数据
  - 重置内存态并恢复输入界面

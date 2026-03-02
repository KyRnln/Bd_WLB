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

#### 7. 用户界面优化
- **响应式设计**: 适配不同尺寸的弹窗界面
- **动画效果**: 使用CSS动画增强用户体验
- **选项卡切换**: 实现功能模块的选项卡切换
- **进度显示**: 实时显示长时间操作的进度

#### 8. 前后端状态同步机制 (v1.2新增)
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

当前版本: 1.3

## 更新日志

### v1.3 (2026-03-02)

#### 功能更新
- **全面支持 XLSX 格式导出**：将所有 CSV 导出功能改为 XLSX 格式
  - 订单查询导出：CSV → XLSX
  - 达人管理导入/导出：CSV → XLSX
  - 达人模板下载：CSV → XLSX
  - 视频封面导出：CSV → XLSX
  - CID查达人导出：CSV → XLSX

#### 技术改进
- **引入 ExcelJS 库**：使用 exceljs.min.js 库生成专业的 xlsx 格式文件
- **达人管理功能升级**：
  - 支持 XLSX 格式模板下载
  - 支持 XLSX 格式数据导入
  - 导入时支持增量更新（已存在的达人会自动更新信息）
- **UI 文本更新**：所有用户可见的"Excel"文本统一改为"XLSX"

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

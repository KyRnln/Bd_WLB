# 商务WLB插件

> 工作是为了更好的生活

## 项目简介

商务WLB插件是一款Chrome浏览器扩展程序，主要面向TikTok平台商家和创作者，帮助提升工作效率。

## 主要功能

### 达人管理
- 通过XLSX文件批量导入达人数据（ID、CID、地区、标签、备注）
- 达人标签管理：绩效达人、流失达人、隐藏达人
- 达人列表页面自动高亮显示：
  - 绩效达人：红色高亮
  - 流失达人：绿色半透明
  - 隐藏达人：灰色删除线
- IM页面达人ID旁显示标签
- 支持数据导出和云同步

### 快捷短语
- 在任意输入框输入 `/` 即可快速唤起短语选择器
- 支持短语分类标签管理
- 常用短语一键插入，提高回复效率

### AI翻译助手
- 点击IM页面输入框自动弹出翻译浮动框
- 支持多种大模型服务：通义千问、OpenAI、DeepSeek等
- 自定义目标语言
- 翻译结果自动复制到剪贴板
- 支持自定义翻译提示词

### 达人CID批量获取
- 输入达人ID（username）批量获取对应的CID
- 自动抓取达人头像
- 支持导出包含头像的Excel文件

### 通过CID查达人
- 输入达人CID批量查询对应的达人ID（username）
- 自动抓取达人头像
- 支持导出包含头像的Excel文件

### 视频封面获取
- 输入TikTok视频链接批量获取封面图片
- 支持封面预览
- 支持导出包含封面图片的Excel文件

### 订单查询与导出
- 通过订单ID查询达人履约情况
- 支持将查询结果导出为XLSX文件
- 方便数据分析和记录

### 本地数据存储
- 所有数据保存在浏览器本地存储中
- 支持数据导出和导入备份
- 支持WebDAV云同步

## 项目架构

```
Bd_WLB/
├── manifest.json                    # Chrome扩展配置文件 (Manifest V3)
├── background.js                    # 后台服务 Worker
├── content.js                       # 内容脚本 - 快捷短语功能
├── popup.html                       # 扩展弹窗界面
├── popup.js                         # 弹窗逻辑
├── page_bridge.js                   # 页面桥接脚本
│
├── Creator/                         # 达人管理模块
│   ├── creator.html                 # 达人管理页面
│   ├── creator.js                   # 达人管理逻辑
│   └── creator_highlight.js         # 达人高亮与隐藏内容脚本
│
├── translate/                       # AI翻译模块
│   ├── translate.html               # 翻译配置页面
│   ├── translate.js                 # 配置页面逻辑
│   └── translate_content.js         # 翻译浮动框内容脚本
│
├── phrase/                          # 短语管理模块
│   ├── phrase_manage.html           # 短语管理页面
│   └── phrase.js                    # 短语管理逻辑
│
├── username_avatarcid/              # 达人CID批量获取模块
│   ├── README.md
│   ├── username_avatarcid.html      # 前端页面
│   ├── username_avatarcid.js        # 前端逻辑
│   ├── username_avatarcid_background.js  # 后台模块
│   └── username_avatarcid_content.js     # 内容脚本
│
├── cid_to_name/                     # 通过CID查达人模块
│   ├── README.md
│   ├── cid_to_name.html
│   ├── cid_to_name.js
│   ├── cid_to_name_background.js
│   └── cid_to_name_content.js
│
├── cover/                           # 视频封面获取模块
│   ├── README.md
│   ├── cover.html
│   ├── cover.js
│   └── cover_background.js
│
├── order/                           # 订单查询模块
│   ├── README.md
│   ├── order.html
│   ├── order.js
│   ├── order_background.js
│   └── order_content.js
│
├── styles/                          # 样式文件
│   ├── base.css
│   ├── components.css
│   └── utilities.css
│
├── libs/                            # 第三方库
│   └── exceljs.min.js              # ExcelJS库
│
├── icon/                            # 扩展图标
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
│
└── README.md                        # 项目说明文档
```

## 模块架构

### 整体架构图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              用户界面层                                      │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │  popup.html │ │  cover.html │ │username_    │ │  order.html │           │
│  │  popup.js   │ │  cover.js   │ │avatarcid.js │ │  order.js   │           │
│  │             │ │             │ │cid_to_name  │ │             │           │
│  │ 主界面      │ │ 封面获取    │ │ CID获取/查询│ │ 订单查询    │           │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘           │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                           │
│  │creator.html │ │translate.   │ │phrase_      │                           │
│  │ creator.js  │ │html/js      │ │manage.html  │                           │
│  │ 达人管理    │ │ 翻译配置    │ │ 短语管理    │                           │
│  └─────────────┘ └─────────────┘ └─────────────┘                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              后台服务层                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  background.js (主后台)                                              │   │
│  │  - 消息路由中心                                                       │   │
│  │  - 网络请求Hook注入                                                   │   │
│  │  - 通用工具函数                                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  *_background.js (模块后台)                                          │   │
│  │  - username_avatarcid_background.js                                  │   │
│  │  - cid_to_name_background.js                                         │   │
│  │  - order_background.js                                               │   │
│  │  - cover_background.js                                               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              内容脚本层                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  content.js (主内容脚本)                                              │   │
│  │  - 快捷短语浮动选择器                                                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  *_content.js (模块内容脚本)                                          │   │
│  │  - creator_highlight.js (达人高亮与隐藏)                              │   │
│  │  - translate_content.js (翻译浮动框)                                  │   │
│  │  - username_avatarcid_content.js                                     │   │
│  │  - cid_to_name_content.js                                            │   │
│  │  - order_content.js                                                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 模块说明

| 模块 | 功能 | 文件 |
|------|------|------|
| **popup** | 主界面、数据管理 | popup.html, popup.js |
| **Creator** | 达人管理、高亮、隐藏 | Creator/* |
| **translate** | AI翻译助手配置与使用 | translate/* |
| **phrase** | 快捷短语管理 | phrase/* |
| **username_avatarcid** | 达人ID→CID批量获取 | username_avatarcid/* |
| **cid_to_name** | CID→达人ID批量查询 | cid_to_name/* |
| **cover** | TikTok视频封面获取 | cover/* |
| **order** | 订单履约查询 | order/* |

## 核心技术栈

- **Chrome扩展 API (Manifest V3)** - 使用最新的扩展规范
- **原生JavaScript ES6+** - 无框架依赖
- **HTML5 + CSS3** - 响应式界面设计
- **chrome.storage.local** - Chrome扩展本地存储API
- **ExcelJS** - 用于生成xlsx格式的Excel文件
- **MutationObserver** - 监听页面DOM变化

## 数据流

### 达人管理功能

```
用户导入XLSX → creator.js解析数据 → 存储到chrome.storage.local
                                              ↓
页面加载 → creator_highlight.js读取数据 → 匹配达人ID
                                              ↓
                                    应用高亮/隐藏样式
                                              ↓
                                    显示标签信息
```

### AI翻译功能

```
用户点击输入框 → translate_content.js监听 → 显示翻译浮动框
                                              ↓
用户输入文本 → 调用大模型API → 返回翻译结果
                                              ↓
                                    自动复制到剪贴板
```

### 快捷短语功能

```
用户输入 "/" → content.js监听 → 显示浮动选择器 → 用户选择 → 插入文本
                    ↑
              phrase.js管理数据
              (chrome.storage.local)
```

## 消息通信

扩展使用消息机制进行前后端通信：

```javascript
// 发送消息
const response = await chrome.runtime.sendMessage({ 
  action: 'xxx', 
  ...params 
});

// 监听消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'xxx') {
    // 处理逻辑
    sendResponse({ success: true });
  }
});
```

### 主要消息列表

| 消息 action | 说明 |
|-------------|------|
| `startBatchQuery` | 开始CID批量查询 |
| `startBatchQuery_cidToName` | 开始CID→达人ID查询 |
| `startOrderAutomation` | 开始订单查询 |
| `startCoverFetch` | 开始封面获取 |
| `exportExcel` | 导出达人数据 |
| `exportOrderData` | 导出订单数据 |
| `openTab` | 打开新标签页 |
| `closeTab` | 关闭标签页 |
| `creatorDataUpdated` | 达人数据更新通知 |

## 开发指南

### 环境要求

- Chrome浏览器 88+
- Node.js (可选，用于开发调试)

### 安装扩展

1. 打开Chrome浏览器，访问 `chrome://extensions/`
2. 开启"开发者模式"
3. 点击"加载已解压的扩展程序"
4. 选择项目根目录

### 添加新功能模块

1. 创建模块目录 `new_feature/`
2. 创建文件：
   - `new_feature.html` - 前端页面
   - `new_feature.js` - 前端逻辑
   - `new_feature_background.js` - 后台模块（如需要）
   - `new_feature_content.js` - 内容脚本（如需要）
   - `README.md` - 模块文档
3. 在 `manifest.json` 中注册content script
4. 在 `popup.html` 中添加导航按钮
5. 在 `popup.js` 中添加按钮事件

### 代码规范

- 使用ES6+语法
- 使用async/await处理异步操作
- 函数和变量使用驼峰命名
- 模块间通过消息通信，避免直接依赖

## 版本历史

### v1.5
- 新增AI翻译助手功能，支持多种大模型服务
- 达人管理：新增标签功能（绩效达人、流失达人、隐藏达人）
- 达人高亮：IM页面显示达人标签
- 达人隐藏：优化隐藏样式，支持通过标签管理
- 优化后台任务持久化，支持离开popup后继续执行

### v1.2
- 重构项目架构，模块化各功能
- 分离CID获取、CID查询、封面获取、订单查询为独立模块
- 优化代码结构，减少冗余

### v1.1
- 添加达人隐藏功能
- 添加WebDAV云同步支持
- 优化Excel导出功能

### v1.0
- 初始版本
- 快捷短语功能
- 订单查询功能
- CID批量获取功能

## 许可证

MIT License

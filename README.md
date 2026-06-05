# 商务WLB插件

> 工作是为了更好的生活

一款面向 TikTok Shop 商务运营人员的 Chrome 浏览器扩展（Manifest V3），集成达人管理、数据采集、AI 翻译、快捷短语等实用功能，提升日常工作自动化水平。

## 功能概览

### 达人管理

通过 XLSX 文件批量导入达人 ID，插件会在 TikTok Shop 达人页面自动匹配并高亮目标达人。支持按标签分类（绩效达人、复联达人、流失达人等），提供达人 CID、地区、备注等多维度信息管理，并可与飞书表格同步数据。

### 获取视频封面

批量输入 TikTok 视频链接，调用 TikTok oEmbed API 自动获取封面图片，支持导出包含封面的 Excel 文件。并发控制为最多 3 个请求同时进行。

### 获取头像/CID

通过达人用户名（username）批量获取对应的 CID 和头像。插件通过注入网络请求 Hook 自动捕获 API 响应中的 CID 数据，结果可导出为 Excel。

### CID 获取达人

反向查询功能，输入达人 CID 批量获取对应的用户名和头像。后台逐个打开达人详情页并提取信息，支持进度跟踪和结果导出。

### 订单履约情况

批量输入订单 ID，自动化查询 TikTok Shop 样品申请页面的订单详情，抓取达人 ID、产品 ID、订单状态等信息，使用 IndexedDB 暂存数据后导出 Excel。

### 封面获取（多维表格）

从飞书多维表格读取视频链接字段，自动获取 TikTok 视频封面并上传回表格，实现批量自动化处理。

### 样品申请采集

自动采集 TikTok Shop 样品申请页面的所有达人申请数据（达人名、达人 ID、申请产品 ID 等），支持上传至飞书多维表格。可配置飞书 App 凭证和表格信息，支持分页自动翻页采集。

### AI 翻译

集成多种 AI 翻译服务（通义千问、OpenAI、DeepSeek 及自定义 API），支持：
- **即时翻译**：独立页面输入文本快速翻译，支持多目标语言批量翻译
- **页面内翻译**：在任意网页的输入框中通过右键或快捷键 `Alt+Q` 触发翻译
- 可自定义提示词模板和目标语言列表

### 快捷短语

管理和快速插入常用文本短语，支持标签分类。在任意输入框中输入 `/` 触发短语选择器（快捷键 `Alt+Y`），选中后自动插入内容。

### 数据备份

支持本地 JSON 文件导出/恢复和 WebDAV 云端同步（如坚果云），确保数据安全。

## 项目结构

```
Bd_WLB/
├── manifest.json              # 扩展清单配置
├── background.js              # Service Worker 后台脚本
├── page_bridge.js             # 页面调试桥接脚本
├── popup.html                 # 弹出窗口主界面
├── popup.js                   # 弹出窗口逻辑
├── 数据预览.json              # 数据预览配置文件
├── icon/                      # 扩展图标
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
├── styles/                    # 样式文件
│   ├── base.css               # 基础样式与 CSS 变量
│   ├── components.css         # 组件样式
│   ├── content.css            # 注入页面的内容脚本样式
│   ├── modules.css            # 模块样式
│   └── utilities.css          # 工具类样式
├── libs/
│   └── exceljs.min.js         # ExcelJS 库
├── creator/
│   ├── creator.html           # 达人管理页面
│   ├── creator.js             # 达人管理逻辑
│   └── creator_highlight.js   # 页面达人高亮脚本
├── phrase/
│   ├── phrase.js              # 短语管理逻辑
│   ├── phrase_content.js      # 页面内短语选择器
│   ├── phrase_manage.html     # 短语管理页面
│   └── phrase_manage.js       # 短语管理页面逻辑
├── translate/
│   ├── translate.html         # 翻译配置页面
│   ├── translate.js           # 翻译配置逻辑
│   ├── translate_content.js   # 页面内翻译功能
│   ├── translate_now.html     # 即时翻译页面
│   └── translate_now.js       # 即时翻译逻辑
├── backup/
│   ├── backup.html            # 数据备份页面
│   └── backup.js              # 备份逻辑（含 WebDAV）
└── quick_module/
    ├── cover/                 # 视频封面获取
    │   ├── cover.html
    │   ├── cover.js
    │   ├── cover_background.js
    │   └── README.md
    ├── username_avatarcid/    # 头像/CID 获取
    │   ├── username_avatarcid.html
    │   ├── username_avatarcid.js
    │   ├── username_avatarcid_background.js
    │   ├── username_avatarcid_content.js
    │   └── README.md
    ├── cid_to_name/           # CID 查询达人
    │   ├── cid_to_name.html
    │   ├── cid_to_name.js
    │   ├── cid_to_name_background.js
    │   ├── cid_to_name_content.js
    │   └── README.md
    ├── order/                 # 订单履约查询
    │   ├── order.html
    │   ├── order.js
    │   ├── order_background.js
    │   ├── order_content.js
    │   └── order_hook.js
    ├── bitable_cover/         # 多维表格封面获取
    │   ├── bitable_cover.html
    │   ├── bitable_cover.js
    │   └── bitable_cover_background.js
    └── sample_crawl/          # 样品申请采集
        ├── sample_crawl.html
        ├── sample_crawl.js
        ├── sample_crawl_background.js
        ├── sample_crawl_content.js
        └── sample_crawl_hook.js
```

每个 `quick_module` 子模块通常包含：
- `*.html` — 功能界面
- `*.js` — 前端逻辑
- `*_background.js` — 后台任务调度（部分模块）
- `*_content.js` — 注入 TikTok 页面的内容脚本（部分模块）
- `*_hook.js` — 网络请求 Hook 脚本，用于拦截页面 API 响应（部分模块）

## 技术栈

| 类别 | 技术 |
|------|------|
| 扩展框架 | Chrome Extension Manifest V3 |
| 前端 | 原生 HTML / CSS / JavaScript |
| UI 设计 | Fluent Design 风格，CSS 自定义属性 |
| 数据存储 | Chrome Storage API / IndexedDB |
| Excel 导出 | ExcelJS |
| 飞书集成 | 飞书开放平台 API（电子表格 / 多维表格） |
| 云同步 | WebDAV 协议 |
| AI 翻译 | 通义千问 / OpenAI / DeepSeek 等兼容接口 |

## 安装方式

1. 下载或克隆本项目到本地
2. 打开 Chrome 浏览器，进入 `chrome://extensions/`
3. 开启右上角「开发者模式」
4. 点击「加载已解压的扩展程序」，选择 `Bd_WLB` 文件夹
5. 扩展图标将出现在浏览器工具栏

## 使用说明

1. 点击工具栏中的扩展图标打开主面板
2. **达人管理**：点击「达人管理」按钮，通过 XLSX 导入达人列表，支持按标签筛选和搜索
3. **工具功能**：点击对应功能按钮进入独立页面，输入数据后开始批量处理
4. **AI 翻译**：先在「翻译配置」中设置 API 密钥和模型，然后通过「即时翻译」或页面内快捷键使用
5. **快捷短语**：在「短语管理」中添加常用短语，在任意输入框中输入 `/` 即可快速插入
6. **数据备份**：在「数据备份」页面导出/恢复本地数据，或配置 WebDAV 实现云端同步

## 权限说明

| 权限 | 用途 |
|------|------|
| `activeTab` | 访问当前活动标签页 |
| `scripting` | 注入内容脚本 |
| `storage` | 存储用户配置和数据 |
| `downloads` | 导出 Excel 文件 |
| `tabs` | 管理后台标签页（批量查询） |

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Alt+Y` | 触发快捷短语选择器 |
| `Alt+Q` | 触发快捷翻译输入 |

## 注意事项

- 视频封面获取功能需要能够访问 TikTok 服务，部分地区可能需要使用 VPN
- 飞书相关功能需要配置飞书应用的 App ID 和 App Secret
- AI 翻译功能需要配置对应的 API Key
- 部分批量操作会自动打开/关闭标签页，请勿在操作过程中手动关闭相关页面

---

Powered by "电子恐龙" with AI

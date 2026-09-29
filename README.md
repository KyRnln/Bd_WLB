# 商务WLB插件（Bd_WLB）

[![CI](https://github.com/KyRnln/Bd_WLB/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/KyRnln/Bd_WLB/actions/workflows/ci.yml)

> 面向 TikTok Shop / Tokopedia 联盟（Affiliate）达人运营的浏览器扩展。一个插件完成：达人库自动高亮、订单履约批量查询、CID 与达人互查、视频封面抓取、AI 翻译、快捷短语与数据备份。

> 工作是为了更好的生活。

- 扩展名称：商务WLB插件
- 版本：1.7
- 清单版本：Manifest V3（Service Worker + ES Module）
- 适用浏览器：Chrome / Edge 等 Chromium 内核浏览器

## 目录

- [功能特性](#功能特性)
- [支持站点与作用域](#支持站点与作用域)
- [安装](#安装)
- [使用说明](#使用说明)
- [目录结构](#目录结构)
- [技术架构](#技术架构)
- [数据存储](#数据存储)
- [权限说明](#权限说明)
- [常见问题](#常见问题)
- [版本记录](#版本记录)

## 功能特性

| 模块 | 说明 | 入口 |
| --- | --- | --- |
| 达人管理 | 通过 XLSX 批量导入/维护达人库（达人ID、CID、地区、标签、备注），并在后台页面按标签自动高亮：绩效达人（红色）、流失达人（绿色+删除线）、隐藏达人（灰色+删除线），同时展示标签卡片与「隐藏/解除」按钮 | 扩展弹窗「达人管理」 |
| 订单履约查询 | 按订单号批量查询达人ID、产品ID、订单状态等履约信息，导出 XLSX | 弹窗「订单履约情况」 |
| 获取头像/CID | 通过达人ID批量获取对应 CID，并抓取达人头像，导出含头像的 XLSX | 弹窗「获取头像/CID」 |
| CID获取达人 | 通过达人 CID 批量反查达人ID（含头像），导出 XLSX | 弹窗「CID获取达人」 |
| 获取视频封面 | 输入 TikTok 视频链接，调用官方 oEmbed 接口批量获取封面图，导出 XLSX | 弹窗「获取视频封面」 |
| AI 翻译 | 配置大模型（通义千问 / OpenAI / DeepSeek / 自定义），在达人后台私信页（`/seller/im`）提供悬浮翻译 | 弹窗「AI翻译」 |
| 快捷短语 | 在任意页面输入框输入 `/` 触发短语面板，快速插入常用话术，支持标签分组 | 全局注入 |
| 数据备份 | 一键导出/导入扩展数据（达人库、短语、翻译配置等），支持 WebDAV（坚果云）同步 | 弹窗「数据管理」 |

## 支持站点与作用域

扩展通过 `manifest.json` 的 `host_permissions` 与 `content_scripts.matches` 决定生效范围。

| 内容脚本 | 生效页面 | 说明 |
| --- | --- | --- |
| `phrase/phrase_content.js` | 所有站点（`*://*/*`） | 快捷短语，`document_start`，含 iframe |
| `Creator/creator_highlight.js` | `affiliate.tiktokshopglobalselling.com/*`、`affiliate-id.tokopedia.com/*` | 达人列表/详情按达人库高亮 |
| `quick_module/username_avatarcid/username_avatarcid_content.js` | 同上 | 批量搜索达人并抓取 CID/头像 |
| `quick_module/order/order_content.js` | 同上 | 样品申请页表格自动化与抓取 |
| `quick_module/cid_to_name/cid_to_name_content.js` | `.../connection/creator/detail*`、`affiliate-id.tokopedia.com/*` | 达人详情页提取达人ID与头像 |
| `translate/translate_content.js` | `.../seller/im*`（两站） | 私信页悬浮翻译 |

当前支持的业务站点：

- TikTok Shop 达人后台：`https://affiliate.tiktokshopglobalselling.com`
- Tokopedia 达人后台：`https://affiliate-id.tokopedia.com`

模块内部会读取当前页面域名，跳转与目标页判断自动切换（TikTok ↔ Tokopedia），无需手动选择站点。

## 安装

1. 克隆或下载本仓库到本地。
2. 打开 `chrome://extensions`，右上角开启「开发者模式」。
3. 点击「加载已解压的扩展程序」，选择本项目根目录（含 `manifest.json` 的目录）。
4. 在浏览器工具栏点击插件图标打开弹窗开始使用。

更新代码后，需在 `chrome://extensions` 点击「重新加载」，并刷新目标网页。

## 使用说明

### 达人管理
- 点击弹窗「达人管理」进入管理页，点击导入按钮上传 XLSX。
- XLSX 列顺序：`达人ID`、`CID`、`地区`、`标签`、`备注`（首行为表头，后续行按顺序读取）。
- 标签取值：`绩效达人`、`流失达人`、`隐藏达人`。已存在的达人ID会被更新，不存在则新增。
- 导入后，在 TikTok Shop / Tokopedia 达人后台页面会自动匹配并高亮达人，可直接在页面上点「隐藏/解除」。

### 订单履约查询
1. 打开达人后台的样品申请页（`/affiliate/sample/sample-request` 或 TikTok 对应页面）并登录。
2. 弹窗进入「订单履约情况」，按行输入订单号，点击开始查询。
3. 查询完成后自动导出 XLSX（列：达人ID、产品ID、订单ID、状态、时间）。

### 获取头像/CID
- 需先打开达人后台的达人管理页面。
- 按行输入达人ID，批量搜索并抓取 CID 与头像，完成后导出 XLSX。

### CID获取达人
- 选择地区，按行输入 CID，批量打开达人详情页提取达人ID 与头像，完成后导出 XLSX。

### 获取视频封面
- 每行一个 TikTok 视频链接，插件并发（最多 3 个）调用 oEmbed 获取封面，支持导出含图片的 XLSX。

### AI 翻译
- 在「翻译配置」中选择服务商（通义千问 / OpenAI / DeepSeek / 自定义），填写 API URL、API Key、模型名与目标语言，可测试连通性。
- 配置完成后，在达人后台私信页（`/seller/im`）选中/聚焦输入框即可调用悬浮翻译。

### 快捷短语
- 在任意页面输入框键入 `/` 呼出短语面板，选择后插入文本；短语支持标签分组管理。

### 数据备份
- 「数据管理」中可导出 JSON 备份、导入恢复，或配置 WebDAV（坚果云）进行云端同步。

## 目录结构

```
Bd_WLB/
├── manifest.json                 # 扩展清单（MV3）
├── background.js                 # 后台 Service Worker，聚合各模块后台逻辑
├── popup.html / popup.js         # 扩展弹窗（功能入口与达人统计）
├── page_bridge.js                # 页面主世界调试桥
├── README.md                     # 本文档
├── icon/                         # 扩展图标
├── libs/                         # 第三方库（exceljs）
├── styles/                       # 公共样式（base/components/modules/utilities）
├── Creator/                      # 达人管理
│   ├── creator.html / creator.js
│   └── creator_highlight.js      # 达人高亮内容脚本
├── phrase/                       # 快捷短语
│   ├── phrase.js
│   ├── phrase_content.js
│   └── phrase_manage.html / phrase_manage.js
├── translate/                    # AI 翻译
│   ├── translate.html / translate.js
│   ├── translate_now.html / translate_now.js
│   └── translate_content.js
├── backup/                       # 数据备份/恢复（含 WebDAV）
│   └── backup.html / backup.js
└── quick_module/                 # 批量处理类功能
    ├── cover/                    # 视频封面
    │   └── cover.html / cover.js / cover_background.js / README.md
    ├── username_avatarcid/       # 达人ID → CID/头像
    │   └── ... / README.md
    ├── cid_to_name/              # CID → 达人ID
    │   └── ... / README.md
    └── order/                    # 订单履约查询
        └── ... / README.md
```

## 技术架构

扩展采用 Manifest V3 的三层结构：

- 用户界面层：弹窗（`popup.html`）与各功能独立页面，负责输入、进度展示与结果导出。
- 后台服务层：`background.js`（Service Worker，ESM）统一接收 `chrome.runtime.onMessage`，再分发给各模块后台（`order_background.js`、`cid_to_name_background.js`、`username_avatarcid_background.js`、`cover_background.js`），负责任务调度、标签页生命周期与数据导出。
- 内容脚本层：注入到目标站点页面，执行 DOM 自动化、数据抓取与页面增强。

批处理任务普遍采用「后台调度 + 内容脚本执行 + storage 状态轮询」的模式：后台逐条派发任务、内容脚本在页面执行并把结果写回，弹窗通过 `chrome.storage.onChanged` 实时刷新进度。

AI 翻译支持多家 OpenAI 兼容接口：

| 服务商 | 默认接口 | 默认模型 |
| --- | --- | --- |
| 通义千问 `qwen` | `https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions` | `qwen-mt-plus` |
| OpenAI `openai` | `https://api.openai.com/v1/chat/completions` | `gpt-4o-mini` |
| DeepSeek `deepseek` | `https://api.deepseek.com/v1/chat/completions` | `deepseek-chat` |
| 自定义 `custom` | 自行填写 | 自行填写 |

## 数据存储

### chrome.storage.local

| 键 | 内容 |
| --- | --- |
| `savedCreators` | 达人库：`{ creator_id, cid, region, tag, remark }` |
| `savedPhrases` / `savedTags` / `activeTagId` | 快捷短语与标签分组 |
| `creatorBlacklist` | 达人黑名单（隐藏达人） |
| `translateConfig` | 翻译配置：`{ provider, apiUrl, apiKey, modelName, targetLanguages, promptTemplate }` |
| `webdavConfig` | WebDAV（坚果云）同步配置 |
| `coverFetchState` / `coverFetchStatus` / `coverFetchResults` | 视频封面抓取状态与结果 |
| `batchSearchStatus` | 达人ID → CID/头像 批量任务状态 |
| `batchQueryState_cidToName` | CID → 达人ID 批量任务状态 |
| `orderQueryState` / `orderQueryOrders` | 订单查询任务状态与结果 |

### IndexedDB

| 数据库 | 用途 |
| --- | --- |
| `TikTokShopCreators` | 达人ID → CID 抓取结果与头像 |
| `TikTokCreatorDB` | CID → 达人ID 抓取结果 |
| `OrderQueryDB` | 订单履约查询结果 |

## 权限说明

| 权限 | 用途 |
| --- | --- |
| `activeTab` | 获取当前标签页以执行页面操作 |
| `scripting` | 注入脚本（如网络 Hook、内容脚本） |
| `storage` | 保存达人库、短语、配置与任务状态 |
| `downloads` | 导出 XLSX/JSON 文件 |
| `tabs` | 批量任务中创建/切换/关闭标签页 |

`host_permissions` 覆盖 TikTok / TikTok Shop / Tokopedia 达人后台等域名（含 `*://*/*` 以支持全局快捷短语）。

## 常见问题

- **达人高亮不生效**：确认已在 `chrome://extensions` 重新加载扩展并刷新页面；站点改版会变更页面 DOM，如某站点高亮失效，需同步更新 `Creator/creator_highlight.js` 中的选择器。
- **订单/批量查询无结果**：需已登录对应后台，且停留在正确的功能页面。
- **AI 翻译提示未配置**：先在「翻译配置」中填写 API Key 并测试连通后再使用。

## 版本记录

- **1.7**：新增 `affiliate-id.tokopedia.com` 站点作用域（权限 / 注入 / 资源）；达人高亮新增 Tokopedia 适配；订单、达人ID互查等模块的域名判断与跳转改为按当前站点自适应。

# 订单履约查询模块

## 功能概述

从飞书多维表格读取**履约状态为空**的记录，按达人ID逐个在 TikTok 联盟后台搜索样品申请数据，用**达人CID + 产品ID**严格匹配后，将订单号和履约状态回写到飞书多维表格对应的记录中。

## 文件结构

```
order/
├── order.html              # Popup 界面（飞书配置、统计、日志、操作按钮）
├── order.js                # Popup 主逻辑（飞书读取、逐条搜索、匹配、回写）
├── order_background.js     # Background 脚本（content script 注入管理、消息路由）
├── order_content.js        # Content Script（注入到 TikTok 页面，执行搜索、捕获API响应）
├── order_hook.js           # Hook 脚本（注入到 TikTok 页面 MAIN world，Hook fetch/XHR 拦截API响应）
└── README.md               # 本文件
```

## 核心数据流

```
飞书多维表格 ──读取──→ order.js ──过滤──→ 履约状态为空的记录
                                                │
                                    按达人ID分组，逐个达人处理
                                                │
                                        order.js 发消息
                                                │
                              order_background.js 确保 content script 已注入
                                                │
                              order_content.js 在 TikTok 页面搜索达人ID
                                                │
                              order_hook.js 拦截 API 响应，提取订单数据
                                                │
                              order_content.js 返回搜索结果（items[]）
                                                │
                              order.js 用 达人CID + 产品ID 严格匹配
                                                │
                                        匹配成功 → 回写飞书
                                        未匹配   → 跳过，不回写
```

## 详细执行流程

### 第一步：配置飞书

用户在 popup 界面配置：
- **App ID / App Secret**：飞书应用凭证
- **多维表格链接**：支持 `/base/` 和 `/wiki/` 格式，自动解析 Base Token 和 Table ID
- **字段名映射**：
  - 达人ID字段名（默认 `达人ID`）—— 用于 TikTok 搜索
  - 达人CID字段名（默认 `达人CID`）—— 用于匹配
  - 产品ID字段名（默认 `产品ID`）—— 用于匹配
  - 履约状态字段名（默认 `履约状态`）—— 空值表示待处理
  - 订单号字段名（默认 `订单号`）—— 回写目标

配置自动保存到 `chrome.storage.local`（key: `orderFeishuConfig`）。

### 第二步：读取飞书记录

1. 调用 `background.js` 中的 `listBitableRecords` 读取多维表格全部记录
2. 过滤出**履约状态字段为空**的记录（`filterPendingRecords`）
3. 按达人ID字段分组（`groupByCreatorName`）

### 第三步：逐个达人搜索

对每个达人的搜索流程：

1. **确保 content script 已注入**（`ensureContentScript`）
   - popup → `orderEnsureContentScript` → `order_background.js`
   - 检查 `ping` 是否响应，不响应则通过 `chrome.scripting.executeScript` 注入 `order_content.js`

2. **发送搜索请求**（`searchOneInTikTok`）
   - popup → `orderSearchOne` → `order_content.js`

3. **在 TikTok 页面执行搜索**（`searchOne` 函数）
   - 点击「全部」标签页
   - 找到搜索输入框
   - 填入达人ID，触发 Enter 搜索
   - 等待 3 秒，收集 API 响应

4. **API 响应捕获机制**
   - `order_hook.js`（MAIN world）Hook 了 `fetch` 和 `XMLHttpRequest`
   - 拦截目标 API：`/api/v1/affiliate/sample/group/list`
   - 拦截到响应后通过 `window.postMessage` 发送给 `order_content.js`
   - `order_content.js` 中 `isSearchWaiting` 优先级最高，确保 `searchOne` 期间的响应进入 `searchResponseBuffer`

5. **数据提取**（`cleanOrderData`）
   - 从 `json.agg_info` 中提取每条记录：
     - `creator_id` → 达人名称（来自 `creator_info.name`）
     - `creator_cid` → 达人CID（来自 `creator_info.creator_id`）
     - `product_id` → 产品ID
     - `order_id` → 订单号（`main_order_id`）
     - `order_status` → 履约状态（`curr_status` 映射为中文）

### 第四步：严格匹配

匹配逻辑（`matchTikTokItem`）：

```
TikTok 数据的 creator_cid + product_id
        ↕ 严格相等
飞书记录的 达人CID字段 + 产品ID字段
```

- **必须同时匹配** 达人CID 和 产品ID，缺一不可
- 任一字段为空则跳过（不回写）
- 匹配方向：**遍历 TikTok 获取到的每条数据，在该达人的飞书记录中查找**
- 同一条飞书记录不会被重复写入（`writtenRecordIds` 去重）

### 第五步：回写飞书

匹配成功后调用 `updateBitableRecord` 将以下字段写回飞书对应的记录：
- 订单号字段 ← TikTok 的 `order_id`
- 履约状态字段 ← TikTok 的 `order_status`（中文映射）

### 履约状态映射

| TikTok 状态码 | 中文 |
|:---:|:---:|
| 10 | 待审核 |
| 30 | 已发货 |
| 40 | 处理中 |
| 51 | 拒绝 |
| 53 | 逾期 |
| 100 | 已发布 |

## 消息流转

| 发送方 | Action | 接收方 | 说明 |
|:---|:---|:---|:---|
| order.js | `listBitableRecords` | background.js | 读取飞书全部记录 |
| order.js | `orderEnsureContentScript` | order_background.js | 确保 content script 注入 |
| order.js | `orderSearchOne` | order_content.js | 单条搜索达人 |
| order_content.js | `orderHookReady` | order_background.js | Hook 注入完成通知 |
| order_hook.js → order_content.js | `postMessage(apiResponse)` | — | API 响应捕获 |
| order.js | `updateBitableRecord` | background.js | 回写飞书记录 |
| order.js | `resolveWikiToken` | background.js | 解析 wiki 链接 |

## 使用步骤

1. 在 TikTok 联盟后台（`affiliate.tiktokshopglobalselling.com`）打开**样品申请**页面
2. 打开扩展 popup，进入「订单履约查询」
3. 展开「飞书多维表格配置」面板，填写配置信息，点击「解析」自动填入 Token
4. 点击「开始查询」
5. 扩展自动读取飞书 → 逐个达人搜索 TikTok → 匹配并回写
6. 实时查看日志面板了解每条记录的处理结果

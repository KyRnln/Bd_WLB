# 达人CID批量获取功能

## 功能概述

通过达人ID（username）批量获取对应的CID，并导出包含头像的Excel文件。

## 架构设计

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              用户界面层                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  username_avatarcid.html + username_avatarcid.js                    │   │
│  │  - 批量输入达人ID                                                     │   │
│  │  - 显示处理进度                                                       │   │
│  │  - 导出Excel结果                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              后台服务层                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  username_avatarcid_background.js                                    │   │
│  │  - 批量搜索任务调度                                                   │   │
│  │  - IndexedDB数据存储                                                  │   │
│  │  - 标签页管理（openTab/closeTab）                                     │   │
│  │  - CID等待与匹配                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  background.js                                                       │   │
│  │  - 网络请求Hook注入                                                   │   │
│  │  - 从API响应中提取CID候选数据                                          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              内容脚本层                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  username_avatarcid_content.js                                       │   │
│  │  - 搜索输入框操作                                                     │   │
│  │  - 触发搜索请求                                                       │   │
│  │  - 头像抓取                                                          │   │
│  │  - 接收网络Hook消息                                                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 文件结构

```
username_avatarcid/
├── README.md                        # 本文档
├── username_avatarcid.html          # 前端页面
├── username_avatarcid.js            # 前端逻辑
├── username_avatarcid_background.js # 后台模块
└── username_avatarcid_content.js    # 内容脚本
```

## 核心流程

### 单个达人CID获取流程

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   用户界面    │     │   后台服务    │     │   内容脚本    │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │
       │ 1. 输入达人ID       │                    │
       │───────────────────>│                    │
       │                    │                    │
       │                    │ 2. 创建新标签页     │
       │                    │───────────────────>│
       │                    │                    │
       │                    │                    │ 3. 安装网络Hook
       │                    │<───────────────────│
       │                    │                    │
       │                    │                    │ 4. 查找搜索输入框
       │                    │                    │    输入达人ID
       │                    │                    │    触发搜索
       │                    │                    │
       │                    │ 5. 等待CID响应     │
       │                    │<───────────────────│
       │                    │                    │
       │                    │ 6. 网络Hook捕获    │
       │    (API响应包含CID) │    API响应中的CID  │
       │                    │                    │
       │                    │ 7. 返回CID         │
       │                    │───────────────────>│
       │                    │                    │
       │                    │                    │ 8. 抓取头像
       │                    │                    │    保存结果
       │                    │                    │
       │                    │ 9. 关闭标签页      │
       │                    │<───────────────────│
       │                    │                    │
       │ 10. 返回结果        │                    │
       │<───────────────────│                    │
       │                    │                    │
```

### 批量处理流程

```
1. 用户输入多个达人ID（每行一个）
2. 点击"开始获取"按钮
3. 后台创建批量搜索任务
4. 依次处理每个达人ID：
   a. 打开新标签页
   b. 执行单个达人CID获取流程
   c. 关闭标签页
   d. 更新进度显示
5. 全部完成后导出Excel
```

## 组件详解

### 1. 前端 (username_avatarcid.js)

**职责：**
- 用户交互界面
- 批量任务状态轮询
- 结果展示与导出

**主要功能：**
```javascript
// 开始批量搜索
startBatchSearch(creatorIds)

// 轮询批量搜索状态
pollBatchStatus()

// 导出Excel
exportExcel()
```

### 2. 后台模块 (username_avatarcid_background.js)

**职责：**
- 批量任务调度
- 数据持久化存储
- 标签页生命周期管理
- CID等待与匹配

**CreatorDatabase 类：**
```javascript
class CreatorDatabase {
  async init()           // 初始化IndexedDB
  async store(data)      // 存储达人数据
  async getAll()         // 获取所有数据
  async clear()          // 清除数据
}
```

**消息处理：**

| Action | 说明 | 参数 |
|--------|------|------|
| `storeResult` | 存储单个达人结果 | `{ id, cid, url, avatarBase64 }` |
| `getStoredResults` | 获取所有存储的结果 | - |
| `clearData` | 清除所有数据 | - |
| `exportExcel` | 导出Excel | - |
| `openTab` | 打开新标签页 | `{ url }` |
| `closeTab` | 关闭标签页 | `{ tabId }` |
| `startBatchSearch` | 启动批量搜索 | `{ creatorIds }` |
| `getBatchSearchStatus` | 获取批量搜索状态 | - |
| `stopBatchSearch` | 停止批量搜索 | - |
| `clearBatchSearchStatus` | 清除批量搜索状态 | - |
| `startWaitingForCid` | 开始等待CID | `{ query, timeoutMs }` |
| `hookCandidates` | 处理CID候选数据 | `{ url, candidates }` |

### 3. 内容脚本 (username_avatarcid_content.js)

**职责：**
- 页面DOM操作
- 搜索触发
- 头像抓取
- 网络Hook消息转发

**TikTokShopCidExtractor 类：**
```javascript
class TikTokShopCidExtractor {
  init()                    // 初始化消息监听
  searchCreator(creatorId)  // 搜索达人并获取CID
  getAvatarBase64()         // 抓取头像
  findInputElement()        // 查找搜索输入框
  buildDetailUrl(cid)       // 构建详情页URL
}
```

**关键方法流程：**

```javascript
async searchCreator(creatorId) {
  // 1. 安装网络Hook
  await this.safeSendMessagePromise({ action: 'installNetworkHook' });
  
  // 2. 查找搜索输入框
  const input = await this.findInputElement();
  
  // 3. 开始等待CID（先启动等待，再触发搜索）
  const waitCidPromise = this.safeSendMessagePromise({
    action: 'startWaitingForCid',
    query: creatorId,
    timeoutMs: 20000
  });
  
  // 4. 输入达人ID并触发搜索
  this.setNativeInputValue(input, creatorId);
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
  
  // 5. 等待CID响应
  const waitRes = await waitCidPromise;
  
  // 6. 抓取头像
  const avatarBase64 = await this.getAvatarBase64();
  
  // 7. 保存结果
  await this.safeSendMessagePromise({ action: 'storeResult', data: {...} });
  
  // 8. 打开并关闭详情页（触发访问记录）
  const openRes = await this.safeSendMessagePromise({ action: 'openTab', url });
  await this.safeSendMessagePromise({ action: 'closeTab', tabId: openRes.tabId });
}
```

### 4. 网络Hook (background.js)

**职责：**
- 在页面主世界中注入脚本
- 拦截 fetch 和 XMLHttpRequest 请求
- 从API响应中提取CID候选数据

**注入脚本逻辑：**
```javascript
// 拦截fetch
const originalFetch = window.fetch;
window.fetch = async (...args) => {
  const response = await originalFetch.apply(window, args);
  cloneAndExtract(response.clone(), args[0]);
  return response;
};

// 提取CID候选
function extractCandidatesFromJson(json) {
  // 递归遍历JSON，提取所有包含cid的字段
  // 匹配达人名称进行评分
  // 通过postMessage发送到内容脚本
}
```

**CID候选数据格式：**
```javascript
{
  source: 'tt-cid-hook',
  type: 'candidates',
  url: 'https://...',
  candidates: [
    { cid: '7123456789012345678', name: 'creator_name' }
  ]
}
```

## 数据流

```
┌─────────────────────────────────────────────────────────────────┐
│                        数据存储                                  │
│                                                                 │
│  IndexedDB: 'TikTokCreatorDB'                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Store: 'creators'                                       │   │
│  │  {                                                       │   │
│  │    id: 'creator_username',                               │   │
│  │    cid: '7123456789012345678',                           │   │
│  │    url: 'https://affiliate.../detail?cid=...',           │   │
│  │    avatarBase64: 'data:image/jpeg;base64,...',           │   │
│  │    timestamp: 1234567890                                 │   │
│  │  }                                                       │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## 错误处理

| 错误类型 | 错误信息 | 处理方式 |
|----------|----------|----------|
| 找不到输入框 | 找不到搜索输入框，请确保页面已正确加载 | 标记失败，继续下一个 |
| 搜索超时 | 搜索达人 "xxx" 超时，可能该达人ID已更改或不存在 | 标记失败，继续下一个 |
| 等待CID失败 | 等待CID失败 | 标记失败，继续下一个 |
| 扩展上下文失效 | 扩展上下文已失效 | 提示用户刷新页面 |

## 使用要求

- 必须在 `affiliate.tiktokshopglobalselling.com` 域名下使用
- 需要登录TikTok Shop达人管理后台
- 建议在处理大量达人时不要操作浏览器

## 调试日志

在浏览器控制台中查看以下日志：

| 日志前缀 | 来源 | 说明 |
|----------|------|------|
| `[CID]` | 内容脚本 | 搜索、抓取、消息处理 |
| `[CID后台]` | 后台模块 | 任务调度、CID匹配、数据存储 |

## 性能优化

1. **并行处理限制**：同时只处理一个达人，避免页面冲突
2. **超时控制**：每个达人最多等待20秒
3. **资源清理**：处理完成后立即关闭标签页
4. **增量存储**：每获取一个达人结果立即存储，避免数据丢失

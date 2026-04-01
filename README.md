# 商务WLB插件

> 工作是为了更好的生活 - 面向 TikTok 平台商家和创作者的高效工作助手

[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-green)](https://chrome.google.com/webstore)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue)](https://developer.chrome.com/docs/extensions/mv3/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## ✨ 功能特性

### 📦 达人管理 (`Creator/`)
- 批量导入达人数据 (XLSX)
- 三种达人标签：**绩效达人**（红色）、**流失达人**（绿色+删除线）、**隐藏达人**（灰色+删除线）
- IM页面达人ID旁自动显示标签
- CSS类 + 内联样式双重保护，悬停不失活

### 💬 快捷短语 (`phrase/`)
- 输入 `/` 快速唤起短语选择器
- 分类标签管理，一键插入

### 📦 数据备份 (`backup/`)
- 本地 JSON 导出/导入
- WebDAV 云端同步（坚果云等）

### 🌐 AI翻译助手 (`translate/`)
- 点击输入框自动弹出翻译浮动框
- 支持通义千问、OpenAI、DeepSeek 等多模型
- 翻译结果自动复制

### 🔍 CID批量获取 (`username_avatarcid/`)
- 达人ID → CID 批量查询
- 自动抓取头像，导出Excel

### 🔎 CID查达人 (`cid_to_name/`)
- CID → 达人ID 批量查询
- 自动抓取头像，导出Excel

### 📋 视频封面获取 (`cover/`)
- TikTok链接 → 批量获取封面
- 封面预览 + 导出Excel

### 📊 订单履约查询 (`order/`)
- 订单ID → 达人履约情况
- 自动抓取达人ID、产品ID、订单状态
- 导出XLSX

## 🚀 快速开始

### 安装

1. 下载/克隆项目
2. 打开 Chrome → `chrome://extensions/`
3. 开启 **开发者模式**
4. 点击 **加载已解压的扩展程序**
5. 选择项目目录

### 使用

| 功能 | 入口位置 | 说明 |
|------|----------|------|
| 达人管理 | popup 达人管理 | 导入XLSX，自动高亮 |
| 快捷短语 | 任意输入框 | 输入 `/` 唤起 |
| AI翻译 | IM输入框 | 点击自动弹出 |
| CID获取 | popup | 输入达人ID列表 |
| CID查达人 | popup | 输入CID列表 |
| 封面获取 | popup | 输入视频链接 |
| 订单查询 | popup | 输入订单ID |

## 🏗️ 项目结构

```
Bd_WLB/
├── manifest.json                    # Chrome扩展配置 (Manifest V3)
├── background.js                    # 后台服务 / 消息路由
├── content.js                       # 内容脚本入口（模块化）
├── popup.html / popup.js            # 主界面
├── page_bridge.js                   # 页面桥接脚本
│
├── Creator/                         # 达人管理模块
│   ├── creator.html                 # 达人管理页面
│   ├── creator.js                   # 达人管理逻辑
│   └── creator_highlight.js         # 达人高亮与隐藏内容脚本
│
├── phrase/                          # 短语管理模块
│   ├── phrase_manage.html           # 短语管理页面
│   ├── phrase.js                    # 短语管理逻辑
│   └── phrase_content.js            # 快捷短语浮动选择内容脚本
│
├── backup/                          # 数据备份模块
│   ├── backup.html                  # 备份管理页面
│   └── backup.js                    # 备份逻辑
│
├── translate/                       # AI翻译模块
│   ├── translate.html               # 翻译配置页面
│   ├── translate.js                 # 配置逻辑
│   ├── translate_content.js         # 翻译浮动框内容脚本
│   ├── translate_now.html           # 快速翻译页面
│   └── translate_now.js             # 快速翻译逻辑
│
├── username_avatarcid/              # 达人ID→CID批量获取模块
│   ├── username_avatarcid.html
│   ├── username_avatarcid.js
│   ├── username_avatarcid_background.js
│   └── username_avatarcid_content.js
│
├── cid_to_name/                     # CID→达人ID批量查询模块
│   ├── cid_to_name.html
│   ├── cid_to_name.js
│   ├── cid_to_name_background.js
│   └── cid_to_name_content.js
│
├── cover/                           # 视频封面获取模块
│   ├── cover.html
│   ├── cover.js
│   └── cover_background.js
│
├── order/                           # 订单查询模块
│   ├── order.html
│   ├── order.js
│   ├── order_background.js
│   └── order_content.js
│
├── styles/                          # 样式文件
├── libs/                            # 第三方库 (ExcelJS)
└── icon/                            # 扩展图标
```

## 🛠️ 技术栈

- **Chrome Extension** (Manifest V3)
- **JavaScript ES6+** (原生，无框架)
- **chrome.storage.local** (本地存储)
- **ExcelJS** (Excel操作)
- **MutationObserver** (DOM监听)

## 📖 数据流

### 达人管理
```
导入XLSX → chrome.storage.local → creator_highlight.js → 页面高亮
```

### AI翻译
```
点击输入框 → 弹出浮动框 → 调用大模型API → 复制结果
```

### 快捷短语
```
输入 "/" → 显示短语选择器 → 选择插入
```

## 📄 许可证

[MIT License](LICENSE)

# 商务WLB插件

> 工作是为了更好的生活

## 项目简介

商务WLB插件是一款Chrome浏览器扩展程序，主要面向TikTok平台商家和创作者，帮助提升工作效率。

## 主要功能

### 快捷短语
- 在任意输入框输入 `/` 即可快速唤起短语选择器
- 支持短语分类标签管理
- 常用短语一键插入，提高回复效率

### 创作者管理
- 记录和管理TikTok创作者信息
- 快速查看和调用创作者数据

### 本地数据存储
- 所有数据保存在浏览器本地存储中
- 支持数据导出和导入备份

## 技术架构

```
├── manifest.json          # Chrome扩展配置文件 (Manifest V3)
├── content.js             # 内容脚本 - 实现页面短语选择器
├── popup.js/html          # 弹出窗口 - 管理短语和标签
├── background.js          # 后台服务 Worker
├── page_bridge.js         # 页面桥接脚本
├── phrase_manage.html     # 短语管理页面
└── migrate.js             # 数据迁移工具
```

### 技术栈
- Chrome扩展 API (Manifest V3)
- 原生JavaScript + HTML + CSS
- chrome.storage.local 本地数据存储

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

当前版本: 1.2

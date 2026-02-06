# 商务WLB插件（Chrome 扩展）

一款专为TikTok广告投放人员设计的Chrome扩展工具，集成了快捷短语输入、达人管理、订单查询等核心功能，帮助提升工作效率。

当前版本：**v1.1**

## 功能概览

### 🚀 核心功能
- **快捷短语**：输入 `/` 唤出浮动选择框，实时筛选预设短语，支持键盘/鼠标操作
- **达人管理**：CSV导入达人信息，支持搜索、编辑和备注管理
- **订单查询**：通过订单ID查询达人履约情况，支持批量查询和CSV导出
- **云端同步**：支持将达人信息和短语配置同步到阿里云ECS数据库，实现多设备数据共享

### ✨ 特色功能
- **智能备注**：页面自动显示达人备注，支持tooltip显示
- **实时高亮**：页面上自动高亮匹配的达人ID
- **专注搜索**：搜索时自动切换到全屏达人管理界面
- **现代化UI**：统一的蓝色主题和胶囊按钮设计

## 安装与加载
1) 打开 `chrome://extensions/`，开启右上角「开发者模式」。
2) 点击「加载已解压的扩展程序」，选择本项目根目录（含 `manifest.json`）。
3) 右上角扩展图标可打开弹窗进行各项功能管理。

## 云数据库设置（可选）

### 服务器端设置

#### 检查MariaDB安装状态
```bash
# 在ECS上执行
bash scripts/check_mariadb.sh
```

#### 配置MariaDB（如果尚未配置）
```bash
# 在ECS上执行
bash scripts/configure_mariadb.sh
```

#### 快速安装（如果尚未安装）
```bash
# 在ECS上执行
bash scripts/quick_setup.sh
```

#### 安装API服务器
```bash
# 上传API服务器文件到ECS
scp db_api_server.js package.json root@kyrnln.cloud:/opt/wlb-api/

# 在ECS上安装和启动API服务器
bash scripts/setup_api_server.sh
```

#### 或使用完整部署脚本
```bash
# 在ECS上执行（包含所有步骤）
bash scripts/deploy_cloud_service.sh
```

### 扩展配置
- 数据库已预配置为连接到 `kyrnln.cloud`
- 在扩展弹窗中点击「云端同步」按钮即可同步数据
- 支持达人信息和短语配置的双向同步

### 数据库信息
- **数据库类型**: MariaDB
- **服务器地址**: kyrnln.cloud:3306
- **数据库名**: wlb_extension
- **用户名**: root
- **密码**: fgs13990845071..
- **API地址**: http://kyrnln.cloud:3001

## 使用说明

### 快捷短语
- 在任意输入框、`textarea` 或可编辑区域输入 `/`，即刻弹出短语列表。
- 输入更多字符（光标后方）可实时缩小匹配范围。
- 上/下键或鼠标悬停高亮，Enter 插入；Esc 关闭。
- 插入后触发的 `/` 会被自动删除。

### 达人管理
- **CSV导入**：支持批量导入达人信息（ID、CID、地区、备注）
- **智能搜索**：实时搜索已导入的达人，支持模糊匹配
- **备注管理**：为每个达人添加详细备注信息
- **页面高亮**：自动在TikTok页面上高亮匹配的达人ID
- **一键跳转**：快速跳转到达人详情页面

### 订单查询
- **批量查询**：支持输入多个订单ID进行批量查询
- **进度显示**：实时显示查询和导出进度
- **CSV导出**：自动生成包含查询结果的CSV文件


## 达人导入模板（CSV）

支持以下字段（可选）：
- `creator_id` / `id`：达人ID（必填）
- `creator_cid` / `cid`：达人CID（可选）
- `region_code` / `region`：地区代码，如 MY/TH/ID/SG/PH/VN（可选）
- `remark`：备注信息（可选）

模板示例：

```csv
creator_id,creator_cid,region_code,remark
aeman_ruby,1234567890,MY,美妆达人，粉丝量不错
test_creator,9876543210,TH,测试账号
```


## 文件结构
```bash
├── manifest.json          # 扩展清单（MV3）
├── popup.html             # 弹窗 UI
├── popup.js               # 弹窗逻辑（功能管理）
├── db_sync.js             # 数据库同步模块
├── content.js             # 内容脚本（页面交互、备注显示）
├── background.js          # 后台脚本（预留）
├── page_bridge.js         # 页面桥接脚本
├── migrate.js             # 数据迁移脚本
├── db_api_server.js      # 云数据库API服务器
├── package.json           # API服务器依赖配置
├── scripts/                 # 部署脚本目录
│   ├── quick_setup.sh         # MariaDB快速安装脚本
│   ├── setup_api_server.sh   # API服务器安装脚本
│   ├── mariadb_setup.sh       # MariaDB详细安装脚本
│   ├── check_mariadb.sh       # MariaDB状态检查脚本
│   ├── configure_mariadb.sh   # MariaDB配置脚本
│   ├── check_nodejs.sh        # Node.js环境检查脚本
│   ├── setup_wlb_database.sh  # WLB数据库创建脚本
│   ├── deploy_cloud_service.sh # 完整云服务部署脚本
│   ├── fix_mariadb_config.sh  # MariaDB配置修复脚本
│   └── check_bind_address.sh  # bind-address检查脚本
├── icon16/32/48/128.png   # 扩展图标
└── README.md              # 说明文档
```

## 调试提示
- **弹窗调试**：右键扩展图标 →「检查弹出内容」查看 `popup.js` 日志。
- **页面交互**：页面 DevTools Console 查看 `content.js` 日志，必要时重新加载扩展。
- **达人搜索**：搜索不到达人时检查控制台输出，可能需要调整页面元素定位逻辑。
- **性能监控**：如遇卡顿，请检查MutationObserver和防抖机制的日志输出。

## 更新日志

### v1.2
- ☁️ **云数据库支持**：新增阿里云ECS MariaDB云存储功能
- 🔄 **数据同步**：支持达人信息和短语配置的云端双向同步
- 🌐 **多设备共享**：通过云数据库实现多设备间数据共享
- 🛠️ **API服务器**：内置RESTful API服务器用于数据管理

### v1.1
- 🎉 **版本升级**：主版本号升级至1.1，标志着产品功能的重大完善
- 🔧 **错误处理优化**：大幅改进错误诊断和用户体验
- 📱 **现代化UI设计**：统一的蓝色主题和胶囊按钮样式
- 🚀 **性能优化**：防抖机制和智能缓存，提升使用流畅度

### v1.0.7.1
- 🔍 优化达人搜索：专注模式，扩大显示区域
- 🐛 修复各种兼容性问题

### v1.0.7
- 🎯 达人管理功能重构
- 📝 支持备注字段
- 🎨 UI界面优化

### v1.0.6.1
- 📊 订单查询功能
- 👥 基础达人管理功能
- 💬 快捷短语功能

## 故障排除

### 502 Bad Gateway 错误
如果遇到 `502 Bad Gateway` 错误，说明API服务器未运行：

1. **检查ECS上服务状态**：
   ```bash
   pm2 status
   ```

2. **查看API日志**：
   ```bash
   pm2 logs wlb-api
   ```

3. **重启API服务**：
   ```bash
   pm2 restart wlb-api
   ```

4. **检查端口占用**：
   ```bash
   netstat -tlnp | grep 3001
   ```

### 数据库连接失败
1. **检查MariaDB服务**：
   ```bash
   systemctl status mariadb
   ```

2. **测试数据库连接**：
   ```bash
   mysql -h localhost -u root -p
   ```

### DNS解析问题
1. **测试域名解析**：
   ```bash
   nslookup kyrnln.cloud
   ```

2. **检查DNS配置**：确保域名正确指向ECS IP地址

## 许可证
MIT License
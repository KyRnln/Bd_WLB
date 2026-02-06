# WLB云服务部署脚本

这个文件夹包含了完整的WLB Chrome扩展云服务部署脚本集合。

## 📋 脚本说明

### 🔍 检查脚本
- **`check_mariadb.sh`** - 检查MariaDB安装和配置状态
- **`check_nodejs.sh`** - 检查Node.js环境和依赖
- **`check_bind_address.sh`** - 检查MariaDB bind-address配置

### ⚙️ 配置脚本
- **`configure_mariadb.sh`** - 完整配置MariaDB数据库
- **`fix_mariadb_config.sh`** - 修复MariaDB配置问题
- **`setup_wlb_database.sh`** - 创建WLB专用数据库和用户

### 🚀 安装脚本
- **`quick_setup.sh`** - MariaDB快速安装和配置
- **`mariadb_setup.sh`** - MariaDB详细安装脚本
- **`setup_api_server.sh`** - API服务器安装和配置

### 🎯 一键部署
- **`deploy_cloud_service.sh`** - 完整云服务一键部署脚本

## 🔄 使用流程

### 快速部署（推荐）
```bash
# 1. 上传脚本
scp scripts/deploy_cloud_service.sh root@kyrnln.cloud:~/

# 2. 执行一键部署
ssh root@kyrnln.cloud
./deploy_cloud_service.sh
```

### 手动部署
```bash
# 1. 检查MariaDB状态
./scripts/check_mariadb.sh

# 2. 配置MariaDB
./scripts/configure_mariadb.sh

# 3. 创建WLB数据库
./scripts/setup_wlb_database.sh

# 4. 检查Node.js环境
./scripts/check_nodejs.sh

# 5. 安装API服务器
./scripts/setup_api_server.sh
```

## 📁 文件传输

将脚本上传到ECS服务器：
```bash
# 上传单个脚本
scp scripts/check_mariadb.sh root@kyrnln.cloud:~/

# 上传所有脚本
scp -r scripts/ root@kyrnln.cloud:~/
```

## 🔧 故障排除

### MariaDB连接问题
```bash
./scripts/check_mariadb.sh
./scripts/fix_mariadb_config.sh
```

### Node.js环境问题
```bash
./scripts/check_nodejs.sh
```

### API服务器问题
```bash
pm2 status
pm2 logs wlb-api
```

## 📊 数据库信息

部署完成后：
- **数据库**: wlb_extension
- **用户**: root
- **密码**: fgs13990845071..
- **端口**: 3306
- **API地址**: http://kyrnln.cloud:3001

## 🎯 验证部署

```bash
# 测试数据库连接
mysql -h kyrnln.cloud -P 3306 -u root -p

# 测试API服务器
curl http://kyrnln.cloud:3001/health

# 检查服务状态
pm2 status
```
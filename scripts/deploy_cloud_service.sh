#!/bin/bash

# WLB云服务完整部署脚本
# 在ECS上执行此脚本完成所有配置

echo "=== WLB云服务完整部署 ==="

# 1. 安装MariaDB
echo "步骤1: 安装MariaDB..."
if command -v apt &> /dev/null; then
    apt update && apt install -y mariadb-server
elif command -v yum &> /dev/null; then
    yum install -y mariadb-server mariadb
elif command -v dnf &> /dev/null; then
    dnf install -y mariadb-server mariadb
fi

# 启动服务
systemctl start mariadb 2>/dev/null || service mysql start
systemctl enable mariadb 2>/dev/null || chkconfig mysql on

# 配置数据库
echo "步骤2: 配置数据库..."
mysql -u root << 'EOF'
CREATE DATABASE IF NOT EXISTS wlb_extension CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'wlb_user'@'%' IDENTIFIED BY 'wlb_password_2024!';
GRANT ALL PRIVILEGES ON wlb_extension.* TO 'wlb_user'@'%';
FLUSH PRIVILEGES;

USE wlb_extension;
CREATE TABLE IF NOT EXISTS creators (
    id INT AUTO_INCREMENT PRIMARY KEY,
    creator_id VARCHAR(100) NOT NULL UNIQUE,
    creator_cid VARCHAR(100),
    region_code VARCHAR(10),
    remark TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS phrases (
    id INT AUTO_INCREMENT PRIMARY KEY,
    category VARCHAR(50) DEFAULT 'general',
    phrase_text TEXT NOT NULL,
    shortcut VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
EOF

# 配置远程访问
sed -i 's/bind-address.*/bind-address = 0.0.0.0/' /etc/mysql/mariadb.conf.d/50-server.cnf 2>/dev/null || sed -i '/^\[mysqld\]$/a bind-address = 0.0.0.0' /etc/my.cnf 2>/dev/null

# 重启服务
systemctl restart mariadb 2>/dev/null || service mysql restart

echo "步骤3: 配置防火墙..."
# 配置防火墙
ufw allow 3306/tcp 2>/dev/null || firewall-cmd --permanent --add-port=3306/tcp 2>/dev/null && firewall-cmd --reload 2>/dev/null || iptables -I INPUT -p tcp --dport 3306 -j ACCEPT 2>/dev/null

# 2. 安装Node.js API服务器
echo "步骤4: 安装Node.js和API服务器..."

# 检查Node.js
if ! command -v node &> /dev/null; then
    echo "安装Node.js..."
    # 使用NodeSource仓库
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
fi

echo "Node.js版本: $(node --version)"
echo "npm版本: $(npm --version)"

# 安装PM2
if ! command -v pm2 &> /dev/null; then
    echo "安装PM2..."
    npm install -g pm2
fi

# 创建应用目录
mkdir -p /opt/wlb-api
cd /opt/wlb-api

echo "步骤5: 安装依赖..."
npm init -y
npm install express mysql2 cors express-rate-limit

# 复制API服务器文件 (需要先上传)
echo "请确保已上传 db_api_server.js 文件到 /opt/wlb-api/ 目录"

# 配置防火墙 (API端口)
ufw allow 3001/tcp 2>/dev/null || firewall-cmd --permanent --add-port=3001/tcp 2>/dev/null && firewall-cmd --reload 2>/dev/null || iptables -I INPUT -p tcp --dport 3001 -j ACCEPT 2>/dev/null

echo "步骤6: 启动API服务器..."
pm2 start db_api_server.js --name wlb-api
pm2 save
pm2 startup

echo ""
echo "=== 部署完成！ ==="
echo ""
echo "服务信息："
echo "- MariaDB数据库: kyrnln.cloud:3306"
echo "- API服务器: http://kyrnln.cloud:3001"
echo "- 健康检查: http://kyrnln.cloud:3001/health"
echo ""
echo "常用命令："
echo "- 查看服务状态: pm2 status"
echo "- 查看API日志: pm2 logs wlb-api"
echo "- 重启API服务: pm2 restart wlb-api"
echo ""
echo "测试连接："
echo "- 数据库: mysql -h localhost -u wlb_user -p wlb_extension"
echo "- API: curl http://localhost:3001/health"
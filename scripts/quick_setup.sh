#!/bin/bash
# 一键安装MariaDB for WLB扩展

# 检测系统并安装MariaDB
if command -v apt &> /dev/null; then
    apt update && apt install -y mariadb-server
elif command -v yum &> /dev/null; then
    yum install -y mariadb-server mariadb
elif command -v dnf &> /dev/null; then
    dnf install -y mariadb-server mariadb
fi

# 启动服务
systemctl start mariadb 2>/dev/null || service mysql start

# 配置数据库
mysql -u root << 'EOF'
CREATE DATABASE wlb_extension CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'wlb_user'@'%' IDENTIFIED BY 'wlb_password_2024!';
GRANT ALL PRIVILEGES ON wlb_extension.* TO 'wlb_user'@'%';
FLUSH PRIVILEGES;

USE wlb_extension;
CREATE TABLE creators (
    id INT AUTO_INCREMENT PRIMARY KEY,
    creator_id VARCHAR(100) NOT NULL UNIQUE,
    creator_cid VARCHAR(100),
    region_code VARCHAR(10),
    remark TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE phrases (
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

# 配置防火墙
ufw allow 3306/tcp 2>/dev/null || firewall-cmd --permanent --add-port=3306/tcp 2>/dev/null && firewall-cmd --reload 2>/dev/null || iptables -I INPUT -p tcp --dport 3306 -j ACCEPT 2>/dev/null

echo "MariaDB安装完成！连接信息："
echo "Host: kyrnln.cloud"
echo "Port: 3306"
echo "Database: wlb_extension"
echo "Username: wlb_user"
echo "Password: wlb_password_2024!"
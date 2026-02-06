#!/bin/bash

# MariaDB 安装和配置脚本 for Aliyun ECS
# 用于WLB Chrome扩展的数据存储

echo "=== 开始安装MariaDB服务器 ==="

# 检查操作系统
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
    VERSION=$VERSION_ID
    echo "检测到操作系统: $OS $VERSION"
else
    echo "无法检测操作系统类型"
    exit 1
fi

# 更新系统包
echo "更新系统包..."
if command -v apt &> /dev/null; then
    # Ubuntu/Debian
    apt update && apt upgrade -y
    apt install -y curl wget gnupg2 software-properties-common
elif command -v yum &> /dev/null; then
    # CentOS/RHEL
    yum update -y
    yum install -y curl wget
elif command -v dnf &> /dev/null; then
    # Fedora/Alibaba Cloud Linux
    dnf update -y
    dnf install -y curl wget
else
    echo "不支持的包管理器"
    exit 1
fi

# 安装MariaDB
echo "安装MariaDB..."
if command -v apt &> /dev/null; then
    # Ubuntu/Debian
    apt install -y mariadb-server mariadb-client
elif command -v yum &> /dev/null || command -v dnf &> /dev/null; then
    # CentOS/RHEL/Fedora
    if [ "$OS" = "alinux" ] || [ "$OS" = "anolis" ]; then
        # Alibaba Cloud Linux
        dnf install -y mariadb-server mariadb
    else
        # 标准CentOS/RHEL
        curl -LsS https://downloads.mariadb.com/MariaDB/mariadb_repo_setup | bash
        if command -v dnf &> /dev/null; then
            dnf install -y MariaDB-server MariaDB-client
        else
            yum install -y MariaDB-server MariaDB-client
        fi
    fi
fi

# 启动MariaDB服务
echo "启动MariaDB服务..."
if command -v systemctl &> /dev/null; then
    systemctl start mariadb
    systemctl enable mariadb
else
    service mysql start
    chkconfig mysql on
fi

# 等待服务启动
sleep 5

# 运行安全安装脚本
echo "配置MariaDB安全设置..."
mysql_secure_installation << EOF

n
y
y
y
y
EOF

# 创建WLB数据库和用户
echo "创建WLB数据库和用户..."
mysql -u root -p << 'MYSQL_EOF'
-- 创建数据库
CREATE DATABASE IF NOT EXISTS wlb_extension DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 创建用户
CREATE USER IF NOT EXISTS 'wlb_user'@'%' IDENTIFIED BY 'wlb_password_2024!';

-- 授予权限
GRANT ALL PRIVILEGES ON wlb_extension.* TO 'wlb_user'@'%';

-- 刷新权限
FLUSH PRIVILEGES;

-- 创建达人信息表
USE wlb_extension;

CREATE TABLE IF NOT EXISTS creators (
    id INT AUTO_INCREMENT PRIMARY KEY,
    creator_id VARCHAR(100) NOT NULL UNIQUE,
    creator_cid VARCHAR(100),
    region_code VARCHAR(10),
    remark TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 创建短语配置表
CREATE TABLE IF NOT EXISTS phrases (
    id INT AUTO_INCREMENT PRIMARY KEY,
    category VARCHAR(50) DEFAULT 'general',
    phrase_text TEXT NOT NULL,
    shortcut VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX idx_creator_id ON creators(creator_id);
CREATE INDEX idx_region_code ON creators(region_code);
CREATE INDEX idx_phrase_category ON phrases(category);

MYSQL_EOF

# 配置MariaDB允许远程连接
echo "配置远程连接..."
MYSQL_CONF="/etc/mysql/mariadb.conf.d/50-server.cnf"
if [ -f "$MYSQL_CONF" ]; then
    # Ubuntu/Debian
    sed -i 's/bind-address.*/bind-address = 0.0.0.0/' $MYSQL_CONF
elif [ -f "/etc/my.cnf" ]; then
    # CentOS/RHEL
    sed -i '/^\[mysqld\]$/a bind-address = 0.0.0.0' /etc/my.cnf
fi

# 重启MariaDB服务
echo "重启MariaDB服务..."
if command -v systemctl &> /dev/null; then
    systemctl restart mariadb
else
    service mysql restart
fi

# 配置防火墙
echo "配置防火墙..."
if command -v ufw &> /dev/null; then
    # Ubuntu
    ufw allow 3306/tcp
    ufw reload
elif command -v firewall-cmd &> /dev/null; then
    # CentOS/RHEL 7+
    firewall-cmd --permanent --add-port=3306/tcp
    firewall-cmd --reload
elif command -v iptables &> /dev/null; then
    # 旧版系统
    iptables -I INPUT -p tcp --dport 3306 -j ACCEPT
    if command -v service &> /dev/null; then
        service iptables save
    fi
fi

echo "=== MariaDB安装完成 ==="
echo ""
echo "数据库信息："
echo "- 数据库名: wlb_extension"
echo "- 用户名: wlb_user"
echo "- 密码: wlb_password_2024!"
echo "- 端口: 3306"
echo ""
echo "表结构："
echo "- creators: 存储达人信息"
echo "- phrases: 存储短语配置"
echo ""
echo "请在Chrome扩展中使用以下连接信息："
echo "Host: kyrnln.cloud"
echo "Port: 3306"
echo "Database: wlb_extension"
echo "Username: wlb_user"
echo "Password: wlb_password_2024!"
echo ""
echo "测试连接: mysql -h kyrnln.cloud -P 3306 -u wlb_user -p wlb_extension"
#!/bin/bash

echo "=== MariaDB配置脚本 ==="

# 检查root用户是否已设置密码
echo "1. 检查MySQL root用户状态..."
if mysql -u root -e "SELECT 1;" 2>/dev/null; then
    echo "✅ Root用户可以使用无密码连接"
    HAS_ROOT_PASSWORD=false
else
    echo "❌ Root用户需要密码或无法连接"
    HAS_ROOT_PASSWORD=true
fi

echo ""

# 运行安全安装（如果需要）
if [ "$HAS_ROOT_PASSWORD" = false ]; then
    echo "2. 运行MySQL安全安装..."
    mysql_secure_installation << EOF

n
y
y
y
y
EOF
fi

echo ""

# 创建WLB数据库和用户
echo "3. 创建WLB数据库和用户..."
mysql -u root -p << 'MYSQL_EOF'
-- 创建数据库
CREATE DATABASE IF NOT EXISTS wlb_extension DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 创建用户
CREATE USER IF NOT EXISTS 'wlb_user'@'%' IDENTIFIED BY 'wlb_password_2024!';

-- 授予权限
GRANT ALL PRIVILEGES ON wlb_extension.* TO 'wlb_user'@'%';

-- 刷新权限
FLUSH PRIVILEGES;

-- 使用数据库并创建表
USE wlb_extension;

-- 创建达人信息表
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
CREATE INDEX IF NOT EXISTS idx_creator_id ON creators(creator_id);
CREATE INDEX IF NOT EXISTS idx_region_code ON creators(region_code);
CREATE INDEX IF NOT EXISTS idx_phrase_category ON phrases(category);

-- 显示创建结果
SHOW TABLES;
SELECT COUNT(*) as creators_count FROM creators;
SELECT COUNT(*) as phrases_count FROM phrases;
MYSQL_EOF

echo ""

# 配置远程访问
echo "4. 配置远程访问..."
MYSQL_CONF="/etc/mysql/mariadb.conf.d/50-server.cnf"
if [ -f "$MYSQL_CONF" ]; then
    echo "配置MariaDB配置文件：$MYSQL_CONF"
    # 备份原配置
    cp "$MYSQL_CONF" "${MYSQL_CONF}.backup.$(date +%Y%m%d_%H%M%S)"

    # 修改bind-address
    sed -i 's/^bind-address.*/bind-address = 0.0.0.0/' "$MYSQL_CONF"

    echo "✅ 已配置bind-address = 0.0.0.0"
elif [ -f "/etc/my.cnf" ]; then
    echo "配置MySQL配置文件：/etc/my.cnf"
    # 备份原配置
    cp "/etc/my.cnf" "/etc/my.cnf.backup.$(date +%Y%m%d_%H%M%S)"

    # 添加bind-address配置
    if ! grep -q "^bind-address" /etc/my.cnf; then
        sed -i '/^\[mysqld\]$/a bind-address = 0.0.0.0' /etc/my.cnf
        echo "✅ 已添加bind-address = 0.0.0.0"
    else
        sed -i 's/^bind-address.*/bind-address = 0.0.0.0/' /etc/my.cnf
        echo "✅ 已修改bind-address = 0.0.0.0"
    fi
else
    echo "❌ 未找到标准配置文件，请手动配置bind-address = 0.0.0.0"
fi

echo ""

# 重启MariaDB服务
echo "5. 重启MariaDB服务..."
if systemctl restart mariadb 2>/dev/null; then
    echo "✅ MariaDB服务重启成功"
elif systemctl restart mysql 2>/dev/null; then
    echo "✅ MySQL服务重启成功"
elif service mysql restart 2>/dev/null; then
    echo "✅ MySQL服务重启成功"
else
    echo "❌ 服务重启失败，请手动重启"
fi

# 等待服务启动
sleep 3

echo ""

# 配置防火墙
echo "6. 配置防火墙..."
if command -v ufw &> /dev/null; then
    echo "使用UFW防火墙..."
    ufw allow 3306/tcp
    ufw reload
    echo "✅ 已开放3306端口"
elif command -v firewall-cmd &> /dev/null; then
    echo "使用firewalld防火墙..."
    firewall-cmd --permanent --add-port=3306/tcp
    firewall-cmd --reload
    echo "✅ 已开放3306端口"
elif command -v iptables &> /dev/null; then
    echo "使用iptables..."
    iptables -I INPUT -p tcp --dport 3306 -j ACCEPT
    if command -v service &> /dev/null; then
        service iptables save 2>/dev/null
    fi
    echo "✅ 已开放3306端口"
else
    echo "ℹ️  未检测到防火墙管理工具，请手动开放3306端口"
fi

echo ""

# 测试配置
echo "7. 测试配置..."
echo "测试数据库连接..."
if mysql -u wlb_user -p'wlb_password_2024!' -h localhost -e "USE wlb_extension; SHOW TABLES;" 2>/dev/null; then
    echo "✅ 数据库配置成功"
else
    echo "❌ 数据库配置测试失败"
fi

echo ""
echo "=== MariaDB配置完成 ==="
echo ""
echo "数据库信息："
echo "- 数据库名: wlb_extension"
echo "- 用户名: wlb_user"
echo "- 密码: wlb_password_2024!"
echo "- 端口: 3306"
echo ""
echo "测试命令："
echo "- 本地连接: mysql -u wlb_user -p wlb_extension"
echo "- 远程连接: mysql -h kyrnln.cloud -P 3306 -u wlb_user -p wlb_extension"
echo ""
echo "下一步：运行API服务器配置脚本"
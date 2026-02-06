#!/bin/bash

echo "=== 创建WLB数据库和用户 ==="

# 创建WLB数据库和用户
mysql -u root << 'MYSQL_EOF'
-- 创建数据库
CREATE DATABASE IF NOT EXISTS wlb_extension DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 创建用户
CREATE USER IF NOT EXISTS 'wlb_user'@'%' IDENTIFIED BY 'wlb_password_2024!';

-- 授予权限
GRANT ALL PRIVILEGES ON wlb_extension.* TO 'wlb_user'@'%';
GRANT CREATE, ALTER, DROP, INSERT, UPDATE, DELETE, SELECT ON wlb_extension.* TO 'wlb_user'@'%';

-- 刷新权限
FLUSH PRIVILEGES;

-- 显示用户信息
SELECT User, Host FROM mysql.user WHERE User = 'wlb_user';

-- 显示数据库
SHOW DATABASES LIKE 'wlb_extension';
MYSQL_EOF

echo ""

# 创建表结构
echo "创建WLB表结构..."
mysql -u root -e "
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

-- 显示表结构
SHOW TABLES;
DESCRIBE creators;
DESCRIBE phrases;
"

echo ""

# 测试连接
echo "测试WLB用户连接..."
if mysql -u wlb_user -p'wlb_password_2024!' -e "USE wlb_extension; SHOW TABLES;" 2>/dev/null; then
    echo "✅ WLB数据库和用户创建成功"
else
    echo "❌ WLB数据库创建失败"
fi

echo ""
echo "=== WLB数据库设置完成 ==="
echo ""
echo "数据库信息："
echo "- 数据库名: wlb_extension"
echo "- 用户名: wlb_user"
echo "- 密码: wlb_password_2024!"
echo "- 远程连接测试: mysql -h kyrnln.cloud -P 3306 -u wlb_user -p wlb_extension"
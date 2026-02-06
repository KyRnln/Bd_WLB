#!/bin/bash

echo "=== 修复MariaDB配置 ==="

# 1. 检查当前bind-address设置
echo "1. 检查bind-address配置..."
if [ -f /etc/my.cnf ]; then
    echo "当前 /etc/my.cnf 配置："
    grep -A5 -B5 "bind-address\|^\[mysqld\]" /etc/my.cnf || echo "未找到bind-address设置"
else
    echo "❌ 未找到配置文件"
fi

echo ""

# 2. 修复bind-address
echo "2. 配置bind-address为0.0.0.0..."
if [ -f /etc/my.cnf ]; then
    # 备份配置文件
    cp /etc/my.cnf /etc/my.cnf.backup.$(date +%Y%m%d_%H%M%S)

    # 检查是否已有bind-address设置
    if grep -q "^bind-address" /etc/my.cnf; then
        # 修改现有设置
        sed -i 's/^bind-address.*/bind-address = 0.0.0.0/' /etc/my.cnf
        echo "✅ 已修改bind-address = 0.0.0.0"
    else
        # 添加新设置
        sed -i '/^\[mysqld\]$/a bind-address = 0.0.0.0' /etc/my.cnf
        echo "✅ 已添加bind-address = 0.0.0.0"
    fi
else
    echo "❌ 配置文件不存在"
fi

echo ""

# 3. 启动firewalld并开放端口
echo "3. 配置防火墙..."
if command -v systemctl &> /dev/null; then
    # 启动firewalld
    systemctl start firewalld
    systemctl enable firewalld

    # 开放3306端口
    firewall-cmd --permanent --add-port=3306/tcp
    firewall-cmd --reload

    echo "✅ 已启动firewalld并开放3306端口"
else
    echo "❌ systemctl不可用"
fi

echo ""

# 4. 重启MariaDB服务
echo "4. 重启MariaDB服务..."
if systemctl restart mariadb 2>/dev/null; then
    echo "✅ MariaDB服务重启成功"
elif systemctl restart mysql 2>/dev/null; then
    echo "✅ MySQL服务重启成功"
else
    echo "❌ 服务重启失败"
fi

# 等待服务启动
sleep 3

echo ""

# 5. 验证配置
echo "5. 验证配置..."
echo "检查端口监听："
netstat -tlnp | grep :3306 || ss -tlnp | grep :3306 || echo "❌ 3306端口未监听"

echo ""
echo "检查防火墙："
firewall-cmd --list-ports | grep 3306 || echo "❌ 3306端口未开放"

echo ""

# 6. 测试远程连接
echo "6. 测试远程连接..."
if mysql -u root -h localhost -e "SELECT VERSION();" 2>/dev/null; then
    echo "✅ 本地连接正常"
else
    echo "❌ 本地连接失败"
fi

echo ""
echo "=== 配置修复完成 ==="
echo ""
echo "测试远程连接命令："
echo "mysql -h kyrnln.cloud -P 3306 -u root -p"
echo ""
echo "如果仍无法连接，请检查阿里云ECS安全组是否开放3306端口"
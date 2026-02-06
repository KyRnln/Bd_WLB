#!/bin/bash

echo "=== 检查MariaDB bind-address配置 ==="

# 检查当前配置文件
echo "1. 检查配置文件内容..."
if [ -f /etc/my.cnf ]; then
    echo "当前 /etc/my.cnf 中的bind-address设置："
    grep -A2 -B2 "bind-address\|^\[mysqld\]" /etc/my.cnf
else
    echo "❌ 未找到 /etc/my.cnf"
fi

echo ""

# 检查MariaDB进程监听的地址
echo "2. 检查MariaDB实际监听地址..."
netstat -tlnp | grep mysqld || ss -tlnp | grep mysqld

echo ""

# 检查是否有skip-networking设置
echo "3. 检查skip-networking设置..."
if [ -f /etc/my.cnf ]; then
    if grep -q "skip-networking" /etc/my.cnf; then
        echo "❌ 发现skip-networking设置，这会阻止网络连接"
    else
        echo "✅ 未发现skip-networking设置"
    fi
fi

echo ""

# 建议的修复方法
echo "4. 修复建议："
echo "如果bind-address未设置为0.0.0.0，请运行："
echo "sed -i '/^\[mysqld\]$/a bind-address = 0.0.0.0' /etc/my.cnf"
echo "systemctl restart mariadb"
echo ""
echo "如果有skip-networking设置，请注释掉："
echo "sed -i 's/^skip-networking/#skip-networking/' /etc/my.cnf"
echo "systemctl restart mariadb"
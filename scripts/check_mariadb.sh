#!/bin/bash

echo "=== MariaDB安装状态检查 ==="

# 检查MariaDB服务状态
echo "1. 检查MariaDB服务状态："
if systemctl is-active --quiet mariadb 2>/dev/null; then
    echo "✅ MariaDB服务正在运行"
    systemctl status mariadb --no-pager -l | head -10
elif systemctl is-active --quiet mysql 2>/dev/null; then
    echo "✅ MySQL服务正在运行"
    systemctl status mysql --no-pager -l | head -10
else
    echo "❌ MariaDB/MySQL服务未运行"
    echo "尝试启动服务..."
    systemctl start mariadb 2>/dev/null || systemctl start mysql 2>/dev/null || service mysql start
fi

echo ""

# 检查MariaDB版本
echo "2. 检查MariaDB版本："
mysql --version 2>/dev/null || mariadb --version 2>/dev/null || echo "❌ 未找到MariaDB/MySQL客户端"

echo ""

# 检查端口监听
echo "3. 检查端口监听："
netstat -tlnp | grep :3306 || ss -tlnp | grep :3306 || echo "❌ 3306端口未监听"

echo ""

# 检查数据库连接
echo "4. 测试数据库连接："
if mysql -u root -e "SELECT VERSION();" 2>/dev/null; then
    echo "✅ 可以连接到数据库"
else
    echo "❌ 无法连接到数据库（需要配置）"
fi

echo ""

# 检查配置文件
echo "5. 检查配置文件："
if [ -f /etc/mysql/mariadb.conf.d/50-server.cnf ]; then
    echo "✅ 找到MariaDB配置文件：/etc/mysql/mariadb.conf.d/50-server.cnf"
    grep -E "(bind-address|port)" /etc/mysql/mariadb.conf.d/50-server.cnf | grep -v "^#" || echo "   配置文件看起来是默认设置"
elif [ -f /etc/my.cnf ]; then
    echo "✅ 找到MySQL配置文件：/etc/my.cnf"
    grep -E "(bind-address|port)" /etc/my.cnf | grep -v "^#" || echo "   配置文件看起来是默认设置"
else
    echo "❌ 未找到标准配置文件"
fi

echo ""

# 检查防火墙
echo "6. 检查防火墙设置："
if command -v ufw &> /dev/null; then
    ufw status | grep 3306 || echo "❌ UFW防火墙未开放3306端口"
elif command -v firewall-cmd &> /dev/null; then
    firewall-cmd --list-ports | grep 3306 || echo "❌ firewalld未开放3306端口"
else
    echo "ℹ️  未检测到防火墙管理工具"
fi

echo ""
echo "=== 检查完成 ==="
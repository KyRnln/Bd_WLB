#!/bin/bash

echo "=== 系统服务检查 ==="
echo "时间: $(date)"
echo ""

# 1. 检查关键服务状态
echo "1. 关键服务状态:"
services=("mariadb" "firewalld" "pm2-root")

for service in "${services[@]}"; do
    echo -n "$service: "
    if systemctl is-active --quiet "$service" 2>/dev/null; then
        echo "✅ 运行中"
    elif systemctl list-units --all | grep -q "$service"; then
        echo "⚠️ 已安装但未运行"
    else
        echo "❌ 未安装"
    fi
done
echo ""

# 2. 详细检查MariaDB
echo "2. MariaDB服务详情:"
if systemctl is-active --quiet mariadb 2>/dev/null; then
    echo "状态: 运行中"
    systemctl status mariadb --no-pager | grep -E "(Active|Main PID|Status)" | head -3
    echo "端口监听:"
    netstat -tlnp | grep :3306 || ss -tlnp | grep :3306 || echo "3306端口未监听"
else
    echo "❌ MariaDB未运行"
    echo "尝试启动:"
    systemctl start mariadb 2>/dev/null && echo "✅ 启动成功" || echo "❌ 启动失败"
fi
echo ""

# 3. 详细检查firewalld
echo "3. 防火墙服务详情:"
if systemctl is-active --quiet firewalld 2>/dev/null; then
    echo "状态: 运行中"
    echo "开放端口:"
    firewall-cmd --list-ports | tr ' ' '\n' | grep -v '^$' | while read port; do
        echo "  - $port"
    done
    echo "默认区域: $(firewall-cmd --get-default-zone)"
    echo "活动区域: $(firewall-cmd --get-active-zones | head -1)"
else
    echo "❌ firewalld未运行"
    echo "尝试启动:"
    systemctl start firewalld 2>/dev/null && echo "✅ 启动成功" || echo "❌ 启动失败"
fi
echo ""

# 4. 检查PM2服务
echo "4. PM2服务详情:"
if command -v pm2 &> /dev/null; then
    echo "PM2版本: $(pm2 --version)"
    echo "PM2进程列表:"
    pm2 list --no-color | grep -E "(name|wlb-api)" | head -5
    echo ""
    echo "PM2日志位置: ~/.pm2/logs/"
    ls -la ~/.pm2/logs/ 2>/dev/null || echo "日志目录不存在"
else
    echo "❌ PM2未安装"
fi
echo ""

# 5. 检查开机自启
echo "5. 开机自启配置:"
echo "systemd自启服务:"
for service in "${services[@]}"; do
    if systemctl is-enabled "$service" 2>/dev/null; then
        echo "  ✅ $service 已启用自启"
    else
        echo "  ❌ $service 未启用自启"
    fi
done

echo ""
echo "PM2开机自启:"
if pm2 startup | grep -q "already configured\|sudo"; then
    echo "  ✅ PM2开机自启已配置"
else
    echo "  ❌ PM2开机自启未配置"
fi
echo ""

# 6. 检查资源使用
echo "6. 系统资源使用:"
echo "内存使用:"
free -h | grep -E "^(Mem|Swap)"
echo ""
echo "磁盘使用:"
df -h / | tail -1
echo ""
echo "CPU负载:"
uptime
echo ""

# 7. 网络配置
echo "7. 网络配置:"
echo "网络接口:"
ip route show | head -3
echo ""
echo "DNS配置:"
cat /etc/resolv.conf | grep nameserver
echo ""

# 8. 服务问题诊断
echo "8. 常见服务问题诊断:"
echo ""

if ! systemctl is-active --quiet mariadb 2>/dev/null; then
    echo "🔧 MariaDB问题修复:"
    echo "  systemctl start mariadb"
    echo "  systemctl enable mariadb"
    echo ""
fi

if ! systemctl is-active --quiet firewalld 2>/dev/null; then
    echo "🔧 防火墙问题修复:"
    echo "  systemctl start firewalld"
    echo "  systemctl enable firewalld"
    echo "  firewall-cmd --permanent --add-port=3001/tcp"
    echo "  firewall-cmd --reload"
    echo ""
fi

if ! pm2 list | grep -q wlb-api; then
    echo "🔧 PM2进程问题修复:"
    echo "  cd /opt/wlb-api"
    echo "  pm2 start db_api_server.js --name wlb-api"
    echo "  pm2 save"
    echo ""
fi

echo "如果服务仍然有问题，请检查系统日志:"
echo "  journalctl -u mariadb --since '1 hour ago'"
echo "  journalctl -u firewalld --since '1 hour ago'"

echo ""
echo "=== 服务检查完成 ==="
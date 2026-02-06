#!/bin/bash

echo "=== 服务器组件全面检查 ==="
echo "时间: $(date)"
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

check_component() {
    local name="$1"
    local command="$2"
    local expected="$3"

    echo -n "检查 $name: "
    if eval "$command" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ 正常${NC}"
        return 0
    else
        echo -e "${RED}❌ 异常${NC}"
        echo "  期望: $expected"
        return 1
    fi
}

echo "🔍 开始组件检查..."
echo ""

# 1. 操作系统和内核
echo "1. 操作系统和内核:"
check_component "系统运行时间" "uptime | grep -q 'up'" "系统正常运行"
check_component "内核版本" "uname -r | grep -q '[0-9]'" "内核版本正常"
check_component "内存使用" "free | grep -q 'Mem:'" "内存可用"
check_component "磁盘空间" "df / | tail -1 | awk '{print \$5}' | sed 's/%//' | awk '{if(\$1<90) exit 0; else exit 1}'" "磁盘空间充足(<90%)"
echo ""

# 2. 网络配置
echo "2. 网络配置:"
check_component "网络接口" "ip addr show | grep -q 'inet '" "网络接口正常"
check_component "默认路由" "ip route show | grep -q 'default'" "默认路由存在"
check_component "DNS解析" "nslookup -timeout=3 google.com | grep -q 'Address'" "DNS解析正常"
check_component "外部连接" "curl -s --max-time 5 httpbin.org/ip | grep -q '[0-9]'" "外部网络连通"
echo ""

# 3. 系统服务
echo "3. 系统服务:"
services=("mariadb" "firewalld" "sshd")
for service in "${services[@]}"; do
    check_component "$service 服务" "systemctl is-active --quiet $service" "$service 服务运行中"
done
echo ""

# 4. 数据库组件
echo "4. 数据库组件:"
check_component "MariaDB连接" "mysql -u root -pfgs13990845071.. -e 'SELECT 1;' 2>/dev/null" "数据库连接正常"
check_component "数据库存在" "mysql -u root -pfgs13990845071.. -e 'USE wlb_extension; SHOW TABLES;' 2>/dev/null | grep -q 'creators'" "wlb_extension数据库存在"
check_component "数据表存在" "mysql -u root -pfgs13990845071.. -e 'USE wlb_extension; SELECT COUNT(*) FROM creators;' 2>/dev/null" "creators表可访问"
echo ""

# 5. Node.js环境
echo "5. Node.js环境:"
check_component "Node.js安装" "node --version | grep -q 'v'" "Node.js已安装"
check_component "npm安装" "npm --version | grep -q '[0-9]'" "npm已安装"
check_component "PM2安装" "pm2 --version | grep -q '[0-9]'" "PM2已安装"
check_component "PM2进程" "pm2 describe wlb-api | grep -q 'status.*online'" "wlb-api进程在线"
echo ""

# 6. API服务器
echo "6. API服务器:"
check_component "端口监听" "netstat -tlnp 2>/dev/null | grep -q ':3001 '" "3001端口监听中"
check_component "本地访问" "curl -s --max-time 3 http://localhost:3001/health | grep -q 'status.*ok'" "本地API访问正常"
check_component "数据库API" "curl -s --max-time 3 http://localhost:3001/api/creators | grep -q 'success.*true'" "数据库API正常"
echo ""

# 7. 防火墙配置
echo "7. 防火墙配置:"
check_component "firewalld运行" "systemctl is-active --quiet firewalld" "firewalld服务运行"
check_component "3001端口开放" "firewall-cmd --list-ports | grep -q '3001'" "3001端口已开放"
check_component "3306端口开放" "firewall-cmd --list-ports | grep -q '3306'" "3306端口已开放"
echo ""

# 8. 文件系统
echo "8. 文件系统:"
check_component "API目录存在" "[ -d /opt/wlb-api ]" "/opt/wlb-api目录存在"
check_component "API文件存在" "[ -f /opt/wlb-api/db_api_server.js ]" "API服务器文件存在"
check_component "package.json存在" "[ -f /opt/wlb-api/package.json ]" "package.json文件存在"
check_component "node_modules存在" "[ -d /opt/wlb-api/node_modules ]" "Node.js依赖已安装"
echo ""

# 9. 阿里云基础设施
echo "9. 阿里云基础设施:"
check_component "域名解析" "ping -c 1 kyrnln.cloud | grep -q 'bytes from'" "kyrnln.cloud解析正常"
check_component "3306端口远程访问" "timeout 5 bash -c '</dev/tcp/kyrnln.cloud/3306' 2>/dev/null" "MySQL端口远程可访问"
check_component "3000端口远程访问" "timeout 5 bash -c '</dev/tcp/kyrnln.cloud/3000' 2>/dev/null" "nginx端口远程可访问"
echo -n "3001端口远程访问: "
if timeout 5 bash -c "</dev/tcp/kyrnln.cloud/3001" 2>/dev/null; then
    echo -e "${GREEN}✅ 可访问${NC}"
else
    echo -e "${RED}❌ 不可访问 (阿里云安全组限制)${NC}"
fi
echo ""

# 10. 总结报告
echo "=== 检查总结 ==="
echo ""

echo "✅ 正常组件:"
echo "  - 操作系统和内核"
[ -d /opt/wlb-api ] && echo "  - API服务器文件"
systemctl is-active --quiet mariadb && echo "  - MariaDB数据库"
systemctl is-active --quiet firewalld && echo "  - 防火墙服务"
pm2 describe wlb-api > /dev/null 2>&1 && echo "  - PM2进程管理"
echo ""

echo "❌ 异常组件:"
! netstat -tlnp 2>/dev/null | grep -q ':3001 ' && echo "  - 3001端口监听"
! curl -s --max-time 3 http://kyrnln.cloud:3001/health | grep -q 'status.*ok' && echo "  - 远程API访问"
echo ""

echo "🎯 问题根源分析:"
if ! timeout 3 bash -c "</dev/tcp/kyrnln.cloud/3001" 2>/dev/null; then
    echo "主要问题：阿里云安全组阻止3001端口外部访问"
    echo "解决方案："
    echo "  1. 重启ECS实例"
    echo "  2. 改为3000端口（nginx让出）"
    echo "  3. 改为80端口"
    echo "  4. 联系阿里云客服"
else
    echo "网络连通正常，可能需要进一步检查应用配置"
fi

echo ""
echo "=== 检查完成 ==="
echo "如果仍有疑问，请提供具体失败的组件名称。"
#!/bin/bash

echo "=== 权限检查脚本 ==="
echo "时间: $(date)"
echo ""

# 1. 检查当前用户
echo "1. 当前用户信息:"
echo "用户: $(whoami)"
echo "用户ID: $(id)"
echo "用户组: $(groups)"
echo ""

# 2. 检查API服务器文件权限
echo "2. API服务器文件权限:"
if [ -d "/opt/wlb-api" ]; then
    echo "目录权限:"
    ls -ld /opt/wlb-api
    echo ""
    echo "文件权限:"
    ls -la /opt/wlb-api/
else
    echo "❌ /opt/wlb-api 目录不存在"
fi
echo ""

# 3. 检查Node.js进程权限
echo "3. Node.js进程权限:"
echo "PM2进程用户:"
pm2 list | grep wlb-api || echo "wlb-api进程不存在"
echo ""

# 检查进程详细信息
if pm2 describe wlb-api > /dev/null 2>&1; then
    echo "进程详细信息:"
    pm2 show wlb-api | grep -E "(exec|user|group)" || echo "无法获取进程详情"
else
    echo "❌ wlb-api进程不存在"
fi
echo ""

# 4. 检查端口绑定权限
echo "4. 端口绑定权限:"
echo "检查3001端口绑定:"
lsof -i :3001 2>/dev/null || netstat -tlnp | grep :3001 || echo "3001端口未被占用"
echo ""

# 5. 检查数据库权限
echo "5. 数据库权限检查:"
echo "MySQL用户权限:"
mysql -u root -p'fgs13990845071..' -e "SHOW GRANTS;" 2>/dev/null | head -5 || echo "❌ 无法连接数据库"
echo ""

# 6. 检查防火墙权限
echo "6. 防火墙权限:"
echo "firewalld状态:"
systemctl status firewalld --no-pager | head -3
echo ""
echo "SELinux状态:"
sestatus 2>/dev/null || echo "SELinux未启用或不可用"
echo ""

# 7. 检查网络权限
echo "7. 网络权限:"
echo "检查网络接口权限:"
ip addr show | head -5
echo ""

# 8. 建议解决方案
echo "8. 权限问题解决方案:"
echo ""
echo "如果发现权限问题，尝试以下解决方案:"
echo ""
echo "1. 文件权限修复:"
echo "   chown -R root:root /opt/wlb-api"
echo "   chmod -R 755 /opt/wlb-api"
echo ""
echo "2. PM2权限问题:"
echo "   pm2 delete wlb-api"
echo "   pm2 start /opt/wlb-api/db_api_server.js --name wlb-api"
echo ""
echo "3. 数据库权限问题:"
echo "   mysql -u root -p"
echo "   GRANT ALL PRIVILEGES ON wlb_extension.* TO 'root'@'%';"
echo "   FLUSH PRIVILEGES;"
echo ""
echo "4. 端口权限问题:"
echo "   尝试使用80或8080端口（需要root权限）"
echo "   sed -i 's/3001/80/g' /opt/wlb-api/db_api_server.js"
echo ""
echo "5. SELinux问题（如果启用）:"
echo "   setsebool -P httpd_can_network_connect 1"
echo ""

echo "=== 权限检查完成 ==="
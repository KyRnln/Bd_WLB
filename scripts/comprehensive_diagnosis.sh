#!/bin/bash

echo "=== 全面诊断脚本 ==="
echo "时间: $(date)"
echo ""

# 1. 基本网络信息
echo "1. 网络信息检查:"
echo "本机公网IP: $(curl -s ifconfig.me || curl -s ipinfo.io/ip || echo '获取失败')"
echo "ECS内网IP: $(hostname -I | awk '{print $1}')"
echo "域名解析: $(ping -c 1 kyrnln.cloud 2>/dev/null | head -1 | awk '{print $3}' | tr -d '()')"
echo ""

# 2. API服务器状态
echo "2. API服务器状态:"
echo -n "进程状态: "
if pm2 describe wlb-api > /dev/null 2>&1; then
    echo "✅ PM2进程存在"
else
    echo "❌ PM2进程不存在"
fi

echo -n "本地端口监听: "
if netstat -tlnp 2>/dev/null | grep :3001 > /dev/null; then
    echo "✅ 3001端口正在监听"
else
    echo "❌ 3001端口未监听"
fi

echo -n "本地API访问: "
if curl -s --max-time 3 http://localhost:3001/health > /dev/null; then
    echo "✅ 本地访问正常"
else
    echo "❌ 本地访问失败"
fi
echo ""

# 3. 数据库连接
echo "3. 数据库连接检查:"
echo -n "数据库连接: "
if mysql -u root -p'fgs13990845071..' -e "SELECT 1;" > /dev/null 2>&1; then
    echo "✅ 数据库连接正常"
else
    echo "❌ 数据库连接失败"
fi

echo -n "数据库表检查: "
if mysql -u root -p'fgs13990845071..' -e "USE wlb_extension; SHOW TABLES;" > /dev/null 2>&1; then
    echo "✅ 数据表存在"
else
    echo "❌ 数据表不存在"
fi
echo ""

# 4. 防火墙配置
echo "4. 防火墙配置:"
echo -n "firewalld状态: "
if systemctl is-active firewalld > /dev/null; then
    echo "✅ 运行中"
    echo -n "3001端口开放: "
    firewall-cmd --list-ports | grep 3001 > /dev/null && echo "✅ 已开放" || echo "❌ 未开放"
else
    echo "❌ 未运行"
fi
echo ""

# 5. 阿里云安全组检查
echo "5. 阿里云安全组诊断:"
echo "请在阿里云控制台检查以下项目:"
echo ""

echo "安全组规则检查:"
echo "1. 规则方向: 入方向"
echo "2. 协议类型: 自定义TCP"
echo "3. 端口范围: 3001/3001"
echo "4. 授权对象: 0.0.0.0/0"
echo "5. 优先级: 1"
echo ""

echo "其他可能问题:"
echo "1. ECS实例是否在VPC中？"
echo "2. 是否有网络ACL限制？"
echo "3. 域名DNS是否正确指向ECS？"
echo "4. ECS安全组是否绑定到实例？"
echo ""

# 6. 端口连通性测试
echo "6. 端口连通性测试:"
echo "测试从ECS内部访问外部端口..."
timeout 5 bash -c "</dev/tcp/kyrnln.cloud/3001" 2>/dev/null && echo "✅ 外部端口可访问" || echo "❌ 外部端口不可访问"

echo ""
echo "测试从ECS内部访问其他端口..."
timeout 3 bash -c "</dev/tcp/kyrnln.cloud/3306" 2>/dev/null && echo "✅ 3306端口可访问" || echo "❌ 3306端口不可访问"
echo ""

# 7. 域名和DNS检查
echo "7. DNS和域名检查:"
echo "域名: kyrnln.cloud"
echo "预期IP: 120.24.170.11"
echo "实际解析: $(dig kyrnln.cloud +short 2>/dev/null || nslookup kyrnln.cloud 2>/dev/null | grep Address | tail -1 | awk '{print $2}')"
echo ""

# 8. 建议解决方案
echo "8. 建议解决方案:"
echo "1. ✅ 重启ECS实例 (最有效)"
echo "2. ✅ 检查阿里云安全组是否正确绑定到实例"
echo "3. ✅ 确认域名DNS解析正确"
echo "4. ✅ 等待30分钟让安全组规则生效"
echo "5. ✅ 联系阿里云客服确认网络配置"
echo ""

echo "=== 诊断完成 ==="
echo "请根据上述结果检查相应配置。"
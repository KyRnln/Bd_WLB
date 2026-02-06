#!/bin/bash

echo "=== 最终连接诊断 ==="
echo "时间: $(date)"
echo ""

# 1. 基本网络检查
echo "1. 基本网络信息:"
echo "本机IP: $(curl -s ifconfig.me || curl -s ipinfo.io/ip || hostname -I | awk '{print $1}')"
echo "域名解析: $(ping -c 1 kyrnln.cloud 2>/dev/null | head -1 | awk '{print $3}' | tr -d '()')"
echo ""

# 2. 本地服务状态
echo "2. 本地服务状态:"
echo -n "API服务进程: "
if pgrep -f "db_api_server.js" > /dev/null; then
    echo "✅ 运行中 (PID: $(pgrep -f "db_api_server.js"))"
else
    echo "❌ 未运行"
fi

echo -n "端口监听: "
if netstat -tlnp 2>/dev/null | grep :3001 > /dev/null || ss -tlnp 2>/dev/null | grep :3001 > /dev/null; then
    echo "✅ 3001端口正在监听"
else
    echo "❌ 3001端口未监听"
fi

echo -n "本地访问: "
if curl -s --max-time 3 http://localhost:3001/health > /dev/null; then
    echo "✅ 本地访问正常"
else
    echo "❌ 本地访问失败"
fi
echo ""

# 3. 防火墙状态
echo "3. 防火墙状态:"
echo -n "firewalld状态: "
if systemctl is-active firewalld > /dev/null; then
    echo "✅ 运行中"
    echo -n "开放端口: "
    firewall-cmd --list-ports | grep 3001 > /dev/null && echo "✅ 3001端口已开放" || echo "❌ 3001端口未开放"
else
    echo "❌ 未运行"
fi
echo ""

# 4. 网络连通性测试
echo "4. 网络连通性测试:"
echo -n "本机到本机: "
timeout 3 bash -c "</dev/tcp/localhost/3001" 2>/dev/null && echo "✅ 连通" || echo "❌ 不通"

echo -n "本机到外网: "
if curl -s --max-time 5 http://httpbin.org/ip > /dev/null; then
    echo "✅ 外网连通正常"
else
    echo "❌ 外网连通异常"
fi

echo -n "外网到本机: "
if timeout 5 bash -c "</dev/tcp/kyrnln.cloud/3001" 2>/dev/null; then
    echo "✅ 远程端口可访问"
else
    echo "❌ 远程端口不可访问"
fi
echo ""

# 5. 阿里云安全组检查
echo "5. 阿里云安全组检查建议:"
echo "请在阿里云ECS控制台确认以下设置:"
echo "1. 进入ECS实例 -> 安全组 -> 配置规则"
echo "2. 检查入方向规则中是否有:"
echo "   - 协议类型: TCP"
echo "   - 端口范围: 3001/3001"
echo "   - 授权对象: 0.0.0.0/0 或您的IP"
echo "3. 规则优先级建议设为1"
echo ""

# 6. 故障排除步骤
echo "6. 故障排除步骤:"
echo "如果仍然无法访问，请按顺序检查:"
echo "1. ✅ 等待5-10分钟让安全组规则生效"
echo "2. ✅ 确认ECS实例状态为'运行中'"
echo "3. ✅ 检查是否有多重防火墙(阿里云+系统)"
echo "4. ✅ 尝试重启API服务: pm2 restart wlb-api"
echo "5. ✅ 检查阿里云VPC安全组(如果使用了VPC)"
echo ""

# 7. 快速测试命令
echo "7. 快速测试命令:"
echo "# 测试本地服务"
echo "curl http://localhost:3001/health"
echo ""
echo "# 测试远程服务"
echo "curl http://kyrnln.cloud:3001/health"
echo ""
echo "# 测试数据库连接"
echo "mysql -h localhost -u wlb_user -p wlb_extension"
echo ""

echo "=== 诊断完成 ==="
echo "如果问题仍然存在，请提供阿里云安全组的截图或配置详情。"
#!/bin/bash

echo "=== 连接问题诊断 ==="

# 1. 检查DNS解析
echo "1. 检查DNS解析..."
echo "域名 kyrnln.cloud 解析结果："
nslookup kyrnln.cloud 2>/dev/null || host kyrnln.cloud 2>/dev/null || dig kyrnln.cloud +short 2>/dev/null || echo "无法解析域名"

echo ""

# 2. 检查本地服务
echo "2. 检查本地API服务..."
if curl -s --max-time 5 http://localhost:3001/health > /dev/null; then
    echo "✅ 本地API服务正常"
    echo "响应: $(curl -s http://localhost:3001/health)"
else
    echo "❌ 本地API服务异常"
fi

echo ""

# 3. 检查端口监听
echo "3. 检查端口监听..."
netstat -tlnp | grep :3001 || ss -tlnp | grep :3001 || echo "❌ 3001端口未监听"

echo ""

# 4. 检查防火墙
echo "4. 检查防火墙设置..."
if command -v ufw &> /dev/null; then
    ufw status | grep 3001 || echo "❌ UFW未开放3001端口"
elif command -v firewall-cmd &> /dev/null; then
    firewall-cmd --list-ports | grep 3001 || echo "❌ firewalld未开放3001端口"
else
    echo "ℹ️ 未检测到防火墙管理工具"
fi

echo ""

# 5. 测试本地网络连接
echo "5. 测试本地网络连接..."
if nc -z localhost 3001 2>/dev/null; then
    echo "✅ 本地端口3001可连接"
else
    echo "❌ 本地端口3001不可连接"
fi

echo ""

# 6. 获取本机IP
echo "6. 本机网络信息..."
echo "内网IP: $(hostname -I | awk '{print $1}')"
echo "公网IP: $(curl -s ifconfig.me || curl -s ipinfo.io/ip || echo '无法获取')"

echo ""

# 7. 阿里云安全组检查建议
echo "7. 阿里云安全组检查建议："
echo "- 登录阿里云ECS控制台"
echo "- 找到您的ECS实例"
echo "- 点击'安全组' -> '配置规则'"
echo "- 添加入方向规则："
echo "  * 端口范围: 3001/3001"
echo "  * 授权对象: 0.0.0.0/0"
echo "  * 协议: TCP"

echo ""
echo "8. DNS配置检查建议："
echo "- 确认kyrnln.cloud域名解析到正确的ECS公网IP"
echo "- 如果是新域名，可能需要等待DNS生效（最多72小时）"
echo "- 可以使用 ping kyrnln.cloud 测试连通性"

echo ""
echo "=== 诊断完成 ==="
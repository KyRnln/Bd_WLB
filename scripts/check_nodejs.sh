#!/bin/bash

echo "=== 检查Node.js环境 ==="

# 检查Node.js版本
echo "1. 检查Node.js版本："
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo "✅ Node.js已安装: $NODE_VERSION"

    # 检查版本是否足够新
    NODE_MAJOR_VERSION=$(node --version | cut -d'.' -f1 | sed 's/v//')
    if [ "$NODE_MAJOR_VERSION" -ge 14 ]; then
        echo "✅ Node.js版本符合要求 (≥14.0.0)"
    else
        echo "⚠️  Node.js版本较旧，建议升级到14.0.0或更高版本"
    fi
else
    echo "❌ Node.js未安装"
fi

echo ""

# 检查npm版本
echo "2. 检查npm版本："
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    echo "✅ npm已安装: $NPM_VERSION"
else
    echo "❌ npm未安装"
fi

echo ""

# 检查PM2
echo "3. 检查PM2进程管理器："
if command -v pm2 &> /dev/null; then
    PM2_VERSION=$(pm2 --version)
    echo "✅ PM2已安装: $PM2_VERSION"
else
    echo "❌ PM2未安装"
    echo "安装命令: npm install -g pm2"
fi

echo ""

# 检查API服务器目录
echo "4. 检查API服务器目录："
if [ -d "/opt/wlb-api" ]; then
    echo "✅ API服务器目录存在: /opt/wlb-api"
    ls -la /opt/wlb-api/
else
    echo "❌ API服务器目录不存在"
    echo "创建命令: mkdir -p /opt/wlb-api"
fi

echo ""

# 检查端口占用
echo "5. 检查端口3001占用情况："
if netstat -tlnp 2>/dev/null | grep :3001 || ss -tlnp 2>/dev/null | grep :3001; then
    echo "⚠️  端口3001已被占用"
else
    echo "✅ 端口3001可用"
fi

echo ""

# 检查防火墙
echo "6. 检查防火墙设置："
if command -v ufw &> /dev/null; then
    if ufw status | grep -q "3001"; then
        echo "✅ UFW防火墙已开放3001端口"
    else
        echo "❌ UFW防火墙未开放3001端口"
    fi
elif command -v firewall-cmd &> /dev/null; then
    if firewall-cmd --list-ports | grep -q "3001"; then
        echo "✅ firewalld已开放3001端口"
    else
        echo "❌ firewalld未开放3001端口"
    fi
else
    echo "ℹ️  未检测到防火墙管理工具"
fi

echo ""
echo "=== 检查完成 ==="

# 给出建议
echo "建议操作："
if ! command -v pm2 &> /dev/null; then
    echo "- 安装PM2: npm install -g pm2"
fi
if [ ! -d "/opt/wlb-api" ]; then
    echo "- 创建目录: mkdir -p /opt/wlb-api"
fi
echo "- 开放端口: firewall-cmd --permanent --add-port=3001/tcp && firewall-cmd --reload"
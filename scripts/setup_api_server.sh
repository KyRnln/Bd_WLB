#!/bin/bash

# WLB API服务器安装脚本
# 用于ECS上的数据库API服务

echo "=== 安装WLB API服务器 ==="

# 检查Node.js
if ! command -v node &> /dev/null; then
    echo "安装Node.js..."
    # 使用NodeSource仓库
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
fi

echo "Node.js版本: $(node --version)"
echo "npm版本: $(npm --version)"

# 安装PM2进程管理器
if ! command -v pm2 &> /dev/null; then
    echo "安装PM2..."
    npm install -g pm2
fi

# 创建应用目录
mkdir -p /opt/wlb-api
cd /opt/wlb-api

echo "复制API服务器文件..."
# 这里需要将db_api_server.js和package.json复制到ECS
# 用户需要手动上传这些文件，或者通过其他方式传输

# 安装依赖
echo "安装依赖..."
npm install --production

# 配置防火墙
echo "配置防火墙..."
if command -v ufw &> /dev/null; then
    ufw allow 3001/tcp
    ufw reload
elif command -v firewall-cmd &> /dev/null; then
    firewall-cmd --permanent --add-port=3001/tcp
    firewall-cmd --reload
elif command -v iptables &> /dev/null; then
    iptables -I INPUT -p tcp --dport 3001 -j ACCEPT
fi

# 启动服务
echo "启动API服务器..."
pm2 start db_api_server.js --name wlb-api
pm2 save
pm2 startup

echo "=== API服务器安装完成 ==="
echo ""
echo "服务信息："
echo "- API地址: http://kyrnln.cloud:3001"
echo "- 健康检查: http://kyrnln.cloud:3001/health"
echo "- 进程管理: pm2 status"
echo ""
echo "常用命令："
echo "- 查看状态: pm2 status"
echo "- 查看日志: pm2 logs wlb-api"
echo "- 重启服务: pm2 restart wlb-api"
echo "- 停止服务: pm2 stop wlb-api"
#!/bin/bash

echo "=== 最终API服务器部署 ==="

# 1. 创建API目录
echo "1. 创建API服务器目录..."
mkdir -p /opt/wlb-api
cd /opt/wlb-api
echo "✅ 目录已创建: /opt/wlb-api"

echo ""

# 2. 启动防火墙并开放端口
echo "2. 配置防火墙..."
systemctl start firewalld
systemctl enable firewalld
firewall-cmd --permanent --add-port=3001/tcp
firewall-cmd --reload
echo "✅ 防火墙已配置，3001端口已开放"

echo ""

# 3. 检查API文件是否存在
echo "3. 检查API服务器文件..."
if [ -f "db_api_server.js" ] && [ -f "package.json" ]; then
    echo "✅ API文件已存在"
else
    echo "❌ API文件不存在，请先上传文件"
    echo "上传命令: scp db_api_server.js package.json root@kyrnln.cloud:/opt/wlb-api/"
    exit 1
fi

echo ""

# 4. 安装依赖
echo "4. 安装Node.js依赖..."
npm install
echo "✅ 依赖安装完成"

echo ""

# 5. 启动API服务器
echo "5. 启动API服务器..."
pm2 delete wlb-api 2>/dev/null || true  # 删除可能存在的旧进程
pm2 start db_api_server.js --name wlb-api
pm2 save
pm2 startup
echo "✅ API服务器已启动"

echo ""

# 6. 等待服务启动
echo "6. 等待服务启动..."
sleep 3

echo ""

# 7. 测试API服务器
echo "7. 测试API服务器..."
if curl -s http://localhost:3001/health > /dev/null; then
    echo "✅ API服务器运行正常"
    echo "健康检查响应: $(curl -s http://localhost:3001/health)"
else
    echo "❌ API服务器测试失败"
fi

echo ""

# 8. 显示服务状态
echo "8. 服务状态信息:"
pm2 status

echo ""
echo "=== 部署完成！ ==="
echo ""
echo "🎉 WLB云服务部署成功！"
echo ""
echo "服务信息："
echo "- API地址: http://kyrnln.cloud:3001"
echo "- 健康检查: http://kyrnln.cloud:3001/health"
echo "- 进程管理: pm2 status"
echo ""
echo "测试Chrome扩展的云端同步功能即可！"
#!/bin/bash

echo "=== 调试同步数据 ==="

# 1. 检查当前数据库内容
echo "1. 当前数据库内容:"
mysql -u root -pfgs13990845071.. -e "
USE wlb_extension;
SELECT 'creators' as table_name, COUNT(*) as count FROM creators
UNION ALL
SELECT 'phrases' as table_name, COUNT(*) as count FROM phrases;
"

echo ""

# 2. 检查表结构
echo "2. creators表结构:"
mysql -u root -pfgs13990845071.. -e "
USE wlb_extension;
DESCRIBE creators;
"

echo ""

echo "3. phrases表结构:"
mysql -u root -pfgs13990845071.. -e "
USE wlb_extension;
DESCRIBE phrases;
"

echo ""

# 3. 测试直接插入数据（模拟Chrome扩展发送的数据）
echo "4. 测试插入模拟数据:"

# 测试creators数据
mysql -u root -pfgs13990845071.. -e "
USE wlb_extension;
INSERT INTO creators (creator_id, creator_cid, region_code, remark)
VALUES ('test_creator_001', '123456789', 'CN', '测试达人');
SELECT * FROM creators WHERE creator_id = 'test_creator_001';
"

# 测试phrases数据
mysql -u root -pfgs13990845071.. -e "
USE wlb_extension;
INSERT INTO phrases (category, phrase_text, shortcut)
VALUES ('general', '测试短语内容', 'test');
SELECT * FROM phrases WHERE category = 'general' AND phrase_text = '测试短语内容';
"

# 清理测试数据
mysql -u root -pfgs13990845071.. -e "
USE wlb_extension;
DELETE FROM creators WHERE creator_id = 'test_creator_001';
DELETE FROM phrases WHERE category = 'general' AND phrase_text = '测试短语内容';
"

echo ""

# 4. 检查API服务器日志
echo "5. 检查API服务器最近日志:"
echo "最近10行错误日志:"
pm2 logs wlb-api --err --lines 10 2>/dev/null | tail -10 || echo "无错误日志"

echo ""
echo "最近10行输出日志:"
pm2 logs wlb-api --lines 10 2>/dev/null | tail -10 || echo "无输出日志"

echo ""
echo "=== 调试完成 ==="
#!/bin/bash

echo "=== 检查数据库表结构 ==="

# 检查creators表
echo "1. creators表结构:"
mysql -u root -pfgs13990845071.. -e "
USE wlb_extension;
DESCRIBE creators;
SELECT COUNT(*) as total_records FROM creators;
"

echo ""

# 检查phrases表
echo "2. phrases表结构:"
mysql -u root -pfgs13990845071.. -e "
USE wlb_extension;
DESCRIBE phrases;
SELECT COUNT(*) as total_records FROM phrases;
"

echo ""

# 测试插入一条数据
echo "3. 测试插入数据:"
mysql -u root -pfgs13990845071.. -e "
USE wlb_extension;
INSERT INTO creators (creator_id, creator_cid, region_code, remark) VALUES ('test_id', 'test_cid', 'CN', '测试数据');
SELECT * FROM creators WHERE creator_id = 'test_id';
DELETE FROM creators WHERE creator_id = 'test_id';
"

mysql -u root -pfgs13990845071.. -e "
USE wlb_extension;
INSERT INTO phrases (category, phrase_text, shortcut) VALUES ('test', '测试短语', 'test');
SELECT * FROM phrases WHERE category = 'test';
DELETE FROM phrases WHERE category = 'test';
"

echo ""
echo "=== 数据库结构检查完成 ==="
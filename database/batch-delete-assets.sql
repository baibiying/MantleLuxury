-- 批量删除资产脚本
-- 使用方法：在 Railway MySQL Terminal 或本地 MySQL 执行

-- ============================================
-- 1. 查看所有资产（先确认要删除哪些）
-- ============================================
SELECT 
    id,
    brand,
    model,
    status,
    token_address,
    created_at
FROM assets
ORDER BY created_at DESC;

-- ============================================
-- 2. 按状态批量删除（示例：删除所有"待认证"状态的资产）
-- ============================================
-- 注意：这会级联删除相关的图片、认证、估值、托管、保险、审核记录
-- DELETE FROM assets WHERE status = 'registered';

-- ============================================
-- 3. 按ID列表批量删除（示例）
-- ============================================
-- 先查看要删除的资产ID
-- SELECT id FROM assets WHERE status = 'registered';

-- 然后删除（替换成实际的ID列表）
-- DELETE FROM assets WHERE id IN (
--     'id1-here',
--     'id2-here',
--     'id3-here'
-- );

-- ============================================
-- 4. 删除所有资产（危险操作！谨慎使用）
-- ============================================
-- DELETE FROM assets;

-- ============================================
-- 5. 删除指定日期之前创建的资产（示例：删除7天前的资产）
-- ============================================
-- DELETE FROM assets 
-- WHERE created_at < DATE_SUB(NOW(), INTERVAL 7 DAY);

-- ============================================
-- 6. 删除没有合约地址的资产（未上链的资产）
-- ============================================
-- DELETE FROM assets WHERE token_address IS NULL;

-- ============================================
-- 验证删除结果
-- ============================================
-- SELECT COUNT(*) AS remaining_assets FROM assets;
-- SELECT status, COUNT(*) AS count FROM assets GROUP BY status;


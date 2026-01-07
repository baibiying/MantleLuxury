-- 修复 asset_images 表的 asset_id 列类型，从 CHAR(36) 改为 VARCHAR(36)
-- 执行方法：在 Railway MySQL Terminal 或本地 MySQL 执行

ALTER TABLE asset_images 
MODIFY COLUMN asset_id VARCHAR(36) NULL COMMENT '关联的资产ID（允许为null，用于临时存储）';


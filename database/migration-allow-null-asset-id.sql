-- 修改 asset_images 表，允许 asset_id 为 null（用于临时存储图片，后续关联资产）
-- 执行方法：在 Railway MySQL Terminal 或本地 MySQL 执行

ALTER TABLE asset_images 
MODIFY COLUMN asset_id CHAR(36) NULL COMMENT '关联的资产ID（允许为null，用于临时存储）';


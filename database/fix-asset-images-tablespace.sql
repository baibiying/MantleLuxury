-- 修复 asset_images 表的表空间问题
-- 执行方法：在 MySQL Terminal 执行此脚本

-- 方法1：如果表存在但表空间有问题，删除并重新创建
DROP TABLE IF EXISTS asset_images;

-- 重新创建表（不指定表空间，使用默认）
CREATE TABLE asset_images (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    asset_id VARCHAR(36) NULL COMMENT '关联的资产ID（允许为null，用于临时存储）',
    image_index INT NOT NULL DEFAULT 0 COMMENT '图片索引（同一资产的多张图片）',
    image_data LONGBLOB NOT NULL COMMENT '图片二进制数据',
    content_type VARCHAR(100) NOT NULL DEFAULT 'image/jpeg' COMMENT '图片MIME类型（image/jpeg, image/png等）',
    original_filename VARCHAR(255) COMMENT '原始文件名',
    file_size BIGINT COMMENT '文件大小（字节）',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_asset_id (asset_id),
    INDEX idx_asset_image_index (asset_id, image_index),
    UNIQUE KEY uk_asset_image (asset_id, image_index)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 如果 assets 表存在，添加外键约束
-- 注意：如果 assets 表不存在，这行会失败，但表仍然会被创建
ALTER TABLE asset_images 
ADD CONSTRAINT fk_asset_images_asset_id 
FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE;


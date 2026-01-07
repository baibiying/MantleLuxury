-- 添加 asset_images 表用于存储图片二进制数据
-- 执行方法：在 Railway MySQL Terminal 或本地 MySQL 执行此脚本

CREATE TABLE IF NOT EXISTS asset_images (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    asset_id CHAR(36) NOT NULL COMMENT '关联的资产ID',
    image_index INT NOT NULL DEFAULT 0 COMMENT '图片索引（同一资产的多张图片）',
    image_data LONGBLOB NOT NULL COMMENT '图片二进制数据',
    content_type VARCHAR(100) NOT NULL DEFAULT 'image/jpeg' COMMENT '图片MIME类型（image/jpeg, image/png等）',
    original_filename VARCHAR(255) COMMENT '原始文件名',
    file_size BIGINT COMMENT '文件大小（字节）',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
    INDEX idx_asset_id (asset_id),
    INDEX idx_asset_image_index (asset_id, image_index),
    UNIQUE KEY uk_asset_image (asset_id, image_index)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


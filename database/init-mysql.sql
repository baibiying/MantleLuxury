-- MantleLuxury 数据库初始化脚本
-- 创建数据库和表结构

-- 创建数据库（如果不存在）
CREATE DATABASE IF NOT EXISTS mantle_luxury CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE mantle_luxury;

-- users 表
CREATE TABLE IF NOT EXISTS users (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    wallet_address VARCHAR(42) UNIQUE NOT NULL,
    email VARCHAR(255),
    kyc_status VARCHAR(20) NOT NULL DEFAULT 'none' COMMENT 'none, pending, approved, rejected',
    kyc_submitted_at TIMESTAMP NULL,
    kyc_approved_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_wallet_address (wallet_address),
    INDEX idx_kyc_status (kyc_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- assets 表
CREATE TABLE IF NOT EXISTS assets (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    asset_id_bytes32 VARCHAR(66) UNIQUE NOT NULL COMMENT '链上 assetId',
    token_address VARCHAR(42) COMMENT 'LuxuryToken 合约地址（资产上链后才有）',
    asset_type VARCHAR(50) NOT NULL COMMENT 'watch, jewelry',
    brand VARCHAR(100),
    model VARCHAR(100),
    year INT,
    total_supply DECIMAL(36, 18) COMMENT '代币总供应量',
    price_per_share DECIMAL(36, 18) COMMENT '每份价格',
    metadata_hash VARCHAR(66) COMMENT 'IPFS 哈希',
    custody_info_hash VARCHAR(66),
    insurance_info_hash VARCHAR(66),
    status VARCHAR(20) NOT NULL DEFAULT 'registered' COMMENT 'registered, fundraising, funded, sold',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_asset_id_bytes32 (asset_id_bytes32),
    INDEX idx_token_address (token_address),
    INDEX idx_asset_type (asset_type),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- valuations 表
CREATE TABLE IF NOT EXISTS valuations (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    asset_id CHAR(36) NOT NULL,
    valuation_amount DECIMAL(36, 18),
    valuation_currency VARCHAR(10) DEFAULT 'USD',
    valuation_date DATE,
    valuation_agency VARCHAR(100),
    report_url TEXT COMMENT 'IPFS 或 S3 URL',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
    INDEX idx_asset_id (asset_id),
    INDEX idx_valuation_date (valuation_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- yield_distributions 表
CREATE TABLE IF NOT EXISTS yield_distributions (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    distribution_id_bytes32 VARCHAR(66) UNIQUE NOT NULL,
    asset_id CHAR(36) NOT NULL,
    token_address VARCHAR(42) NOT NULL,
    yield_type VARCHAR(20) NOT NULL COMMENT 'appreciation, rental',
    total_amount DECIMAL(36, 18),
    distributed_amount DECIMAL(36, 18) DEFAULT 0,
    is_completed BOOLEAN DEFAULT FALSE,
    transaction_hash VARCHAR(66),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
    INDEX idx_distribution_id_bytes32 (distribution_id_bytes32),
    INDEX idx_asset_id (asset_id),
    INDEX idx_token_address (token_address),
    INDEX idx_is_completed (is_completed)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- user_holdings 表（从链上事件索引）
CREATE TABLE IF NOT EXISTS user_holdings (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_address VARCHAR(42) NOT NULL,
    token_address VARCHAR(42) NOT NULL,
    balance DECIMAL(36, 18) NOT NULL,
    last_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_user_token (user_address, token_address),
    INDEX idx_user_address (user_address),
    INDEX idx_token_address (token_address)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 显示创建的表
SHOW TABLES;


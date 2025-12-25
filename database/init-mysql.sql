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
    kyc_rejected_at TIMESTAMP NULL,
    kyc_rejection_reason TEXT COMMENT 'KYC驳回原因',
    -- KYC基本信息
    full_name VARCHAR(200) COMMENT '姓名',
    id_number VARCHAR(50) COMMENT '证件号',
    id_type VARCHAR(20) COMMENT '证件类型：id_card, passport, driver_license',
    address TEXT COMMENT '地址',
    phone VARCHAR(20) COMMENT '联系电话',
    -- 证件上传
    id_document_front_url TEXT COMMENT '证件正面照片URL',
    id_document_back_url TEXT COMMENT '证件背面照片URL',
    selfie_url TEXT COMMENT '自拍照片URL（人脸识别）',
    -- 通知偏好
    email_notifications BOOLEAN DEFAULT TRUE COMMENT '是否接收邮件通知',
    yield_notifications BOOLEAN DEFAULT TRUE COMMENT '是否接收收益分配通知',
    announcement_notifications BOOLEAN DEFAULT TRUE COMMENT '是否接收重要公告通知',
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
    submitted_by VARCHAR(42) COMMENT '提交者钱包地址或用户ID',
    description TEXT COMMENT '资产描述',
    purchase_price DECIMAL(36, 18) COMMENT '购入价格',
    purchase_date DATE COMMENT '购入日期',
    serial_number VARCHAR(200) COMMENT '序列号',
    image_urls TEXT COMMENT '资产图片 URL 列表（JSON 数组）',
    model_3d_url TEXT COMMENT '3D模型文件URL（.glb或.gltf格式）',
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

-- user_investments 表（记录用户投资成本）
CREATE TABLE IF NOT EXISTS user_investments (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_address VARCHAR(42) NOT NULL,
    asset_id CHAR(36) NOT NULL,
    token_address VARCHAR(42) NOT NULL,
    invested_amount_mnt DECIMAL(36, 18) NOT NULL COMMENT '本次投入的 MNT 金额',
    shares DECIMAL(36, 18) NOT NULL COMMENT '本次购买的份数',
    tx_hash VARCHAR(66),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
    INDEX idx_user_address (user_address),
    INDEX idx_asset_id (asset_id),
    INDEX idx_token_address (token_address)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- aml_blacklist 表（基础黑名单）
CREATE TABLE IF NOT EXISTS aml_blacklist (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    wallet_address VARCHAR(42) NOT NULL UNIQUE,
    reason VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_wallet_address (wallet_address)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- aml_alerts 表（AML 告警记录）
CREATE TABLE IF NOT EXISTS aml_alerts (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    wallet_address VARCHAR(42) NOT NULL COMMENT '触发告警的钱包地址',
    alert_type VARCHAR(50) NOT NULL COMMENT '告警类型：blacklist_hit, single_tx_limit, total_limit, external_risk, manual',
    risk_level VARCHAR(20) NOT NULL DEFAULT 'medium' COMMENT '风险等级：low, medium, high, critical',
    source VARCHAR(100) COMMENT '告警来源：internal_rule, chainalysis, elliptic, manual',
    message TEXT COMMENT '详细告警信息',
    status VARCHAR(20) NOT NULL DEFAULT 'open' COMMENT 'open, in_review, resolved, ignored',
    handled_by VARCHAR(42) COMMENT '处理人钱包地址',
    handled_at TIMESTAMP NULL COMMENT '处理时间',
    handle_notes TEXT COMMENT '处理备注',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_wallet_address (wallet_address),
    INDEX idx_status (status),
    INDEX idx_risk_level (risk_level),
    INDEX idx_alert_type (alert_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- risk_assessments 表（风险评估记录）
CREATE TABLE IF NOT EXISTS risk_assessments (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    wallet_address VARCHAR(42) NOT NULL COMMENT '用户钱包地址',
    investment_experience_score INT COMMENT '投资经验评分 (1-5)',
    risk_tolerance_score INT COMMENT '风险承受能力评分 (1-5)',
    investment_goal_score INT COMMENT '投资目标评分 (1-5)',
    investment_horizon_score INT COMMENT '投资期限偏好评分 (1-5)',
    total_score INT COMMENT '总分数 (4-20)',
    risk_level VARCHAR(20) COMMENT '风险等级：conservative, moderate, aggressive',
    assessment_result TEXT COMMENT '测评结果描述',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_wallet_address (wallet_address),
    INDEX idx_risk_level (risk_level),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- asset_authentications 表（资产真伪认证）
CREATE TABLE IF NOT EXISTS asset_authentications (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    asset_id CHAR(36) NOT NULL,
    authentication_status VARCHAR(20) NOT NULL DEFAULT 'pending' COMMENT 'pending, verified, rejected',
    authenticator_name VARCHAR(200) NOT NULL COMMENT '鉴定机构名称',
    authenticator_type VARCHAR(50) NOT NULL COMMENT 'official_brand, third_party, ai_system',
    verification_date DATE,
    report_url TEXT COMMENT 'IPFS 或 S3 URL',
    report_hash VARCHAR(66) COMMENT '报告哈希（链上存证）',
    verifier_signature TEXT COMMENT '鉴定师签名/证书信息',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
    INDEX idx_asset_id (asset_id),
    INDEX idx_authentication_status (authentication_status),
    INDEX idx_authenticator_type (authenticator_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- custodies 表（资产托管）
CREATE TABLE IF NOT EXISTS custodies (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    asset_id CHAR(36) NOT NULL UNIQUE,
    custody_status VARCHAR(20) NOT NULL DEFAULT 'registered' COMMENT 'registered, in_custody, for_sale, sold, withdrawn',
    custody_organization VARCHAR(200) NOT NULL COMMENT '托管机构名称',
    warehouse_location VARCHAR(500) COMMENT '仓储位置（模糊显示）',
    warehouse_address_hash VARCHAR(66) COMMENT '详细地址哈希（链上存证）',
    entry_date DATE COMMENT '入库日期',
    custody_contract_url TEXT COMMENT '托管合同 URL',
    custody_contract_hash VARCHAR(66) COMMENT '托管合同哈希（链上存证）',
    facility_standards TEXT COMMENT '设施标准（恒温恒湿、防火防盗等）',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
    INDEX idx_asset_id (asset_id),
    INDEX idx_custody_status (custody_status),
    INDEX idx_custody_organization (custody_organization)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- insurances 表（资产保险）
CREATE TABLE IF NOT EXISTS insurances (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    asset_id CHAR(36) NOT NULL,
    insurance_company VARCHAR(200) NOT NULL COMMENT '保险公司名称',
    policy_number VARCHAR(100) COMMENT '保单号',
    coverage_amount DECIMAL(36, 18) NOT NULL COMMENT '保额',
    coverage_currency VARCHAR(10) NOT NULL DEFAULT 'USD' COMMENT '保额币种',
    policy_start_date DATE NOT NULL COMMENT '保单生效日期',
    policy_end_date DATE NOT NULL COMMENT '保单到期日期',
    premium_amount DECIMAL(36, 18) COMMENT '保费',
    coverage_type VARCHAR(50) COMMENT '保险类型（全险、盗窃险等）',
    policy_document_url TEXT COMMENT '保单文档 URL',
    policy_document_hash VARCHAR(66) COMMENT '保单文档哈希（链上存证）',
    is_active BOOLEAN NOT NULL DEFAULT TRUE COMMENT '保单是否有效',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
    INDEX idx_asset_id (asset_id),
    INDEX idx_insurance_company (insurance_company),
    INDEX idx_is_active (is_active),
    INDEX idx_policy_end_date (policy_end_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- asset_reviews 表（资产审核记录）
CREATE TABLE IF NOT EXISTS asset_reviews (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    asset_id CHAR(36) NOT NULL,
    reviewer_address VARCHAR(42) NOT NULL COMMENT '审核人钱包地址',
    review_status VARCHAR(20) NOT NULL COMMENT 'pending, approved, rejected, needs_revision',
    review_notes TEXT COMMENT '审核备注',
    action_type VARCHAR(50) COMMENT '审核操作类型：initial_review, authentication_review, custody_review, insurance_review, final_approval',
    next_step VARCHAR(255) COMMENT '下一步操作建议',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
    INDEX idx_asset_id (asset_id),
    INDEX idx_review_status (review_status),
    INDEX idx_reviewer_address (reviewer_address),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- event_indexer_state 表（事件索引器状态）
CREATE TABLE IF NOT EXISTS event_indexer_state (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    contract_type VARCHAR(50) NOT NULL COMMENT 'LuxuryToken, KYCRegistry, YieldDistribution',
    contract_address VARCHAR(42) NOT NULL COMMENT '合约地址',
    last_processed_block BIGINT NOT NULL DEFAULT 0 COMMENT '最后处理的区块号',
    last_processed_timestamp TIMESTAMP NULL COMMENT '最后处理的时间戳',
    is_active BOOLEAN NOT NULL DEFAULT TRUE COMMENT '是否启用索引',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_contract (contract_type, contract_address),
    INDEX idx_contract_type (contract_type),
    INDEX idx_last_processed_block (last_processed_block)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- blockchain_events 表（链上事件记录，用于审计和调试）
CREATE TABLE IF NOT EXISTS blockchain_events (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    event_type VARCHAR(50) NOT NULL COMMENT 'TokensPurchased, KYCStatusUpdated, DistributionCreated, Claimed',
    contract_address VARCHAR(42) NOT NULL,
    transaction_hash VARCHAR(66) NOT NULL,
    block_number BIGINT NOT NULL,
    block_timestamp TIMESTAMP NULL,
    log_index INT NOT NULL,
    event_data JSON COMMENT '事件数据（JSON格式）',
    processed BOOLEAN NOT NULL DEFAULT FALSE COMMENT '是否已处理',
    processed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_tx_log (transaction_hash, log_index),
    INDEX idx_event_type (event_type),
    INDEX idx_contract_address (contract_address),
    INDEX idx_block_number (block_number),
    INDEX idx_processed (processed),
    INDEX idx_transaction_hash (transaction_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 显示创建的表
SHOW TABLES;


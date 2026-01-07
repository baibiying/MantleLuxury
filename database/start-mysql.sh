#!/bin/bash

# MantleLuxury MySQL Docker 启动脚本
# 功能：启动 MySQL Docker 容器并自动创建数据库表

set -e  # 遇到错误立即退出

# 配置变量
CONTAINER_NAME="mantle-luxury-mysql"
MYSQL_ROOT_PASSWORD="root123456"
MYSQL_DATABASE="mantle_luxury"
MYSQL_USER="mantle_user"
MYSQL_PASSWORD="mantle_pass"
MYSQL_PORT="3306"
IMAGE_NAME="mysql:8.0"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INIT_SQL_FILE="${SCRIPT_DIR}/init-mysql.sql"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查 Docker 是否运行
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker 未运行，请先启动 Docker"
        exit 1
    fi
    print_info "Docker 检查通过"
}

# 检查并创建 SQL 初始化文件
check_sql_file() {
    if [ ! -f "$INIT_SQL_FILE" ]; then
        print_error "SQL 初始化文件不存在: $INIT_SQL_FILE"
        exit 1
    fi
    print_info "SQL 初始化文件检查通过: $INIT_SQL_FILE"
}

# 停止并删除现有容器（如果存在）
cleanup_existing_container() {
    if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        print_warn "发现已存在的容器: $CONTAINER_NAME"
        read -p "是否删除现有容器并重新创建? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            print_info "停止并删除现有容器..."
            docker stop "$CONTAINER_NAME" > /dev/null 2>&1 || true
            docker rm "$CONTAINER_NAME" > /dev/null 2>&1 || true
            
            # 询问是否删除数据卷（完全重新生成表格）
            read -p "是否删除数据卷并完全重新生成数据库? (y/N): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                print_warn "删除数据卷: ${SCRIPT_DIR}/mysql-data"
                rm -rf "${SCRIPT_DIR}/mysql-data"
                print_info "数据卷已删除，将重新生成数据库和表格"
            else
                print_info "保留数据卷，使用现有数据"
            fi
        else
            print_info "使用现有容器"
            return 1
        fi
    fi
    return 0
}

# 启动 MySQL 容器
start_mysql_container() {
    print_info "启动 MySQL Docker 容器..."
    
    docker run -d \
        --name "$CONTAINER_NAME" \
        -e MYSQL_ROOT_PASSWORD="$MYSQL_ROOT_PASSWORD" \
        -e MYSQL_DATABASE="$MYSQL_DATABASE" \
        -e MYSQL_USER="$MYSQL_USER" \
        -e MYSQL_PASSWORD="$MYSQL_PASSWORD" \
        -p "$MYSQL_PORT:3306" \
        -v "${SCRIPT_DIR}/mysql-data:/var/lib/mysql" \
        "$IMAGE_NAME" \
        --character-set-server=utf8mb4 \
        --collation-server=utf8mb4_unicode_ci \
        > /dev/null
    
    if [ $? -eq 0 ]; then
        print_info "MySQL 容器启动成功"
    else
        print_error "MySQL 容器启动失败"
        exit 1
    fi
}

# 等待 MySQL 就绪
wait_for_mysql() {
    print_info "等待 MySQL 服务就绪..."
    local max_attempts=30
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if docker exec "$CONTAINER_NAME" mysqladmin ping -h localhost --silent > /dev/null 2>&1; then
            print_info "MySQL 服务已就绪"
            return 0
        fi
        attempt=$((attempt + 1))
        echo -n "."
        sleep 2
    done
    
    echo
    print_error "MySQL 服务启动超时"
    exit 1
}

# 执行 SQL 初始化脚本
execute_init_sql() {
    print_info "执行数据库初始化脚本..."
    
    # 将 SQL 文件复制到容器中
    docker cp "$INIT_SQL_FILE" "$CONTAINER_NAME:/tmp/init.sql" > /dev/null 2>&1
    
    # 方法一：使用 docker exec 在容器内执行
    if docker exec "$CONTAINER_NAME" bash -c "mysql -uroot -p'$MYSQL_ROOT_PASSWORD' $MYSQL_DATABASE < /tmp/init.sql" > /dev/null 2>&1; then
        print_info "数据库表创建成功"
    else
        # 方法二：使用标准输入重定向
        print_warn "尝试使用另一种方式执行 SQL..."
        if docker exec -i "$CONTAINER_NAME" mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" < "$INIT_SQL_FILE" > /dev/null 2>&1; then
            print_info "数据库表创建成功"
        else
            print_warn "SQL 脚本执行可能失败，但将继续检查表结构..."
            # 不退出，继续执行 ensure_schema 来补齐缺失的表
        fi
    fi
}

# 确保关键列存在（适用于保留旧数据卷的情况）
ensure_schema() {
    print_info "检查并补齐 users 表缺失列..."
    # MySQL 8.0 不支持 IF NOT EXISTS，使用存储过程方式检查并添加列
    local users_sql="
        SET @dbname = DATABASE();
        SET @tablename = 'users';
        
        -- 检查并添加 email_notifications 列
        SET @columnname = 'email_notifications';
        SET @preparedStatement = (SELECT IF(
            (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = @dbname
             AND TABLE_NAME = @tablename
             AND COLUMN_NAME = @columnname) > 0,
            'SELECT 1',
            CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' BOOLEAN DEFAULT TRUE COMMENT ''是否接收邮件通知''')
        ));
        PREPARE alterIfNotExists FROM @preparedStatement;
        EXECUTE alterIfNotExists;
        DEALLOCATE PREPARE alterIfNotExists;
        
        -- 检查并添加 yield_notifications 列
        SET @columnname = 'yield_notifications';
        SET @preparedStatement = (SELECT IF(
            (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = @dbname
             AND TABLE_NAME = @tablename
             AND COLUMN_NAME = @columnname) > 0,
            'SELECT 1',
            CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' BOOLEAN DEFAULT TRUE COMMENT ''是否接收收益分配通知''')
        ));
        PREPARE alterIfNotExists FROM @preparedStatement;
        EXECUTE alterIfNotExists;
        DEALLOCATE PREPARE alterIfNotExists;
        
        -- 检查并添加 announcement_notifications 列
        SET @columnname = 'announcement_notifications';
        SET @preparedStatement = (SELECT IF(
            (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = @dbname
             AND TABLE_NAME = @tablename
             AND COLUMN_NAME = @columnname) > 0,
            'SELECT 1',
            CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' BOOLEAN DEFAULT TRUE COMMENT ''是否接收重要公告通知''')
        ));
        PREPARE alterIfNotExists FROM @preparedStatement;
        EXECUTE alterIfNotExists;
        DEALLOCATE PREPARE alterIfNotExists;
        
        -- 检查并添加 kyc_rejected_at 列
        SET @columnname = 'kyc_rejected_at';
        SET @preparedStatement = (SELECT IF(
            (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = @dbname
             AND TABLE_NAME = @tablename
             AND COLUMN_NAME = @columnname) > 0,
            'SELECT 1',
            CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' TIMESTAMP NULL COMMENT ''KYC驳回时间''')
        ));
        PREPARE alterIfNotExists FROM @preparedStatement;
        EXECUTE alterIfNotExists;
        DEALLOCATE PREPARE alterIfNotExists;
        
        -- 检查并添加 kyc_rejection_reason 列
        SET @columnname = 'kyc_rejection_reason';
        SET @preparedStatement = (SELECT IF(
            (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = @dbname
             AND TABLE_NAME = @tablename
             AND COLUMN_NAME = @columnname) > 0,
            'SELECT 1',
            CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' TEXT COMMENT ''KYC驳回原因''')
        ));
        PREPARE alterIfNotExists FROM @preparedStatement;
        EXECUTE alterIfNotExists;
        DEALLOCATE PREPARE alterIfNotExists;
        
        -- 检查并添加 full_name 列
        SET @columnname = 'full_name';
        SET @preparedStatement = (SELECT IF(
            (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = @dbname
             AND TABLE_NAME = @tablename
             AND COLUMN_NAME = @columnname) > 0,
            'SELECT 1',
            CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' VARCHAR(200) COMMENT ''姓名''')
        ));
        PREPARE alterIfNotExists FROM @preparedStatement;
        EXECUTE alterIfNotExists;
        DEALLOCATE PREPARE alterIfNotExists;
        
        -- 检查并添加 id_number 列
        SET @columnname = 'id_number';
        SET @preparedStatement = (SELECT IF(
            (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = @dbname
             AND TABLE_NAME = @tablename
             AND COLUMN_NAME = @columnname) > 0,
            'SELECT 1',
            CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' VARCHAR(50) COMMENT ''证件号''')
        ));
        PREPARE alterIfNotExists FROM @preparedStatement;
        EXECUTE alterIfNotExists;
        DEALLOCATE PREPARE alterIfNotExists;
        
        -- 检查并添加 id_type 列
        SET @columnname = 'id_type';
        SET @preparedStatement = (SELECT IF(
            (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = @dbname
             AND TABLE_NAME = @tablename
             AND COLUMN_NAME = @columnname) > 0,
            'SELECT 1',
            CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' VARCHAR(20) COMMENT ''证件类型：id_card, passport, driver_license''')
        ));
        PREPARE alterIfNotExists FROM @preparedStatement;
        EXECUTE alterIfNotExists;
        DEALLOCATE PREPARE alterIfNotExists;
        
        -- 检查并添加 address 列
        SET @columnname = 'address';
        SET @preparedStatement = (SELECT IF(
            (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = @dbname
             AND TABLE_NAME = @tablename
             AND COLUMN_NAME = @columnname) > 0,
            'SELECT 1',
            CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' TEXT COMMENT ''地址''')
        ));
        PREPARE alterIfNotExists FROM @preparedStatement;
        EXECUTE alterIfNotExists;
        DEALLOCATE PREPARE alterIfNotExists;
        
        -- 检查并添加 phone 列
        SET @columnname = 'phone';
        SET @preparedStatement = (SELECT IF(
            (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = @dbname
             AND TABLE_NAME = @tablename
             AND COLUMN_NAME = @columnname) > 0,
            'SELECT 1',
            CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' VARCHAR(20) COMMENT ''联系电话''')
        ));
        PREPARE alterIfNotExists FROM @preparedStatement;
        EXECUTE alterIfNotExists;
        DEALLOCATE PREPARE alterIfNotExists;
        
        -- 检查并添加 id_document_front_url 列
        SET @columnname = 'id_document_front_url';
        SET @preparedStatement = (SELECT IF(
            (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = @dbname
             AND TABLE_NAME = @tablename
             AND COLUMN_NAME = @columnname) > 0,
            'SELECT 1',
            CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' TEXT COMMENT ''证件正面照片URL''')
        ));
        PREPARE alterIfNotExists FROM @preparedStatement;
        EXECUTE alterIfNotExists;
        DEALLOCATE PREPARE alterIfNotExists;
        
        -- 检查并添加 id_document_back_url 列
        SET @columnname = 'id_document_back_url';
        SET @preparedStatement = (SELECT IF(
            (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = @dbname
             AND TABLE_NAME = @tablename
             AND COLUMN_NAME = @columnname) > 0,
            'SELECT 1',
            CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' TEXT COMMENT ''证件背面照片URL''')
        ));
        PREPARE alterIfNotExists FROM @preparedStatement;
        EXECUTE alterIfNotExists;
        DEALLOCATE PREPARE alterIfNotExists;
        
        -- 检查并添加 selfie_url 列
        SET @columnname = 'selfie_url';
        SET @preparedStatement = (SELECT IF(
            (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = @dbname
             AND TABLE_NAME = @tablename
             AND COLUMN_NAME = @columnname) > 0,
            'SELECT 1',
            CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' TEXT COMMENT ''自拍照片URL（人脸识别）''')
        ));
        PREPARE alterIfNotExists FROM @preparedStatement;
        EXECUTE alterIfNotExists;
        DEALLOCATE PREPARE alterIfNotExists;
    "
    if docker exec "$CONTAINER_NAME" mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" -e "$users_sql" > /dev/null 2>&1; then
        print_info "users 表列检查完成（如有缺失已自动补齐）"
    else
        print_warn "users 表列自动补齐失败，请手动检查数据库"
    fi
    
    print_info "检查并补齐 assets 表缺失列..."
    local sql="
        SET @dbname = DATABASE();
        SET @tablename = 'assets';
        
        -- submitted_by
        SET @columnname = 'submitted_by';
        SET @preparedStatement = (SELECT IF(
          (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE (TABLE_SCHEMA = @dbname) AND (TABLE_NAME = @tablename) AND (COLUMN_NAME = @columnname)) > 0,
          'SELECT 1',
          CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' VARCHAR(42) COMMENT ''提交者钱包地址或用户ID''')
        ));
        PREPARE alterIfNotExists FROM @preparedStatement;
        EXECUTE alterIfNotExists;
        DEALLOCATE PREPARE alterIfNotExists;
        
        -- description
        SET @columnname = 'description';
        SET @preparedStatement = (SELECT IF(
          (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE (TABLE_SCHEMA = @dbname) AND (TABLE_NAME = @tablename) AND (COLUMN_NAME = @columnname)) > 0,
          'SELECT 1',
          CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' TEXT COMMENT ''资产描述''')
        ));
        PREPARE alterIfNotExists FROM @preparedStatement;
        EXECUTE alterIfNotExists;
        DEALLOCATE PREPARE alterIfNotExists;
        
        -- purchase_price
        SET @columnname = 'purchase_price';
        SET @preparedStatement = (SELECT IF(
          (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE (TABLE_SCHEMA = @dbname) AND (TABLE_NAME = @tablename) AND (COLUMN_NAME = @columnname)) > 0,
          'SELECT 1',
          CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' DECIMAL(36, 18) COMMENT ''购入价格''')
        ));
        PREPARE alterIfNotExists FROM @preparedStatement;
        EXECUTE alterIfNotExists;
        DEALLOCATE PREPARE alterIfNotExists;
        
        -- purchase_date
        SET @columnname = 'purchase_date';
        SET @preparedStatement = (SELECT IF(
          (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE (TABLE_SCHEMA = @dbname) AND (TABLE_NAME = @tablename) AND (COLUMN_NAME = @columnname)) > 0,
          'SELECT 1',
          CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' DATE COMMENT ''购入日期''')
        ));
        PREPARE alterIfNotExists FROM @preparedStatement;
        EXECUTE alterIfNotExists;
        DEALLOCATE PREPARE alterIfNotExists;
        
        -- serial_number
        SET @columnname = 'serial_number';
        SET @preparedStatement = (SELECT IF(
          (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE (TABLE_SCHEMA = @dbname) AND (TABLE_NAME = @tablename) AND (COLUMN_NAME = @columnname)) > 0,
          'SELECT 1',
          CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' VARCHAR(200) COMMENT ''序列号''')
        ));
        PREPARE alterIfNotExists FROM @preparedStatement;
        EXECUTE alterIfNotExists;
        DEALLOCATE PREPARE alterIfNotExists;
        
        -- image_urls
        SET @columnname = 'image_urls';
        SET @preparedStatement = (SELECT IF(
          (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE (TABLE_SCHEMA = @dbname) AND (TABLE_NAME = @tablename) AND (COLUMN_NAME = @columnname)) > 0,
          'SELECT 1',
          CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' TEXT COMMENT ''资产图片 URL 列表（JSON 数组）''')
        ));
        PREPARE alterIfNotExists FROM @preparedStatement;
        EXECUTE alterIfNotExists;
        DEALLOCATE PREPARE alterIfNotExists;
        
        -- model_3d_url
        SET @columnname = 'model_3d_url';
        SET @preparedStatement = (SELECT IF(
          (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE (TABLE_SCHEMA = @dbname) AND (TABLE_NAME = @tablename) AND (COLUMN_NAME = @columnname)) > 0,
          'SELECT 1',
          CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' TEXT COMMENT ''3D模型文件URL（.glb或.gltf格式）''')
        ));
        PREPARE alterIfNotExists FROM @preparedStatement;
        EXECUTE alterIfNotExists;
        DEALLOCATE PREPARE alterIfNotExists;
    "
    if docker exec "$CONTAINER_NAME" mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" -e "$sql" > /dev/null 2>&1; then
        print_info "assets 表列检查完成（如有缺失已自动补齐）"
    else
        print_warn "列自动补齐失败，请手动检查数据库"
    fi
    
    # 检查并创建 asset_authentications 表（如果不存在）
    print_info "检查 asset_authentications 表..."
    local create_auth_table_sql="
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
    "
    if docker exec "$CONTAINER_NAME" mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" -e "$create_auth_table_sql" > /dev/null 2>&1; then
        print_info "asset_authentications 表检查完成（如不存在已自动创建）"
    else
        print_warn "asset_authentications 表创建失败，请手动检查数据库"
    fi
    
    # 检查并创建 custodies 表（如果不存在）
    print_info "检查 custodies 表..."
    local create_custody_table_sql="
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
    "
    if docker exec "$CONTAINER_NAME" mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" -e "$create_custody_table_sql" > /dev/null 2>&1; then
        print_info "custodies 表检查完成（如不存在已自动创建）"
    else
        print_warn "custodies 表创建失败，请手动检查数据库"
    fi
    
    # 检查并创建 insurances 表（如果不存在）
    print_info "检查 insurances 表..."
    local create_insurance_table_sql="
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
    "
    if docker exec "$CONTAINER_NAME" mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" -e "$create_insurance_table_sql" > /dev/null 2>&1; then
        print_info "insurances 表检查完成（如不存在已自动创建）"
    else
        print_warn "insurances 表创建失败，请手动检查数据库"
    fi
    
    # 检查并创建 asset_reviews 表（如果不存在）
    print_info "检查 asset_reviews 表..."
    local create_review_table_sql="
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
    "
    if docker exec "$CONTAINER_NAME" mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" -e "$create_review_table_sql" > /dev/null 2>&1; then
        print_info "asset_reviews 表检查完成（如不存在已自动创建）"
    else
        print_warn "asset_reviews 表创建失败，请手动检查数据库"
    fi

    # 检查并创建 aml_alerts 表（如果不存在）
    print_info "检查 aml_alerts 表..."
    local create_aml_alerts_table_sql="
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
    "
    if docker exec "$CONTAINER_NAME" mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" -e "$create_aml_alerts_table_sql" > /dev/null 2>&1; then
        print_info "aml_alerts 表检查完成（如不存在已自动创建）"
    else
        print_warn "aml_alerts 表创建失败，请手动检查数据库"
    fi
    
    # 检查并创建 risk_assessments 表（如果不存在）
    print_info "检查 risk_assessments 表..."
    local create_risk_assessments_table_sql="
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
    "
    if docker exec "$CONTAINER_NAME" mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" -e "$create_risk_assessments_table_sql" > /dev/null 2>&1; then
        print_info "risk_assessments 表检查完成（如不存在已自动创建）"
    else
        print_warn "risk_assessments 表创建失败，请手动检查数据库"
    fi
    
    # 检查并创建 asset_images 表（如果不存在），并确保 asset_id 允许为 null
    print_info "检查 asset_images 表..."
    local create_asset_images_table_sql="
        CREATE TABLE IF NOT EXISTS asset_images (
            id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
            asset_id CHAR(36) NULL COMMENT '关联的资产ID（允许为null，用于临时存储）',
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
    "
    if docker exec "$CONTAINER_NAME" mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" -e "$create_asset_images_table_sql" > /dev/null 2>&1; then
        print_info "asset_images 表检查完成（如不存在已自动创建）"
    else
        print_warn "asset_images 表创建失败，请手动检查数据库"
    fi
    
    # 如果 asset_images 表已存在，检查并修改 asset_id 列允许为 null
    print_info "检查并修改 asset_images 表的 asset_id 列..."
    local modify_asset_id_sql="
        SET @dbname = DATABASE();
        SET @tablename = 'asset_images';
        SET @columnname = 'asset_id';
        
        -- 检查 asset_id 列是否允许 null
        SET @is_nullable = (
            SELECT IS_NULLABLE 
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = @dbname
            AND TABLE_NAME = @tablename
            AND COLUMN_NAME = @columnname
        );
        
        -- 如果列存在，检查类型和是否允许 null，并修改为 VARCHAR(36) NULL
        SET @column_type = (
            SELECT DATA_TYPE 
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = @dbname
            AND TABLE_NAME = @tablename
            AND COLUMN_NAME = @columnname
        );
        
        -- 如果类型不是 VARCHAR 或不允许 null，则修改
        SET @preparedStatement = (SELECT IF(
            @is_nullable = 'NO' OR @column_type != 'varchar',
            CONCAT('ALTER TABLE ', @tablename, ' MODIFY COLUMN ', @columnname, ' VARCHAR(36) NULL COMMENT ''关联的资产ID（允许为null，用于临时存储）'''),
            'SELECT 1'
        ));
        PREPARE alterIfNotNull FROM @preparedStatement;
        EXECUTE alterIfNotNull;
        DEALLOCATE PREPARE alterIfNotNull;
    "
    if docker exec "$CONTAINER_NAME" mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" -e "$modify_asset_id_sql" > /dev/null 2>&1; then
        print_info "asset_images 表的 asset_id 列检查完成（如不允许null已自动修改）"
    else
        print_warn "asset_images 表的 asset_id 列修改失败，请手动检查数据库"
    fi
}

# 显示连接信息
show_connection_info() {
    echo
    print_info "=========================================="
    print_info "MySQL 容器启动完成！"
    print_info "=========================================="
    echo
    echo "容器名称: $CONTAINER_NAME"
    echo "数据库名: $MYSQL_DATABASE"
    echo "端口映射: localhost:$MYSQL_PORT -> 容器:3306"
    echo
    echo "连接信息:"
    echo "  Host: localhost"
    echo "  Port: $MYSQL_PORT"
    echo "  Database: $MYSQL_DATABASE"
    echo "  Root User: root"
    echo "  Root Password: $MYSQL_ROOT_PASSWORD"
    echo "  App User: $MYSQL_USER"
    echo "  App Password: $MYSQL_PASSWORD"
    echo
    echo "连接命令示例:"
    echo "  mysql -h 127.0.0.1 -P $MYSQL_PORT -u root -p$MYSQL_ROOT_PASSWORD $MYSQL_DATABASE"
    echo
    echo "Docker 命令:"
    echo "  查看日志: docker logs $CONTAINER_NAME"
    echo "  停止容器: docker stop $CONTAINER_NAME"
    echo "  启动容器: docker start $CONTAINER_NAME"
    echo "  删除容器: docker rm -f $CONTAINER_NAME"
    echo
    print_info "=========================================="
}

# 主函数
main() {
    print_info "开始启动 MantleLuxury MySQL 环境..."
    echo
    
    # 检查前置条件
    check_docker
    check_sql_file
    
    # 清理现有容器
    if cleanup_existing_container; then
        # 启动新容器
        start_mysql_container
    else
        # 使用现有容器，检查是否运行
        if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
            print_info "启动现有容器..."
            docker start "$CONTAINER_NAME" > /dev/null
        fi
    fi
    
    # 等待 MySQL 就绪
    wait_for_mysql
    
    # 执行初始化 SQL
    execute_init_sql
    # 补齐可能缺失的列
    ensure_schema
    
    # 显示连接信息
    show_connection_info
}

# 执行主函数
main


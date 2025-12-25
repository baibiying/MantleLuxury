#!/bin/bash

# Railway MySQL 数据库初始化脚本
# 功能：自动连接 Railway MySQL 并执行初始化 SQL
# 
# 使用方法：
# 1. 在 Railway MySQL 服务的 "Data" 标签页，点击 "Connect" → "MySQL Terminal"
# 2. 在终端中执行：source <(curl -s https://raw.githubusercontent.com/your-repo/MantleLuxury/main/database/init-railway.sh)
#    或者：bash <(cat database/init-railway.sh)
#
# 注意：此脚本需要在 Railway MySQL Terminal 中运行，或使用 Railway CLI

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INIT_SQL_FILE="${SCRIPT_DIR}/init-mysql.sql"

# 检查 SQL 文件是否存在
if [ ! -f "$INIT_SQL_FILE" ]; then
    print_error "SQL 初始化文件不存在: $INIT_SQL_FILE"
    exit 1
fi

print_info "开始初始化 Railway MySQL 数据库..."
print_info "SQL 文件: $INIT_SQL_FILE"

# 方法一：如果在 Railway MySQL Terminal 中运行
if [ -n "$MYSQLHOST" ] || [ -n "$MYSQL_HOST" ]; then
    print_info "检测到 Railway 环境变量，使用 MySQL 客户端连接..."
    
    # 获取 Railway MySQL 连接信息
    MYSQL_HOST="${MYSQLHOST:-$MYSQL_HOST}"
    MYSQL_PORT="${MYSQLPORT:-${MYSQL_PORT:-3306}}"
    MYSQL_DATABASE="${MYSQLDATABASE:-$MYSQL_DATABASE}"
    MYSQL_USER="${MYSQLUSER:-$MYSQL_USER}"
    MYSQL_PASSWORD="${MYSQLPASSWORD:-$MYSQL_PASSWORD}"
    
    if [ -z "$MYSQL_HOST" ] || [ -z "$MYSQL_USER" ] || [ -z "$MYSQL_PASSWORD" ]; then
        print_error "缺少必要的 MySQL 连接信息"
        print_info "请确保以下环境变量已设置："
        print_info "  - MYSQLHOST 或 MYSQL_HOST"
        print_info "  - MYSQLUSER 或 MYSQL_USER"
        print_info "  - MYSQLPASSWORD 或 MYSQL_PASSWORD"
        print_info "  - MYSQLDATABASE 或 MYSQL_DATABASE"
        exit 1
    fi
    
    print_info "连接到 MySQL: $MYSQL_USER@$MYSQL_HOST:$MYSQL_PORT/$MYSQL_DATABASE"
    
    # 执行 SQL 脚本
    if mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" < "$INIT_SQL_FILE"; then
        print_info "✅ 数据库初始化成功！"
    else
        print_error "❌ 数据库初始化失败"
        exit 1
    fi
else
    # 方法二：在 Railway MySQL Terminal 中直接执行 SQL
    print_info "在 Railway MySQL Terminal 中执行 SQL..."
    print_info "如果当前在 Railway MySQL Terminal 中，请直接执行以下命令："
    echo
    echo "SOURCE $INIT_SQL_FILE;"
    echo
    print_info "或者复制以下内容到 Railway MySQL Terminal："
    echo "----------------------------------------"
    cat "$INIT_SQL_FILE"
    echo "----------------------------------------"
fi

print_info "数据库初始化完成！"


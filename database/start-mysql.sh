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
    
    # 将 SQL 文件复制到容器中并执行
    docker cp "$INIT_SQL_FILE" "$CONTAINER_NAME:/tmp/init.sql" > /dev/null
    
    if docker exec -i "$CONTAINER_NAME" mysql -uroot -p"$MYSQL_ROOT_PASSWORD" < "$INIT_SQL_FILE" 2>/dev/null; then
        print_info "数据库表创建成功"
    else
        print_warn "尝试使用另一种方式执行 SQL..."
        # 备用方法：直接在容器内执行
        docker exec "$CONTAINER_NAME" bash -c "mysql -uroot -p$MYSQL_ROOT_PASSWORD < /tmp/init.sql" 2>/dev/null && \
            print_info "数据库表创建成功" || \
            print_error "数据库表创建失败，请检查 SQL 脚本"
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
    
    # 显示连接信息
    show_connection_info
}

# 执行主函数
main


# Railway MySQL 自动初始化指南

## 方法一：使用 Railway MySQL Terminal（推荐）

### 步骤 1：打开 Railway MySQL Terminal

1. 登录 Railway (https://railway.app)
2. 进入项目 → 点击 MySQL 服务
3. 进入 "Data" 标签页
4. 点击 "Connect" → 选择 "MySQL Terminal"

### 步骤 2：执行初始化脚本

在 Railway MySQL Terminal 中，执行以下命令：

```bash
# 方法 A：如果 SQL 文件已上传到 Railway（通过 Git）
SOURCE /path/to/database/init-mysql.sql;

# 方法 B：直接粘贴 SQL 内容（推荐）
# 复制 database/init-mysql.sql 的全部内容，粘贴到终端并执行
```

## 方法二：使用本地脚本 + Railway CLI

### 前置要求

1. 安装 Railway CLI：
   ```bash
   npm i -g @railway/cli
   ```

2. 登录 Railway：
   ```bash
   railway login
   ```

### 执行初始化

```bash
# 1. 进入项目目录
cd /path/to/MantleLuxury

# 2. 连接到 Railway 项目
railway link

# 3. 执行初始化脚本（需要先获取 MySQL 连接信息）
railway run bash database/init-railway.sh
```

## 方法三：使用 MySQL 客户端（本地）

### 步骤 1：获取 Railway MySQL 连接信息

在 Railway MySQL 服务的 "Variables" 标签页，查看：
- `MYSQLHOST` 或 `MYSQL_HOST`
- `MYSQLPORT` 或 `MYSQL_PORT`（通常是 3306）
- `MYSQLDATABASE` 或 `MYSQL_DATABASE`
- `MYSQLUSER` 或 `MYSQL_USER`
- `MYSQLPASSWORD` 或 `MYSQL_PASSWORD`

### 步骤 2：使用 MySQL 客户端连接并执行

```bash
# 使用命令行 MySQL 客户端
mysql -h MYSQLHOST -P MYSQLPORT -u MYSQLUSER -pMYSQLPASSWORD MYSQLDATABASE < database/init-mysql.sql

# 或使用 MySQL Workbench、DBeaver 等 GUI 工具
# 1. 创建新连接，填入上述信息
# 2. 打开 database/init-mysql.sql 文件
# 3. 执行整个脚本
```

## 方法四：一键执行（最简单）

### 在 Railway MySQL Terminal 中

1. 打开 Railway MySQL Terminal（见方法一步骤 1）
2. 复制以下命令并执行：

```bash
# 如果项目已连接到 Git，可以直接执行：
SOURCE database/init-mysql.sql;
```

如果文件路径不对，可以：

```bash
# 查看当前目录
pwd

# 列出文件
ls -la

# 找到 init-mysql.sql 的路径后执行
SOURCE /完整路径/init-mysql.sql;
```

## 验证初始化

执行完成后，在 Railway MySQL Terminal 中验证：

```sql
-- 查看所有表
SHOW TABLES;

-- 应该看到以下表：
-- users
-- assets
-- valuations
-- yield_distributions
-- user_holdings
-- user_investments
-- aml_blacklist
-- aml_alerts          ⚠️ 重要
-- risk_assessments    ⚠️ 重要
-- asset_authentications
-- custodies
-- insurances
-- asset_reviews
-- event_indexer_state
-- blockchain_events

-- 检查特定表是否存在
SHOW TABLES LIKE 'aml_%';
SHOW TABLES LIKE 'risk_%';
```

## 常见问题

### Q: 为什么不能直接运行 `./database/start-mysql.sh`？

A: `start-mysql.sh` 是用于本地 Docker 环境的脚本，Railway MySQL 是托管服务，不能直接运行本地 Docker 脚本。

### Q: 如何自动化执行？

A: Railway MySQL 不支持在服务启动时自动执行 SQL 脚本。需要在首次部署后手动执行一次初始化脚本。

### Q: 如果表已存在会怎样？

A: SQL 脚本使用了 `CREATE TABLE IF NOT EXISTS`，如果表已存在，不会报错，也不会覆盖现有数据。

### Q: 如何重新初始化？

A: 如果需要完全重新初始化（会删除所有数据）：

```sql
-- ⚠️ 警告：这会删除所有数据！
DROP DATABASE IF EXISTS 数据库名;
CREATE DATABASE 数据库名 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE 数据库名;
SOURCE database/init-mysql.sql;
```

## 推荐流程

1. **首次部署**：在 Railway MySQL Terminal 中执行 `database/init-mysql.sql`
2. **后续更新**：如果 SQL 脚本有更新，只需执行新增或修改的部分
3. **验证**：使用 `SHOW TABLES` 确认所有表已创建


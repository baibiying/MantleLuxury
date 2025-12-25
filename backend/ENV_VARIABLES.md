# 后端环境变量配置说明

本文档说明后端服务所需的环境变量配置。

## 必需的环境变量

### 数据库配置

```bash
# 数据库连接 URL（Railway MySQL 会自动提供 MYSQLHOST, MYSQLPORT, MYSQLDATABASE）
DATABASE_URL=jdbc:mysql://MYSQLHOST:MYSQLPORT/MYSQLDATABASE?useSSL=true&serverTimezone=UTC&useUnicode=true&characterEncoding=UTF-8&allowPublicKeyRetrieval=true

# 数据库用户名（Railway MySQL 会自动提供）
DATABASE_USERNAME=MYSQLUSER

# 数据库密码（Railway MySQL 会自动提供）
DATABASE_PASSWORD=MYSQLPASSWORD
```

### 服务器配置

```bash
# 服务器端口（Railway 会自动设置 PORT 环境变量）
PORT=8080
```

### CORS 配置

```bash
# 允许的前端域名（多个用逗号分隔，不要有空格）
CORS_ALLOWED_ORIGINS=https://your-frontend.vercel.app,https://your-frontend.vercel.app
```

### 区块链配置

```bash
# 是否启用区块链功能
BLOCKCHAIN_ENABLED=true

# Mantle Sepolia 测试网 RPC URL
BLOCKCHAIN_RPC_URL=https://rpc.sepolia.mantle.xyz

# 区块链私钥（用于签名交易，请妥善保管）
BLOCKCHAIN_PRIVATE_KEY=your_private_key_here

# 智能合约地址
YIELD_DISTRIBUTION_CONTRACT=0x988304593FC2e89e56FFAD9393Af0B97c37d9E5D
KYC_REGISTRY_CONTRACT=0x519AD3F043581620e67567c896508b8Da33fF91D
CUSTODY_MANAGER_CONTRACT=0xF1c527a19b65E3e9Ab9AD7499cc8167C63c3ca87
```

### 管理员配置

```bash
# 管理员钱包地址列表（小写，用逗号分隔）
ADMIN_WALLET_ADDRESSES=0x70a0af9d47a0f6314c4eef2a68666b096701ebdf
```

## Railway 配置示例

在 Railway 后端服务的 "Variables" 标签页中，添加以下变量：

```bash
DATABASE_URL=jdbc:mysql://${{MySQL.MYSQLHOST}}:${{MySQL.MYSQLPORT}}/${{MySQL.MYSQLDATABASE}}?useSSL=true&serverTimezone=UTC&useUnicode=true&characterEncoding=UTF-8&allowPublicKeyRetrieval=true
DATABASE_USERNAME=${{MySQL.MYSQLUSER}}
DATABASE_PASSWORD=${{MySQL.MYSQLPASSWORD}}
CORS_ALLOWED_ORIGINS=https://your-frontend.vercel.app
BLOCKCHAIN_ENABLED=true
BLOCKCHAIN_RPC_URL=https://rpc.sepolia.mantle.xyz
BLOCKCHAIN_PRIVATE_KEY=your_private_key_here
YIELD_DISTRIBUTION_CONTRACT=0x988304593FC2e89e56FFAD9393Af0B97c37d9E5D
KYC_REGISTRY_CONTRACT=0x519AD3F043581620e67567c896508b8Da33fF91D
CUSTODY_MANAGER_CONTRACT=0xF1c527a19b65E3e9Ab9AD7499cc8167C63c3ca87
ADMIN_WALLET_ADDRESSES=0x70a0af9d47a0f6314c4eef2a68666b096701ebdf
```

**注意：** Railway 支持引用其他服务的变量，使用 `${{ServiceName.VARIABLE_NAME}}` 语法。

## 本地开发配置

在本地开发时，可以在 `backend` 目录创建 `.env` 文件（不要提交到 Git）：

```bash
DATABASE_URL=jdbc:mysql://localhost:3306/mantle_luxury?useSSL=false&serverTimezone=UTC&useUnicode=true&characterEncoding=UTF-8&allowPublicKeyRetrieval=true
DATABASE_USERNAME=root
DATABASE_PASSWORD=root123456
PORT=8080
CORS_ALLOWED_ORIGINS=http://localhost:3000
BLOCKCHAIN_ENABLED=true
BLOCKCHAIN_RPC_URL=https://rpc.sepolia.mantle.xyz
BLOCKCHAIN_PRIVATE_KEY=your_private_key_here
YIELD_DISTRIBUTION_CONTRACT=0x988304593FC2e89e56FFAD9393Af0B97c37d9E5D
KYC_REGISTRY_CONTRACT=0x519AD3F043581620e67567c896508b8Da33fF91D
CUSTODY_MANAGER_CONTRACT=0xF1c527a19b65E3e9Ab9AD7499cc8167C63c3ca87
ADMIN_WALLET_ADDRESSES=0x70a0af9d47a0f6314c4eef2a68666b096701ebdf
```

## 安全提示

1. **私钥安全**：
   - 永远不要将私钥提交到代码仓库
   - 使用环境变量或密钥管理服务存储
   - 定期轮换私钥

2. **数据库密码**：
   - 使用强密码
   - 不要在生产环境使用默认密码

3. **CORS 配置**：
   - 只允许必要的域名
   - 不要使用通配符 `*`


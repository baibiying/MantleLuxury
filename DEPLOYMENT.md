# 部署指南

本文档说明如何将 MantleLuxury 项目部署到生产环境：
- **前端**：使用 Vercel 部署
- **后端和数据库**：使用 Railway 部署

## 前置要求

1. GitHub 账号（用于代码仓库）
2. Vercel 账号（https://vercel.com）
3. Railway 账号（https://railway.app）
4. 已部署的智能合约地址（Mantle Sepolia 测试网）

## 一、数据库部署（Railway）

### 1.1 创建 MySQL 数据库服务

1. 登录 Railway（https://railway.app）
2. 点击 "New Project" → "Empty Project"
3. 点击 "New" → 选择 "Database" → 选择 "MySQL"
4. Railway 会自动创建 MySQL 数据库实例

### 1.2 配置数据库

1. 点击数据库服务，进入 "Variables" 标签页
2. 记录以下信息（后续会用到）：
   - `MYSQLHOST` - 数据库主机地址
   - `MYSQLPORT` - 数据库端口（通常是 3306）
   - `MYSQLDATABASE` - 数据库名称
   - `MYSQLUSER` - 数据库用户名
   - `MYSQLPASSWORD` - 数据库密码

### 1.3 初始化数据库表结构

1. 在数据库服务的 "Data" 标签页，点击 "Connect" 获取连接信息
2. 使用 MySQL 客户端（如 MySQL Workbench、DBeaver 或命令行）连接到数据库
3. 执行 `database/init-mysql.sql` 脚本创建表结构

或者使用 Railway 的 MySQL 终端：
```bash
# 在 Railway 数据库服务的 "Data" 标签页，点击 "Connect" → "MySQL Terminal"
# 然后执行 SQL 脚本
```

## 二、后端部署（Railway）

### 2.1 准备代码仓库

确保代码已推送到 GitHub 仓库。

### 2.2 创建后端服务

1. 在 Railway 项目中，点击 "New" → "GitHub Repo"
2. 选择你的 GitHub 仓库
3. Railway 会自动检测到 `backend` 目录（如果没有，需要手动配置根目录）

### 2.3 配置环境变量

在后端服务的 "Variables" 标签页，添加以下环境变量：

```bash
# 数据库配置（从 MySQL 服务获取）
DATABASE_URL=jdbc:mysql://MYSQLHOST:MYSQLPORT/MYSQLDATABASE?useSSL=true&serverTimezone=UTC&useUnicode=true&characterEncoding=UTF-8&allowPublicKeyRetrieval=true
DATABASE_USERNAME=MYSQLUSER
DATABASE_PASSWORD=MYSQLPASSWORD

# 服务器端口（Railway 会自动设置，但可以显式指定）
PORT=8080

# CORS 配置（替换为你的 Vercel 前端域名）
CORS_ALLOWED_ORIGINS=https://your-frontend.vercel.app,https://your-frontend.vercel.app

# 区块链配置
BLOCKCHAIN_ENABLED=true
BLOCKCHAIN_RPC_URL=https://rpc.sepolia.mantle.xyz
BLOCKCHAIN_PRIVATE_KEY=your_private_key_here
YIELD_DISTRIBUTION_CONTRACT=0x988304593FC2e89e56FFAD9393Af0B97c37d9E5D
KYC_REGISTRY_CONTRACT=0x519AD3F043581620e67567c896508b8Da33fF91D
CUSTODY_MANAGER_CONTRACT=0xF1c527a19b65E3e9Ab9AD7499cc8167C63c3ca87

# 管理员配置
ADMIN_WALLET_ADDRESSES=0x70a0af9d47a0f6314c4eef2a68666b096701ebdf
```

**重要提示：**
- `DATABASE_URL` 中的 `MYSQLHOST`、`MYSQLPORT`、`MYSQLDATABASE` 需要替换为实际值
- `CORS_ALLOWED_ORIGINS` 需要包含你的 Vercel 前端域名
- `BLOCKCHAIN_PRIVATE_KEY` 是敏感信息，请妥善保管

### 2.4 配置构建和启动

Railway 会自动使用 `nixpacks.toml` 或 `railway.json` 配置进行构建。

如果自动检测失败，可以手动设置：
- **Root Directory**: `backend`
- **Build Command**: `./gradlew bootJar`
- **Start Command**: `java -jar build/libs/mantle-luxury-backend-0.0.1-SNAPSHOT.jar`

### 2.5 获取后端 URL

部署完成后，在服务的 "Settings" → "Networking" 中：
1. 点击 "Generate Domain" 生成公共域名
2. 记录这个域名（例如：`your-backend.railway.app`）

## 三、前端部署（Vercel）

### 3.1 连接 GitHub 仓库

1. 登录 Vercel（https://vercel.com）
2. 点击 "Add New..." → "Project"
3. 导入你的 GitHub 仓库

### 3.2 配置项目

在项目配置页面：

1. **Framework Preset**: Next.js（自动检测）
2. **Root Directory**: `frontend`
3. **Build Command**: `npm run build`（默认）
4. **Output Directory**: `.next`（默认）

### 3.3 配置环境变量

在 "Environment Variables" 部分，添加：

```bash
NEXT_PUBLIC_API_BASE_URL=https://your-backend.railway.app
```

**重要：** 将 `your-backend.railway.app` 替换为你在步骤 2.5 中获取的后端域名。

### 3.4 部署

点击 "Deploy" 开始部署。Vercel 会自动：
1. 安装依赖
2. 构建项目
3. 部署到 CDN

### 3.5 获取前端 URL

部署完成后，Vercel 会提供一个域名（例如：`your-project.vercel.app`）。

## 四、更新 CORS 配置

部署前端后，需要更新后端的 CORS 配置：

1. 回到 Railway 后端服务的 "Variables"
2. 更新 `CORS_ALLOWED_ORIGINS`，添加你的 Vercel 域名：
   ```
   CORS_ALLOWED_ORIGINS=https://your-project.vercel.app,https://your-project.vercel.app
   ```
3. Railway 会自动重新部署

## 五、验证部署

### 5.1 检查后端健康状态

访问：`https://your-backend.railway.app/api/health`

应该返回：
```json
{"status":"UP"}
```

### 5.2 检查前端

访问你的 Vercel 域名，确认：
- 页面正常加载
- 可以连接到后端 API
- Web3 功能正常工作

### 5.3 测试 API 连接

在浏览器控制台执行：
```javascript
fetch('https://your-backend.railway.app/api/assets')
  .then(res => res.json())
  .then(data => console.log(data))
```

## 六、文件上传配置（可选）

如果需要支持文件上传，可以考虑：

1. **使用 Railway 的持久化存储**（需要付费计划）
2. **使用外部存储服务**（如 AWS S3、Cloudinary）
3. **使用 IPFS**（适合去中心化应用）

当前配置中，上传的文件会存储在服务器的 `uploads` 目录，这在 Railway 的临时文件系统中可能不会持久化。

## 七、监控和日志

### Railway

- 在服务页面查看实时日志
- 使用 "Metrics" 标签页查看资源使用情况

### Vercel

- 在项目页面查看部署日志
- 使用 "Analytics" 查看访问统计

## 八、常见问题

### 问题 1：后端无法连接数据库

**解决方案：**
- 检查 `DATABASE_URL` 是否正确
- 确认数据库服务正在运行
- 检查数据库防火墙设置（Railway 通常自动配置）

### 问题 2：CORS 错误

**解决方案：**
- 确认 `CORS_ALLOWED_ORIGINS` 包含前端域名
- 检查域名是否包含 `https://` 前缀
- 重启后端服务

### 问题 3：前端无法连接后端

**解决方案：**
- 检查 `NEXT_PUBLIC_API_BASE_URL` 是否正确
- 确认后端服务正在运行
- 检查浏览器控制台的错误信息

### 问题 4：构建失败

**后端构建失败：**
- 检查 Java 版本（需要 Java 17）
- 查看 Railway 构建日志

**前端构建失败：**
- 检查 Node.js 版本
- 查看 Vercel 构建日志
- 确认所有依赖都已安装

## 九、持续部署

### Railway

Railway 默认启用自动部署：
- 当代码推送到 GitHub 主分支时自动部署
- 可以在 "Settings" → "Source" 中配置分支

### Vercel

Vercel 默认启用自动部署：
- 当代码推送到 GitHub 主分支时自动部署
- 可以在项目设置中配置分支和预览部署

## 十、安全建议

1. **私钥管理**：
   - 永远不要将私钥提交到代码仓库
   - 使用环境变量存储敏感信息
   - 考虑使用密钥管理服务（如 Railway 的 Secrets）

2. **数据库安全**：
   - 使用强密码
   - 限制数据库访问（Railway 自动处理）
   - 定期备份数据

3. **API 安全**：
   - 考虑添加 API 限流
   - 使用 HTTPS（Railway 和 Vercel 自动提供）
   - 验证用户输入

4. **CORS 配置**：
   - 只允许必要的域名
   - 不要使用通配符 `*`（除非必要）

## 十一、成本估算

### Railway

- **免费计划**：$5 免费额度/月
- **Hobby 计划**：$5/月
- MySQL 数据库：约 $5/月

### Vercel

- **免费计划**：适合个人项目
- **Pro 计划**：$20/月（团队功能）

**总计（免费计划）**：约 $0-10/月

## 十二、下一步

部署完成后，建议：

1. 设置自定义域名（可选）
2. 配置 SSL 证书（Railway 和 Vercel 自动提供）
3. 设置监控和告警
4. 配置备份策略
5. 优化性能（CDN、缓存等）

---

如有问题，请查看：
- [Railway 文档](https://docs.railway.app)
- [Vercel 文档](https://vercel.com/docs)
- [Next.js 文档](https://nextjs.org/docs)


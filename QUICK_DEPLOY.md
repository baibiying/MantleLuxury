# 快速部署检查清单

按照以下步骤快速部署项目到生产环境。

## 📋 部署前准备

- [ ] 代码已推送到 GitHub 仓库
- [ ] 已准备好智能合约地址（Mantle Sepolia 测试网）
- [ ] 已准备好区块链私钥（用于后端签名交易）

## 🗄️ 第一步：部署数据库（Railway）

1. [ ] 登录 Railway（https://railway.app）
2. [ ] 创建新项目 "New Project" → "Empty Project"
3. [ ] 添加 MySQL 数据库："New" → "Database" → "MySQL"
4. [ ] 记录数据库连接信息（在 Variables 标签页）：
   - `MYSQLHOST`
   - `MYSQLPORT`
   - `MYSQLDATABASE`
   - `MYSQLUSER`
   - `MYSQLPASSWORD`
5. [ ] 初始化数据库表结构：
   - 在数据库服务的 "Data" 标签页点击 "Connect"
   - 执行 `database/init-mysql.sql` 脚本

## 🔧 第二步：部署后端（Railway）

1. [ ] 在同一个 Railway 项目中，添加后端服务："New" → "GitHub Repo"
2. [ ] 选择你的 GitHub 仓库
3. [ ] 设置根目录为 `backend`（如果未自动检测）
4. [ ] 配置环境变量（在 "Variables" 标签页）：

```bash
# 数据库配置（使用 Railway 变量引用）
DATABASE_URL=jdbc:mysql://${{MySQL.MYSQLHOST}}:${{MySQL.MYSQLPORT}}/${{MySQL.MYSQLDATABASE}}?useSSL=true&serverTimezone=UTC&useUnicode=true&characterEncoding=UTF-8&allowPublicKeyRetrieval=true
DATABASE_USERNAME=${{MySQL.MYSQLUSER}}
DATABASE_PASSWORD=${{MySQL.MYSQLPASSWORD}}

# CORS 配置（先填占位符，部署前端后更新）
CORS_ALLOWED_ORIGINS=https://your-frontend.vercel.app

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

5. [ ] 等待部署完成
6. [ ] 在 "Settings" → "Networking" 中生成公共域名
7. [ ] 记录后端域名（例如：`your-backend.railway.app`）
8. [ ] 测试健康检查：访问 `https://your-backend.railway.app/api/health`

## 🌐 第三步：部署前端（Vercel）

1. [ ] 登录 Vercel（https://vercel.com）
2. [ ] 导入 GitHub 仓库："Add New..." → "Project"
3. [ ] 配置项目：
   - Root Directory: `frontend`
   - Framework Preset: Next.js（自动检测）
4. [ ] 添加环境变量：
   ```bash
   NEXT_PUBLIC_API_BASE_URL=https://your-backend.railway.app
   ```
   （替换为你的实际后端域名）
5. [ ] 点击 "Deploy"
6. [ ] 等待部署完成
7. [ ] 记录前端域名（例如：`your-project.vercel.app`）

## 🔄 第四步：更新 CORS 配置

1. [ ] 回到 Railway 后端服务的 "Variables"
2. [ ] 更新 `CORS_ALLOWED_ORIGINS`：
   ```bash
   CORS_ALLOWED_ORIGINS=https://your-project.vercel.app
   ```
   （替换为你的实际 Vercel 域名）
3. [ ] Railway 会自动重新部署

## ✅ 第五步：验证部署

1. [ ] 访问前端域名，确认页面正常加载
2. [ ] 打开浏览器开发者工具，检查网络请求
3. [ ] 确认 API 请求发送到正确的后端地址
4. [ ] 测试主要功能：
   - [ ] 连接钱包
   - [ ] 查看资产列表
   - [ ] 提交 KYC
   - [ ] 查看投资组合

## 🐛 常见问题排查

### 后端无法连接数据库
- 检查 `DATABASE_URL` 是否正确
- 确认数据库服务正在运行
- 检查 Railway 变量引用语法

### CORS 错误
- 确认 `CORS_ALLOWED_ORIGINS` 包含前端域名
- 检查域名是否包含 `https://` 前缀
- 重启后端服务

### 前端无法连接后端
- 检查 `NEXT_PUBLIC_API_BASE_URL` 是否正确
- 确认后端服务正在运行
- 检查浏览器控制台的错误信息

### 构建失败
- 查看 Railway/Vercel 的构建日志
- 确认所有依赖都已正确安装
- 检查 Java/Node.js 版本

## 📚 详细文档

- 完整部署指南：查看 `DEPLOYMENT.md`
- 后端环境变量：查看 `backend/ENV_VARIABLES.md`
- 前端环境变量：查看 `frontend/ENV_VARIABLES.md`

## 🎉 部署完成！

部署成功后，你的应用应该可以正常访问了。记得：
- 定期检查日志
- 监控资源使用情况
- 备份重要数据
- 更新安全配置


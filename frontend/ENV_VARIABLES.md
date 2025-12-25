# 前端环境变量配置说明

本文档说明前端服务所需的环境变量配置。

## 必需的环境变量

### API 配置

```bash
# 后端 API 基础 URL
NEXT_PUBLIC_API_BASE_URL=https://your-backend.railway.app
```

**注意：** `NEXT_PUBLIC_` 前缀表示这个变量会在构建时注入到客户端代码中。

## Vercel 配置

在 Vercel 项目的 "Settings" → "Environment Variables" 中，添加：

```bash
NEXT_PUBLIC_API_BASE_URL=https://your-backend.railway.app
```

**重要：** 将 `your-backend.railway.app` 替换为你的实际后端域名。

## 本地开发配置

在本地开发时，可以在 `frontend` 目录创建 `.env.local` 文件（不要提交到 Git）：

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
```

或者使用 `.env.development` 文件：

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
```

## 环境变量优先级

Next.js 按以下顺序加载环境变量：

1. `.env.local`（所有环境，本地优先）
2. `.env.development` 或 `.env.production`（根据 `NODE_ENV`）
3. `.env`

**注意：** `.env.local` 文件应该添加到 `.gitignore` 中。

## 使用环境变量

在代码中使用环境变量：

```typescript
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";
```

## 部署后更新

如果后端 URL 发生变化，需要：

1. 在 Vercel 中更新 `NEXT_PUBLIC_API_BASE_URL`
2. 重新部署前端（Vercel 会自动触发）

## 验证配置

部署后，可以在浏览器控制台检查：

```javascript
console.log('API Base URL:', process.env.NEXT_PUBLIC_API_BASE_URL);
```

或者检查网络请求，确认 API 请求发送到正确的后端地址。


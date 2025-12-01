# MantleLuxury 技术设计文档

**版本：** v1.0  
**最后更新：** 2025-12-01  
**文档类型：** 技术架构与实现设计文档

---

## 目录

1. [总体架构概览](#1-总体架构概览)
2. [智能合约设计](#2-智能合约设计)
3. [后端服务设计](#3-后端服务设计)
4. [前端应用设计](#4-前端应用设计)
5. [Mantle 集成设计](#5-mantle-集成设计)
6. [数据存储设计](#6-数据存储设计)
7. [安全与合规设计](#7-安全与合规设计)
8. [API 设计](#8-api-设计)
9. [部署与运维](#9-部署与运维)
10. [开发环境与工具链](#10-开发环境与工具链)

---

## 1. 总体架构概览

### 1.1 架构分层

```
┌─────────────────────────────────────────────────────────┐
│                    前端层 (Frontend)                      │
│  Next.js + TypeScript + Tailwind CSS                     │
│  - 资产展示、投资流程、投资组合、KYC                      │
└─────────────────────────────────────────────────────────┘
                            ↕ HTTP/WebSocket
┌─────────────────────────────────────────────────────────┐
│                  BFF 层 (Backend for Frontend)           │
│  Spring Boot (REST API / Gateway)                        │
│  - 统一 API 入口、请求聚合、权限校验                      │
└─────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────┐
│                  业务服务层 (Microservices)               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐│
│  │ 用户服务 │  │ 资产服务 │  │ 收益服务 │  │ 合规服务 ││
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘│
└─────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────┐
│                  区块链层 (Mantle L2)                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐│
│  │LuxuryToken│ │KYCRegistry│ │YieldDist.│ │CustodyMgr ││
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘│
└─────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────┐
│                  数据与存储层                             │
│  PostgreSQL + Redis + IPFS/S3 + 事件索引器              │
└─────────────────────────────────────────────────────────┘
```

### 1.2 技术栈选型

#### 前端
- **框架**: Next.js 14+ (App Router)
- **语言**: TypeScript
- **样式**: Tailwind CSS
- **Web3 集成**: 
  - `ethers.js` 或 `viem` (以太坊/Mantle 交互)
  - `wagmi` (React Hooks for Ethereum)
  - `WalletConnect` (多钱包支持)

#### 后端
- **BFF/API Gateway**: Spring Boot
- **微服务**: Java 17+ + Spring Boot
- **数据库**: PostgreSQL (主数据) + Redis (缓存)
- **消息队列**: RabbitMQ 或 Kafka（可选，用于异步任务）

#### 区块链
- **开发框架**: Hardhat
- **语言**: Solidity 0.8.20+
- **库**: OpenZeppelin Contracts
- **网络**: Mantle L2 (测试网/主网)

#### 基础设施
- **容器化**: Docker + Docker Compose (开发) / Kubernetes (生产)
- **CI/CD**: GitHub Actions
- **监控**: Prometheus + Grafana
- **日志**: ELK Stack 或 Loki

### 1.3 核心设计原则

1. **链上链下分离**
   - 关键状态（KYC、资产所有权、收益分配）在链上可验证
   - 大体积数据（图片、报告、元数据）存储在链下（IPFS/S3），哈希上链

2. **最小信任面**
   - 所有与资产和收益相关的操作以链上结果为准
   - 前端和后端仅作为链上数据的展示和索引层

3. **可扩展性**
   - 微服务架构便于独立扩展
   - 合约设计支持批量操作，降低 Gas 成本

4. **安全优先**
   - 多签钱包管理关键操作
   - 所有合约通过第三方审计
   - 后台系统采用 RBAC 权限控制

---

## 2. 智能合约设计

### 2.1 合约架构

#### 2.1.1 LuxuryToken (ERC-20 份额代币)

**功能概述**: 代表单个实物奢侈品的份额代币，基于 ERC-20 标准，增加 KYC 转账限制。

**核心接口**:

```solidity
interface ILuxuryToken {
    // 基础 ERC-20 功能
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    
    // 资产元数据
    function assetId() external view returns (bytes32);
    function metadataHash() external view returns (bytes32);
    function custodyManager() external view returns (address);
    
    // 发行与配置（仅管理员）
    function mint(address to, uint256 amount) external;
    function setMetadataHash(bytes32 _hash) external;
}
```

**关键实现细节**:
- 继承 `ERC20` 和 `ERC20Pausable` (OpenZeppelin)
- 在 `_beforeTokenTransfer` 中检查 `KYCRegistry.isKYCApproved(to)`
- 存储 `assetId` (bytes32) 和 `metadataHash` (IPFS 哈希)
- 支持 `Ownable` 或 `AccessControl` 进行权限管理

**事件**:
```solidity
event TokenIssued(bytes32 indexed assetId, address indexed tokenAddress, uint256 totalSupply);
event MetadataUpdated(bytes32 indexed assetId, bytes32 newHash);
```

#### 2.1.2 KYCRegistry (KYC 状态注册表)

**功能概述**: 链上维护地址与 KYC 状态的映射，供其他合约检查权限。

**核心接口**:

```solidity
interface IKYCRegistry {
    enum Status { None, Pending, Approved, Rejected, Blacklisted }
    
    function setKYCStatus(address user, Status status) external;
    function getKYCStatus(address user) external view returns (Status);
    function isKYCApproved(address user) external view returns (bool);
    function batchSetKYCStatus(address[] calldata users, Status[] calldata statuses) external;
}
```

**关键实现细节**:
- 使用 `mapping(address => Status)` 存储状态
- 仅 `ROLE_COMPLIANCE` 角色可调用 `setKYCStatus`
- `isKYCApproved` 返回 `status == Status.Approved`
- 支持批量操作以降低 Gas 成本

**事件**:
```solidity
event KYCStatusUpdated(address indexed user, Status indexed oldStatus, Status indexed newStatus);
```

#### 2.1.3 YieldDistribution (收益分配合约)

**功能概述**: 根据持仓比例，将收益池资金分配给持有人。支持升值收益和租赁收益两种类型。

**核心接口**:

```solidity
interface IYieldDistribution {
    enum YieldType { Appreciation, Rental }
    
    struct Distribution {
        bytes32 distributionId;
        address tokenAddress;  // LuxuryToken 地址
        YieldType yieldType;
        uint256 totalAmount;
        uint256 distributedAmount;
        bool isCompleted;
        uint256 createdAt;
    }
    
    function createDistribution(
        bytes32 distributionId,
        address tokenAddress,
        YieldType yieldType,
        uint256 totalAmount
    ) external;
    
    function distribute(bytes32 distributionId) external;
    function claim(bytes32 distributionId, address user) external;
    function getDistribution(bytes32 distributionId) external view returns (Distribution memory);
}
```

**分配策略** (MVP 采用方案 A，后续可升级为 Merkle):
- **方案 A (直接循环分发)**: 合约遍历所有持有人，按比例转账（适合持有人 < 100）
- **方案 B (Merkle 分发)**: 链下计算 Merkle 树，用户自行 `claim`（适合大规模分发）

**关键实现细节**:
- 接收稳定币（USDC/USDT）或原生代币（ETH/MNT）
- 使用 `LuxuryToken.balanceOf` 计算持仓比例
- 支持暂停/恢复分配（紧急情况）
- 记录每次分配的完整历史

**事件**:
```solidity
event DistributionCreated(
    bytes32 indexed distributionId,
    address indexed tokenAddress,
    YieldType indexed yieldType,
    uint256 totalAmount
);
event DistributionCompleted(bytes32 indexed distributionId, uint256 totalDistributed);
event Claimed(bytes32 indexed distributionId, address indexed user, uint256 amount);
```

#### 2.1.4 CustodyManager (托管与保险管理)

**功能概述**: 记录实物资产托管、保险状态，对接线下流程。

**核心接口**:

```solidity
interface ICustodyManager {
    enum AssetStatus { Registered, InCustody, ForSale, Sold, Withdrawn }
    
    struct AssetInfo {
        bytes32 assetId;
        AssetStatus status;
        bytes32 custodyInfoHash;  // 托管机构、位置等信息的哈希
        bytes32 insuranceInfoHash; // 保险信息的哈希
        address tokenAddress;  // 关联的 LuxuryToken
        uint256 registeredAt;
    }
    
    function registerAsset(
        bytes32 assetId,
        address tokenAddress,
        bytes32 custodyInfoHash,
        bytes32 insuranceInfoHash
    ) external;
    
    function updateStatus(bytes32 assetId, AssetStatus newStatus) external;
    function updateCustodyInfo(bytes32 assetId, bytes32 newHash) external;
    function updateInsuranceInfo(bytes32 assetId, bytes32 newHash) external;
    function getAssetInfo(bytes32 assetId) external view returns (AssetInfo memory);
}
```

**关键实现细节**:
- 状态迁移需多签确认或特定角色授权
- `Sold` 状态触发后，可自动通知 `YieldDistribution` 创建分配
- 所有链下详细信息（托管机构名称、地址、保险单号等）仅存储哈希

**事件**:
```solidity
event AssetRegistered(bytes32 indexed assetId, address indexed tokenAddress, bytes32 custodyHash);
event StatusUpdated(bytes32 indexed assetId, AssetStatus indexed oldStatus, AssetStatus indexed newStatus);
event CustodyInfoUpdated(bytes32 indexed assetId, bytes32 newHash);
event InsuranceInfoUpdated(bytes32 indexed assetId, bytes32 newHash);
```

### 2.2 合约部署与升级策略

#### 部署顺序
1. `KYCRegistry` (基础合约，其他合约依赖)
2. `CustodyManager` (资产注册需要)
3. `YieldDistribution` (收益分配需要)
4. `LuxuryToken` (每个资产一个实例，通过工厂合约或手动部署)

#### 升级策略
- **不可升级合约**: `KYCRegistry`, `CustodyManager` (核心状态，避免复杂性)
- **可升级合约**: `YieldDistribution` (可能需要优化分配算法)
- **工厂模式**: `LuxuryTokenFactory` 用于批量部署 `LuxuryToken` 实例

### 2.3 安全考虑

- **使用 OpenZeppelin 库**: `ReentrancyGuard`, `Pausable`, `AccessControl`
- **输入验证**: 所有外部输入进行边界检查
- **Gas 优化**: 批量操作、事件精简、存储优化
- **审计要求**: 所有合约上线前通过第三方安全审计

---

## 3. 后端服务设计

### 3.1 服务模块划分

#### 3.1.1 BFF (Backend for Frontend)

**职责**:
- 统一 API 入口，聚合多个微服务数据
- 处理前端特定的数据格式转换
- 实现请求限流、认证、日志记录

**技术栈**: Java 17+ + Spring Boot (Spring Web, Spring Security)

**主要路由**:
```
GET  /api/assets              # 资产列表
GET  /api/assets/:id          # 资产详情
POST /api/assets/:id/purchase # 购买代币（生成交易参数）
GET  /api/portfolio           # 用户投资组合
GET  /api/kyc/status          # KYC 状态
POST /api/kyc/submit          # 提交 KYC
GET  /api/yields              # 收益记录
```

#### 3.1.2 用户与合规服务 (Identity & Compliance Service)

**技术栈**: Java 17+ + Spring Boot (Spring Web, Spring Data JPA, Spring Security)  

**职责**:
- 管理用户身份信息（链下存储，加密）
- 对接第三方 KYC/AML 服务（如 Sumsub, Onfido）
- 与 `KYCRegistry` 合约同步 KYC 状态（通过 web3j 调用合约）
- 处理 AML 风险检测与黑名单管理

**核心功能**:
- KYC 审核工作流（基于数据库状态机 + Spring 事件）
- AML 地址筛查（Chainalysis/Elliptic 集成）
- 用户权限与角色管理（基于 Spring Security + RBAC）

#### 3.1.3 资产与估值服务 (Asset Service)

**技术栈**: Java 17+ + Spring Boot (Spring Web, Spring Data JPA)  

**职责**:
- 管理资产链下元数据（品牌、型号、图片、报告）
- 存储托管与保险文档（IPFS/S3）
- 与 `CustodyManager` 状态同步（监听链上事件或定时拉取）
- 管理估值记录与历史

**核心功能**:
- 资产上架审核流程
- 元数据 CRUD 操作
- IPFS 上传与哈希管理
- 估值报告存储与版本管理

#### 3.1.4 收益与报表服务 (Yield & Reporting Service)

**技术栈**: Java 17+ + Spring Boot (Spring Web, Spring Batch)  

**职责**:
- 监听链上收益分配事件
- 为用户生成收益报表（CSV/PDF）
- 为机构生成合规审计报表
- 计算与展示收益统计

**核心功能**:
- 事件索引与数据同步
- 报表生成（年度收益、交易记录）
- 数据导出（CSV, PDF）

### 3.2 事件索引器 (Event Indexer)

**职责**: 监听 Mantle 链上事件，同步到数据库。

**监听的事件**:
- `LuxuryToken.TokenIssued`
- `KYCRegistry.KYCStatusUpdated`
- `YieldDistribution.DistributionCreated`, `Claimed`
- `CustodyManager.StatusUpdated`

**实现方式**:
- 使用 `web3j` 或 Java 以太坊/Mantle 客户端库监听事件
- 定期扫描区块（从上次同步位置开始）
- 将事件数据写入 PostgreSQL
- 处理链重组（reorg）情况

### 3.3 数据同步策略

- **链上 → 链下**: 事件索引器实时同步
- **链下 → 链上**: 通过管理员钱包/多签调用合约（KYC 状态更新、收益分配触发）

---

## 4. 前端应用设计

### 4.1 项目结构

```
web/
├── app/                    # Next.js App Router
│   ├── page.tsx           # 首页
│   ├── assets/
│   │   ├── page.tsx       # 资产列表
│   │   └── [id]/
│   │       └── page.tsx   # 资产详情
│   ├── portfolio/
│   │   └── page.tsx       # 投资组合
│   └── kyc/
│       └── page.tsx       # KYC 流程
├── components/            # 通用组件
│   ├── WalletConnect.tsx
│   ├── AssetCard.tsx
│   ├── AssetDetail.tsx
│   ├── PortfolioChart.tsx
│   └── KYCForm.tsx
├── lib/
│   ├── web3/              # Web3 工具
│   │   ├── contracts.ts  # 合约 ABI 与地址
│   │   ├── hooks.ts      # React Hooks (useWallet, useLuxuryToken)
│   │   └── mantle.ts     # Mantle 网络配置
│   └── api/               # 后端 API 客户端
│       └── client.ts
└── public/                # 静态资源
```

### 4.2 核心功能实现

#### 4.2.1 钱包连接

使用 `wagmi` + `WalletConnect`:

```typescript
// lib/web3/hooks.ts
import { useAccount, useConnect, useNetwork } from 'wagmi';
import { mantleTestnet } from 'wagmi/chains';

export function useWallet() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { chain, switchNetwork } = useNetwork();
  
  // 检查是否在 Mantle 网络
  const isMantleNetwork = chain?.id === mantleTestnet.id;
  
  return { address, isConnected, connect, isMantleNetwork, switchNetwork };
}
```

#### 4.2.2 资产列表与详情

- **列表页**: 从后端 API 获取资产数据，支持筛选和排序
- **详情页**: 
  - 展示高清图片、3D 模型（Three.js 或模型查看器）
  - 显示估值报告、托管/保险信息
  - 购买模块：输入金额 → 计算份额 → 调用合约 `transfer`

#### 4.2.3 投资组合

- 从链上读取用户持有的所有 `LuxuryToken` 余额
- 从后端 API 获取资产元数据和估值
- 使用 Chart.js 或 Recharts 展示收益曲线和资产分布

#### 4.2.4 KYC 流程

- 多步骤表单（React Hook Form）
- 文件上传（图片、PDF）
- 调用后端 API 提交 KYC
- 轮询或 WebSocket 获取审核状态

### 4.3 状态管理

- **全局状态**: Zustand 或 React Context (钱包状态、用户信息)
- **服务端状态**: React Query (资产列表、投资组合数据)
- **链上状态**: `wagmi` hooks (余额、交易状态)

### 4.4 样式与 UI

- **设计系统**: Tailwind CSS + 自定义组件库
- **主题**: 符合奢侈品定位的高端视觉风格（深色/浅色模式）
- **响应式**: 移动端优先，桌面端优化

---

## 5. Mantle 集成设计

### 5.1 网络配置

**测试网配置**:
```typescript
// lib/web3/mantle.ts
export const mantleTestnet = {
  id: 5001,
  name: 'Mantle Testnet',
  network: 'mantle-testnet',
  nativeCurrency: { name: 'Mantle', symbol: 'MNT', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.testnet.mantle.xyz'] },
    public: { http: ['https://rpc.testnet.mantle.xyz'] },
  },
  blockExplorers: {
    default: { name: 'Mantle Explorer', url: 'https://explorer.testnet.mantle.xyz' },
  },
};
```

### 5.2 Gas 优化策略

- **批量操作**: 收益分配使用批量转账，减少交易次数
- **事件精简**: 只记录必要数据，降低 Gas 消耗
- **存储优化**: 使用 `bytes32` 存储哈希而非完整字符串

### 5.3 跨链桥接

- 集成 Mantle 官方桥接方案
- 前端提供从以太坊主网到 Mantle 的资产桥接引导
- 支持 USDC/USDT 等稳定币跨链

### 5.4 监控与健康检查

- 监控 Mantle RPC 节点可用性
- 跟踪区块确认时间
- 告警：RPC 延迟 > 5s 或节点不可用

---

## 6. 数据存储设计

### 6.1 关系型数据库 (PostgreSQL)

#### 核心表结构

**users 表**:
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address VARCHAR(42) UNIQUE NOT NULL,
    email VARCHAR(255),
    kyc_status VARCHAR(20) NOT NULL, -- 'none', 'pending', 'approved', 'rejected'
    kyc_submitted_at TIMESTAMP,
    kyc_approved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

**assets 表**:
```sql
CREATE TABLE assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id_bytes32 VARCHAR(66) UNIQUE NOT NULL, -- 链上 assetId
    token_address VARCHAR(42) NOT NULL, -- LuxuryToken 合约地址
    asset_type VARCHAR(50) NOT NULL, -- 'watch', 'jewelry'
    brand VARCHAR(100),
    model VARCHAR(100),
    year INTEGER,
    total_supply NUMERIC(36, 18), -- 代币总供应量
    price_per_share NUMERIC(36, 18), -- 每份价格
    metadata_hash VARCHAR(66), -- IPFS 哈希
    custody_info_hash VARCHAR(66),
    insurance_info_hash VARCHAR(66),
    status VARCHAR(20) NOT NULL, -- 'registered', 'fundraising', 'funded', 'sold'
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

**valuations 表**:
```sql
CREATE TABLE valuations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID REFERENCES assets(id),
    valuation_amount NUMERIC(36, 18),
    valuation_currency VARCHAR(10) DEFAULT 'USD',
    valuation_date DATE,
    valuation_agency VARCHAR(100),
    report_url TEXT, -- IPFS 或 S3 URL
    created_at TIMESTAMP DEFAULT NOW()
);
```

**yield_distributions 表**:
```sql
CREATE TABLE yield_distributions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    distribution_id_bytes32 VARCHAR(66) UNIQUE NOT NULL,
    asset_id UUID REFERENCES assets(id),
    token_address VARCHAR(42) NOT NULL,
    yield_type VARCHAR(20) NOT NULL, -- 'appreciation', 'rental'
    total_amount NUMERIC(36, 18),
    distributed_amount NUMERIC(36, 18) DEFAULT 0,
    is_completed BOOLEAN DEFAULT FALSE,
    transaction_hash VARCHAR(66),
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);
```

**user_holdings 表** (从链上事件索引):
```sql
CREATE TABLE user_holdings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_address VARCHAR(42) NOT NULL,
    token_address VARCHAR(42) NOT NULL,
    balance NUMERIC(36, 18) NOT NULL,
    last_updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_address, token_address)
);
```

### 6.2 缓存 (Redis)

**缓存策略**:
- 资产列表（TTL: 5 分钟）
- 首页统计数据（AUM、用户数，TTL: 1 分钟）
- KYC 状态（TTL: 10 分钟）
- 用户持仓（TTL: 30 秒）

### 6.3 对象存储 (IPFS/S3)

**存储内容**:
- 资产高清图片
- 3D 模型文件
- 估值报告 PDF
- 鉴定证书扫描件
- 托管与保险文档

**哈希管理**: 所有文件上传后返回 IPFS 哈希，存储到数据库并上链。

---

## 7. 安全与合规设计

### 7.1 智能合约安全

- **审计**: 所有合约上线前通过第三方审计（如 OpenZeppelin, Trail of Bits）
- **漏洞赏金**: 建立漏洞赏金计划，鼓励社区发现安全问题
- **多签钱包**: 关键操作（KYC 状态更新、收益分配触发）需多签确认

### 7.2 后端安全

- **认证**: JWT Token + 多因素认证（MFA）
- **权限控制**: RBAC (Role-Based Access Control)
- **API 限流**: 防止 DDoS 和滥用
- **数据加密**: 敏感数据（用户身份信息）加密存储

### 7.3 合规流程

- **KYC/AML**: 集成第三方服务（Sumsub, Onfido, Chainalysis）
- **风控规则**: 
  - 大额交易（> 10,000 USD）触发人工审核
  - 高风险地址自动冻结
- **审计日志**: 所有关键操作记录审计日志，可追溯

### 7.4 数据隐私

- **GDPR 合规**: 支持用户数据导出和删除
- **数据脱敏**: 序列号等敏感信息在前端脱敏显示
- **访问控制**: 仅授权人员可访问完整用户数据

---

## 8. API 设计

### 8.1 REST API 规范

**基础 URL**: `https://api.mantleluxury.com/v1`

#### 资产相关

```
GET    /assets                    # 获取资产列表
GET    /assets/:id                # 获取资产详情
POST   /assets/:id/purchase        # 生成购买交易参数（前端调用合约）
```

#### 用户相关

```
GET    /users/me                  # 获取当前用户信息
GET    /users/me/portfolio        # 获取投资组合
GET    /users/me/yields           # 获取收益记录
POST   /users/me/export-report    # 导出收益报表
```

#### KYC 相关

```
GET    /kyc/status                # 获取 KYC 状态
POST   /kyc/submit                # 提交 KYC 申请
GET    /kyc/status/:requestId     # 查询 KYC 审核状态
```

### 8.2 响应格式

```json
{
  "success": true,
  "data": { ... },
  "error": null,
  "timestamp": "2025-12-01T10:00:00Z"
}
```

### 8.3 认证

- **Header**: `Authorization: Bearer <JWT_TOKEN>`
- **Web3 签名**: 部分接口支持 Web3 签名验证（替代 JWT）

---

## 9. 部署与运维

### 9.1 环境划分

#### 开发环境 (Development)
- 本地 Hardhat 节点或 Mantle 测试网
- Docker Compose 启动数据库、Redis
- 前端本地开发服务器

#### 测试环境 (Staging)
- 合约部署到 Mantle 测试网
- 后端服务部署到测试集群（Kubernetes 或云服务）
- 前端部署到测试域名

#### 生产环境 (Production)
- 合约部署到 Mantle 主网
- 后端服务部署到生产集群（高可用、自动扩缩容）
- 前端部署到 CDN
- 数据库主从复制、定期备份

### 9.2 CI/CD 流程

**GitHub Actions 工作流**:
1. **合约测试**: 运行 Hardhat 测试套件
2. **前端构建**: 构建 Next.js 应用
3. **后端测试**: 运行单元测试和集成测试
4. **部署**: 
   - 测试环境自动部署
   - 生产环境需手动审批

### 9.3 监控与告警

#### 监控指标

**应用层**:
- API 响应时间 (P50, P95, P99)
- 错误率
- 请求量 (QPS)

**基础设施**:
- CPU、内存、磁盘使用率
- 数据库连接池状态
- Redis 缓存命中率

**区块链层**:
- Mantle RPC 延迟
- 合约交易成功率
- Gas 使用量

#### 告警规则

- API 错误率 > 5%
- RPC 延迟 > 5s
- 数据库连接数 > 80%
- 大额异常交易（> 50,000 USD）

### 9.4 日志管理

- **集中式日志**: ELK Stack 或 Loki + Grafana
- **日志级别**: DEBUG (开发), INFO (生产), ERROR (告警)
- **日志保留**: 90 天

---

## 10. 开发环境与工具链

### 10.1 本地开发设置

#### 前置要求
- Java 17+
- Maven 或 Gradle
- Docker & Docker Compose
- Git

#### 快速开始

```bash
# 1. 克隆仓库
git clone https://github.com/your-org/MantleLuxury.git
cd MantleLuxury

# 2. 启动本地基础设施（数据库、Redis）
docker-compose up -d

# 3. 安装依赖（合约和前端）
cd contracts && npm install
cd ../web && npm install

# 4. 启动本地 Hardhat 节点
cd contracts && npx hardhat node

# 5. 部署合约到本地节点
npx hardhat run scripts/deploy.ts --network localhost

# 6. 启动后端 Spring Boot 服务
cd ../backend && ./mvnw spring-boot:run

# 7. 启动前端开发服务器
cd ../web && npm run dev
```

### 10.2 开发工具

- **合约开发**: Hardhat, Foundry (可选)
- **后端开发**: Spring Boot, Spring Initializr, web3j
- **前端测试**: Jest + React Testing Library
- **代码质量**: ESLint, Prettier, Checkstyle/Spotless, Solidity Linter
- **版本控制**: Git + Conventional Commits

### 10.3 测试策略

#### 合约测试
- 单元测试: 每个合约函数单独测试
- 集成测试: 合约间交互测试
- 安全测试: 使用 Slither 或 Mythril 进行静态分析

#### 前端测试
- 单元测试: React Testing Library
- E2E 测试: Playwright 或 Cypress

#### 后端测试
- 单元测试: JUnit 5 + Spring Boot Test
- 集成测试: 使用 Testcontainers 启动 PostgreSQL/Redis，测试 API 端点与数据库交互

---

## 11. 附录

### 11.1 参考文档

- [Mantle 官方文档](https://docs.mantle.xyz/)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts/)
- [Next.js 文档](https://nextjs.org/docs)
- [Wagmi 文档](https://wagmi.sh/)

### 11.2 合约地址（待部署）

- `KYCRegistry`: TBD
- `CustodyManager`: TBD
- `YieldDistribution`: TBD
- `LuxuryTokenFactory`: TBD

### 11.3 联系方式

- 技术负责人: TBD
- 安全审计: TBD
- 问题反馈: GitHub Issues

---

**文档版本历史**:
- v1.0 (2025-12-01): 初始版本


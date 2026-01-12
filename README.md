## MantleLuxury

奢侈品 RWA 代币化投资平台（基于 Mantle L2）。

---

## 🌐 在线访问

- **前端应用**: [https://ml-snowy-five.vercel.app/](https://ml-snowy-five.vercel.app/)
- **后端 API**: [https://mantleluxury-production.up.railway.app](https://mantleluxury-production.up.railway.app)
  - 健康检查: [https://mantleluxury-production.up.railway.app/api/health](https://mantleluxury-production.up.railway.app/api/health)

## 📋 Compliance Disclosure

**Regulated Asset Disclosure**: MantleLuxury is a Real World Asset (RWA) tokenization platform that **involves regulated assets**. The platform tokenizes physical luxury assets (watches, jewelry) which may be subject to securities regulations, financial services regulations, AML/KYC requirements, and consumer protection laws in various jurisdictions. 

The platform implements comprehensive compliance measures including mandatory KYC/AML verification, professional asset custody, comprehensive insurance, third-party authentication, and transparent reporting.

**Full Compliance Disclosure**: See [COMPLIANCE_DISCLOSURE.md](./COMPLIANCE_DISCLOSURE.md) for detailed information.

---

> 快速了解：请查看一页纸白皮书 `ONE_PAGER.md`（Problem / Solution / Business Model / Roadmap）。

## 本地运行说明

### 1. 数据库（MySQL Docker）

启动 MySQL Docker 容器并自动创建数据库表：

```bash
./database/start-mysql.sh
```


### 2. 后端（Spring Boot + Gradle Wrapper）

#### 首次运行（生成 Gradle Wrapper）

```bash
cd backend
gradle wrapper
```

执行成功后，`backend` 目录下会出现 `gradlew`、`gradlew.bat` 和 `gradle/` 目录。

#### 启动后端服务

```bash
cd backend
./gradlew bootRun
```

默认监听：`http://localhost:8080`  
健康检查接口：`http://localhost:8080/api/health`

> 注意：后端需要连接 MySQL 数据库，请先启动 MySQL 服务。

### 3. 前端（Next.js）

```bash
cd frontend
npm install        # 首次运行需要
npm run dev
```

默认监听：`http://localhost:3000`

> 注意：前端会通过 `http://localhost:8080` 调用后端 API，请先启动后端。

### 4. 智能合约（Hardhat）

#### 配置区块链部署

1. 创建 `.env` 文件（在 `contracts` 目录下）：
   ```bash
   cd contracts
   cp .env.example .env
   ```

2. 编辑 `.env` 文件，填入：
   ```env
   MANTLE_TESTNET_RPC_URL=https://rpc.sepolia.mantle.xyz
   PRIVATE_KEY=your_private_key_here
   ```
   
   **注意：**
   - 私钥不要包含 `0x` 前缀
   - 确保账户有足够的测试网 MNT（Mantle 原生代币）用于支付 Gas 费
   - 获取测试币的方法：
     - **官方 Faucet**: https://faucet.sepolia.mantle.xyz/ （推荐）
     - **Alchemy Faucet**: https://sepoliafaucet.com/ （选择 Mantle Sepolia）
     - **Chainlink Faucet**: https://faucets.chain.link/ （选择 Mantle Sepolia）
     - 详细说明请查看 `GET_TESTNET_TOKENS.md`
   - 建议至少准备 0.001 MNT 用于合约部署
   - 使用 Mantle Sepolia 测试网（Chain ID: 5003）

3. 配置后端私钥（使用与合约部署相同的私钥）：
   
   **方式 1：使用环境变量（推荐）**
   ```bash
   export BLOCKCHAIN_PRIVATE_KEY=your_private_key_here
   ```
   
   **方式 2：在 application.yml 中配置**
   编辑 `backend/src/main/resources/application.yml`：
   ```yaml
   blockchain:
     enabled: true
     rpc-url: https://rpc.sepolia.mantle.xyz
     private-key: your_private_key_here  # 与 contracts/.env 中的 PRIVATE_KEY 相同
   ```
   
   **注意：** 后端和合约部署使用同一个私钥，只需配置一次。

4. **首次使用建议手动编译一次**（确保环境正确）：
   ```bash
   cd contracts
   npm run build
   ```

#### 自动编译和部署

**重要：** 启动后端后，提交资产时会**自动编译和部署**合约，无需手动操作！

- 后端会自动调用 `hardhat compile` 编译合约
- 然后自动调用部署脚本部署到 Mantle 测试网
- 整个过程完全自动化

**手动部署（可选，用于测试）：**

```bash
cd contracts
npm run deploy:mantle  # 部署到 Mantle 测试网
```

#### 合约说明

**LuxuryToken**

ERC-20 代币合约，代表单个奢侈品资产的份额。

**构造函数参数：**
- `name`: 代币名称
- `symbol`: 代币符号
- `assetId`: 资产 ID (bytes32)
- `metadataHash`: 元数据哈希 (bytes32)
- `initialSupply`: 初始供应量
- `owner`: 所有者地址

#### 网络信息

- **Mantle Sepolia 测试网**: Chain ID 5003
- **RPC URL**: https://rpc.sepolia.mantle.xyz
- **区块浏览器**: https://explorer.sepolia.mantle.xyz
- **Faucet**: https://faucet.testnet.mantle.xyz/

### 5. 收益分配管理

#### 部署 YieldDistribution 合约

`YieldDistribution` 合约需要手动部署一次（全局单例合约）：

```bash
cd contracts
npx hardhat run scripts/deployYieldDistribution.ts --network mantleTestnet
```

部署完成后，在 `backend/src/main/resources/application.yml` 中配置合约地址：

```yaml
blockchain:
  yield-distribution-contract: 0x...  # 填入部署后的合约地址
```

#### 创建收益分配记录

**获取资产 ID：**

```bash
curl -s http://localhost:8080/api/assets | jq '.[] | {id: .id, brand: .brand, model: .model}'
```

**创建收益分配记录：**

```bash
curl -X POST http://localhost:8080/api/yields/create \
  -H "Content-Type: application/json" \
  -d '{
    "assetId": "资产ID",
    "yieldType": "appreciation",
    "totalAmount": 收益金额
  }'
```

参数说明：
- `assetId`: 资产的 UUID（从 `/api/assets` 获取）
- `yieldType`: 收益类型，`"appreciation"`（升值收益）或 `"rental"`（租赁收益）
- `totalAmount`: 总收益金额（MNT）

**示例：**

```bash
# 为资产创建 50 MNT 的升值收益分配
curl -X POST http://localhost:8080/api/yields/create \
  -H "Content-Type: application/json" \
  -d '{
    "assetId": "062653bc-678b-4a19-b3a8-dec1a4405f00",
    "yieldType": "appreciation",
    "totalAmount": 50.0
  }'
```

**查看收益记录：**

```bash
# 查看所有收益记录
curl -s http://localhost:8080/api/yields | jq .

# 查看用户的收益记录
curl -s http://localhost:8080/api/yields/user/0x用户地址 | jq .

# 查看资产的收益记录
curl -s http://localhost:8080/api/yields/asset/资产ID | jq .
```

---

### 6. 资产真伪认证与估值

#### 创建认证记录

为资产提交真伪认证和估值信息：

**API 端点：** `POST /api/asset-authentications`

**请求参数：**
- `assetId`: 资产 ID（必需）
- `authenticatorName`: 鉴定机构名称（必需）
- `authenticatorType`: 鉴定机构类型，可选值：
  - `"official_brand"` - 官方品牌认证
  - `"third_party"` - 第三方机构认证
  - `"ai_system"` - AI 系统认证（默认）
- `reportUrl`: 认证报告 URL（IPFS 或 S3）
- `reportHash`: 报告哈希（链上存证）
- `verifierSignature`: 鉴定师签名/证书信息
- `notes`: 备注信息

**示例：**

```bash
# 为资产创建第三方机构认证记录
curl -X POST http://localhost:8080/api/asset-authentications \
  -H "Content-Type: application/json" \
  -d '{
    "assetId": "062653bc-678b-4a19-b3a8-dec1a4405f00",
    "authenticatorName": "瑞士钟表鉴定中心",
    "authenticatorType": "third_party",
    "reportUrl": "https://ipfs.io/ipfs/Qm...",
    "reportHash": "0x1234567890abcdef...",
    "verifierSignature": "鉴定师：张三，证书编号：ABC123",
    "notes": "经鉴定，该手表为真品，状态良好。"
  }'
```

#### 审核认证记录

审核认证记录（通过或拒绝）：

**API 端点：** `POST /api/asset-authentications/{authenticationId}/review`

**请求参数：**
- `status`: 审核状态，`"verified"`（通过）或 `"rejected"`（拒绝）
- `notes`: 审核备注（可选）

**示例：**

```bash
# 通过认证
curl -X POST http://localhost:8080/api/asset-authentications/{认证ID}/review \
  -H "Content-Type: application/json" \
  -d '{
    "status": "verified",
    "notes": "认证信息完整，予以通过"
  }'
```

#### 查看认证记录

```bash
# 查看资产的所有认证记录
curl -s http://localhost:8080/api/asset-authentications/asset/{资产ID} | jq .

# 查看资产已通过的认证记录
curl -s http://localhost:8080/api/asset-authentications/asset/{资产ID}/verified | jq .

# 查看认证记录详情
curl -s http://localhost:8080/api/asset-authentications/{认证ID} | jq .
```

**完整认证流程示例：**

```bash
# 1. 创建认证记录（返回认证 ID）
AUTH_ID=$(curl -s -X POST http://localhost:8080/api/asset-authentications \
  -H "Content-Type: application/json" \
  -d '{
    "assetId": "80ef25bb-db72-4cc5-8d7d-9d6609c64de9",
    "authenticatorName": "瑞士钟表鉴定中心",
    "authenticatorType": "third_party",
    "reportUrl": "https://ipfs.io/ipfs/QmExample123",
    "reportHash": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    "verifierSignature": "鉴定师：张三，证书编号：ABC123",
    "notes": "经鉴定，该资产为真品，状态良好，符合上架标准。"
  }' | jq -r '.id')

echo "认证记录 ID: $AUTH_ID"

# 2. 审核通过认证（认证通过后，资产状态会自动从 registered 更新为 fundraising）
curl -X POST http://localhost:8080/api/asset-authentications/$AUTH_ID/review \
  -H "Content-Type: application/json" \
  -d '{
    "status": "verified",
    "notes": "认证信息完整，予以通过"
  }'

# 3. 验证资产状态已更新为 fundraising
curl -s http://localhost:8080/api/assets/80ef25bb-db72-4cc5-8d7d-9d6609c64de9 | jq '{id, status, authentications: .authentications | map({status: .authenticationStatus, name: .authenticatorName})}'
```

**快速认证资产（一步完成）：**

```bash
# 为资产创建并立即通过认证（需要先创建获取认证 ID，然后审核）
ASSET_ID="80ef25bb-db72-4cc5-8d7d-9d6609c64de9"

# 创建认证记录
AUTH_RESPONSE=$(curl -s -X POST http://localhost:8080/api/asset-authentications \
  -H "Content-Type: application/json" \
  -d "{
    \"assetId\": \"$ASSET_ID\",
    \"authenticatorName\": \"瑞士钟表鉴定中心\",
    \"authenticatorType\": \"third_party\",
    \"reportUrl\": \"https://ipfs.io/ipfs/QmExample123\",
    \"reportHash\": \"0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef\",
    \"verifierSignature\": \"鉴定师：张三，证书编号：ABC123\",
    \"notes\": \"经鉴定，该资产为真品，状态良好。\"
  }")

AUTH_ID=$(echo $AUTH_RESPONSE | jq -r '.id')

# 审核通过
curl -X POST http://localhost:8080/api/asset-authentications/$AUTH_ID/review \
  -H "Content-Type: application/json" \
  -d '{"status": "verified"}'

echo "✅ 资产 $ASSET_ID 已认证通过，状态已更新为 fundraising"
```

**前端显示：**

认证信息会自动显示在资产详情页面（`/assets/{id}`）的"真伪认证与估值"部分，包括：
- 认证机构名称和类型
- 认证状态（待审核/已认证/已拒绝）
- 认证日期
- 认证报告链接（如有）
- 报告哈希（链上存证）
- 备注信息

**重要提示：**

- 资产提交后，状态为 `registered`（待认证）
- 创建认证记录后，状态仍为 `registered`（待审核）
- 审核通过认证后，资产状态会自动更新为 `fundraising`（募集中），此时用户可以投资
- 只有状态为 `fundraising` 且有已通过认证的资产才能被投资

---

### 7. 资产托管管理

#### 创建托管记录

为资产创建托管记录（资产实物进入托管机构）：

**API 端点：** `POST /api/custodies`

**请求参数：**
- `assetId`: 资产 ID（必需）
- `custodyOrganization`: 托管机构名称（必需）
- `warehouseLocation`: 仓储位置（模糊显示，如"香港-XX区"）
- `warehouseAddressHash`: 详细地址哈希（链上存证）
- `entryDate`: 入库日期（格式：YYYY-MM-DD）
- `custodyContractUrl`: 托管合同 URL
- `custodyContractHash`: 托管合同哈希（链上存证）
- `facilityStandards`: 设施标准（恒温恒湿、防火防盗等）
- `notes`: 备注信息

**示例：**

```bash
# 为资产创建托管记录（完整参数）
curl -X POST http://localhost:8080/api/custodies \
  -H "Content-Type: application/json" \
  -d '{
    "assetId": "80ef25bb-db72-4cc5-8d7d-9d6609c64de9",
    "custodyOrganization": "香港国际仓储中心",
    "warehouseLocation": "香港-中环区",
    "warehouseAddressHash": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    "entryDate": "2025-01-15",
    "custodyContractUrl": "https://ipfs.io/ipfs/QmCustodyContract123",
    "custodyContractHash": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
    "facilityStandards": "恒温恒湿（20°C，湿度 50%），24/7 监控，防火防盗系统",
    "notes": "资产已安全入库，状态良好"
  }'

# 为资产创建托管记录（简化版，仅必需参数）
curl -X POST http://localhost:8080/api/custodies \
  -H "Content-Type: application/json" \
  -d '{
    "assetId": "80ef25bb-db72-4cc5-8d7d-9d6609c64de9",
    "custodyOrganization": "香港国际仓储中心",
    "warehouseLocation": "香港-中环区",
    "entryDate": "2025-01-15",
    "facilityStandards": "恒温恒湿（20°C，湿度 50%），24/7 监控，防火防盗系统"
  }'

# 使用变量快速创建（替换 ASSET_ID 为实际资产 ID）
ASSET_ID="80ef25bb-db72-4cc5-8d7d-9d6609c64de9"
curl -X POST http://localhost:8080/api/custodies \
  -H "Content-Type: application/json" \
  -d "{
    \"assetId\": \"$ASSET_ID\",
    \"custodyOrganization\": \"香港国际仓储中心\",
    \"warehouseLocation\": \"香港-中环区\",
    \"entryDate\": \"$(date +%Y-%m-%d)\",
    \"facilityStandards\": \"恒温恒湿（20°C，湿度 50%），24/7 监控，防火防盗系统\",
    \"notes\": \"资产已安全入库，状态良好\"
  }"
```

#### 更新托管状态

更新资产的托管状态：

**API 端点：** `POST /api/custodies/{assetId}/status`

**请求参数：**
- `status`: 托管状态，可选值：
  - `"registered"` - 已注册
  - `"in_custody"` - 托管中
  - `"for_sale"` - 待售
  - `"sold"` - 已售
  - `"withdrawn"` - 已提取

**示例：**

```bash
# 更新托管状态为"托管中"
curl -X POST http://localhost:8080/api/custodies/{资产ID}/status \
  -H "Content-Type: application/json" \
  -d '{
    "status": "in_custody"
  }'
```

#### 查看托管记录

```bash
# 查看资产的托管记录
curl -s http://localhost:8080/api/custodies/asset/{资产ID} | jq .

# 查看所有托管记录
curl -s http://localhost:8080/api/custodies | jq .
```

**前端显示：**

托管信息会自动显示在资产详情页面（`/assets/{id}`）的"托管与保险"部分，包括：
- 托管机构名称
- 仓储位置（模糊显示）
- 入库日期
- 设施标准
- 托管状态

---

### 8. 资产保险管理

#### 创建保险记录

为资产购买保险（保额需不低于资产估值）：

**API 端点：** `POST /api/insurances`

**请求参数：**
- `assetId`: 资产 ID（必需）
- `insuranceCompany`: 保险公司名称（必需）
- `policyNumber`: 保单号
- `coverageAmount`: 保额（必需，需不低于资产估值）
- `coverageCurrency`: 保额币种（默认：USD）
- `policyStartDate`: 保单生效日期（格式：YYYY-MM-DD，默认：今天）
- `policyEndDate`: 保单到期日期（格式：YYYY-MM-DD，必需）
- `premiumAmount`: 保费
- `coverageType`: 保险类型（默认：全险）
- `policyDocumentUrl`: 保单文档 URL
- `policyDocumentHash`: 保单文档哈希（链上存证）
- `notes`: 备注信息

**示例：**

```bash
# 为资产购买全险（完整参数）
curl -X POST http://localhost:8080/api/insurances \
  -H "Content-Type: application/json" \
  -d '{
    "assetId": "80ef25bb-db72-4cc5-8d7d-9d6609c64de9",
    "insuranceCompany": "香港保险有限公司",
    "policyNumber": "POL-2025-001234",
    "coverageAmount": 50000,
    "coverageCurrency": "USD",
    "policyStartDate": "2025-01-15",
    "policyEndDate": "2026-01-15",
    "premiumAmount": 500,
    "coverageType": "全险",
    "policyDocumentUrl": "https://ipfs.io/ipfs/QmInsuranceDoc123",
    "policyDocumentHash": "0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba",
    "notes": "保单已生效，覆盖盗窃、火灾、自然灾害等风险"
  }'

# 为资产购买全险（简化版，仅必需参数）
curl -X POST http://localhost:8080/api/insurances \
  -H "Content-Type: application/json" \
  -d '{
    "assetId": "80ef25bb-db72-4cc5-8d7d-9d6609c64de9",
    "insuranceCompany": "香港保险有限公司",
    "coverageAmount": 50000,
    "coverageCurrency": "USD",
    "policyEndDate": "2026-01-15",
    "coverageType": "全险"
  }'

# 使用变量快速创建（替换 ASSET_ID 为实际资产 ID，兼容 macOS）
ASSET_ID="80ef25bb-db72-4cc5-8d7d-9d6609c64de9"
curl -X POST http://localhost:8080/api/insurances \
  -H "Content-Type: application/json" \
  -d "{
    \"assetId\": \"$ASSET_ID\",
    \"insuranceCompany\": \"香港保险有限公司\",
    \"policyNumber\": \"POL-$(date +%Y)-$(printf '%06d' $RANDOM)\",
    \"coverageAmount\": 50000,
    \"coverageCurrency\": \"USD\",
    \"policyStartDate\": \"$(date +%Y-%m-%d)\",
    \"policyEndDate\": \"$(date -v+1y +%Y-%m-%d 2>/dev/null || date -d '+1 year' +%Y-%m-%d)\",
    \"premiumAmount\": 500,
    \"coverageType\": \"全险\",
    \"notes\": \"保单已生效，覆盖盗窃、火灾、自然灾害等风险\"
  }"
```

#### 续保

为资产续保（创建新的保险记录，将旧的设为非活跃）：

**API 端点：** `POST /api/insurances/renew`

**请求参数：** 与创建保险记录相同

**示例：**

```bash
# 续保
curl -X POST http://localhost:8080/api/insurances/renew \
  -H "Content-Type: application/json" \
  -d '{
    "assetId": "80ef25bb-db72-4cc5-8d7d-9d6609c64de9",
    "insuranceCompany": "香港保险有限公司",
    "policyNumber": "POL-2026-001234",
    "coverageAmount": 55000,
    "coverageCurrency": "USD",
    "policyStartDate": "2026-01-15",
    "policyEndDate": "2027-01-15",
    "premiumAmount": 550,
    "coverageType": "全险"
  }'
```

#### 查看保险记录

```bash
# 查看资产的有效保险记录
curl -s http://localhost:8080/api/insurances/asset/{资产ID} | jq .

# 查看资产的所有保险记录（包括历史记录）
curl -s http://localhost:8080/api/insurances/asset/{资产ID}/all | jq .

# 查看即将到期的保险（30天内）
curl -s "http://localhost:8080/api/insurances/expiring?daysBeforeExpiry=30" | jq .
```

**前端显示：**

保险信息会自动显示在资产详情页面（`/assets/{id}`）的"托管与保险"部分，包括：
- 保险公司名称
- 保单号
- 保额和币种
- 保险类型
- 保单有效期
- 保单状态（有效/已过期）

---

### 快速托管和保险脚本

以下脚本可以帮助你快速为指定资产创建托管和保险记录。请替换 `ASSET_ID` 为你的实际资产 ID。

```bash
# 替换为你的实际资产 ID
ASSET_ID="YOUR_ASSET_ID_HERE"

echo "为资产 $ASSET_ID 创建托管记录..."
CUSTODY_RESPONSE=$(curl -s -X POST http://localhost:8080/api/custodies \
  -H "Content-Type: application/json" \
  -d "{
    \"assetId\": \"$ASSET_ID\",
    \"custodyOrganization\": \"香港国际仓储中心\",
    \"warehouseLocation\": \"香港-中环区\",
    \"warehouseAddressHash\": \"0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef\",
    \"entryDate\": \"$(date +%Y-%m-%d)\",
    \"custodyContractUrl\": \"https://ipfs.io/ipfs/QmCustodyContract123\",
    \"custodyContractHash\": \"0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890\",
    \"facilityStandards\": \"恒温恒湿（20°C，湿度 50%），24/7 监控，防火防盗系统\",
    \"notes\": \"资产已安全入库，状态良好\"
  }")

CUSTODY_ID=$(echo $CUSTODY_RESPONSE | jq -r '.id')

if [ "$CUSTODY_ID" == "null" ] || [ -z "$CUSTODY_ID" ]; then
  echo "错误：未能创建托管记录或解析托管ID。响应：$CUSTODY_RESPONSE"
  exit 1
fi

echo "托管记录已创建，ID: $CUSTODY_ID"

echo "为资产 $ASSET_ID 创建保险记录..."
INSURANCE_RESPONSE=$(curl -s -X POST http://localhost:8080/api/insurances \
  -H "Content-Type: application/json" \
  -d "{
    \"assetId\": \"$ASSET_ID\",
    \"insuranceCompany\": \"香港保险有限公司\",
    \"policyNumber\": \"POL-$(date +%Y)-$(printf '%06d' $RANDOM)\",
    \"coverageAmount\": 50000,
    \"coverageCurrency\": \"USD\",
    \"policyStartDate\": \"$(date +%Y-%m-%d)\",
    \"policyEndDate\": \"$(date -v+1y +%Y-%m-%d 2>/dev/null || date -d '+1 year' +%Y-%m-%d)\",
    \"premiumAmount\": 500,
    \"coverageType\": \"全险\",
    \"policyDocumentUrl\": \"https://ipfs.io/ipfs/QmInsuranceDoc123\",
    \"policyDocumentHash\": \"0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba\",
    \"notes\": \"保单已生效，覆盖盗窃、火灾、自然灾害等风险\"
  }")

INSURANCE_ID=$(echo $INSURANCE_RESPONSE | jq -r '.id')

if [ "$INSURANCE_ID" == "null" ] || [ -z "$INSURANCE_ID" ]; then
  echo "错误：未能创建保险记录或解析保险ID。响应：$INSURANCE_RESPONSE"
  exit 1
fi

echo "保险记录已创建，ID: $INSURANCE_ID"
echo "✅ 资产 $ASSET_ID 的托管和保险记录已创建完成。"
```

---

## 部署说明

> 📖 **详细部署指南**: 请查看 [`DEPLOYMENT.md`](./DEPLOYMENT.md) 获取完整的部署说明  
> ⚡ **快速部署**: 请查看 [`QUICK_DEPLOY.md`](./QUICK_DEPLOY.md) 获取快速部署检查清单

### 部署架构

本项目使用以下平台进行部署：
- **前端**: [Vercel](https://vercel.com) - 配置文件: [`frontend/vercel.json`](./frontend/vercel.json)
- **后端**: [Railway](https://railway.app) - 配置文件: [`backend/Dockerfile`](./backend/Dockerfile), [`backend/railway.json`](./backend/railway.json), [`backend/railway.toml`](./backend/railway.toml), [`backend/nixpacks.toml`](./backend/nixpacks.toml), [`backend/Procfile`](./backend/Procfile)
- **数据库**: [Railway MySQL](https://railway.app) - 初始化脚本: [`database/init-mysql.sql`](./database/init-mysql.sql)

### 配置文件说明

#### 前端部署配置
- **Vercel 配置**: [`frontend/vercel.json`](./frontend/vercel.json)
- **环境变量说明**: [`frontend/ENV_VARIABLES.md`](./frontend/ENV_VARIABLES.md)

#### 后端部署配置
- **Docker 配置**: [`backend/Dockerfile`](./backend/Dockerfile) - 用于 Railway Docker 部署
- **Railway JSON 配置**: [`backend/railway.json`](./backend/railway.json)
- **Railway TOML 配置**: [`backend/railway.toml`](./backend/railway.toml)
- **Nixpacks 配置**: [`backend/nixpacks.toml`](./backend/nixpacks.toml) - 用于 Railway Nixpacks 构建
- **Procfile**: [`backend/Procfile`](./backend/Procfile) - Railway 启动命令
- **环境变量说明**: [`backend/ENV_VARIABLES.md`](./backend/ENV_VARIABLES.md)

#### 数据库配置
- **初始化脚本**: [`database/init-mysql.sql`](./database/init-mysql.sql)

### 前置要求

#### 服务器环境
- **操作系统**: Linux (Ubuntu 20.04+ 推荐) 或 macOS
- **CPU**: 2 核以上
- **内存**: 4GB 以上
- **磁盘**: 20GB 以上可用空间

#### 软件依赖
- **Java**: JDK 17 或更高版本
- **Node.js**: v18 或更高版本
- **npm**: v9 或更高版本
- **Docker**: v20.10 或更高版本（用于 MySQL）
- **MySQL**: 8.0 或更高版本（或使用 Docker）
- **Git**: 用于代码拉取

#### 区块链环境
- **Mantle 网络**: Mantle Sepolia 测试网或 Mantle 主网
- **钱包私钥**: 用于部署合约和支付 Gas 费
- **测试币/主网币**: 确保账户有足够的 MNT 用于交易

### 1. 数据库部署

> 📝 **数据库初始化**: 使用 [`database/init-mysql.sql`](./database/init-mysql.sql) 初始化数据库表结构

#### 方式一：使用 Docker（推荐）

```bash
# 在项目根目录执行
./database/start-mysql.sh
```

#### 方式二：使用现有 MySQL 服务器

1. 创建数据库：
```sql
CREATE DATABASE mantle_luxury CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

2. 执行初始化脚本：
```bash
mysql -u root -p mantle_luxury < database/init-mysql.sql
```

3. 创建应用用户（可选）：
```sql
CREATE USER 'mantle_user'@'%' IDENTIFIED BY 'your_secure_password';
GRANT ALL PRIVILEGES ON mantle_luxury.* TO 'mantle_user'@'%';
FLUSH PRIVILEGES;
```

### 2. 后端部署

> 📝 **Railway 部署**: 本项目使用 Railway 部署后端，配置文件包括：
> - [`backend/Dockerfile`](./backend/Dockerfile) - Docker 构建配置（推荐使用）
> - [`backend/railway.json`](./backend/railway.json) - Railway JSON 配置
> - [`backend/railway.toml`](./backend/railway.toml) - Railway TOML 配置
> - [`backend/nixpacks.toml`](./backend/nixpacks.toml) - Nixpacks 构建配置
> - [`backend/Procfile`](./backend/Procfile) - 启动命令配置
> - [`backend/ENV_VARIABLES.md`](./backend/ENV_VARIABLES.md) - 环境变量说明

详细部署步骤请参考 [`DEPLOYMENT.md`](./DEPLOYMENT.md#二后端部署railway)。

#### 2.1 构建后端应用

```bash
cd backend

# 生成 Gradle Wrapper（如果还没有）
gradle wrapper

# 构建 JAR 包
./gradlew clean build -x test

# 生成的 JAR 文件位于: backend/build/libs/mantle-luxury-backend-*.jar
```

#### 2.2 配置环境变量

创建 `application-prod.yml` 或使用环境变量：

```bash
# 方式一：使用环境变量（推荐）
export SPRING_DATASOURCE_URL=jdbc:mysql://localhost:3306/mantle_luxury?useSSL=false&serverTimezone=UTC
export SPRING_DATASOURCE_USERNAME=root
export SPRING_DATASOURCE_PASSWORD=your_secure_password
export BLOCKCHAIN_PRIVATE_KEY=your_private_key_here
export BLOCKCHAIN_RPC_URL=https://rpc.sepolia.mantle.xyz  # 或主网 RPC
export BLOCKCHAIN_YIELD_DISTRIBUTION_CONTRACT=0x...
export BLOCKCHAIN_KYC_REGISTRY_CONTRACT=0x...
export BLOCKCHAIN_CUSTODY_MANAGER_CONTRACT=0x...
export ADMIN_WALLET_ADDRESSES=0x...
```

#### 2.3 启动后端服务

```bash
# 方式一：直接运行 JAR
java -jar -Dspring.profiles.active=prod build/libs/mantle-luxury-backend-*.jar

# 方式二：使用 systemd（Linux）
sudo nano /etc/systemd/system/mantle-luxury-backend.service
```

systemd 服务文件示例：
```ini
[Unit]
Description=MantleLuxury Backend Service
After=network.target mysql.service

[Service]
Type=simple
User=your_user
WorkingDirectory=/path/to/MantleLuxury/backend
ExecStart=/usr/bin/java -jar -Dspring.profiles.active=prod /path/to/MantleLuxury/backend/build/libs/mantle-luxury-backend-*.jar
Restart=always
RestartSec=10
Environment="SPRING_DATASOURCE_URL=jdbc:mysql://localhost:3306/mantle_luxury"
Environment="SPRING_DATASOURCE_USERNAME=root"
Environment="SPRING_DATASOURCE_PASSWORD=your_password"
Environment="BLOCKCHAIN_PRIVATE_KEY=your_private_key"

[Install]
WantedBy=multi-user.target
```

启动服务：
```bash
sudo systemctl daemon-reload
sudo systemctl enable mantle-luxury-backend
sudo systemctl start mantle-luxury-backend
sudo systemctl status mantle-luxury-backend
```

### 3. 前端部署

> 📝 **Vercel 部署**: 本项目使用 Vercel 部署前端，配置文件包括：
> - [`frontend/vercel.json`](./frontend/vercel.json) - Vercel 部署配置
> - [`frontend/ENV_VARIABLES.md`](./frontend/ENV_VARIABLES.md) - 环境变量说明

详细部署步骤请参考 [`DEPLOYMENT.md`](./DEPLOYMENT.md#三前端部署vercel)。

#### 3.1 构建前端应用

```bash
cd frontend

# 安装依赖
npm install

# 构建生产版本
npm run build
```

#### 3.2 配置环境变量

创建 `.env.production` 文件：

```env
NEXT_PUBLIC_API_URL=http://your-backend-domain:8080
NEXT_PUBLIC_CHAIN_ID=5003  # Mantle Sepolia: 5003, Mantle Mainnet: 5000
NEXT_PUBLIC_RPC_URL=https://rpc.sepolia.mantle.xyz
```

#### 3.3 部署方式

**方式一：使用 Next.js Standalone（推荐）**

```bash
# 修改 next.config.js，添加：
# output: 'standalone'

npm run build

# 启动生产服务器
node .next/standalone/server.js
```

**方式二：使用 PM2**

```bash
# 安装 PM2
npm install -g pm2

# 启动应用
pm2 start npm --name "mantle-luxury-frontend" -- start

# 保存配置
pm2 save
pm2 startup
```

**方式三：使用 Docker**

创建 `Dockerfile`（在 `frontend` 目录）：

```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV production
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
RUN npm install --production
EXPOSE 3000
CMD ["npm", "start"]
```

构建和运行：
```bash
docker build -t mantle-luxury-frontend .
docker run -p 3000:3000 --env-file .env.production mantle-luxury-frontend
```

**方式四：使用 Nginx 反向代理**

1. 构建静态导出（如果使用静态导出）：
```bash
# 在 next.config.js 中设置 output: 'export'
npm run build
# 生成的文件在 out/ 目录
```

2. 配置 Nginx：
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        root /path/to/MantleLuxury/frontend/out;
        try_files $uri $uri.html $uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 4. 智能合约部署

#### 4.1 配置合约环境

```bash
cd contracts

# 复制环境变量模板
cp .env.example .env

# 编辑 .env 文件
nano .env
```

`.env` 文件内容：
```env
MANTLE_TESTNET_RPC_URL=https://rpc.sepolia.mantle.xyz
# 或主网
# MANTLE_MAINNET_RPC_URL=https://rpc.mantle.xyz
PRIVATE_KEY=your_private_key_here
```

#### 4.2 部署核心合约

```bash
# 安装依赖
npm install

# 编译合约
npm run build

# 部署 KYCRegistry 合约
npx hardhat run scripts/deployKYCRegistry.ts --network mantleTestnet

# 部署 CustodyManager 合约
npx hardhat run scripts/deployCustodyManager.ts --network mantleTestnet

# 部署 YieldDistribution 合约
npx hardhat run scripts/deployYieldDistribution.ts --network mantleTestnet
```

#### 4.3 更新后端配置

将部署后的合约地址更新到后端配置：

```yaml
# backend/src/main/resources/application.yml
blockchain:
  kyc-registry-contract: 0x...  # 填入 KYCRegistry 合约地址
  custody-manager-contract: 0x...  # 填入 CustodyManager 合约地址
  yield-distribution-contract: 0x...  # 填入 YieldDistribution 合约地址
```

### 5. 验证部署

#### 5.1 检查后端服务

```bash
# 健康检查
curl http://localhost:8080/api/health

# 查看日志
tail -f /var/log/mantle-luxury-backend.log
# 或使用 systemd
journalctl -u mantle-luxury-backend -f
```

#### 5.2 检查前端服务

```bash
# 访问前端
curl http://localhost:3000

# 检查 API 连接
curl http://localhost:3000/api/health
```

#### 5.3 检查数据库连接

```bash
# 连接数据库
mysql -h localhost -u root -p mantle_luxury

# 检查表
SHOW TABLES;
```

### 6. 安全建议

1. **私钥管理**：
   - 使用环境变量或密钥管理服务（如 AWS Secrets Manager、HashiCorp Vault）
   - 不要将私钥提交到代码仓库
   - 生产环境使用硬件钱包或多签钱包

2. **数据库安全**：
   - 使用强密码
   - 限制数据库访问 IP
   - 启用 SSL 连接
   - 定期备份数据库

3. **API 安全**：
   - 使用 HTTPS
   - 配置 CORS 白名单
   - 实施速率限制
   - 使用 JWT 或 Web3 签名验证

4. **服务器安全**：
   - 配置防火墙规则
   - 定期更新系统和依赖
   - 使用非 root 用户运行服务
   - 配置日志监控和告警

### 7. 监控与维护

#### 7.1 日志管理

- **后端日志**: 配置日志轮转，保留 30-90 天
- **前端日志**: 使用 Sentry 或其他错误追踪服务
- **数据库日志**: 启用慢查询日志

#### 7.2 性能监控

- **API 响应时间**: 使用 Prometheus + Grafana
- **数据库性能**: 监控连接池、慢查询
- **区块链 RPC**: 监控延迟和错误率

#### 7.3 备份策略

- **数据库备份**: 每日自动备份，保留 30 天
- **配置文件备份**: 版本控制管理
- **合约地址记录**: 保存到安全位置

### 8. 故障排查

#### 常见问题

1. **后端无法连接数据库**：
   - 检查数据库服务是否运行
   - 验证连接字符串和凭据
   - 检查防火墙规则

2. **合约部署失败**：
   - 检查账户余额（Gas 费）
   - 验证 RPC 节点可用性
   - 检查私钥格式

3. **前端无法连接后端**：
   - 检查 CORS 配置
   - 验证 API URL 配置
   - 检查网络连接

4. **事件索引器不工作**：
   - 检查 `event-indexer.enabled` 配置
   - 查看后端日志
   - 验证 RPC 连接

---

## Team Bios and Contact Info

### Abby Bai
- **Role**: Full Stack Developer & Project Mananger
- **Email**: baibiying@icloud.com
- **Phone**: 18600665034

---

## 合规声明（RWA 相关项目需特别提供）
- 本项目涉及与实物资产映射的链上代币（RWA），在部分司法辖区可能被视为受监管资产，需根据当地法律法规完成必要的许可、备案或豁免申请。
- 本代码库仅用于技术演示与内部评估，不构成投资邀约或法律、税务、合规建议。上线生产环境前，请获取合格律师的正式法律意见，并确保获得所需的金融牌照/监管批准。
- 如果您位于或服务的对象位于受限制/制裁地区，请勿使用或部署本项目；使用者须自行承担遵守当地法规的全部责任。

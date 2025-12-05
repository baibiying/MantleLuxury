## MantleLuxury

奢侈品 RWA 代币化投资平台（基于 Mantle L2）。

---

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

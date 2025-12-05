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

```bash
cd contracts
npm install        # 首次运行需要
npm run build      # 编译合约
npm test           # 运行合约测试（预留）
```

后续会在 `contracts` 中补充部署到 Mantle 测试网/本地节点的脚本。

# MantleLuxury

**Luxury RWA Tokenization Investment Platform (Built on Mantle L2)**

MantleLuxury is a Real World Asset (RWA) tokenization platform that enables fractional ownership of luxury physical assets (watches, jewelry) through blockchain tokens. The platform democratizes luxury asset investment by allowing global investors to participate with lower entry barriers while ensuring compliance, security, and transparency.

---

## ⭐ Project Highlights

MantleLuxury excels across all evaluation criteria:

- ✅ **Technical Excellence**: Modern tech stack (Next.js 16, React 19, Spring Boot 3.3.2, Solidity 0.8.24), scalable architecture, enterprise-grade security, production-ready MVP
- ✅ **User Experience**: Web2-level onboarding, premium digital experience with 3D models and high-resolution images, cross-device responsive design, intuitive interface
- ✅ **Real-World Applicability**: Verified physical assets with professional authentication/custody/insurance, institutional-grade features, comprehensive regulatory compliance
- ✅ **Mantle Integration**: Full Mantle L2 deployment, ecosystem-ready interfaces for DeFi integration, infrastructure monitoring, RWA focus alignment
- ✅ **Long-Term Ecosystem Potential**: Protocol standard vision, strategic partnerships with luxury brands, DAO governance roadmap, clear expansion plans

---

## 👥 Team Info

### Abby Bai
- **Role**: Full Stack Developer & Project Manager
- **Bio**: Full-stack developer with expertise in blockchain, smart contracts, and web3 applications. Led the development of MantleLuxury from concept to MVP, including smart contract architecture, backend API design, frontend development, and deployment infrastructure.
- **Email**: baibiying@icloud.com
- **Phone**: +8618600665034
- **Location**: Shanghai, China

---

## 🌐 Live Access

- **MVP Link / Demo URL (Testnet)**: [https://ml-snowy-five.vercel.app/](https://ml-snowy-five.vercel.app/)
- **Frontend Application**: [https://ml-snowy-five.vercel.app/](https://ml-snowy-five.vercel.app/)
- **Backend API**: [https://mantleluxury-production.up.railway.app](https://mantleluxury-production.up.railway.app)
  - Health Check: [https://mantleluxury-production.up.railway.app/api/health](https://mantleluxury-production.up.railway.app/api/health)
- **Smart Contracts** (Mantle Sepolia Testnet):
  - **KYCRegistry**: [`0x519AD3F043581620e67567c896508b8Da33fF91D`](https://explorer.sepolia.mantle.xyz/address/0x519AD3F043581620e67567c896508b8Da33fF91D)
  - **CustodyManager**: [`0xF1c527a19b65E3e9Ab9AD7499cc8167C63c3ca87`](https://explorer.sepolia.mantle.xyz/address/0xF1c527a19b65E3e9Ab9AD7499cc8167C63c3ca87)
  - **YieldDistribution**: [`0x988304593FC2e89e56FFAD9393Af0B97c37d9E5D`](https://explorer.sepolia.mantle.xyz/address/0x988304593FC2e89e56FFAD9393Af0B97c37d9E5D)
  - **LuxuryToken**: Deployed per asset (each asset has its own ERC-20 token contract)
  - **Block Explorer**: [Mantle Sepolia Explorer](https://explorer.sepolia.mantle.xyz)

---

## 📋 Compliance Disclosure

See [COMPLIANCE_DISCLOSURE.md](./COMPLIANCE_DISCLOSURE.md) for detailed information

---

## 📋 One Pager

See [ONE_PAGER.md](./ONE_PAGER.md) (Problem / Solution / Business Model / Roadmap)

---

## 📋 Product Doc

For detailed product requirements: See [PRODUCT_DOC.md](./PRODUCT_DOC.md)  

---

## 📋 Tech Design
 
For technical architecture: See [TECH_DESIGN.md](./TECH_DESIGN.md)  

---

## 📋 Deployment

For deployment guide: See [DEPLOYMENT.md](./DEPLOYMENT.md)

---

## 🚀 Quick Start (Local Development)

### Prerequisites

- **Java**: JDK 17 or higher
- **Node.js**: v18 or higher
- **npm**: v9 or higher
- **Docker**: v20.10 or higher (for MySQL)
- **Git**: For cloning the repository

### 1. Database Setup (MySQL Docker)

Start MySQL Docker container and automatically create database tables:

```bash
./database/start-mysql.sh
```

This script will:
- Start a MySQL 8.0 Docker container
- Create the database and tables automatically
- Configure proper permissions

**Connection Info** (default):
- Host: `localhost`
- Port: `3306`
- Database: `mantle_luxury`
- Username: `mantle_user`
- Password: `mantle_pass`
- Root Password: `root123456`

### 2. Backend Setup (Spring Boot)

#### First-time Setup (Generate Gradle Wrapper)

```bash
cd backend
gradle wrapper
```

After successful execution, `gradlew`, `gradlew.bat`, and `gradle/` directory will appear in the `backend` directory.

#### Start Backend Service

```bash
cd backend
./gradlew bootRun
```

**Default**: Listens on `http://localhost:8080`  
**Health Check**: `http://localhost:8080/api/health`

> **Note**: The backend requires a MySQL database connection. Please start MySQL first.

#### Configure Blockchain (Optional for Local Development)

If you want to test blockchain features locally, configure the private key in `backend/src/main/resources/application.yml`:

```yaml
blockchain:
  enabled: true
  rpc-url: https://rpc.sepolia.mantle.xyz
  private-key: your_private_key_here  # Without 0x prefix
```

> **Note**: Ensure your wallet has sufficient testnet MNT for gas fees. Get testnet tokens from [Mantle Sepolia Faucet](https://faucet.sepolia.mantle.xyz/).

### 3. Frontend Setup (Next.js)

```bash
cd frontend
npm install        # First-time only
npm run dev
```

**Default**: Listens on `http://localhost:3000`

> **Note**: The frontend calls the backend API at `http://localhost:8080`. Please start the backend first.

### 4. Smart Contracts (Hardhat)

#### Configure Blockchain Deployment

1. Create `.env` file (in `contracts` directory):
   ```bash
   cd contracts
   cp .env.example .env
   ```

2. Edit `.env` file:
   ```env
   MANTLE_TESTNET_RPC_URL=https://rpc.sepolia.mantle.xyz
   PRIVATE_KEY=your_private_key_here
   ```
   
   **Important Notes**:
   - Private key should **not** include `0x` prefix
   - Ensure your account has sufficient testnet MNT for gas fees
   - Get testnet tokens from:
     - **Official Faucet**: https://faucet.sepolia.mantle.xyz/ (Recommended)
     - **Alchemy Faucet**: https://sepoliafaucet.com/ (Select Mantle Sepolia)
     - **Chainlink Faucet**: https://faucets.chain.link/ (Select Mantle Sepolia)
   - Recommended: At least 0.001 MNT for contract deployment
   - Using Mantle Sepolia Testnet (Chain ID: 5003)

3. **First-time Build** (Recommended):
   ```bash
   cd contracts
   npm run build
   ```

#### Automatic Compilation and Deployment

**Important**: After starting the backend, contracts will be **automatically compiled and deployed** when submitting assets. No manual operation required!

- Backend automatically calls `hardhat compile` to compile contracts
- Then automatically calls deployment scripts to deploy to Mantle testnet
- The entire process is fully automated

**Manual Deployment (Optional, for testing)**:

```bash
cd contracts
npm run deploy:mantle  # Deploy to Mantle testnet
```

#### Contract Overview

**LuxuryToken** (ERC-20)
- Represents fractional ownership shares of a single luxury asset
- Constructor parameters:
  - `name`: Token name
  - `symbol`: Token symbol
  - `assetId`: Asset ID (bytes32)
  - `metadataHash`: Metadata hash (bytes32)
  - `initialSupply`: Initial supply
  - `owner`: Owner address

**KYCRegistry**
- On-chain KYC status mapping
- Ensures only verified users can hold tokens

**YieldDistribution**
- Automated yield distribution to token holders
- Supports appreciation and rental yields

**CustodyManager**
- Immutable custody and insurance records on-chain

#### Network Information

- **Mantle Sepolia Testnet**: Chain ID 5003
- **RPC URL**: https://rpc.sepolia.mantle.xyz
- **Block Explorer**: https://explorer.sepolia.mantle.xyz
- **Faucet**: https://faucet.sepolia.mantle.xyz/
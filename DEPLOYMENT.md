# Deployment Guide

This document provides comprehensive instructions for deploying the MantleLuxury RWA tokenization platform to production.

## Overview

 MantleLuxury is a Real World Asset (RWA) tokenization platform built on Mantle L2 that enables fractional ownership of luxury assets (watches, jewelry) through blockchain tokens. The platform implements comprehensive compliance measures including KYC/AML, asset custody, and insurance.

### Deployment Architecture

- **Frontend**: Next.js application deployed on [Vercel](https://vercel.com)
- **Backend**: Spring Boot API deployed on [Railway](https://railway.app)
- **Database**: MySQL 8.0+ deployed on Railway
- **Smart Contracts**: Deployed on Mantle Sepolia Testnet (or Mantle Mainnet)
- **Blockchain Network**: Mantle L2 (Chain ID: 5003 for Sepolia, 1 for Mainnet)

---

## Prerequisites

### Accounts Required

1. **GitHub Account** - For code repository
2. **Vercel Account** - [Sign up](https://vercel.com)
3. **Railway Account** - [Sign up](https://railway.app)
4. **MetaMask Wallet** - For blockchain interactions

### Blockchain Requirements

- **Mantle Network Access**: Mantle Sepolia Testnet or Mantle Mainnet
- **Wallet with MNT**: For paying gas fees (deployment and transactions)

### Software Requirements

- **Java**: JDK 17 or higher
- **Node.js**: v18 or higher
- **npm**: v9 or higher
- **Git**: For code management

---

## Part 1: Database Deployment (Railway)

### 1.1 Create MySQL Database Service

1. Log in to [Railway](https://railway.app)
2. Click "New Project" → "Empty Project"
3. Click "New" → Select "Database" → Select "MySQL"
4. Railway will automatically create a MySQL database instance

### 1.2 Configure Database Connection

1. Click on the MySQL service
2. Go to the "Variables" tab
3. Record the following connection details (you'll need these later):
   - `MYSQLHOST` - Database host address
   - `MYSQLPORT` - Database port (usually 3306)
   - `MYSQLDATABASE` - Database name
   - `MYSQLUSER` - Database username
   - `MYSQLPASSWORD` - Database password

### 1.3 Initialize Database Schema

**Important**: The database schema must be initialized before starting the backend service!

#### Method 1: Using Railway MySQL Terminal (Recommended)

1. In your Railway project, click on the MySQL service
2. Go to the "Data" tab
3. Click "Connect" → Select "MySQL Terminal"
4. In the terminal, execute:

```sql
-- Copy and paste the entire content of database/init-mysql.sql
-- Or use SOURCE command if the file is accessible:
SOURCE database/init-mysql.sql;
```

**Note**: If the `SOURCE` command doesn't work:
- Check current directory: `pwd`
- List files: `ls -la`
- Copy the entire content of `database/init-mysql.sql` and paste it directly into the terminal

#### Method 2: Using Local MySQL Client

1. Get connection details from the MySQL service "Variables" tab
2. Connect using a MySQL client:

```bash
mysql -h MYSQLHOST -P MYSQLPORT -u MYSQLUSER -pMYSQLPASSWORD MYSQLDATABASE < database/init-mysql.sql
```

Or use MySQL Workbench, DBeaver, or other GUI tools:
1. Create a new connection with the details above
2. Open `database/init-mysql.sql`
3. Execute the entire script

### 1.4 Verify Database Initialization

After initialization, verify in Railway MySQL Terminal:

```sql
-- List all tables
SHOW TABLES;

-- Should see tables including:
-- assets, user_investments, user_holdings, yield_distributions, 
-- kyc_verifications, custody_records, insurance_records, etc.
```

---

## Part 2: Smart Contract Deployment

### 2.1 Deploy Core Contracts

Before deploying the backend, you need to deploy the following core smart contracts:

1. **KYCRegistry** - Manages KYC verification status
2. **CustodyManager** - Records asset custody and insurance status
3. **YieldDistribution** - Handles yield distribution to token holders

#### Deploy Core Contracts

```bash
cd contracts

# Set up environment variables
cp .env.example .env

# Edit .env file:
# MANTLE_TESTNET_RPC_URL=https://rpc.sepolia.mantle.xyz
# PRIVATE_KEY=your_private_key_here (without 0x prefix)
# KYC_REGISTRY_ADDRESS= (will be set after deployment)
# CUSTODY_MANAGER_ADDRESS= (will be set after deployment)
# YIELD_DISTRIBUTION_CONTRACT= (will be set after deployment)

# Deploy core contracts
npx hardhat run scripts/deployKYCRegistry.ts --network mantleTestnet
npx hardhat run scripts/deployCustodyManager.ts --network mantleTestnet
npx hardhat run scripts/deployYieldDistribution.ts --network mantleTestnet
```

**Note**: Record all contract addresses - you'll need them for backend configuration.

### 2.2 Get Testnet Tokens

For Mantle Sepolia Testnet, get testnet MNT from:
- **Official Faucet**: https://faucet.sepolia.mantle.xyz/
- **Alchemy Faucet**: https://sepoliafaucet.com/ (select Mantle Sepolia)
- **Chainlink Faucet**: https://faucets.chain.link/ (select Mantle Sepolia)

You'll need at least 0.001 MNT for contract deployments and gas fees.

---

## Part 3: Backend Deployment (Railway)

### 3.1 Prepare Code Repository

Ensure your code is pushed to a GitHub repository.

### 3.2 Create Backend Service

1. In your Railway project, click "New" → "GitHub Repo"
2. Select your GitHub repository
3. Railway will auto-detect the `backend` directory (if not, configure root directory manually)

### 3.3 Configure Environment Variables

**Important**: Configure these in Railway's Web UI, not in code files!

1. In Railway project, click on the backend service
2. Go to "Variables" tab
3. Click "New Variable" to add each variable, or use "Raw Editor" for bulk addition

#### Database Configuration

**Option 1: Using Railway Variable References (Recommended)**

Railway supports referencing variables from other services using `${{ServiceName.VARIABLE_NAME}}` syntax:

```bash
# Database configuration (auto-referenced from MySQL service)
DATABASE_URL=jdbc:mysql://${{MySQL.MYSQLHOST}}:${{MySQL.MYSQLPORT}}/${{MySQL.MYSQLDATABASE}}?useSSL=true&serverTimezone=UTC&useUnicode=true&characterEncoding=UTF-8&allowPublicKeyRetrieval=true
DATABASE_USERNAME=${{MySQL.MYSQLUSER}}
DATABASE_PASSWORD=${{MySQL.MYSQLPASSWORD}}
```

**Option 2: Manual Configuration**

If variable references don't work, manually fill in the values from MySQL service variables:

```bash
# Database configuration (replace with actual values)
DATABASE_URL=jdbc:mysql://MYSQLHOST:MYSQLPORT/MYSQLDATABASE?useSSL=true&serverTimezone=UTC&useUnicode=true&characterEncoding=UTF-8&allowPublicKeyRetrieval=true
DATABASE_USERNAME=MYSQLUSER
DATABASE_PASSWORD=MYSQLPASSWORD
```

#### Server Configuration

```bash
# Server port (Railway auto-sets PORT, but can be explicit)
PORT=8080
```

#### CORS Configuration

```bash
# CORS allowed origins (replace with your Vercel frontend domain)
CORS_ALLOWED_ORIGINS=https://your-frontend.vercel.app,http://localhost:3000
```

**Note**: Update this after deploying the frontend with the actual Vercel domain.

#### Blockchain Configuration

```bash
# Blockchain settings
BLOCKCHAIN_ENABLED=true
BLOCKCHAIN_RPC_URL=https://rpc.sepolia.mantle.xyz  # For testnet
# For mainnet: https://rpc.mantle.xyz
BLOCKCHAIN_CHAIN_ID=5003  # 5003 for Sepolia, 1 for Mainnet
BLOCKCHAIN_PRIVATE_KEY=your_private_key_here  # Without 0x prefix
BLOCKCHAIN_GAS_LIMIT=80000000

# Core contract addresses (from Part 2.1)
YIELD_DISTRIBUTION_CONTRACT=0x...  # YieldDistribution contract address
KYC_REGISTRY_CONTRACT=0x...  # KYCRegistry contract address
CUSTODY_MANAGER_CONTRACT=0x...  # CustodyManager contract address
```

**Important Security Notes**:
- Never commit private keys to Git
- Use Railway's Secrets management for sensitive values
- The private key should have sufficient MNT balance for gas fees

#### Admin Configuration

```bash
# Admin wallet addresses (comma-separated, lowercase)
# These addresses can access admin features
ADMIN_WALLET_ADDRESSES=0x70a0af9d47a0f6314c4eef2a68666b096701ebdf
```

### 3.4 Configure Build and Start Commands

**Important**: Ensure Railway correctly identifies the build configuration.

Railway detects build configuration in this priority:
1. `railway.toml` (recommended)
2. `nixpacks.toml`
3. `railway.json`
4. `Dockerfile` (if exists)

**In Railway Service Settings**:

1. Go to backend service "Settings" tab
2. **Root Directory**: Set to project root (`/`) or `backend` depending on your setup
   - If set to `/`, ensure `contracts/` directory is accessible
   - If set to `backend`, contracts should be in `../contracts` or accessible via path
3. **Build Command**: `cd backend && ./gradlew bootJar --no-daemon`
4. **Start Command**: `cd backend && java -jar build/libs/mantle-luxury-backend-0.0.1-SNAPSHOT.jar`
5. **Builder**: Select `NIXPACKS` (not Docker, unless using Dockerfile)

**Ensure contracts directory is included**:
- Check `.railwayignore` file - ensure `contracts/` is not ignored
- Railway will auto-install Node.js dependencies in contracts directory (via nixpacks.toml)

### 3.5 Get Backend URL

After deployment:

1. In service "Settings" → "Networking"
2. Click "Generate Domain" to create a public domain
3. Record this domain (e.g., `your-backend.railway.app`)

### 3.6 Verify Backend Deployment

Test the health endpoint:

```bash
curl https://your-backend.railway.app/api/health
```

Should return:
```json
{"status":"UP"}
```

---

## Part 4: Frontend Deployment (Vercel)

### 4.1 Connect GitHub Repository

1. Log in to [Vercel](https://vercel.com)
2. Click "Add New..." → "Project"
3. Import your GitHub repository

### 4.2 Configure Project Settings

In the project configuration page:

1. **Framework Preset**: Next.js (auto-detected)
2. **Root Directory**: `frontend`
3. **Build Command**: `npm run build` (default)
4. **Output Directory**: `.next` (default)

### 4.3 Configure Environment Variables

In "Environment Variables" section, add:

```bash
# Backend API URL
NEXT_PUBLIC_API_BASE_URL=https://your-backend.railway.app

# Blockchain network (optional, defaults to Mantle Sepolia)
NEXT_PUBLIC_CHAIN_ID=5003  # 5003 for Sepolia, 1 for Mainnet
```

**Important**: Replace `your-backend.railway.app` with the actual backend domain from Part 3.5.

### 4.4 Deploy

Click "Deploy" to start deployment. Vercel will automatically:
1. Install dependencies
2. Build the project
3. Deploy to CDN

### 4.5 Get Frontend URL

After deployment, Vercel provides a domain (e.g., `your-project.vercel.app`).

### 4.6 Update CORS Configuration

After deploying the frontend, update backend CORS:

1. Go back to Railway backend service "Variables"
2. Update `CORS_ALLOWED_ORIGINS`:
   ```
   CORS_ALLOWED_ORIGINS=https://your-project.vercel.app,http://localhost:3000
   ```
3. Railway will automatically redeploy

---

## Part 5: File Upload Configuration

The platform supports asset image uploads. Current configuration stores files in the server's `uploads` directory, which may not persist on Railway's ephemeral filesystem.

### Options for Production:

1. **Railway Persistent Storage** (requires paid plan)
2. **External Storage Service**:
   - AWS S3
   - Cloudinary
   - Google Cloud Storage
3. **IPFS** (decentralized option)
   - Pinata
   - Infura IPFS

For MVP, the current setup works but files may be lost on service restart. Consider implementing external storage for production.

---

## Part 6: Continuous Deployment

### Railway Auto-Deploy

Railway automatically deploys when code is pushed to the configured branch:
- Default: Main/master branch
- Configure in "Settings" → "Source"

### Vercel Auto-Deploy

Vercel automatically deploys on push:
- Default: Main/master branch
- Configure in project settings
- Supports preview deployments for pull requests

### Deployment Workflow

1. Make changes locally
2. Commit and push to GitHub
3. Railway and Vercel auto-detect changes
4. Build and deploy automatically
5. Monitor deployment logs

---

## Part 7: Cost Estimation

### Railway Costs

- **Free Plan**: $5 free credit/month
- **Hobby Plan**: $5/month
- **MySQL Database**: ~$5/month
- **Total**: ~$10-15/month for small-scale deployment

### Vercel Costs

- **Free Plan**: Suitable for personal projects
- **Pro Plan**: $20/month (team features, more bandwidth)
- **Total**: $0-20/month depending on usage

### Total Estimated Cost

- **Development/Testing**: $0-10/month (free tiers)
- **Small Production**: $15-35/month
- **Medium Production**: $50-100/month

**Note**: Costs vary based on traffic, storage, and compute usage.


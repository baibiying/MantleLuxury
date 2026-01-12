# MantleLuxury Technical Design Document

**Version:** v1.0  
**Last Updated:** Jan 2026
**Document Type:** Technical Architecture and Implementation Design Document

---

## Table of Contents

1. [Overall Architecture Overview](#1-overall-architecture-overview)
2. [Smart Contract Design](#2-smart-contract-design)
3. [Backend Service Design](#3-backend-service-design)
4. [Frontend Application Design](#4-frontend-application-design)
5. [Mantle Integration Design](#5-mantle-integration-design)
6. [Data Storage Design](#6-data-storage-design)
7. [Security and Compliance Design](#7-security-and-compliance-design)
8. [API Design](#8-api-design)
9. [Deployment and Operations](#9-deployment-and-operations)
10. [Development Environment and Toolchain](#10-development-environment-and-toolchain)

---

## 1. Overall Architecture Overview

### 1.1 Architecture Layers

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend Layer                        │
│  Next.js 16 + TypeScript + Tailwind CSS 4              │
│  - Asset display, investment flow, portfolio, KYC        │
└─────────────────────────────────────────────────────────┘
                            ↕ HTTP/REST API
┌─────────────────────────────────────────────────────────┐
│              Backend Layer (Monolithic)                  │
│  Spring Boot 3.3.2 + Java 17                           │
│  - REST API, business logic, blockchain integration      │
│  - Event indexer, KYC/AML, asset management             │
└─────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────┐
│              Blockchain Layer (Mantle L2)                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐│
│  │LuxuryToken│ │KYCRegistry│ │YieldDist.│ │CustodyMgr ││
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘│
└─────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────┐
│              Data and Storage Layer                      │
│  MySQL 8.0+ + File System (uploads) + Event Indexer    │
└─────────────────────────────────────────────────────────┘
```

### 1.2 Technology Stack

#### Frontend
- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4
- **Web3 Integration**: 
  - `wagmi` 3.1.0 (React Hooks for Ethereum)
  - `viem` 2.41.2 (TypeScript Ethereum library)
  - `@metamask/sdk` (MetaMask integration)
- **3D Rendering**: Three.js + @react-three/fiber + @react-three/drei
- **Data Fetching**: @tanstack/react-query
- **Charts**: Recharts

#### Backend
- **Framework**: Spring Boot 3.3.2
- **Language**: Java 17
- **Database**: MySQL 8.0+ (via HikariCP connection pool)
- **ORM**: Spring Data JPA / Hibernate
- **Blockchain Integration**: Web3j 4.10.3
- **Build Tool**: Gradle
- **Architecture**: Monolithic (single Spring Boot application)

#### Blockchain
- **Development Framework**: Hardhat
- **Language**: Solidity 0.8.24
- **Libraries**: OpenZeppelin Contracts
- **Network**: Mantle Sepolia Testnet (Chain ID: 5003) / Mantle Mainnet
- **Compiler**: Solidity compiler with optimizer (200 runs)

#### Infrastructure
- **Frontend Deployment**: Vercel
- **Backend Deployment**: Railway
- **Database**: Railway MySQL
- **File Storage**: Local filesystem (uploads directory) - can be migrated to S3/IPFS
- **CI/CD**: Manual deployment (can be automated with GitHub Actions)

### 1.3 Core Design Principles

1. **On-Chain/Off-Chain Separation**
   - Critical state (KYC, asset ownership, yield distribution) is verifiable on-chain
   - Large data (images, reports, metadata) stored off-chain (filesystem/IPFS), hash stored on-chain

2. **Minimal Trust Surface**
   - All asset and yield-related operations are based on on-chain results
   - Frontend and backend serve as display and indexing layers for on-chain data

3. **Scalability**
   - Monolithic architecture simplifies deployment and maintenance
   - Contract design supports batch operations to reduce gas costs
   - Event indexer enables efficient off-chain data synchronization

4. **Security First**
   - Multi-signature wallet management for critical operations (planned)
   - All contracts use OpenZeppelin libraries
   - Backend implements admin role-based access control

---

## 2. Smart Contract Design

### 2.1 Contract Architecture

#### 2.1.1 LuxuryToken (ERC-20 Fractional Ownership Token)

**Function Overview**: Represents fractional ownership tokens for individual physical luxury assets, based on ERC-20 standard with KYC transfer restrictions.

**Core Interface**:

```solidity
interface ILuxuryToken {
    // Basic ERC-20 functions
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    
    // Asset metadata
    function assetId() external view returns (bytes32);
    function metadataHash() external view returns (bytes32);
    function pricePerToken() external view returns (uint256);
    
    // Purchase function
    function buyTokens(uint256 amount) external payable;
    
    // Owner functions
    function setPrice(uint256 newPrice) external;
    function toggleSales() external;
    function setKYCRegistry(address newRegistry) external;
}
```

**Key Implementation Details**:
- Inherits `ERC20` and `Ownable` from OpenZeppelin
- Checks `KYCRegistry.isKYCApproved(buyer)` before allowing token purchases
- Stores `assetId` (bytes32) and `metadataHash` (IPFS hash)
- Supports configurable price per token
- Funds are immediately transferred to the asset owner upon purchase
- Sales can be toggled on/off by owner

**Events**:
```solidity
event TokensPurchased(address indexed buyer, uint256 amount, uint256 totalCost);
event PaymentTransferred(address indexed recipient, uint256 amount);
event PriceUpdated(uint256 newPrice);
event SalesToggled(bool enabled);
```

#### 2.1.2 KYCRegistry (KYC Status Registry)

**Function Overview**: Maintains on-chain mapping of addresses to KYC status for other contracts to check permissions.

**Core Interface**:

```solidity
interface IKYCRegistry {
    enum Status { None, Pending, Approved, Rejected, Blacklisted }
    
    function setKYCStatus(address user, Status status) external;
    function getKYCStatus(address user) external view returns (Status);
    function isKYCApproved(address user) external view returns (bool);
    function batchSetKYCStatus(address[] calldata users, Status[] calldata statuses) external;
}
```

**Key Implementation Details**:
- Uses `mapping(address => Status)` to store status
- Only `ROLE_COMPLIANCE` role can call `setKYCStatus`
- `isKYCApproved` returns `status == Status.Approved`
- Supports batch operations to reduce gas costs

**Events**:
```solidity
event KYCStatusUpdated(address indexed user, Status indexed oldStatus, Status indexed newStatus);
```

#### 2.1.3 YieldDistribution (Yield Distribution Contract)

**Function Overview**: Distributes funds from yield pool to holders proportionally based on token holdings. Supports appreciation and rental yield types.

**Core Interface**:

```solidity
interface IYieldDistribution {
    enum YieldType { Appreciation, Rental }
    
    struct Distribution {
        bytes32 distributionId;
        address tokenAddress;  // LuxuryToken address
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

**Distribution Strategy**:
- **Direct Loop Distribution**: Contract iterates through all holders and transfers proportionally (suitable for < 100 holders)
- **Merkle Distribution** (future): Off-chain Merkle tree calculation, users claim themselves (suitable for large-scale distribution)

**Key Implementation Details**:
- Accepts native token (MNT) for distribution
- Uses `LuxuryToken.balanceOf` to calculate holding proportions
- Supports pause/resume distribution (emergency situations)
- Records complete history of each distribution

**Events**:
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

#### 2.1.4 CustodyManager (Custody and Insurance Management)

**Function Overview**: Records physical asset custody and insurance status, interfaces with off-chain processes.

**Core Interface**:

```solidity
interface ICustodyManager {
    enum AssetStatus { Registered, InCustody, ForSale, Sold, Withdrawn }
    
    struct AssetInfo {
        bytes32 assetId;
        AssetStatus status;
        bytes32 custodyInfoHash;  // Hash of custody organization, location, etc.
        bytes32 insuranceInfoHash; // Hash of insurance information
        address tokenAddress;  // Associated LuxuryToken
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
    function getAssetStatus(bytes32 assetId) external view returns (AssetStatus);
}
```

**Key Implementation Details**:
- Status transitions require multi-signature confirmation or specific role authorization
- `Sold` status can trigger automatic notification to `YieldDistribution` to create distribution
- All off-chain detailed information (custody organization name, address, insurance policy number, etc.) stored as hash only

**Events**:
```solidity
event AssetRegistered(bytes32 indexed assetId, address indexed tokenAddress, bytes32 custodyHash);
event StatusUpdated(bytes32 indexed assetId, AssetStatus indexed oldStatus, AssetStatus indexed newStatus);
event CustodyInfoUpdated(bytes32 indexed assetId, bytes32 newHash);
event InsuranceInfoUpdated(bytes32 indexed assetId, bytes32 newHash);
```

### 2.2 Contract Deployment and Upgrade Strategy

#### Deployment Order
1. `KYCRegistry` (base contract, other contracts depend on it)
2. `CustodyManager` (required for asset registration)
3. `YieldDistribution` (required for yield distribution)
4. `LuxuryToken` (one instance per asset, deployed automatically when asset is submitted)

#### Upgrade Strategy
- **Non-upgradeable Contracts**: `KYCRegistry`, `CustodyManager` (core state, avoid complexity)
- **Non-upgradeable Contracts**: `LuxuryToken` (one per asset, immutable)
- **Potentially Upgradeable**: `YieldDistribution` (may need to optimize distribution algorithm in future)

### 2.3 Security Considerations

- **OpenZeppelin Libraries**: Uses `ReentrancyGuard`, `Ownable`, `AccessControl`
- **Input Validation**: All external inputs have boundary checks
- **Gas Optimization**: Batch operations, event optimization, storage optimization
- **Audit Requirements**: All contracts should pass third-party security audits before mainnet deployment

---

## 3. Backend Service Design

### 3.1 Service Module Structure

The backend is a monolithic Spring Boot application organized into the following modules:

#### 3.1.1 API Layer

**Responsibilities**:
- REST API endpoints for frontend
- Request validation and error handling
- CORS configuration
- Admin authentication and authorization

**Technology Stack**: Spring Boot Web, Spring Security (planned)

**Main Controllers**:
- `AssetController`: Asset listing, details, submission
- `PortfolioController`: User portfolio and holdings
- `KycController`: KYC submission and status
- `YieldController`: Yield distribution and records
- `AssetAuthenticationController`: Asset authentication management
- `CustodyController`: Custody record management
- `InsuranceController`: Insurance record management
- `AdminAssetController`: Admin asset management
- `AdminKycController`: Admin KYC management
- `AdminYieldController`: Admin yield distribution management
- `StatsController`: Platform statistics

#### 3.1.2 Service Layer

**Asset Service** (`AssetService`):
- Manages asset off-chain metadata (brand, model, images, reports)
- Handles asset submission and review workflow
- Integrates with blockchain for token deployment
- Manages asset images and file uploads

**User Service** (via `UserRepository` and domain entities):
- Manages user identity information (off-chain storage, encrypted)
- KYC status management
- User settings and preferences

**KYC/AML Service** (`AmlService`):
- KYC workflow management (database state machine)
- AML address screening (can integrate with Chainalysis/Elliptic)
- Blacklist management

**Yield Service** (`YieldService`):
- Yield distribution creation and management
- Integration with `YieldDistribution` contract
- Yield record tracking and reporting

**Blockchain Integration Services**:
- `TokenDeploymentService`: Automatic token contract deployment
- `KYCRegistryService`: KYC status synchronization with on-chain registry
- `CustodyManagerService`: Custody status synchronization
- `LuxuryTokenService`: Token interaction (balance queries, etc.)
- `EventIndexerService`: On-chain event indexing and synchronization

#### 3.1.3 Event Indexer

**Responsibilities**: Listens to Mantle on-chain events and synchronizes to database.

**Listened Events**:
- `LuxuryToken.TokensPurchased`
- `KYCRegistry.KYCStatusUpdated`
- `YieldDistribution.DistributionCreated`, `Claimed`
- `CustodyManager.StatusUpdated`

**Implementation**:
- Uses Web3j to listen to events
- Periodically scans blocks (from last synced position)
- Writes event data to MySQL
- Handles chain reorganization (reorg) situations
- Self-hosted event indexer (not using The Graph)

### 3.2 Data Synchronization Strategy

- **On-Chain → Off-Chain**: Event indexer synchronizes in real-time
- **Off-Chain → On-Chain**: Through admin wallet/multi-signature calling contracts (KYC status updates, yield distribution triggers)

### 3.3 Automatic Contract Deployment

When an asset is submitted:
1. Backend automatically compiles the `LuxuryToken` contract using Hardhat
2. Deploys the contract to Mantle testnet
3. Records the contract address in the database
4. Updates asset status

This is handled by `MantleTokenDeploymentService` which:
- Executes Hardhat compilation and deployment scripts
- Manages deployment configuration
- Handles deployment errors and retries

---

## 4. Frontend Application Design

### 4.1 Project Structure

```
frontend/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── page.tsx           # Homepage
│   │   ├── assets/
│   │   │   ├── page.tsx       # Asset list
│   │   │   ├── [id]/
│   │   │   │   └── page.tsx   # Asset detail
│   │   │   └── submit/
│   │   │       └── page.tsx   # Asset submission
│   │   ├── portfolio/
│   │   │   └── page.tsx       # Portfolio
│   │   └── kyc/
│   │       └── page.tsx       # KYC flow
│   ├── components/            # Reusable components
│   │   ├── WalletConnect.tsx
│   │   ├── AssetCard.tsx
│   │   ├── AssetDetail.tsx
│   │   ├── PortfolioChart.tsx
│   │   └── KYCForm.tsx
│   ├── lib/
│   │   ├── web3/              # Web3 utilities
│   │   │   ├── config.ts     # Wagmi configuration
│   │   │   └── contracts.ts  # Contract ABIs and addresses
│   │   └── api/               # Backend API client
│   │       └── client.ts
│   └── providers/
│       └── Web3Provider.tsx   # Web3 context provider
└── public/                    # Static assets
```

### 4.2 Core Feature Implementation

#### 4.2.1 Wallet Connection

Uses `wagmi` + `viem`:

```typescript
// lib/web3/config.ts
import { createConfig, http } from 'wagmi';
import { mantleSepolia } from 'wagmi/chains';
import { metaMask } from 'wagmi/connectors';

export const wagmiConfig = createConfig({
  chains: [mantleSepolia],
  connectors: [metaMask()],
  transports: {
    [mantleSepolia.id]: http(),
  },
});
```

#### 4.2.2 Asset List and Details

- **List Page**: Fetches asset data from backend API, supports filtering and sorting
- **Detail Page**: 
  - Displays high-resolution images, 3D models (Three.js)
  - Shows valuation reports, custody/insurance information
  - Purchase module: Input amount → Calculate shares → Call contract `buyTokens`

#### 4.2.3 Portfolio

- Reads user's `LuxuryToken` balances from on-chain
- Fetches asset metadata and valuations from backend API
- Uses Recharts to display yield curves and asset distribution
- Supports CSV export for tax and accounting

#### 4.2.4 KYC Flow

- Multi-step form (React Hook Form)
- File upload (images, PDFs)
- Calls backend API to submit KYC
- Polls or uses WebSocket to get review status

### 4.3 State Management

- **Global State**: React Context (wallet state, user info)
- **Server State**: React Query (@tanstack/react-query) for asset list, portfolio data
- **On-Chain State**: `wagmi` hooks (balance, transaction status)

### 4.4 Styling and UI

- **Design System**: Tailwind CSS 4 + custom component library
- **Theme**: Premium visual style matching luxury positioning (dark mode)
- **Responsive**: Mobile-first, desktop optimized

---

## 5. Mantle Integration Design

### 5.1 Network Configuration

**Testnet Configuration**:
```typescript
// lib/web3/config.ts
export const mantleSepolia = {
  id: 5003,
  name: 'Mantle Sepolia',
  network: 'mantle-sepolia',
  nativeCurrency: { name: 'Mantle', symbol: 'MNT', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.sepolia.mantle.xyz'] },
  },
  blockExplorers: {
    default: { name: 'Mantle Explorer', url: 'https://explorer.sepolia.mantle.xyz' },
  },
};
```

### 5.2 Gas Optimization Strategy

- **Batch Operations**: Yield distribution uses batch transfers to reduce transaction count
- **Event Optimization**: Only record necessary data to reduce gas consumption
- **Storage Optimization**: Use `bytes32` to store hashes instead of full strings

### 5.3 Monitoring and Health Checks

- Monitor Mantle RPC node availability
- Track block confirmation time
- Alert: RPC latency > 5s or node unavailable

---

## 6. Data Storage Design

### 6.1 Relational Database (MySQL 8.0+)

#### Core Table Structure

**users table**:
```sql
CREATE TABLE users (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    wallet_address VARCHAR(42) UNIQUE NOT NULL,
    email VARCHAR(255),
    kyc_status VARCHAR(20) NOT NULL, -- 'none', 'pending', 'approved', 'rejected'
    kyc_submitted_at TIMESTAMP NULL,
    kyc_approved_at TIMESTAMP NULL,
    kyc_rejected_at TIMESTAMP NULL,
    kyc_rejection_reason TEXT,
    full_name VARCHAR(200),
    id_number VARCHAR(50),
    id_type VARCHAR(20),
    address TEXT,
    phone VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

**assets table**:
```sql
CREATE TABLE assets (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    asset_id_bytes32 VARCHAR(66) UNIQUE NOT NULL,
    token_address VARCHAR(42),
    asset_type VARCHAR(50) NOT NULL, -- 'watch', 'jewelry'
    brand VARCHAR(100),
    model VARCHAR(100),
    year INT,
    total_supply DECIMAL(36, 18),
    price_per_share DECIMAL(36, 18),
    metadata_hash VARCHAR(66),
    custody_info_hash VARCHAR(66),
    insurance_info_hash VARCHAR(66),
    status VARCHAR(20) NOT NULL, -- 'registered', 'fundraising', 'funded', 'sold'
    submitted_by VARCHAR(42),
    description TEXT,
    purchase_price DECIMAL(36, 18),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

**asset_authentications table**:
```sql
CREATE TABLE asset_authentications (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    asset_id CHAR(36) NOT NULL,
    authenticator_name VARCHAR(200) NOT NULL,
    authenticator_type VARCHAR(50), -- 'official_brand', 'third_party', 'ai_system'
    authentication_status VARCHAR(20) NOT NULL, -- 'pending', 'verified', 'rejected'
    report_url TEXT,
    report_hash VARCHAR(66),
    verifier_signature TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (asset_id) REFERENCES assets(id)
);
```

**custodies table**:
```sql
CREATE TABLE custodies (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    asset_id CHAR(36) NOT NULL,
    custody_organization VARCHAR(200) NOT NULL,
    warehouse_location VARCHAR(200),
    warehouse_address_hash VARCHAR(66),
    entry_date DATE,
    custody_contract_url TEXT,
    custody_contract_hash VARCHAR(66),
    facility_standards TEXT,
    status VARCHAR(20) NOT NULL, -- 'registered', 'in_custody', 'for_sale', 'sold', 'withdrawn'
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (asset_id) REFERENCES assets(id)
);
```

**insurances table**:
```sql
CREATE TABLE insurances (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    asset_id CHAR(36) NOT NULL,
    insurance_company VARCHAR(200) NOT NULL,
    policy_number VARCHAR(100),
    coverage_amount DECIMAL(36, 18) NOT NULL,
    coverage_currency VARCHAR(10) DEFAULT 'USD',
    policy_start_date DATE,
    policy_end_date DATE NOT NULL,
    premium_amount DECIMAL(36, 18),
    coverage_type VARCHAR(50) DEFAULT '全险',
    policy_document_url TEXT,
    policy_document_hash VARCHAR(66),
    is_active BOOLEAN DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (asset_id) REFERENCES assets(id)
);
```

**yield_distributions table**:
```sql
CREATE TABLE yield_distributions (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    distribution_id_bytes32 VARCHAR(66) UNIQUE NOT NULL,
    asset_id CHAR(36) NOT NULL,
    token_address VARCHAR(42) NOT NULL,
    yield_type VARCHAR(20) NOT NULL, -- 'appreciation', 'rental'
    total_amount DECIMAL(36, 18),
    distributed_amount DECIMAL(36, 18) DEFAULT 0,
    is_completed BOOLEAN DEFAULT FALSE,
    transaction_hash VARCHAR(66),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    FOREIGN KEY (asset_id) REFERENCES assets(id)
);
```

**user_holdings table** (indexed from on-chain events):
```sql
CREATE TABLE user_holdings (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_address VARCHAR(42) NOT NULL,
    token_address VARCHAR(42) NOT NULL,
    balance DECIMAL(36, 18) NOT NULL,
    last_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE(user_address, token_address)
);
```

### 6.2 File Storage

**Current Implementation**: Local filesystem (uploads directory on server)

**Storage Content**:
- Asset high-resolution images
- 3D model files
- Valuation report PDFs
- Authentication certificate scans
- Custody and insurance documents

**Future Migration**: Can migrate to S3, Cloudinary, or IPFS for production

**Hash Management**: All files uploaded return a hash, stored in database and on-chain.

---

## 7. Security and Compliance Design

### 7.1 Smart Contract Security

- **OpenZeppelin Libraries**: All contracts use OpenZeppelin's battle-tested libraries
- **Audit**: Contracts should pass third-party security audits before mainnet deployment
- **Bug Bounty**: Establish bug bounty program to encourage community discovery
- **Multi-Signature Wallet**: Critical operations (KYC status updates, yield distribution triggers) require multi-signature confirmation (planned)

### 7.2 Backend Security

- **Authentication**: Admin wallet address verification (planned: JWT Token + MFA)
- **Authorization**: Admin role-based access control (wallet address whitelist)
- **API Rate Limiting**: Prevent DDoS and abuse (planned)
- **Data Encryption**: Sensitive data (user identity information) encrypted storage (planned)
- **CORS**: Configured to allow only frontend domain

### 7.3 Compliance Process

- **KYC/AML**: Integration with third-party services (can integrate Sumsub, Onfido, Chainalysis)
- **Risk Control Rules**: 
  - Large transactions trigger manual review (configurable threshold)
  - High-risk addresses automatically flagged
- **Audit Logging**: All critical operations record audit logs, traceable

### 7.4 Data Privacy

- **GDPR Compliance**: Support user data export and deletion (planned)
- **Data Masking**: Serial numbers and other sensitive information masked in frontend display
- **Access Control**: Only authorized personnel can access complete user data

---

## 8. API Design

### 8.1 REST API Specification

**Base URL**: `https://mantleluxury-production.up.railway.app/api`

#### Asset Related

```
GET    /api/assets                    # Get asset list
GET    /api/assets/:id                # Get asset details
POST   /api/assets/submit             # Submit new asset
POST   /api/assets/:id/purchase        # Generate purchase transaction parameters (frontend calls contract)
GET    /api/assets/:id/images          # Get asset images
POST   /api/assets/:id/images          # Upload asset images
```

#### User Related

```
GET    /api/portfolio                 # Get user portfolio
GET    /api/portfolio/holdings        # Get user holdings
GET    /api/yields                     # Get yield records
GET    /api/yields/user/:address       # Get user's yield records
GET    /api/yields/asset/:assetId     # Get asset's yield records
POST   /api/yields/create              # Create yield distribution (admin)
POST   /api/yields/:id/distribute      # Trigger yield distribution (admin)
```

#### KYC Related

```
GET    /api/kyc/status                 # Get KYC status
POST   /api/kyc/submit                 # Submit KYC application
GET    /api/kyc/status/:requestId      # Query KYC review status
```

#### Asset Management (Admin)

```
POST   /api/asset-authentications      # Create asset authentication record
POST   /api/asset-authentications/:id/review  # Review authentication
GET    /api/asset-authentications/asset/:assetId  # Get asset authentications
POST   /api/custodies                  # Create custody record
POST   /api/custodies/:assetId/status  # Update custody status
POST   /api/insurances                 # Create insurance record
POST   /api/insurances/renew           # Renew insurance
GET    /api/insurances/asset/:assetId  # Get asset insurances
```

#### Statistics

```
GET    /api/stats/overview             # Get platform overview statistics
```

### 8.2 Response Format

```json
{
  "id": "uuid",
  "data": { ... },
  "timestamp": "2025-12-01T10:00:00Z"
}
```

### 8.3 Authentication

- **Admin Operations**: Verified by wallet address (configured in `ADMIN_WALLET_ADDRESSES`)
- **Future**: JWT Token or Web3 signature verification for user operations

---

## 9. Deployment and Operations

### 9.1 Environment Setup

#### Development Environment
- Local Hardhat node or Mantle testnet
- Local MySQL database (Docker)
- Frontend local development server
- Backend local Spring Boot server

#### Production Environment
- **Frontend**: Deployed on Vercel
- **Backend**: Deployed on Railway
- **Database**: Railway MySQL
- **Contracts**: Deployed on Mantle Sepolia Testnet (Chain ID: 5003)

### 9.2 Deployment Process

#### Frontend Deployment (Vercel)
1. Connect GitHub repository to Vercel
2. Configure build settings (root directory: `frontend`)
3. Set environment variables (`NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_CHAIN_ID`)
4. Automatic deployment on git push

#### Backend Deployment (Railway)
1. Connect GitHub repository to Railway
2. Configure build command: `cd backend && ./gradlew bootJar --no-daemon`
3. Configure start command: `cd backend && java -jar build/libs/mantle-luxury-backend-*.jar`
4. Set environment variables (database, blockchain, admin addresses)
5. Automatic deployment on git push

#### Contract Deployment
1. Deploy core contracts manually (KYCRegistry, CustodyManager, YieldDistribution)
2. LuxuryToken contracts are deployed automatically when assets are submitted
3. Update contract addresses in backend configuration

### 9.3 Monitoring and Alerts

#### Monitoring Metrics

**Application Layer**:
- API response time (P50, P95, P99)
- Error rate
- Request volume (QPS)

**Infrastructure**:
- CPU, memory, disk usage (Railway dashboard)
- Database connection pool status
- File storage usage

**Blockchain Layer**:
- Mantle RPC latency
- Contract transaction success rate
- Gas usage

#### Alert Rules (Planned)
- API error rate > 5%
- RPC latency > 5s
- Database connection pool > 80%
- Large abnormal transactions (> 50,000 USD)

### 9.4 Log Management

- **Backend Logs**: View in Railway service logs
- **Frontend Logs**: View in Vercel deployment logs
- **Log Retention**: Railway and Vercel default retention periods

---

## 10. Development Environment and Toolchain

### 10.1 Local Development Setup

#### Prerequisites
- Java 17+
- Gradle (or use Gradle Wrapper)
- Node.js 18+
- Docker & Docker Compose
- Git

#### Quick Start

```bash
# 1. Clone repository
git clone https://github.com/your-org/MantleLuxury.git
cd MantleLuxury

# 2. Start local infrastructure (MySQL)
./database/start-mysql.sh

# 3. Install dependencies (contracts and frontend)
cd contracts && npm install
cd ../frontend && npm install

# 4. Configure contracts environment
cd contracts
cp .env.example .env
# Edit .env with your private key and RPC URL

# 5. Deploy core contracts to Mantle testnet
npx hardhat run scripts/deployKYCRegistry.ts --network mantleTestnet
npx hardhat run scripts/deployCustodyManager.ts --network mantleTestnet
npx hardhat run scripts/deployYieldDistribution.ts --network mantleTestnet

# 6. Configure backend environment
cd ../backend
# Edit application.yml or set environment variables:
# - DATABASE_URL
# - BLOCKCHAIN_PRIVATE_KEY
# - BLOCKCHAIN_RPC_URL
# - YIELD_DISTRIBUTION_CONTRACT
# - KYC_REGISTRY_CONTRACT
# - CUSTODY_MANAGER_CONTRACT
# - ADMIN_WALLET_ADDRESSES

# 7. Start backend Spring Boot service
./gradlew bootRun

# 8. Start frontend development server
cd ../frontend
npm run dev
```

### 10.2 Development Tools

- **Contract Development**: Hardhat, OpenZeppelin Contracts
- **Backend Development**: Spring Boot, Spring Initializr, Web3j
- **Frontend Development**: Next.js, TypeScript, Tailwind CSS
- **Code Quality**: ESLint, Prettier (frontend), Checkstyle/Spotless (backend, planned)
- **Version Control**: Git

### 10.3 Testing Strategy

#### Contract Testing
- Unit tests: Test each contract function individually
- Integration tests: Test interactions between contracts
- Security testing: Use Slither or Mythril for static analysis (planned)

#### Frontend Testing
- Unit tests: React Testing Library (planned)
- E2E tests: Playwright or Cypress (planned)

#### Backend Testing
- Unit tests: JUnit 5 + Spring Boot Test (planned)
- Integration tests: Testcontainers for MySQL, test API endpoints and database interactions (planned)

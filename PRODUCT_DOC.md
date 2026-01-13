# MantleLuxury Product Requirements Document (PRD)

**Version:** v1.0  
**Last Updated:** Jan 2026  
**Product Type:** Luxury RWA Tokenization Investment Platform (Built on Mantle L2)

---

## 1. Product Overview

### 1.1 Product Definition

**MantleLuxury** is a Real World Asset (RWA) tokenization platform built on Mantle L2 that enables fractional ownership of luxury physical assets (watches, jewelry) through blockchain tokens. The platform democratizes luxury asset investment by allowing global investors to participate with lower entry barriers while ensuring compliance, security, and transparency through comprehensive KYC/AML, professional custody, insurance, and third-party authentication.

### 1.2 Product Vision

- **Become the infrastructure and preferred platform for luxury RWA tokenization**
- Transform luxury goods from "collectibles for the few" into "investable assets for the many"
- Establish a complete closed-loop system: "Physical Asset → Tokenization → Trading/Investment → Yield Distribution → Compliance Reporting"

### 1.3 Product Goals

- Establish MantleLuxury as a benchmark RWA project within the Mantle ecosystem
- Launch 5–10 pilot assets to validate business and technical feasibility
- Provide investors with a **transparent, secure, and seamless** luxury investment experience
- Offer asset owners **efficient liquidity and monetization** solutions

### 1.4 Key Features

#### Core Functionality

- **Fractional Ownership**: Invest in luxury watches and jewelry with as little as $500
- **Asset Tokenization**: Automatic ERC-20 token deployment when assets are submitted
- **KYC/AML Integration**: Mandatory verification before investment
- **Portfolio Management**: View holdings, transaction history, and yield records
- **Yield Distribution**: Automated distribution of appreciation and rental yields via smart contracts
- **Asset Authentication**: Third-party authentication and valuation reports
- **Custody & Insurance**: Professional custody and comprehensive insurance tracking
- **CSV Export**: Export transaction and holding records for tax filing

#### Asset Management

- **Asset Submission**: Submit luxury assets with high-resolution images, 3D models, and detailed information
- **Authentication Flow**: Create authentication records → Review → Asset status automatically updates to `fundraising`
- **Custody Management**: Track asset custody with warehouse location, entry date, and facility standards
- **Insurance Management**: Manage insurance policies with coverage amounts, policy numbers, and expiration dates

#### Investment Flow

1. **Browse Assets**: View available assets with detailed information, images, and authentication status
2. **Complete KYC**: Mandatory KYC/AML verification before investment
3. **Invest**: Connect wallet and invest in fractional ownership tokens
4. **Track Portfolio**: Monitor holdings, transaction history, and yield distributions
5. **Export Records**: Download CSV files for tax filing and compliance reporting

---

## 2. Users and Use Cases

### 2.1 User Roles

1. **Individual Investors**
   - Profile: Investors with some financial experience, willing to allocate to alternative assets, investment range $1,000–$50,000
   - Needs: Low-barrier entry to luxury investment, improved returns, visualizable assets and yields

2. **Institutional Investors**
   - Profile: Family offices, asset management institutions, hedge funds
   - Needs: Compliant and transparent alternative asset opportunities, API access, bulk operation capabilities, report exports

3. **Collectors / Luxury Asset Owners (Asset Issuers)**
   - Profile: Owners of multiple luxury watches, jewelry, or handbags seeking to unlock asset value
   - Needs: Obtain liquidity without fully divesting physical assets; maintain brand and asset value

4. **Platform Operations and Compliance Personnel**
   - Needs: Manage asset listings, review KYC/AML, initiate yield distributions, generate compliance reports

### 2.2 Core Use Cases

1. **Fractional Luxury Asset Investment**
   - Users can invest in top-tier watches/diamonds with as little as a few hundred dollars
   - Platform displays asset details, valuation reports, authentication certificates, and historical performance

2. **Asset Owner Liquidity Access**
   - Collectors tokenize a $50,000 Patek Philippe watch into 1,000 shares
   - Sell partial tokens for cash flow while retaining shares to benefit from future appreciation

3. **Yield Distribution**
   - Platform distributes appreciation yields when assets are sold
   - Yields are automatically distributed to token holders proportionally via smart contracts

4. **Compliance Reporting and Regulatory Alignment**
   - Users export annual yields and transaction records for tax filing
   - Platform generates necessary compliance and audit reports for partners and regulators

---

## 3. Product Scope and Principles

### 3.1 MVP Product Scope (Current Release)

- Support tokenization and investment for **watches and jewelry** asset classes
- Web application (desktop-first, mobile browser compatible)
- Basic KYC (individual-focused) with blacklist/sanctions screening
- Asset display, token investment, portfolio and yield viewing
- **One-time appreciation yield distribution** (distributed after asset sale)

### 3.2 Out of Scope (Not in MVP)

- Full DAO governance and platform token economics
- Open API and extensive third-party integrations
- Complete multi-jurisdiction tax auto-filing on-chain
- Full-featured native mobile apps (iOS/Android)
- Stablecoin payment integration (not currently implemented)

### 3.3 Product Design Principles

- **Compliance First**: All designs default to KYC/AML, asset proof, and regulatory requirements
- **Asset Security Priority**: Custody, insurance, multi-signature, and audits must be implemented
- **Premium Experience**: Visual and interaction design must match "luxury" positioning
- **Transparency and Verifiability**: Critical status, custody, and compliance information recorded on-chain, with off-chain audits and reports

---

## 4. Key Business Processes

This section describes end-to-end processes from a product perspective for design, development, and compliance coordination.

### 4.1 New User Investment Flow (Individual Investor)

1. **Registration & Wallet Connection**
   - User visits the platform and clicks "Connect Wallet"
   - Supports MetaMask, WalletConnect, and other mainstream wallets
   - Before KYC completion, users can only browse assets, not invest

2. **KYC Identity Verification**
   - Fill in basic identity information (name, ID number, address, contact)
   - Upload ID documents + facial recognition (third-party KYC service)
   - Simple risk assessment questionnaire
   - After approval, on-chain `KYCRegistry` records user status

3. **Browse and Select Assets**
   - Filter assets by category/brand/price range/risk level on asset list page
   - Click to view asset detail page: high-resolution images, 3D models, valuation reports, custody/insurance information

4. **Purchase Token Shares**
   - Enter purchase amount or shares on asset detail page
   - System displays expected holding percentage, fees, and risk warnings
   - User confirms transaction in wallet, `LuxuryToken` contract completes token transfer

5. **View Holdings and Yields**
   - View asset holdings, percentage, and valuation changes on "Portfolio" page
   - When yield distribution occurs, `YieldDistribution` contract automatically transfers funds to user address

### 4.2 Asset Listing and Tokenization Flow (Issuer)

1. **Issuer Application**
   - Issuer creates "Issuer Account" and completes institutional-level KYC
   - Submit basic information (company info, authorized person info, etc.)

2. **Asset Information Submission**
   - Fill in brand, model, year, purchase price, etc. in "Submit Asset" form
   - Upload high-quality images and videos, purchase receipts, insurance policies, etc.

3. **Authentication and Valuation**
   - Platform and third-party authentication agencies (can combine AI image recognition) complete authenticity verification
   - Multiple valuation agencies provide valuation ranges, forming valuation reports

4. **Custody and Insurance Implementation**
   - Physical assets enter partner custody warehouses
   - Purchase comprehensive insurance with coverage amount tied to valuation
   - Custody and insurance information written to on-chain `CustodyManager` contract

5. **Token Issuance and Listing**
   - Determine total token supply and minimum subscription amount (e.g., 1,000 shares at $500 per share)
   - Deploy/instantiate `LuxuryToken` contract, write IPFS metadata hash
   - Asset appears in frontend "Available Assets" list, fundraising can begin

6. **Asset Sale and Yield Distribution**
   - When asset matures or conditions are met, multi-signature initiates sale process
   - After sale completion, proceeds enter yield pool
   - `YieldDistribution` distributes appreciation yields proportionally to token holders

### 4.3 Rental Yield Flow (Future Version)

> MVP does not implement this yet, but contract and product interfaces are reserved.

1. Platform signs rental agreements with event organizers/institutions
2. After rental completion, rental income enters platform escrow account
3. Platform confirms net income (after deducting insurance surcharges, transportation, maintenance, etc.)
4. Call `YieldDistribution` contract to distribute "rental yield" proportionally to token holders

---

## 5. Feature Module Description

### 5.1 Frontend Feature Modules

1. **Homepage**
   - Featured asset carousel (promoted assets, popularity ranking)
   - Platform key metrics (total assets, user count, cumulative distributed yields, etc.)
   - Most recent yield distribution records

2. **Asset List Page**
   - Filtering: Asset type, brand, price range, status (fundraising/funded/sold)
   - Sorting: Expected yield, price, listing time, etc.
   - Card information: Thumbnail, brand/model, current price, remaining available shares

3. **Asset Detail Page**
   - Asset display: High-resolution images, 3D models, videos (if available)
   - Key information: Brand, model, year, serial number (masked), valuation report link
   - Custody and insurance information: Custody organization, warehouse location (fuzzy), insurance company and coverage
   - Investment module: Current price, remaining quota, input purchase shares/amount, confirm button
   - Risk warnings and compliance statements

4. **Portfolio Page**
   - Overview: Asset net value, cumulative yields, yield curve
   - Asset distribution: Pie chart by category/brand
   - Holdings list: Supports CSV export for tax and accounting purposes

5. **KYC Page**
   - Step-by-step process: Basic information → ID upload → Facial recognition → Risk assessment
   - Real-time status updates (under review/approved/rejected)
   - Rejection reasons and resubmission entry

6. **Account and Settings**
   - Bind email (for notifications)
   - Notification preferences (yield distributions, important announcements)
   - Legal documents and risk disclosure statements

### 5.2 Backend Operations and Compliance Modules

1. **Asset Review Backend**
   - Asset submission list and detail viewing
   - Review records and notes
   - One-click push to authentication/valuation agencies (integrated or semi-manual process)

2. **KYC/AML Management**
   - User KYC status overview
   - Blacklist and high-risk user marking
   - AML alert records and processing status (integrated with third-party services)

3. **Yield Distribution Console**
   - Pending yield distribution list (appreciation/rental)
   - Estimated yield per holder, gas cost prompts
   - Trigger yield distribution transactions, execute on-chain after multi-signature confirmation

4. **Reports and Exports**
   - Asset-level yield/fee reports
   - User-level transaction and yield records
   - Export formats required for audits and regulation

### 5.3 Smart Contract and On-Chain Features (Product Perspective)

- **LuxuryToken**
  - Represents fractional ownership tokens (ERC-20) for individual physical luxury assets
  - Supports: Transfer restrictions (only KYC-approved addresses can hold), asset metadata references

- **KYCRegistry**
  - Maintains mapping of addresses to KYC status
  - Contract-level read-only interface for other contracts to check permissions

- **YieldDistribution**
  - Distributes funds from yield pool to holders proportionally based on token holdings
  - Supports different yield types (appreciation/rental) for frontend display differentiation

- **CustodyManager**
  - Records physical asset custody organization, status, insurance information (hash + off-chain details)
  - Critical operations (unlock/transfer) require multi-signature authorization

---

## 6. Compliance and Risk Control Requirements

### 6.1 KYC/AML

- All investable users must pass KYC
- Integration with third-party AML services (e.g., Chainalysis/Elliptic) to detect high-risk addresses
- Large transactions and abnormal behavior trigger risk control rules: manual review or temporary freeze

### 6.2 Asset Authentication and Valuation

- At least two authoritative institutions participate in authentication or valuation
- All certification reports must be stored (IPFS + off-chain backup)
- Regular (e.g., annual) re-inspection of high-value asset status and valuation

### 6.3 Custody and Insurance

- All listed assets must enter qualified custody institutions; personal custody is not allowed
- Custody warehouses must meet: Constant temperature and humidity, fire and theft monitoring, access control
- Each asset must have comprehensive insurance with coverage not less than valuation

### 6.4 Legal and Tax

- Legal assessment for major target markets (e.g., Hong Kong, Singapore, EU, etc.)
- Platform must provide clear terms of use, risk disclosure, and investor suitability statements
- Provide standardized yield and transaction reports to facilitate users' local tax filing

---

## 7. Technology and Platform Integration

### 7.1 Mantle Integration Points

- All critical contracts deployed on Mantle L2 network
- Leverage Mantle's low gas advantage for frequent yield distributions
- Integrate Mantle's recommended wallets and bridging solutions to simplify cross-chain asset flows

### 7.2 Performance and Availability

- Regular page load time: ≤ 2 seconds (in major regions)
- Batch transactions related to yield distribution must control costs through batch processing and L2 optimization
- Provide health monitoring and alerts, integrated with operations systems

### 7.3 Security Requirements

- Smart contracts must pass third-party security audits
- Establish bug bounty program to encourage community discovery
- Backend system access requires multi-factor authentication and permission levels

---

## 8. Milestones and Deliverables

### 8.1 Phase 1 – MVP (Completed)

- **Status**: MVP is completed and currently in testing phase

- **Deliverables:**
  - Core smart contracts deployed on Mantle Sepolia testnet
  - Asset submission and review system
  - KYC/AML integration
  - Portfolio management and yield tracking
  - Yield distribution console for administrators
  - CSV export for transactions and holdings
  - Self-hosted event indexer powering homepage and reports
  - Frontend and backend integration
  - Basic tokenization and investment flow for watches/jewelry
  - Basic KYC & simple AML verification
  - One-time appreciation yield distribution capability
  - Web core pages (homepage, asset list, detail, portfolio, KYC)
  - 1–2 real pilot assets listed

### 8.2 Phase 2 – Production Version (3–6 Months)

- **Expansion:**
  - Complete KYC/AML integration
  - Multi-signature custody, more custody/authentication/valuation partner institutions
  - Rental yield distribution module
  - English/Chinese bilingual interface
  - 5–10 assets in stable operation

### 8.3 Phase 3+ – Ecosystem Expansion (12+ Months)

- **Directions:**
  - Support more asset types (limited edition handbags, etc.)
  - DeFi integration (liquidity pools, lending)
  - Open API, institutional-level bulk interfaces
  - DAO governance and platform tokens

---

## 9. Metrics and Success Criteria

- **User-Side Metrics**
  - Registered users / KYC-approved users
  - Active investors (monthly active)
  - Average asset holding size

- **Asset and Capital Metrics**
  - Platform total assets under management (AUM)
  - Listed asset count and category distribution
  - Cumulative distributed yield amount

- **Experience and Stability Metrics**
  - Key process success rate (KYC, purchase, yield claim)
  - Page load and interaction response time
  - Number of serious production incidents (security/compliance)



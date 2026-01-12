# Compliance Disclosure Statement

## Regulated Asset Disclosure

**MantleLuxury** is a Real World Asset (RWA) tokenization platform that facilitates the fractional ownership of luxury physical assets (watches, jewelry) through blockchain-based tokens. 

**This project involves regulated assets** and operates in a jurisdictionally complex regulatory environment.

### 1. Nature of Regulated Assets

**MantleLuxury** tokenizes physical luxury assets, which may be subject to various regulatory frameworks depending on jurisdiction:

- **Securities Regulations**: Tokenized fractional ownership interests may constitute securities in certain jurisdictions (e.g., under U.S. SEC regulations, EU MiCA framework, or local securities laws)
- **Financial Services Regulations**: The platform facilitates investment activities that may require licensing as a securities intermediary, investment advisor, or similar regulated entity
- **Anti-Money Laundering (AML) Regulations**: The platform handles financial transactions subject to AML/KYC requirements
- **Consumer Protection Laws**: Investment products involving physical assets may be subject to consumer protection regulations

### 2. Regulatory Compliance Measures

To address regulatory requirements, **MantleLuxury** implements the following compliance framework:

#### 2.1 Know Your Customer (KYC) and Anti-Money Laundering (AML)

- **Mandatory KYC Verification**: All users must complete identity verification before purchasing tokens
- **AML Screening**: Integration with third-party AML services (e.g., Chainalysis, Elliptic) to screen high-risk addresses and transactions
- **Sanctions Screening**: Automated checks against sanctions lists and watchlists
- **Transaction Monitoring**: Large transactions (> $10,000 USD equivalent) trigger manual review
- **On-Chain KYC Registry**: KYC status is recorded on-chain via `KYCRegistry` smart contract for transparent compliance verification

#### 2.2 Asset Custody and Insurance

- **Professional Custody**: All tokenized assets are held in qualified third-party custody facilities meeting industry standards (climate-controlled, secured, insured)
- **Comprehensive Insurance**: All assets are fully insured with coverage amounts matching or exceeding asset valuations
- **Custody Verification**: Custody status is recorded on-chain via `CustodyManager` smart contract
- **Multi-Signature Controls**: Critical operations (asset release, custody transfers) require multi-signature authorization

#### 2.3 Asset Authentication and Valuation

- **Third-Party Authentication**: Assets undergo authentication by at least two independent, reputable authentication agencies
- **Professional Valuation**: Assets are valued by multiple accredited valuation agencies
- **Documentation**: All authentication reports, valuation certificates, and custody documents are stored on IPFS with on-chain hash verification

#### 2.4 Investor Protection

- **Risk Disclosure**: Comprehensive risk disclosure statements provided to all investors
- **Suitability Assessment**: Risk assessment questionnaires to ensure investor appropriateness
- **Transparent Reporting**: Investors receive detailed transaction records and yield distribution reports for tax and compliance purposes
- **Audit Trail**: All critical operations are logged with immutable audit trails

### 3. Regulatory Status and Jurisdictional Considerations

**Current Status**: The platform is currently operating in a **development/testing phase** on Mantle Sepolia testnet. Prior to mainnet launch, the project will:

1. **Legal Review**: Conduct comprehensive legal review in target jurisdictions (e.g., Hong Kong, Singapore, EU)
2. **Regulatory Consultation**: Engage with regulatory authorities to clarify compliance requirements
3. **Licensing Assessment**: Determine necessary licenses or registrations (securities intermediary, investment advisor, etc.)
4. **Jurisdictional Restrictions**: Implement geographic restrictions where required by local regulations

**Jurisdictional Variations**: Regulatory treatment of tokenized RWAs varies significantly by jurisdiction:
- **United States**: May require SEC registration or exemption (Regulation D, Regulation S)
- **European Union**: Subject to MiCA (Markets in Crypto-Assets) regulation when fully implemented
- **Singapore**: May require licensing under the Securities and Futures Act
- **Hong Kong**: Subject to Securities and Futures Ordinance

### 4. Risk Disclosures

Investors should be aware of the following risks:

#### 4.1 Regulatory Risks
- **Regulatory Changes**: Evolving regulatory landscape may impact platform operations or token tradability
- **Jurisdictional Restrictions**: Platform access may be restricted in certain jurisdictions
- **Compliance Costs**: Regulatory compliance may result in increased operational costs
- **Enforcement Actions**: Potential regulatory enforcement actions if compliance measures are deemed insufficient

#### 4.2 Asset-Specific Risks
- **Valuation Risk**: Asset valuations may fluctuate based on market conditions, authentication status, or condition changes
- **Liquidity Risk**: Tokenized assets may have limited secondary market liquidity
- **Custody Risk**: Despite professional custody, physical assets remain subject to theft, damage, or loss
- **Authentication Risk**: Authentication errors or disputes may impact asset value

#### 4.3 Technology Risks
- **Smart Contract Risk**: Smart contracts may contain bugs or vulnerabilities despite audits
- **Blockchain Risk**: Network congestion, forks, or protocol changes may impact operations
- **Key Management Risk**: Loss of private keys results in permanent loss of tokens

#### 4.4 Operational Risks
- **Platform Risk**: Platform may experience downtime, security breaches, or operational failures
- **Counterparty Risk**: Dependence on third-party service providers (custodians, insurers, authenticators)
- **Concentration Risk**: Limited number of assets or asset types may increase portfolio risk

### 5. Ongoing Compliance Commitment

**MantleLuxury** is committed to maintaining the highest standards of regulatory compliance:

- **Regular Compliance Reviews**: Periodic review and update of compliance policies and procedures
- **Regulatory Monitoring**: Active monitoring of regulatory developments in target jurisdictions
- **Third-Party Audits**: Regular security audits and compliance assessments by independent third parties
- **Transparency**: Public disclosure of compliance measures, audit reports, and regulatory status updates
- **User Education**: Comprehensive educational materials to help users understand risks and compliance requirements

### 6. Contact Information

For compliance-related inquiries, please contact:
- **Compliance Email**: compliance@mantleluxury.com
- **Legal Inquiries**: legal@mantleluxury.com


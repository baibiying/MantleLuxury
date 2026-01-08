import { ethers } from "hardhat";

/**
 * 部署 LuxuryToken 合约
 * 使用方式: npx hardhat run scripts/deployLuxuryToken.ts --network mantleTestnet
 * 
 * 或者通过后端 API 调用时，使用以下参数：
 * - name: 代币名称
 * - symbol: 代币符号
 * - assetId: bytes32 格式的资产 ID
 * - metadataHash: bytes32 格式的元数据哈希
 * - initialSupply: 初始供应量（wei 单位）
 * - owner: 所有者地址
 */
async function main() {
  const signers = await ethers.getSigners();
  
  // 检查是否有可用的 signer
  if (signers.length === 0) {
    throw new Error(
      "No signers available. Please ensure PRIVATE_KEY is set in the environment variables. " +
      "The Hardhat network configuration requires a private key to create a signer."
    );
  }
  
  const deployer = signers[0];
  
  if (!deployer || !deployer.address) {
    throw new Error(
      "Deployer signer is invalid. Please check your Hardhat network configuration and PRIVATE_KEY environment variable."
    );
  }
  
  console.log("Deploying LuxuryToken with the account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  // 从命令行参数或环境变量获取部署参数
  const name = process.env.TOKEN_NAME || "Luxury Token";
  const symbol = process.env.TOKEN_SYMBOL || "LUX";
  const assetIdHex = process.env.ASSET_ID || ethers.ZeroHash;
  const metadataHashHex = process.env.METADATA_HASH || ethers.ZeroHash;
  const initialSupplyStr = process.env.INITIAL_SUPPLY || "1000";
  const pricePerTokenStr = process.env.PRICE_PER_TOKEN || "1000000000000000000"; // 默认 1 MNT (wei)
  const owner = process.env.OWNER_ADDRESS || deployer.address;
  const kycRegistry = process.env.KYC_REGISTRY_ADDRESS || ethers.ZeroAddress; // KYCRegistry 合约地址
  const custodyManager = process.env.CUSTODY_MANAGER_ADDRESS || ethers.ZeroAddress; // CustodyManager 合约地址（可选）

  // 转换参数
  // assetId 和 metadataHash 应该是 0x 开头的 66 字符（32 字节的 hex）
  let assetId: `0x${string}`;
  let metadataHash: `0x${string}`;
  
  if (assetIdHex.startsWith("0x") && assetIdHex.length === 66) {
    assetId = assetIdHex as `0x${string}`;
  } else {
    // 如果不是标准格式，转换为 bytes32
    const padded = assetIdHex.replace("0x", "").padStart(64, "0");
    assetId = ("0x" + padded) as `0x${string}`;
  }
  
  if (metadataHashHex.startsWith("0x") && metadataHashHex.length === 66) {
    metadataHash = metadataHashHex as `0x${string}`;
  } else {
    const padded = metadataHashHex.replace("0x", "").padStart(64, "0");
    metadataHash = ("0x" + padded) as `0x${string}`;
  }
  
  const initialSupply = ethers.parseEther(initialSupplyStr);
  const pricePerToken = BigInt(pricePerTokenStr);

  console.log("Deployment parameters:");
  console.log("  Name:", name);
  console.log("  Symbol:", symbol);
  console.log("  Asset ID:", assetId);
  console.log("  Metadata Hash:", metadataHash);
  console.log("  Initial Supply:", initialSupply.toString());
  console.log("  Price Per Token (wei):", pricePerToken.toString());
  console.log("  Owner:", owner);
  console.log("  KYC Registry:", kycRegistry);
  console.log("  Custody Manager:", custodyManager);
  
  // 验证 KYC Registry 地址
  if (kycRegistry === ethers.ZeroAddress) {
    console.warn("⚠️  Warning: KYC Registry address is not set. Token will be deployed without KYC check.");
    console.warn("   Please set KYC_REGISTRY_ADDRESS environment variable or deploy KYCRegistry first.");
  }
  
  // 验证 CustodyManager 地址（可选）
  if (custodyManager === ethers.ZeroAddress) {
    console.warn("⚠️  Warning: CustodyManager address is not set. Token will be deployed without custody check.");
    console.warn("   Please set CUSTODY_MANAGER_ADDRESS environment variable or deploy CustodyManager first.");
  }

  const LuxuryToken = await ethers.getContractFactory("LuxuryToken");
  const token = await LuxuryToken.deploy(
    name,
    symbol,
    assetId,
    metadataHash,
    initialSupply,
    pricePerToken,
    owner,
    kycRegistry,
    custodyManager  // 传递 CustodyManager 地址（可以是零地址）
  );

  await token.waitForDeployment();

  const tokenAddress = await token.getAddress();
  console.log("\n✅ LuxuryToken deployed successfully!");
  console.log("Contract address:", tokenAddress);
  console.log("Asset ID:", await token.assetId());
  console.log("Metadata Hash:", await token.metadataHash());
  console.log("Total Supply:", (await token.totalSupply()).toString());
  console.log("Price Per Token:", (await token.pricePerToken()).toString());
  console.log("Sales Enabled:", await token.salesEnabled());
  console.log("Owner:", await token.owner());
  console.log("KYC Registry:", await token.kycRegistry());
  console.log("KYC Check Enabled:", await token.kycCheckEnabled());
  console.log("Custody Manager:", await token.custodyManager());
  console.log("Custody Check Enabled:", await token.custodyCheckEnabled());
  
  // 输出 JSON 格式，方便后端解析
  console.log("\nJSON Output:");
  console.log(JSON.stringify({
    contractAddress: tokenAddress,
    assetId: await token.assetId(),
    metadataHash: await token.metadataHash(),
    totalSupply: (await token.totalSupply()).toString(),
    pricePerToken: (await token.pricePerToken()).toString(),
    salesEnabled: await token.salesEnabled(),
    owner: await token.owner(),
    kycRegistry: await token.kycRegistry(),
    kycCheckEnabled: await token.kycCheckEnabled(),
    custodyManager: await token.custodyManager(),
    custodyCheckEnabled: await token.custodyCheckEnabled()
  }));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


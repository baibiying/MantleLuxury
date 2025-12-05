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
  const [deployer] = await ethers.getSigners();
  
  console.log("Deploying LuxuryToken with the account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  // 从命令行参数或环境变量获取部署参数
  const name = process.env.TOKEN_NAME || "Luxury Token";
  const symbol = process.env.TOKEN_SYMBOL || "LUX";
  const assetIdHex = process.env.ASSET_ID || ethers.ZeroHash;
  const metadataHashHex = process.env.METADATA_HASH || ethers.ZeroHash;
  const initialSupplyStr = process.env.INITIAL_SUPPLY || "1000";
  const owner = process.env.OWNER_ADDRESS || deployer.address;

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

  console.log("Deployment parameters:");
  console.log("  Name:", name);
  console.log("  Symbol:", symbol);
  console.log("  Asset ID:", assetId);
  console.log("  Metadata Hash:", metadataHash);
  console.log("  Initial Supply:", initialSupply.toString());
  console.log("  Owner:", owner);

  const LuxuryToken = await ethers.getContractFactory("LuxuryToken");
  const token = await LuxuryToken.deploy(
    name,
    symbol,
    assetId,
    metadataHash,
    initialSupply,
    owner
  );

  await token.waitForDeployment();

  const tokenAddress = await token.getAddress();
  console.log("\n✅ LuxuryToken deployed successfully!");
  console.log("Contract address:", tokenAddress);
  console.log("Asset ID:", await token.assetId());
  console.log("Metadata Hash:", await token.metadataHash());
  console.log("Total Supply:", (await token.totalSupply()).toString());
  console.log("Owner:", await token.owner());
  
  // 输出 JSON 格式，方便后端解析
  console.log("\nJSON Output:");
  console.log(JSON.stringify({
    contractAddress: tokenAddress,
    assetId: await token.assetId(),
    metadataHash: await token.metadataHash(),
    totalSupply: (await token.totalSupply()).toString(),
    owner: await token.owner()
  }));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


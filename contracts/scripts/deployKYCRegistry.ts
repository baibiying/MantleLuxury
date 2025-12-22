import { ethers } from "hardhat";

/**
 * 部署 KYCRegistry 合约
 * 使用方式: npx hardhat run scripts/deployKYCRegistry.ts --network mantleTestnet
 * 
 * KYCRegistry 是全局单例合约，只需要部署一次。
 * 部署后，需要在后端配置文件中设置合约地址。
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("Deploying KYCRegistry with the account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  // 默认管理员地址（通常是部署者地址，也可以从环境变量获取）
  const defaultAdmin = process.env.DEFAULT_ADMIN || deployer.address;

  console.log("Deployment parameters:");
  console.log("  Default Admin:", defaultAdmin);

  // 部署 KYCRegistry 合约
  const KYCRegistry = await ethers.getContractFactory("KYCRegistry");
  const kycRegistry = await KYCRegistry.deploy(defaultAdmin);

  await kycRegistry.waitForDeployment();

  const address = await kycRegistry.getAddress();
  console.log("\n✅ KYCRegistry deployed successfully!");
  console.log("Contract address:", address);
  console.log("Default Admin:", defaultAdmin);
  
  // 验证部署
  const adminRole = await kycRegistry.DEFAULT_ADMIN_ROLE();
  const complianceRole = await kycRegistry.COMPLIANCE_ROLE();
  const hasAdminRole = await kycRegistry.hasRole(adminRole, defaultAdmin);
  const hasComplianceRole = await kycRegistry.hasRole(complianceRole, defaultAdmin);
  
  console.log("\nVerification:");
  console.log("  Has DEFAULT_ADMIN_ROLE:", hasAdminRole);
  console.log("  Has COMPLIANCE_ROLE:", hasComplianceRole);
  
  // 输出 JSON 格式，方便后端解析
  console.log("\nJSON Output:");
  console.log(JSON.stringify({
    contractAddress: address,
    defaultAdmin: defaultAdmin,
    adminRole: adminRole,
    complianceRole: complianceRole
  }));
  
  console.log("\n⚠️  重要提示：");
  console.log("1. 请将合约地址保存到后端配置文件 (application.yml)");
  console.log("2. 配置项: blockchain.kyc-registry-contract");
  console.log("3. 部署 LuxuryToken 时需要使用此地址作为 kycRegistry 参数");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


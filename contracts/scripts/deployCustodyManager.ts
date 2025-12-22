import { ethers } from "hardhat";

/**
 * 部署 CustodyManager 合约
 * 使用方式: npx hardhat run scripts/deployCustodyManager.ts --network mantleTestnet
 * 
 * CustodyManager 是全局单例合约，只需要部署一次。
 * 部署后，需要在后端配置文件中设置合约地址。
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("Deploying CustodyManager with the account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  // 默认管理员地址（通常是部署者地址，也可以从环境变量获取）
  const defaultAdmin = process.env.DEFAULT_ADMIN || deployer.address;

  console.log("Deployment parameters:");
  console.log("  Default Admin:", defaultAdmin);

  // 部署 CustodyManager 合约
  const CustodyManager = await ethers.getContractFactory("CustodyManager");
  const custodyManager = await CustodyManager.deploy(defaultAdmin);

  await custodyManager.waitForDeployment();

  const address = await custodyManager.getAddress();
  console.log("\n✅ CustodyManager deployed successfully!");
  console.log("Contract address:", address);
  console.log("Default Admin:", defaultAdmin);
  
  // 验证部署
  const adminRole = await custodyManager.DEFAULT_ADMIN_ROLE();
  const custodyRole = await custodyManager.CUSTODY_ROLE();
  const operatorRole = await custodyManager.OPERATOR_ROLE();
  const hasAdminRole = await custodyManager.hasRole(adminRole, defaultAdmin);
  const hasCustodyRole = await custodyManager.hasRole(custodyRole, defaultAdmin);
  const hasOperatorRole = await custodyManager.hasRole(operatorRole, defaultAdmin);
  
  console.log("\nVerification:");
  console.log("  Has DEFAULT_ADMIN_ROLE:", hasAdminRole);
  console.log("  Has CUSTODY_ROLE:", hasCustodyRole);
  console.log("  Has OPERATOR_ROLE:", hasOperatorRole);
  
  // 输出 JSON 格式，方便后端解析
  console.log("\nJSON Output:");
  console.log(JSON.stringify({
    contractAddress: address,
    defaultAdmin: defaultAdmin,
    adminRole: adminRole,
    custodyRole: custodyRole,
    operatorRole: operatorRole
  }));
  
  console.log("\n⚠️  重要提示：");
  console.log("1. 请将合约地址保存到后端配置文件 (application.yml)");
  console.log("2. 配置项: blockchain.custody-manager-contract");
  console.log("3. 此合约用于管理资产的托管和保险状态");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


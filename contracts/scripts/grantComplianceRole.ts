import { ethers } from "hardhat";

/**
 * 授予 COMPLIANCE_ROLE 权限给指定地址
 * 使用方式: npx hardhat run scripts/grantComplianceRole.ts --network mantleTestnet
 * 
 * 环境变量：
 * - KYC_REGISTRY_ADDRESS: KYCRegistry 合约地址（必需）
 * - COMPLIANCE_ADDRESS: 要授予权限的地址（必需）
 */
async function main() {
  const [signer] = await ethers.getSigners();
  
  console.log("Granting COMPLIANCE_ROLE with the account:", signer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(signer.address)).toString());

  const kycRegistryAddress = process.env.KYC_REGISTRY_ADDRESS;
  const complianceAddress = process.env.COMPLIANCE_ADDRESS || signer.address;

  if (!kycRegistryAddress) {
    throw new Error("KYC_REGISTRY_ADDRESS environment variable is required");
  }

  console.log("\nParameters:");
  console.log("  KYCRegistry address:", kycRegistryAddress);
  console.log("  Address to grant role:", complianceAddress);

  // 连接到合约
  const KYCRegistry = await ethers.getContractFactory("KYCRegistry");
  const kycRegistry = KYCRegistry.attach(kycRegistryAddress);

  // 获取 COMPLIANCE_ROLE
  const complianceRole = await kycRegistry.COMPLIANCE_ROLE();
  console.log("\nCOMPLIANCE_ROLE hash:", complianceRole);

  // 检查当前是否有权限
  const hasRole = await kycRegistry.hasRole(complianceRole, complianceAddress);
  console.log("Current has COMPLIANCE_ROLE:", hasRole);

  if (hasRole) {
    console.log("\n✅ Address already has COMPLIANCE_ROLE. No action needed.");
    return;
  }

  // 授予权限
  console.log("\nGranting COMPLIANCE_ROLE...");
  const tx = await kycRegistry.grantRole(complianceRole, complianceAddress);
  console.log("Transaction hash:", tx.hash);

  console.log("Waiting for confirmation...");
  const receipt = await tx.wait();
  console.log("✅ Transaction confirmed in block:", receipt.blockNumber);

  // 验证
  const hasRoleAfter = await kycRegistry.hasRole(complianceRole, complianceAddress);
  console.log("\nVerification:");
  console.log("  Has COMPLIANCE_ROLE:", hasRoleAfter);

  if (hasRoleAfter) {
    console.log("\n✅ Successfully granted COMPLIANCE_ROLE to", complianceAddress);
  } else {
    console.log("\n❌ Failed to grant COMPLIANCE_ROLE");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


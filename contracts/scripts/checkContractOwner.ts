import { ethers } from "hardhat";

/**
 * 检查合约的 owner 地址
 * 使用方式: npx hardhat run scripts/checkContractOwner.ts --network mantleTestnet
 */
async function main() {
  const contractAddress = process.env.CONTRACT_ADDRESS;
  const expectedOwner = process.env.EXPECTED_OWNER;

  if (!contractAddress) {
    throw new Error("CONTRACT_ADDRESS environment variable is not set.");
  }

  console.log("Checking contract owner...");
  console.log("Contract address:", contractAddress);

  // 获取合约实例
  const LuxuryToken = await ethers.getContractFactory("LuxuryToken");
  const token = await ethers.getContractAt("LuxuryToken", contractAddress);

  // 调用 owner() 函数
  const owner = await token.owner();
  console.log("Contract owner:", owner);

  if (expectedOwner) {
    const expectedOwnerLower = expectedOwner.toLowerCase();
    const actualOwnerLower = owner.toLowerCase();
    
    if (actualOwnerLower === expectedOwnerLower) {
      console.log("✅ Contract owner matches expected address!");
    } else {
      console.log("❌ Contract owner does NOT match expected address!");
      console.log("Expected:", expectedOwnerLower);
      console.log("Actual:", actualOwnerLower);
    }
  }

  // 输出 JSON 格式，方便解析
  console.log("\nJSON Output:");
  console.log(JSON.stringify({
    contractAddress: contractAddress,
    owner: owner,
    expectedOwner: expectedOwner || null,
    matches: expectedOwner ? owner.toLowerCase() === expectedOwner.toLowerCase() : null
  }));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


import { ethers } from "hardhat";

/**
 * 部署 YieldDistribution 合约
 * 使用方式: npx hardhat run scripts/deployYieldDistribution.ts --network mantleTestnet
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("Deploying YieldDistribution with the account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  const owner = process.env.OWNER_ADDRESS || deployer.address;

  // 部署 YieldDistribution 合约
  const YieldDistribution = await ethers.getContractFactory("YieldDistribution");
  const yieldDistribution = await YieldDistribution.deploy(owner);

  await yieldDistribution.waitForDeployment();

  const address = await yieldDistribution.getAddress();
  console.log("YieldDistribution deployed to:", address);
  console.log("Owner:", owner);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


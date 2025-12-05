import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  // 部署参数（示例）
  const name = "Luxury Token";
  const symbol = "LUX";
  const assetId = ethers.ZeroHash; // 实际使用时应该传入真实的 assetId
  const metadataHash = ethers.ZeroHash; // 实际使用时应该传入真实的 metadataHash
  const initialSupply = ethers.parseEther("1000"); // 1000 tokens
  const owner = deployer.address;

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
  console.log("LuxuryToken deployed to:", tokenAddress);
  console.log("Asset ID:", await token.assetId());
  console.log("Metadata Hash:", await token.metadataHash());
  console.log("Total Supply:", (await token.totalSupply()).toString());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });



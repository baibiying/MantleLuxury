import { ethers } from "hardhat";

async function main() {
  const contractAddress = "0x4d0cF910D0649B457476EE33109F3a5b513deDf3";
  const LuxuryToken = await ethers.getContractFactory("LuxuryToken");
  const token = await ethers.getContractAt("LuxuryToken", contractAddress);
  
  const owner = await token.owner();
  console.log("Owner:", owner);
  
  const availableTokens = await token.getAvailableTokens();
  console.log("Available tokens (wei):", availableTokens.toString());
  console.log("Available tokens (tokens):", ethers.formatEther(availableTokens));
  
  const totalSupply = await token.totalSupply();
  console.log("Total supply (tokens):", ethers.formatEther(totalSupply));
  
  const ownerBalance = await token.balanceOf(owner);
  console.log("Owner balance (tokens):", ethers.formatEther(ownerBalance));
}

main().then(() => process.exit(0)).catch(console.error);


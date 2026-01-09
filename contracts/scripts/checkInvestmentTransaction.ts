import { ethers } from "hardhat";

/**
 * 检查投资交易是否成功，以及 MNT 是否转账给 owner
 * 使用方式: npx hardhat run scripts/checkInvestmentTransaction.ts --network mantleTestnet
 */
async function main() {
  const contractAddress = process.env.CONTRACT_ADDRESS || "0x4d0cF910D0649B457476EE33109F3a5b513deDf3";
  const expectedOwner = process.env.EXPECTED_OWNER || "0x3bf10d11f66148580918457ad09e8532e644381b";
  const transactionHash = process.env.TRANSACTION_HASH;

  console.log("Checking investment transaction...");
  console.log("Contract address:", contractAddress);
  console.log("Expected owner:", expectedOwner);

  // 获取合约实例
  const LuxuryToken = await ethers.getContractFactory("LuxuryToken");
  const token = await ethers.getContractAt("LuxuryToken", contractAddress);

  // 检查合约的 owner
  const owner = await token.owner();
  console.log("\nContract owner:", owner);
  console.log("Owner matches expected:", owner.toLowerCase() === expectedOwner.toLowerCase());

  // 检查合约的余额（应该为 0，因为 MNT 应该立即转给 owner）
  const contractBalance = await ethers.provider.getBalance(contractAddress);
  console.log("\nContract balance:", ethers.formatEther(contractBalance), "MNT");

  // 检查 owner 的余额
  const ownerBalance = await ethers.provider.getBalance(owner);
  console.log("Owner balance:", ethers.formatEther(ownerBalance), "MNT");

  // 如果提供了交易哈希，检查交易详情
  if (transactionHash) {
    console.log("\nChecking transaction:", transactionHash);
    try {
      const tx = await ethers.provider.getTransaction(transactionHash);
      const receipt = await ethers.provider.getTransactionReceipt(transactionHash);
      
      console.log("Transaction status:", receipt?.status === 1 ? "Success" : "Failed");
      console.log("Transaction value:", ethers.formatEther(tx?.value || 0), "MNT");
      console.log("Transaction to:", tx?.to);
      console.log("Transaction from:", tx?.from);
      
      // 检查交易日志中的 TokensPurchased 事件
      if (receipt) {
        const TokensPurchasedEvent = token.interface.parseLog({
          topics: receipt.logs[0]?.topics || [],
          data: receipt.logs[0]?.data || ""
        });
        if (TokensPurchasedEvent) {
          console.log("\nTokensPurchased event found:");
          console.log("  Buyer:", TokensPurchasedEvent.args[0]);
          console.log("  Amount:", TokensPurchasedEvent.args[1].toString());
          console.log("  Total Cost:", ethers.formatEther(TokensPurchasedEvent.args[2]), "MNT");
        }
      }
    } catch (error: any) {
      console.error("Error checking transaction:", error.message);
    }
  }

  // 检查最近的 TokensPurchased 事件
  console.log("\nChecking recent TokensPurchased events...");
  try {
    const filter = token.filters.TokensPurchased();
    const events = await token.queryFilter(filter, -100); // 检查最近 100 个区块
    console.log(`Found ${events.length} TokensPurchased events`);
    
    if (events.length > 0) {
      const latestEvent = events[events.length - 1];
      console.log("\nLatest TokensPurchased event:");
      console.log("  Block:", latestEvent.blockNumber);
      console.log("  Buyer:", latestEvent.args[0]);
      console.log("  Amount:", latestEvent.args[1].toString());
      console.log("  Total Cost:", ethers.formatEther(latestEvent.args[2]), "MNT");
      
      // 检查该区块中的交易，确认 MNT 是否转账给 owner
      const block = await ethers.provider.getBlock(latestEvent.blockNumber, true);
      if (block && block.transactions) {
        console.log("\nChecking transactions in block", latestEvent.blockNumber, "...");
        for (const txHash of block.transactions) {
          if (typeof txHash === "string") {
            const tx = await ethers.provider.getTransaction(txHash);
            if (tx && tx.to === contractAddress && tx.value > 0) {
              console.log("  Found investment transaction:", txHash);
              console.log("    Value:", ethers.formatEther(tx.value), "MNT");
              console.log("    From:", tx.from);
              
              // 检查交易收据中的转账
              const receipt = await ethers.provider.getTransactionReceipt(txHash);
              if (receipt) {
                console.log("    Status:", receipt.status === 1 ? "Success" : "Failed");
                // 检查内部交易（如果有）
                if (receipt.logs && receipt.logs.length > 0) {
                  console.log("    Logs:", receipt.logs.length);
                }
              }
            }
          }
        }
      }
    }
  } catch (error: any) {
    console.error("Error checking events:", error.message);
  }

  console.log("\n✅ Check completed");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


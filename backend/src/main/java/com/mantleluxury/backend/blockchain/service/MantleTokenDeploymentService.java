package com.mantleluxury.backend.blockchain.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.web3j.crypto.Credentials;
import org.web3j.protocol.Web3j;
import org.web3j.protocol.core.DefaultBlockParameterName;
import org.web3j.protocol.core.methods.response.EthGetTransactionCount;
import org.web3j.protocol.core.methods.response.TransactionReceipt;
import org.web3j.tx.RawTransactionManager;
import org.web3j.tx.TransactionManager;
import org.web3j.tx.gas.DefaultGasProvider;
import org.web3j.utils.Convert;
import org.web3j.utils.Numeric;

import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;

/**
 * Mantle 测试网代币部署服务
 * 使用 Web3j 直接部署合约
 */
@Service
public class MantleTokenDeploymentService {

    private static final Logger logger = LoggerFactory.getLogger(MantleTokenDeploymentService.class);

    private final Web3j web3j;
    private final Credentials credentials;
    private final boolean enabled;

    // LuxuryToken 合约的字节码（需要从编译后的合约获取）
    // 这里使用简化的方式，实际应该从编译后的 artifacts 读取
    private static final String LUXURY_TOKEN_BYTECODE = ""; // 需要从编译后的合约获取

    public MantleTokenDeploymentService(
            Web3j web3j,
            Credentials credentials,
            @Value("${blockchain.enabled:false}") boolean enabled
    ) {
        this.web3j = web3j;
        this.credentials = credentials;
        this.enabled = enabled;
    }

    /**
     * 部署 LuxuryToken 合约到 Mantle 测试网
     */
    public String deployToken(
            String assetId,
            String name,
            String symbol,
            BigInteger totalSupply,
            String metadataHash
    ) {
        if (!enabled) {
            logger.warn("Blockchain deployment is disabled. Returning mock address.");
            return generateMockAddress(assetId);
        }

        try {
            logger.info("Deploying LuxuryToken to Mantle testnet...");
            logger.info("Asset ID: {}, Name: {}, Symbol: {}, Supply: {}", assetId, name, symbol, totalSupply);
            logger.info("RPC URL: {}", web3j.getClass().getName()); // 记录使用的 RPC

            // 先测试 RPC 连接
            try {
                String clientVersion = web3j.web3ClientVersion().send().getWeb3ClientVersion();
                logger.info("Connected to blockchain. Client version: {}", clientVersion);
            } catch (Exception e) {
                logger.error("Failed to connect to RPC endpoint. Please check the RPC URL in application.yml", e);
                throw new RuntimeException("RPC connection failed. Error: " + e.getMessage(), e);
            }

            // 检查账户余额（Mantle 使用 MNT 作为原生代币）
            BigInteger balance = web3j.ethGetBalance(credentials.getAddress(), DefaultBlockParameterName.LATEST)
                    .send()
                    .getBalance();
            logger.info("Deployer balance: {} MNT", Convert.fromWei(balance.toString(), Convert.Unit.ETHER));

            if (balance.compareTo(Convert.toWei("0.001", Convert.Unit.ETHER).toBigInteger()) < 0) {
                throw new RuntimeException("Insufficient balance for deployment. Need at least 0.001 MNT. " +
                        "Please get testnet MNT from https://faucet.testnet.mantle.xyz/");
            }

            // 获取 nonce
            EthGetTransactionCount ethGetTransactionCount = web3j.ethGetTransactionCount(
                    credentials.getAddress(), DefaultBlockParameterName.LATEST).send();
            BigInteger nonce = ethGetTransactionCount.getTransactionCount();

            // 注意：这里需要实际的合约字节码和 ABI
            // 由于 Web3j 需要编译后的合约 wrapper，我们使用另一种方式：
            // 通过调用 Hardhat 脚本或使用 web3j 的合约工厂
            
            // 方案1：使用 ProcessBuilder 调用 Hardhat 脚本（推荐用于 MVP）
            String contractAddress = deployViaHardhatScript(assetId, name, symbol, totalSupply, metadataHash);
            
            logger.info("✅ LuxuryToken deployed successfully at: {}", contractAddress);
            return contractAddress;

        } catch (Exception e) {
            logger.error("Failed to deploy LuxuryToken contract", e);
            throw new RuntimeException("Token deployment failed: " + e.getMessage(), e);
        }
    }

    /**
     * 通过调用 Hardhat 脚本部署合约
     */
    private String deployViaHardhatScript(
            String assetId,
            String name,
            String symbol,
            BigInteger totalSupply,
            String metadataHash
    ) throws Exception {
        logger.info("Deploying via Hardhat script...");

        // 先编译合约（Hardhat 会自动编译，但显式编译更可靠）
        compileContracts();

        // 构建部署命令
        ProcessBuilder processBuilder = new ProcessBuilder(
                "npx", "hardhat", "run", "scripts/deployLuxuryToken.ts",
                "--network", "mantleTestnet"
        );

        // 设置环境变量
        processBuilder.environment().put("TOKEN_NAME", name);
        processBuilder.environment().put("TOKEN_SYMBOL", symbol);
        processBuilder.environment().put("ASSET_ID", assetId);
        processBuilder.environment().put("METADATA_HASH", metadataHash);
        processBuilder.environment().put("INITIAL_SUPPLY", totalSupply.divide(BigInteger.TEN.pow(18)).toString());
        processBuilder.environment().put("OWNER_ADDRESS", credentials.getAddress());
        
        // 设置工作目录
        processBuilder.directory(findContractsDirectory());
        processBuilder.redirectErrorStream(true);

        Process process = processBuilder.start();
        
        // 读取输出
        StringBuilder output = new StringBuilder();
        try (java.io.BufferedReader reader = new java.io.BufferedReader(
                new java.io.InputStreamReader(process.getInputStream()))) {
            String line;
            while ((line = reader.readLine()) != null) {
                output.append(line).append("\n");
                logger.info("Hardhat output: {}", line);
            }
        }

        int exitCode = process.waitFor();
        if (exitCode != 0) {
            throw new RuntimeException("Hardhat deployment failed with exit code: " + exitCode);
        }

        // 从输出中提取合约地址
        String outputStr = output.toString();
        String contractAddress = extractContractAddress(outputStr);
        
        if (contractAddress == null || contractAddress.isEmpty()) {
            throw new RuntimeException("Failed to extract contract address from Hardhat output");
        }

        return contractAddress;
    }

    /**
     * 编译合约
     */
    private void compileContracts() throws Exception {
        logger.info("Compiling contracts...");
        
        java.io.File contractsDir = findContractsDirectory();
        
        ProcessBuilder processBuilder = new ProcessBuilder(
                "npx", "hardhat", "compile"
        );
        
        processBuilder.directory(contractsDir);
        processBuilder.redirectErrorStream(true);
        
        Process process = processBuilder.start();
        
        // 读取输出
        StringBuilder output = new StringBuilder();
        try (java.io.BufferedReader reader = new java.io.BufferedReader(
                new java.io.InputStreamReader(process.getInputStream()))) {
            String line;
            while ((line = reader.readLine()) != null) {
                output.append(line).append("\n");
                if (line.contains("Compiled") || line.contains("Successfully")) {
                    logger.info("Compilation: {}", line);
                }
            }
        }
        
        int exitCode = process.waitFor();
        if (exitCode != 0) {
            logger.warn("Contract compilation may have issues, but continuing...");
            logger.debug("Compilation output: {}", output.toString());
        } else {
            logger.info("✅ Contracts compiled successfully");
        }
    }

    /**
     * 查找 contracts 目录
     */
    private java.io.File findContractsDirectory() {
        java.io.File contractsDir = new java.io.File("contracts");
        if (!contractsDir.exists()) {
            contractsDir = new java.io.File("../contracts");
        }
        if (!contractsDir.exists()) {
            throw new RuntimeException("Contracts directory not found. Expected: contracts/ or ../contracts/");
        }
        return contractsDir;
    }

    /**
     * 从 Hardhat 输出中提取合约地址
     */
    private String extractContractAddress(String output) {
        // 查找 "Contract address:" 后面的地址
        String[] lines = output.split("\n");
        for (String line : lines) {
            if (line.contains("Contract address:")) {
                String[] parts = line.split(":");
                if (parts.length > 1) {
                    return parts[1].trim();
                }
            }
            // 或者从 JSON 输出中提取
            if (line.contains("\"contractAddress\"")) {
                try {
                    int start = line.indexOf("\"contractAddress\"");
                    int addrStart = line.indexOf("0x", start);
                    if (addrStart > 0) {
                        return line.substring(addrStart, addrStart + 42);
                    }
                } catch (Exception e) {
                    logger.warn("Failed to parse contract address from JSON", e);
                }
            }
        }
        return null;
    }

    /**
     * 生成模拟地址（仅用于开发测试）
     */
    private String generateMockAddress(String assetId) {
        String hash = String.valueOf(assetId.hashCode());
        String address = "0x" + hash.repeat(4).substring(0, 40);
        return address;
    }
}


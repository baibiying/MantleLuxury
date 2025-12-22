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

import java.math.BigDecimal;
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
    private final String kycRegistryAddress;

    // LuxuryToken 合约的字节码（需要从编译后的合约获取）
    // 这里使用简化的方式，实际应该从编译后的 artifacts 读取
    private static final String LUXURY_TOKEN_BYTECODE = ""; // 需要从编译后的合约获取

    public MantleTokenDeploymentService(
            Web3j web3j,
            Credentials credentials,
            @Value("${blockchain.enabled:false}") boolean enabled,
            @Value("${blockchain.kyc-registry-contract:}") String kycRegistryAddress
    ) {
        this.web3j = web3j;
        this.credentials = credentials;
        this.enabled = enabled;
        this.kycRegistryAddress = kycRegistryAddress;
    }
    
    /**
     * 获取 KYCRegistry 合约地址
     */
    private String getKYCRegistryAddress() {
        return kycRegistryAddress;
    }

    /**
     * 部署 LuxuryToken 合约到 Mantle 测试网
     */
    public String deployToken(
            String assetId,
            String name,
            String symbol,
            BigInteger totalSupply,
            String metadataHash,
            BigDecimal pricePerShare
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
            String contractAddress = deployViaHardhatScript(assetId, name, symbol, totalSupply, metadataHash, pricePerShare);
            
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
            String metadataHash,
            BigDecimal pricePerShare
    ) throws Exception {
        logger.info("Deploying via Hardhat script...");

        // 查找 contracts 目录
        java.io.File contractsDir = findContractsDirectory();
        java.io.File deployScript = new java.io.File(contractsDir, "scripts/deployLuxuryToken.ts");
        
        if (!deployScript.exists()) {
            throw new RuntimeException("Deployment script not found: " + deployScript.getAbsolutePath());
        }
        logger.info("Using deployment script: {}", deployScript.getAbsolutePath());

        // 先编译合约（Hardhat 会自动编译，但显式编译更可靠）
        compileContracts();

        // 构建部署命令
        ProcessBuilder processBuilder = new ProcessBuilder(
                "npx", "hardhat", "run", "scripts/deployLuxuryToken.ts",
                "--network", "mantleTestnet"
        );

        // 计算每份代币的价格（wei 单位）
        // 假设 1 USD = 1 MNT（实际应该使用价格预言机）
        // pricePerShare 是 USD，需要转换为 wei：例如 $85.00 = 85 * 10^18 wei
        BigInteger pricePerTokenWei;
        if (pricePerShare != null) {
            // pricePerShare 以 "MNT/份"（整份 Token）为单位。
            // 合约 buyTokens 传入的是最小单位 amount（例如 1 份=10^18），totalCost = amount * pricePerToken。
            // 为使 1 份 (1e18) * pricePerToken = pricePerShare(wei)，需要 pricePerToken = pricePerShareWei / 1e18。
            BigInteger pricePerShareWei = pricePerShare.multiply(new BigDecimal(BigInteger.TEN.pow(18))).toBigInteger();
            pricePerTokenWei = pricePerShareWei.divide(BigInteger.TEN.pow(18)); // 每个最小单位的价格
        } else {
            // 默认价格：1 MNT/份 => 每最小单位价格 = 1
            pricePerTokenWei = BigInteger.ONE;
        }
        
        // 获取 KYCRegistry 合约地址（从配置中读取）
        String kycRegistryAddress = getKYCRegistryAddress();
        
        // 设置环境变量
        processBuilder.environment().put("TOKEN_NAME", name);
        processBuilder.environment().put("TOKEN_SYMBOL", symbol);
        processBuilder.environment().put("ASSET_ID", assetId);
        processBuilder.environment().put("METADATA_HASH", metadataHash);
        // totalSupply 以"份"为单位（与合约 decimals=18 对应），直接传给脚本，由脚本内部 parseEther 放大 10^18
        processBuilder.environment().put("INITIAL_SUPPLY", totalSupply.toString());
        processBuilder.environment().put("PRICE_PER_TOKEN", pricePerTokenWei.toString());
        processBuilder.environment().put("OWNER_ADDRESS", credentials.getAddress());
        if (kycRegistryAddress != null && !kycRegistryAddress.isEmpty()) {
            processBuilder.environment().put("KYC_REGISTRY_ADDRESS", kycRegistryAddress);
            logger.info("Using KYCRegistry address: {}", kycRegistryAddress);
        } else {
            logger.warn("KYCRegistry address not configured. Token will be deployed without KYC check.");
        }
        
        // 设置工作目录
        processBuilder.directory(contractsDir);
        processBuilder.redirectErrorStream(true); // 将错误输出合并到标准输出

        Process process = processBuilder.start();
        
        // 读取输出（包括标准输出和错误输出）
        StringBuilder output = new StringBuilder();
        StringBuilder errorOutput = new StringBuilder();
        
        // 读取标准输出
        try (java.io.BufferedReader reader = new java.io.BufferedReader(
                new java.io.InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                output.append(line).append("\n");
                logger.info("Hardhat output: {}", line);
            }
        }
        
        // 读取错误输出（如果 redirectErrorStream 为 false）
        try (java.io.BufferedReader errorReader = new java.io.BufferedReader(
                new java.io.InputStreamReader(process.getErrorStream(), StandardCharsets.UTF_8))) {
            String line;
            while ((line = errorReader.readLine()) != null) {
                errorOutput.append(line).append("\n");
                logger.error("Hardhat error: {}", line);
            }
        }

        int exitCode = process.waitFor();
        if (exitCode != 0) {
            String fullOutput = output.toString();
            String fullError = errorOutput.toString();
            String errorMessage = String.format(
                "Hardhat deployment failed with exit code: %d\n" +
                "Standard output:\n%s\n" +
                "Error output:\n%s",
                exitCode, fullOutput, fullError
            );
            logger.error("Hardhat deployment failed. Full output:\n{}", errorMessage);
            throw new RuntimeException(errorMessage);
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


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
    private final String privateKey;
    private final String rpcUrl;

    // LuxuryToken 合约的字节码（需要从编译后的合约获取）
    // 这里使用简化的方式，实际应该从编译后的 artifacts 读取
    private static final String LUXURY_TOKEN_BYTECODE = ""; // 需要从编译后的合约获取

    public MantleTokenDeploymentService(
            Web3j web3j,
            Credentials credentials,
            @Value("${blockchain.enabled:false}") boolean enabled,
            @Value("${blockchain.kyc-registry-contract:}") String kycRegistryAddress,
            @Value("${blockchain.private-key:}") String privateKey,
            @Value("${blockchain.rpc-url:}") String rpcUrl
    ) {
        this.web3j = web3j;
        this.credentials = credentials;
        this.enabled = enabled;
        this.kycRegistryAddress = kycRegistryAddress;
        this.privateKey = privateKey;
        this.rpcUrl = rpcUrl;
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

        // 检查并确保 Hardhat 已安装
        ensureHardhatInstalled(contractsDir);

        // 先编译合约（Hardhat 会自动编译，但显式编译更可靠）
        compileContracts();

        // 构建部署命令
        // 优先使用本地安装的 Hardhat（./node_modules/.bin/hardhat）
        // 如果不存在，回退到 npx hardhat
        String hardhatCommand;
        java.io.File localHardhat = new java.io.File(contractsDir, "node_modules/.bin/hardhat");
        if (localHardhat.exists() && localHardhat.canExecute()) {
            hardhatCommand = localHardhat.getAbsolutePath();
            logger.info("Using local Hardhat installation: {}", hardhatCommand);
        } else {
            hardhatCommand = "npx";
            logger.warn("Local Hardhat not found, using npx. Expected at: {}", localHardhat.getAbsolutePath());
        }
        
        ProcessBuilder processBuilder;
        if (hardhatCommand.equals("npx")) {
            processBuilder = new ProcessBuilder(
                    "npx", "hardhat", "run", "scripts/deployLuxuryToken.ts",
                    "--network", "mantleTestnet"
            );
        } else {
            processBuilder = new ProcessBuilder(
                    hardhatCommand, "run", "scripts/deployLuxuryToken.ts",
                    "--network", "mantleTestnet"
            );
        }

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
        
        // 设置私钥（Hardhat 需要这个来创建 signer）
        if (privateKey != null && !privateKey.isEmpty()) {
            // 确保私钥不包含 0x 前缀（Hardhat 配置期望的格式）
            String cleanPrivateKey = privateKey.startsWith("0x") ? privateKey.substring(2) : privateKey;
            processBuilder.environment().put("PRIVATE_KEY", cleanPrivateKey);
            logger.info("PRIVATE_KEY environment variable set for Hardhat");
        } else {
            logger.error("PRIVATE_KEY is not configured! Hardhat deployment will fail.");
            throw new RuntimeException("PRIVATE_KEY is required for token deployment. Please configure blockchain.private-key in application.yml or environment variables.");
        }
        
        // 设置 RPC URL（Hardhat 需要这个来连接网络）
        if (rpcUrl != null && !rpcUrl.isEmpty()) {
            processBuilder.environment().put("MANTLE_TESTNET_RPC_URL", rpcUrl);
            logger.info("MANTLE_TESTNET_RPC_URL environment variable set: {}", rpcUrl);
        } else {
            logger.warn("RPC URL not configured, Hardhat will use default RPC URL");
        }
        
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
     * 确保 Hardhat 已安装
     * 如果 node_modules 不存在或 Hardhat 不可用，尝试安装依赖
     */
    private void ensureHardhatInstalled(java.io.File contractsDir) throws Exception {
        java.io.File nodeModules = new java.io.File(contractsDir, "node_modules");
        java.io.File hardhatBin = new java.io.File(contractsDir, "node_modules/.bin/hardhat");
        java.io.File packageJson = new java.io.File(contractsDir, "package.json");
        
        // 如果 Hardhat 已存在，直接返回
        if (hardhatBin.exists() && hardhatBin.canExecute()) {
            logger.info("Hardhat is already installed at: {}", hardhatBin.getAbsolutePath());
            return;
        }
        
        // 如果 package.json 存在但 node_modules 不存在，需要安装
        if (packageJson.exists() && (!nodeModules.exists() || !hardhatBin.exists())) {
            logger.warn("Hardhat not found. Installing dependencies in contracts directory...");
            logger.info("Contracts directory: {}", contractsDir.getAbsolutePath());
            
            ProcessBuilder installProcess = new ProcessBuilder("npm", "install");
            installProcess.directory(contractsDir);
            installProcess.redirectErrorStream(true);
            
            Process installProc = installProcess.start();
            StringBuilder installOutput = new StringBuilder();
            try (java.io.BufferedReader reader = new java.io.BufferedReader(
                    new java.io.InputStreamReader(installProc.getInputStream(), StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    installOutput.append(line).append("\n");
                    logger.info("npm install: {}", line);
                }
            }
            
            int installExitCode = installProc.waitFor();
            if (installExitCode != 0) {
                logger.error("npm install failed. Output: {}", installOutput.toString());
                throw new RuntimeException("Failed to install Hardhat dependencies. Exit code: " + installExitCode);
            }
            
            // 再次检查 Hardhat 是否安装成功
            if (!hardhatBin.exists()) {
                throw new RuntimeException("Hardhat installation completed but binary not found at: " + hardhatBin.getAbsolutePath());
            }
            
            logger.info("✅ Hardhat installed successfully");
        } else if (!packageJson.exists()) {
            throw new RuntimeException("package.json not found in contracts directory: " + contractsDir.getAbsolutePath());
        }
    }

    /**
     * 编译合约
     */
    private void compileContracts() throws Exception {
        logger.info("Compiling contracts...");
        
        java.io.File contractsDir = findContractsDirectory();
        
        // 优先使用本地安装的 Hardhat
        String hardhatCommand;
        java.io.File localHardhat = new java.io.File(contractsDir, "node_modules/.bin/hardhat");
        if (localHardhat.exists() && localHardhat.canExecute()) {
            hardhatCommand = localHardhat.getAbsolutePath();
            logger.info("Using local Hardhat for compilation: {}", hardhatCommand);
        } else {
            hardhatCommand = "npx";
            logger.warn("Local Hardhat not found for compilation, using npx");
        }
        
        ProcessBuilder processBuilder;
        if (hardhatCommand.equals("npx")) {
            processBuilder = new ProcessBuilder("npx", "hardhat", "compile");
        } else {
            processBuilder = new ProcessBuilder(hardhatCommand, "compile");
        }
        
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
     * 支持多种路径：当前目录、上级目录、项目根目录
     * 在生产环境中，contracts 目录应该与 backend 目录同级（项目根目录）
     */
    private java.io.File findContractsDirectory() {
        // 获取当前工作目录
        String currentDir = System.getProperty("user.dir");
        logger.info("Current working directory: {}", currentDir);
        
        // 尝试多个可能的路径（按优先级排序）
        String[] possiblePaths;
        
        // 如果当前目录是 /app（Railway/Vercel 生产环境）
        if (currentDir.equals("/app")) {
            possiblePaths = new String[]{
                "../contracts",                            // /app/../contracts (项目根目录)
                "../../contracts",                          // 上两级
                "contracts",                               // 当前目录
                currentDir + "/../contracts",              // 绝对路径
            };
        }
        // 如果当前目录是 backend
        else if (currentDir.endsWith("backend") || currentDir.endsWith("/backend")) {
            possiblePaths = new String[]{
                "../contracts",                            // backend/../contracts
                currentDir + "/../contracts",              // 绝对路径
                "contracts",                               // 当前目录
                "../../contracts",                          // 上两级
            };
        }
        // 其他情况（可能是项目根目录）
        else {
            possiblePaths = new String[]{
                "contracts",                               // 当前目录下的 contracts
                "../contracts",                            // 上级目录
                currentDir + "/contracts",                  // 绝对路径：当前目录/contracts
                currentDir + "/../contracts",               // 绝对路径：上级目录/contracts
                "../../contracts",                          // 上两级
            };
        }
        
        for (String path : possiblePaths) {
            java.io.File contractsDir = new java.io.File(path);
            logger.debug("Checking contracts directory: {} (exists: {})", contractsDir.getAbsolutePath(), contractsDir.exists());
            if (contractsDir.exists() && contractsDir.isDirectory()) {
                // 验证 contracts 目录中是否有必要的文件
                java.io.File deployScript = new java.io.File(contractsDir, "scripts/deployLuxuryToken.ts");
                java.io.File hardhatConfig = new java.io.File(contractsDir, "hardhat.config.ts");
                if (deployScript.exists() || hardhatConfig.exists()) {
                    logger.info("✅ Found contracts directory at: {}", contractsDir.getAbsolutePath());
                    return contractsDir;
                } else {
                    logger.warn("Contracts directory found but missing required files: {}", contractsDir.getAbsolutePath());
                }
            }
        }
        
        // 如果都找不到，抛出异常
        throw new RuntimeException(
            String.format("Contracts directory not found. Searched in: %s. Current working directory: %s. " +
                "Please ensure the contracts directory is available in the deployment environment.", 
                String.join(", ", possiblePaths), currentDir)
        );
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


package com.mantleluxury.backend.assets.service;

import com.mantleluxury.backend.assets.domain.Asset;
import com.mantleluxury.backend.assets.domain.YieldDistribution;
import com.mantleluxury.backend.assets.domain.UserInvestment;
import com.mantleluxury.backend.assets.repository.AssetRepository;
import com.mantleluxury.backend.assets.repository.YieldDistributionRepository;
import com.mantleluxury.backend.assets.repository.UserInvestmentRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.web3j.abi.FunctionEncoder;
import org.web3j.abi.TypeReference;
import org.web3j.abi.datatypes.Function;
import org.web3j.abi.datatypes.Type;
import org.web3j.abi.datatypes.generated.Uint256;
import org.web3j.crypto.Credentials;
import org.web3j.protocol.Web3j;
import org.web3j.protocol.core.DefaultBlockParameterName;
import org.web3j.protocol.core.methods.response.TransactionReceipt;
import org.web3j.protocol.core.methods.response.EthGetTransactionCount;
import org.web3j.protocol.core.methods.response.EthSendTransaction;
import org.web3j.crypto.TransactionEncoder;
import org.web3j.crypto.RawTransaction;
import org.web3j.tx.gas.DefaultGasProvider;
import org.web3j.utils.Convert;
import org.web3j.utils.Numeric;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.nio.ByteBuffer;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * 收益分配服务
 */
@Service
public class YieldService {

    private static final Logger logger = LoggerFactory.getLogger(YieldService.class);

    private final YieldDistributionRepository yieldDistributionRepository;
    private final AssetRepository assetRepository;
    private final UserInvestmentRepository userInvestmentRepository;
    private final Web3j web3j;
    private final Credentials credentials;

    @Value("${blockchain.yield-distribution-contract:}")
    private String yieldDistributionContractAddress;

    /**
     * 区块链 chainId，用于构造 EIP-155 保护的交易（Mantle Sepolia 默认 5003）
     */
    @Value("${blockchain.chain-id:5003}")
    private long chainId;

    /**
     * 全局 gas limit，避免默认 9,000,000 过低导致 intrinsic gas too low。
     * Mantle 给出的最小值约为 50,666,904，这里默认给一个更高的安全值 80,000,000，
     * 同时允许通过配置覆盖。
     */
    @Value("${blockchain.gas-limit:80000000}")
    private BigInteger gasLimit;

    public YieldService(
            YieldDistributionRepository yieldDistributionRepository,
            AssetRepository assetRepository,
            UserInvestmentRepository userInvestmentRepository,
            Web3j web3j,
            Credentials credentials
    ) {
        this.yieldDistributionRepository = yieldDistributionRepository;
        this.assetRepository = assetRepository;
        this.userInvestmentRepository = userInvestmentRepository;
        this.web3j = web3j;
        this.credentials = credentials;
    }

    /**
     * 创建收益分配记录（链下）
     */
    @Transactional
    public YieldDistribution createDistribution(
            String assetId,
            String yieldType,
            BigDecimal totalAmount
    ) {
        Asset asset = assetRepository.findById(assetId)
                .orElseThrow(() -> new RuntimeException("Asset not found: " + assetId));

        if (asset.getTokenAddress() == null || asset.getTokenAddress().isEmpty()) {
            throw new RuntimeException("Asset token address is not set");
        }

        // 生成唯一的 distributionId (bytes32)
        String distributionIdBytes32 = generateDistributionId();

        YieldDistribution distribution = new YieldDistribution();
        distribution.setDistributionIdBytes32(distributionIdBytes32);
        distribution.setAssetId(assetId);
        distribution.setTokenAddress(asset.getTokenAddress());
        distribution.setYieldType(yieldType);
        distribution.setTotalAmount(totalAmount);
        distribution.setDistributedAmount(BigDecimal.ZERO);
        distribution.setIsCompleted(false);

        return yieldDistributionRepository.save(distribution);
    }

    /**
     * 在链上创建收益分配（调用合约的 createDistribution）
     * 注意：此功能需要先部署 YieldDistribution 合约并配置合约地址
     */
    @Transactional
    public String createDistributionOnChain(String distributionId) throws Exception {
        String contractAddress = getValidatedYieldDistributionAddress();

        YieldDistribution distribution = yieldDistributionRepository.findById(distributionId)
                .orElseThrow(() -> new RuntimeException("Distribution not found: " + distributionId));

        // 将 distributionIdBytes32 转换为 bytes32
        String hexId = distributionIdBytes32ToHex(distribution.getDistributionIdBytes32());
        byte[] distributionIdBytes = Numeric.hexStringToByteArray(hexId);
        if (distributionIdBytes.length > 32) {
            byte[] truncated = new byte[32];
            System.arraycopy(distributionIdBytes, 0, truncated, 0, 32);
            distributionIdBytes = truncated;
        } else if (distributionIdBytes.length < 32) {
            byte[] padded = new byte[32];
            System.arraycopy(distributionIdBytes, 0, padded, 32 - distributionIdBytes.length, distributionIdBytes.length);
            distributionIdBytes = padded;
        }

        // 准备函数调用
        Function function = new Function(
                "createDistribution",
                Arrays.asList(
                        new org.web3j.abi.datatypes.generated.Bytes32(distributionIdBytes),
                        new org.web3j.abi.datatypes.Address(160, distribution.getTokenAddress()),
                        new org.web3j.abi.datatypes.generated.Uint8(yieldTypeToEnum(distribution.getYieldType())),
                        new Uint256(Convert.toWei(distribution.getTotalAmount(), Convert.Unit.ETHER).toBigInteger())
                ),
                Collections.emptyList()
        );

        String encodedFunction = FunctionEncoder.encode(function);

        // 手动管理 nonce，避免并发冲突
        // 重试机制：如果 nonce 错误，重新获取 nonce 并重试（最多重试 3 次）
        int maxRetries = 3;
        Exception lastException = null;
        String txHash = null;
        
        for (int attempt = 0; attempt < maxRetries; attempt++) {
            try {
                // 每次重试都重新获取最新的 nonce
                EthGetTransactionCount ethGetTransactionCount = 
                        web3j.ethGetTransactionCount(credentials.getAddress(), DefaultBlockParameterName.LATEST).send();
                BigInteger nonce = ethGetTransactionCount.getTransactionCount();
                
                if (attempt > 0) {
                    logger.info("Retry attempt {}: using nonce {}", attempt + 1, nonce);
                    // 重试时稍微等待一下，避免立即重试
                    Thread.sleep(500 * attempt); // 递增等待时间：0ms, 500ms, 1000ms
                }

                BigInteger gasPrice = DefaultGasProvider.GAS_PRICE;
                
                // 记录交易详情（发送前）
                logger.info("📤 Sending createDistribution transaction - Gas Limit: {}, Gas Price: {} Gwei, Nonce: {}, To: {}, From: {}", 
                        gasLimit, 
                        gasPrice.divide(BigInteger.valueOf(1_000_000_000)), // 转换为 Gwei
                        nonce,
                        contractAddress,
                        credentials.getAddress());

                // 创建原始交易
                RawTransaction rawTransaction = RawTransaction.createTransaction(
                        nonce,
                        gasPrice,
                        gasLimit,
                        contractAddress,
                        encodedFunction
                );

                // 签名并发送交易（包含链 ID 以支持 EIP-155）
                byte[] signedMessage = TransactionEncoder.signMessage(rawTransaction, chainId, credentials);
                String hexValue = Numeric.toHexString(signedMessage);

                EthSendTransaction ethSendTransaction = 
                        web3j.ethSendRawTransaction(hexValue).send();
                        
                if (ethSendTransaction.hasError()) {
                    String errorMessage = ethSendTransaction.getError().getMessage();
                    
                    // 如果是 nonce 错误且还有重试机会，则重试
                    if (errorMessage != null && errorMessage.contains("nonce") && attempt < maxRetries - 1) {
                        logger.warn("Nonce error on attempt {}: {}. Will retry...", attempt + 1, errorMessage);
                        lastException = new RuntimeException("Nonce error: " + errorMessage);
                        continue; // 继续重试
                    }
                    
                    // 其他错误或已达到最大重试次数
                    String message = "Failed to create distribution on chain: " + errorMessage;
                    logger.error(message);
                    throw new RuntimeException(message);
                }

                txHash = ethSendTransaction.getTransactionHash();
                logger.info("✅ CreateDistribution transaction sent successfully. TxHash: {}, Nonce: {}", txHash, nonce);
                break; // 成功，退出重试循环
                
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new RuntimeException("Thread interrupted while retrying createDistribution", e);
            } catch (Exception e) {
                String errorMessage = e.getMessage();
                // 如果是 nonce 错误且还有重试机会，则重试
                if (errorMessage != null && errorMessage.contains("nonce") && attempt < maxRetries - 1) {
                    logger.warn("Nonce error on attempt {}: {}. Will retry...", attempt + 1, errorMessage);
                    lastException = e;
                    continue; // 继续重试
                }
                // 其他错误或已达到最大重试次数
                logger.error("Failed to create distribution on chain (attempt {}): {}", attempt + 1, errorMessage, e);
                throw new RuntimeException("Failed to create distribution on chain: " + errorMessage, e);
            }
        }
        
        if (txHash == null) {
            throw new RuntimeException("Failed to create distribution on chain after " + maxRetries + " attempts. Last error: " + 
                    (lastException != null ? lastException.getMessage() : "Unknown error"));
        }

        distribution.setTransactionHash(txHash);
        yieldDistributionRepository.save(distribution);

        logger.info("Created distribution on chain. DistributionId: {}, TxHash: {}", distributionId, txHash);
        return txHash;
    }

    /**
     * 在链上执行收益分配（调用合约的 distribute）
     * 根据当前资产的投资记录计算持有人地址列表，并调用 distribute。
     * 前提：需要先向 YieldDistribution 合约地址转入足够的 MNT（总额 >= totalAmount）。
     */
    @Transactional
    public String distributeOnChain(String distributionId) throws Exception {
        String contractAddress = getValidatedYieldDistributionAddress();

        YieldDistribution distribution = yieldDistributionRepository.findById(distributionId)
                .orElseThrow(() -> new RuntimeException("Distribution not found: " + distributionId));

        if (Boolean.TRUE.equals(distribution.getIsCompleted())) {
            throw new RuntimeException("Distribution already completed");
        }

        // 基于资产 ID 从用户投资记录中找出所有投资者地址
        List<UserInvestment> investments = userInvestmentRepository.findAll().stream()
                .filter(inv -> distribution.getAssetId().equals(inv.getAssetId()))
                .collect(Collectors.toList());

        if (investments.isEmpty()) {
            throw new RuntimeException("No investors found for asset: " + distribution.getAssetId());
        }

        List<String> holderAddresses = investments.stream()
                .map(UserInvestment::getUserAddress)
                .map(String::toLowerCase)
                .distinct()
                .collect(Collectors.toList());

        if (holderAddresses.isEmpty()) {
            throw new RuntimeException("No holders found for distribution");
        }

        // 将 distributionIdBytes32 转换为 bytes32
        String hexId = distributionIdBytes32ToHex(distribution.getDistributionIdBytes32());
        byte[] distributionIdBytes = Numeric.hexStringToByteArray(hexId);
        if (distributionIdBytes.length > 32) {
            byte[] truncated = new byte[32];
            System.arraycopy(distributionIdBytes, 0, truncated, 0, 32);
            distributionIdBytes = truncated;
        } else if (distributionIdBytes.length < 32) {
            byte[] padded = new byte[32];
            System.arraycopy(distributionIdBytes, 0, padded, 32 - distributionIdBytes.length, distributionIdBytes.length);
            distributionIdBytes = padded;
        }

        // 准备 holders 参数
        List<Type> inputParameters = new java.util.ArrayList<>();
        inputParameters.add(new org.web3j.abi.datatypes.generated.Bytes32(distributionIdBytes));

        java.util.List<org.web3j.abi.datatypes.Address> holderTypes = holderAddresses.stream()
                .map(addr -> new org.web3j.abi.datatypes.Address(160, addr))
                .collect(Collectors.toList());
        org.web3j.abi.datatypes.DynamicArray<org.web3j.abi.datatypes.Address> holderArray =
                new org.web3j.abi.datatypes.DynamicArray<org.web3j.abi.datatypes.Address>(
                        org.web3j.abi.datatypes.Address.class,
                        holderTypes
                );
        inputParameters.add(holderArray);

        Function function = new Function(
                "distribute",
                inputParameters,
                Collections.emptyList()
        );

        String encodedFunction = FunctionEncoder.encode(function);

        // 手动管理 nonce，避免并发冲突
        // 重试机制：如果 nonce 错误，重新获取 nonce 并重试（最多重试 3 次）
        int maxRetries = 3;
        Exception lastException = null;
        String txHash = null;
        
        for (int attempt = 0; attempt < maxRetries; attempt++) {
            try {
                // 每次重试都重新获取最新的 nonce
                EthGetTransactionCount ethGetTransactionCount = 
                        web3j.ethGetTransactionCount(credentials.getAddress(), DefaultBlockParameterName.LATEST).send();
                BigInteger nonce = ethGetTransactionCount.getTransactionCount();
                
                if (attempt > 0) {
                    logger.info("Retry attempt {}: using nonce {}", attempt + 1, nonce);
                    // 重试时稍微等待一下，避免立即重试
                    Thread.sleep(500 * attempt); // 递增等待时间：0ms, 500ms, 1000ms
                }

                BigInteger gasPrice = DefaultGasProvider.GAS_PRICE;
                
                // 记录交易详情（发送前）
                logger.info("📤 Sending distribute transaction - Gas Limit: {}, Gas Price: {} Gwei, Nonce: {}, To: {}, From: {}", 
                        gasLimit, 
                        gasPrice.divide(BigInteger.valueOf(1_000_000_000)), // 转换为 Gwei
                        nonce,
                        contractAddress,
                        credentials.getAddress());

                // 创建原始交易
                org.web3j.crypto.RawTransaction rawTransaction = org.web3j.crypto.RawTransaction.createTransaction(
                        nonce,
                        gasPrice,
                        gasLimit,
                        contractAddress,
                        encodedFunction
                );

                // 签名并发送交易（包含链 ID 以支持 EIP-155）
                byte[] signedMessage = org.web3j.crypto.TransactionEncoder.signMessage(rawTransaction, chainId, credentials);
                String hexValue = org.web3j.utils.Numeric.toHexString(signedMessage);

                org.web3j.protocol.core.methods.response.EthSendTransaction ethSendTransaction = 
                        web3j.ethSendRawTransaction(hexValue).send();
                        
                if (ethSendTransaction.hasError()) {
                    String errorMessage = ethSendTransaction.getError().getMessage();
                    
                    // 如果是 nonce 错误且还有重试机会，则重试
                    if (errorMessage != null && errorMessage.contains("nonce") && attempt < maxRetries - 1) {
                        logger.warn("Nonce error on attempt {}: {}. Will retry...", attempt + 1, errorMessage);
                        lastException = new RuntimeException("Nonce error: " + errorMessage);
                        continue; // 继续重试
                    }
                    
                    // 其他错误或已达到最大重试次数
                    String message = "Failed to execute distribution on chain: " + errorMessage;
                    logger.error(message);
                    throw new RuntimeException(message);
                }

                txHash = ethSendTransaction.getTransactionHash();
                logger.info("✅ Distribution transaction sent successfully. TxHash: {}, Nonce: {}", txHash, nonce);
                break; // 成功，退出重试循环
                
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new RuntimeException("Thread interrupted while retrying distribution", e);
            } catch (Exception e) {
                String errorMessage = e.getMessage();
                // 如果是 nonce 错误且还有重试机会，则重试
                if (errorMessage != null && errorMessage.contains("nonce") && attempt < maxRetries - 1) {
                    logger.warn("Nonce error on attempt {}: {}. Will retry...", attempt + 1, errorMessage);
                    lastException = e;
                    continue; // 继续重试
                }
                // 其他错误或已达到最大重试次数
                logger.error("Failed to execute distribution on chain (attempt {}): {}", attempt + 1, errorMessage, e);
                throw new RuntimeException("Failed to execute distribution on chain: " + errorMessage, e);
            }
        }
        
        if (txHash == null) {
            throw new RuntimeException("Failed to execute distribution on chain after " + maxRetries + " attempts. Last error: " + 
                    (lastException != null ? lastException.getMessage() : "Unknown error"));
        }

        // 分发完成后，简单认为链上会按 totalAmount 分配完，更新本地记录
        distribution.setIsCompleted(true);
        distribution.setDistributedAmount(distribution.getTotalAmount());
        yieldDistributionRepository.save(distribution);

        logger.info("Executed distribution on chain. DistributionId: {}, TxHash: {}", distributionId, txHash);
        return txHash;
    }

    /**
     * 获取用户的收益记录
     */
    public List<YieldDistribution> getUserYields(String userAddress) {
        // 获取用户持有的所有 token 地址（从投资记录中）
        List<UserInvestment> investments = userInvestmentRepository.findByUserAddress(userAddress);
        List<String> userTokenAddresses = investments.stream()
                .map(UserInvestment::getTokenAddress)
                .distinct()
                .collect(Collectors.toList());
        
        if (userTokenAddresses.isEmpty()) {
            return Collections.emptyList();
        }
        
        // 返回用户持有的 token 地址对应的所有收益记录
        return yieldDistributionRepository.findByTokenAddressIn(userTokenAddresses);
    }

    /**
     * 获取资产的所有收益分配记录
     */
    public List<YieldDistribution> getAssetYields(String assetId) {
        return yieldDistributionRepository.findByAssetId(assetId);
    }

    /**
     * 获取所有收益分配记录
     */
    public List<YieldDistribution> getAllYields() {
        return yieldDistributionRepository.findAllByOrderByCreatedAtDesc();
    }

    /**
     * 获取最近的收益分配记录
     */
    public List<YieldDistribution> getRecentYields(int limit) {
        return yieldDistributionRepository.findAllByOrderByCreatedAtDesc()
                .stream()
                .limit(limit)
                .collect(Collectors.toList());
    }

    /**
     * 生成唯一的 distributionId (bytes32 格式的十六进制字符串)
     */
    private String generateDistributionId() {
        UUID uuid = UUID.randomUUID();
        ByteBuffer buffer = ByteBuffer.wrap(new byte[32]);
        buffer.putLong(uuid.getMostSignificantBits());
        buffer.putLong(uuid.getLeastSignificantBits());
        buffer.putLong(System.currentTimeMillis());
        byte[] bytes = buffer.array();
        return "0x" + Numeric.toHexStringNoPrefix(bytes);
    }

    /**
     * 将 distributionIdBytes32 转换为十六进制字符串（如果还不是）
     */
    private String distributionIdBytes32ToHex(String distributionIdBytes32) {
        if (distributionIdBytes32.startsWith("0x")) {
            return distributionIdBytes32;
        }
        return "0x" + distributionIdBytes32;
    }

    /**
     * 获取并校验 YieldDistribution 合约地址
     */
    private String getValidatedYieldDistributionAddress() {
        if (yieldDistributionContractAddress == null) {
            throw new RuntimeException("YieldDistribution contract address is not configured. Please deploy the contract first.");
        }
        String addr = yieldDistributionContractAddress.trim();
        if (!addr.startsWith("0x")) {
            addr = "0x" + addr;
        }
        // 0x + 40 hex chars
        if (addr.length() != 42) {
            throw new RuntimeException("Invalid YieldDistribution contract address length: " + addr);
        }
        return addr;
    }

    /**
     * 将 yieldType 字符串转换为枚举值（0 = Appreciation, 1 = Rental）
     */
    private int yieldTypeToEnum(String yieldType) {
        if ("rental".equalsIgnoreCase(yieldType)) {
            return 1;
        }
        return 0; // appreciation
    }
}


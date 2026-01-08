package com.mantleluxury.backend.blockchain.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.web3j.abi.FunctionEncoder;
import org.web3j.abi.FunctionReturnDecoder;
import org.web3j.abi.TypeReference;
import org.web3j.abi.datatypes.Function;
import org.web3j.abi.datatypes.Type;
import org.web3j.abi.datatypes.Utf8String;
import org.web3j.abi.datatypes.generated.Uint8;
import org.web3j.crypto.Credentials;
import org.web3j.protocol.Web3j;
import org.web3j.protocol.core.DefaultBlockParameterName;
import org.web3j.protocol.core.methods.request.Transaction;
import org.web3j.protocol.core.methods.response.EthCall;
import org.web3j.protocol.core.methods.response.EthGetTransactionCount;
import org.web3j.protocol.core.methods.response.EthSendTransaction;
import org.web3j.protocol.core.methods.response.TransactionReceipt;
import org.web3j.protocol.core.methods.response.EthGetTransactionReceipt;
import org.web3j.tx.RawTransactionManager;
import org.web3j.tx.TransactionManager;
import org.web3j.tx.gas.DefaultGasProvider;
import org.web3j.utils.Numeric;
import org.web3j.tx.response.PollingTransactionReceiptProcessor;
import org.web3j.tx.response.TransactionReceiptProcessor;
import org.web3j.crypto.Hash;
import org.web3j.abi.datatypes.generated.Bytes32;

import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;

/**
 * KYCRegistry 服务
 * 用于同步 KYC 状态到链上 KYCRegistry 合约
 */
@Service
public class KYCRegistryService {

    private static final Logger logger = LoggerFactory.getLogger(KYCRegistryService.class);

    // KYCRegistry 合约 ABI（简化版，只包含需要的方法）
    private static final String SET_KYC_STATUS_FUNCTION = "setKYCStatus(address,uint8)";
    private static final String IS_KYC_APPROVED_FUNCTION = "isKYCApproved(address)";
    private static final String GRANT_ROLE_FUNCTION = "grantRole(bytes32,address)";
    private static final String HAS_ROLE_FUNCTION = "hasRole(bytes32,address)";
    private static final String COMPLIANCE_ROLE_FUNCTION = "COMPLIANCE_ROLE()";
    
    
    // KYC 状态枚举值（对应合约中的 Status enum）
    public enum KYCStatus {
        None(0),
        Pending(1),
        Approved(2),
        Rejected(3),
        Blacklisted(4);

        private final int value;

        KYCStatus(int value) {
            this.value = value;
        }

        public int getValue() {
            return value;
        }

        public static KYCStatus fromString(String status) {
            if (status == null) {
                return None;
            }
            switch (status.toLowerCase()) {
                case "approved":
                    return Approved;
                case "pending":
                    return Pending;
                case "rejected":
                    return Rejected;
                case "blacklisted":
                    return Blacklisted;
                default:
                    return None;
            }
        }
    }

    private final Web3j web3j;
    private final Credentials credentials;
    private final String contractAddress;
    private final boolean enabled;
    private final TransactionManager transactionManager;

    /**
     * 区块链 chainId，用于构造 EIP-155 保护的交易（Mantle Sepolia 默认 5003）
     */
    private final long chainId;

    /**
     * Gas 限制
     */
    @Value("${blockchain.gas-limit:80000000}")
    private BigInteger gasLimit;

    public KYCRegistryService(
            Web3j web3j,
            Credentials credentials,
            @Value("${blockchain.enabled:false}") boolean enabled,
            @Value("${blockchain.kyc-registry-contract:}") String contractAddress,
            @Value("${blockchain.chain-id:5003}") long chainId
    ) {
        this.web3j = web3j;
        this.credentials = credentials;
        this.enabled = enabled;
        this.contractAddress = contractAddress;
        this.chainId = chainId;
        this.transactionManager = new RawTransactionManager(web3j, credentials, chainId);

        if (enabled && (contractAddress == null || contractAddress.isEmpty())) {
            logger.warn("KYCRegistry contract address is not configured. KYC status will not be synced to blockchain.");
        } else if (enabled) {
            logger.info("KYCRegistryService initialized with contract address: {}, chainId: {}", contractAddress, chainId);
        }
    }

    /**
     * 获取后端钱包地址（用于授予权限）
     * @return 后端钱包地址
     */
    public String getCredentialsAddress() {
        return credentials.getAddress();
    }

    /**
     * 设置用户的 KYC 状态（同步到链上）
     * @param userAddress 用户钱包地址
     * @param status KYC 状态（"approved", "rejected", "pending", "blacklisted"）
     * @return 交易哈希
     */
    public String setKYCStatus(String userAddress, String status) {
        if (!enabled || contractAddress == null || contractAddress.isEmpty()) {
            logger.debug("Blockchain sync is disabled or contract address not configured. Skipping on-chain sync.");
            return null;
        }

        // 检查权限（可选，如果检查失败不影响执行，让链上验证）
        try {
            if (!hasComplianceRole()) {
                logger.warn("⚠️  Backend wallet address {} does not have COMPLIANCE_ROLE. " +
                        "Transaction may fail. Please grant COMPLIANCE_ROLE to this address.", 
                        credentials.getAddress());
                logger.warn("   To grant permission, call KYCRegistry.grantRole(COMPLIANCE_ROLE(), {})", 
                        credentials.getAddress());
            }
        } catch (Exception e) {
            logger.warn("Failed to check COMPLIANCE_ROLE, proceeding anyway: {}", e.getMessage());
        }

        try {
            KYCStatus kycStatus = KYCStatus.fromString(status);
            logger.info("Setting KYC status on-chain: {} -> {}", userAddress, kycStatus);

            // 构建函数调用
            Function function = new Function(
                    "setKYCStatus",
                    Arrays.asList(
                            new org.web3j.abi.datatypes.Address(userAddress),
                            new Uint8(BigInteger.valueOf(kycStatus.getValue()))
                    ),
                    Collections.emptyList()
            );

            String encodedFunction = FunctionEncoder.encode(function);

            // 构建交易参数
            org.web3j.tx.gas.ContractGasProvider gasProvider = new DefaultGasProvider();
            BigInteger gasPrice = gasProvider.getGasPrice();
            // 使用配置的 gasLimit，如果未配置则使用默认值
            BigInteger txGasLimit = this.gasLimit != null ? this.gasLimit : gasProvider.getGasLimit();

            // 重试机制：如果 nonce 错误，重新获取 nonce 并重试（最多重试 3 次）
            int maxRetries = 3;
            Exception lastException = null;
            
            for (int attempt = 0; attempt < maxRetries; attempt++) {
                try {
                    // 每次重试都重新获取最新的 nonce
                    EthGetTransactionCount ethGetTransactionCount = web3j.ethGetTransactionCount(
                            credentials.getAddress(), DefaultBlockParameterName.LATEST).send();
                    BigInteger nonce = ethGetTransactionCount.getTransactionCount();
                    
                    if (attempt > 0) {
                        logger.info("Retry attempt {}: using nonce {}", attempt + 1, nonce);
                        // 重试时稍微等待一下，避免立即重试
                        Thread.sleep(500 * attempt); // 递增等待时间：0ms, 500ms, 1000ms
                    }

                    org.web3j.crypto.RawTransaction rawTransaction = org.web3j.crypto.RawTransaction.createTransaction(
                            nonce,
                            gasPrice,
                            txGasLimit,
                            contractAddress,
                            encodedFunction
                    );

                    // 签名并发送交易（包含链 ID 以支持 EIP-155）
                    byte[] signedMessage = org.web3j.crypto.TransactionEncoder.signMessage(rawTransaction, chainId, credentials);
                    String hexValue = Numeric.toHexString(signedMessage);

                    EthSendTransaction ethSendTransaction = web3j.ethSendRawTransaction(hexValue).send();
                    if (ethSendTransaction.hasError()) {
                        String errorMessage = ethSendTransaction.getError().getMessage();
                        
                        // 如果是 nonce 错误且还有重试机会，则重试
                        if (errorMessage != null && errorMessage.contains("nonce") && attempt < maxRetries - 1) {
                            logger.warn("Nonce error on attempt {}: {}. Will retry...", attempt + 1, errorMessage);
                            lastException = new RuntimeException("Nonce error: " + errorMessage);
                            continue; // 继续重试
                        }
                        
                        // 其他错误或已达到最大重试次数，抛出异常
                        logger.error("Failed to send transaction: {}", errorMessage);
                        throw new RuntimeException("Failed to set KYC status on-chain: " + errorMessage);
                    }

                    String transactionHash = ethSendTransaction.getTransactionHash();
                    logger.info("✅ KYC status transaction sent. Transaction hash: {} (attempt {}). Waiting for confirmation...", transactionHash, attempt + 1);
                    
                    // 等待交易确认（最多等待 60 秒，每 1 秒轮询一次）
                    TransactionReceiptProcessor receiptProcessor = new PollingTransactionReceiptProcessor(
                            web3j, 
                            1000,  // 轮询间隔：1 秒
                            60     // 最多等待：60 秒
                    );
                    TransactionReceipt receipt = receiptProcessor.waitForTransactionReceipt(transactionHash);
                    
                    if (receipt != null && receipt.isStatusOK()) {
                        logger.info("✅ KYC status updated on-chain. Transaction confirmed. Hash: {}, Block: {}", 
                                transactionHash, receipt.getBlockNumber());
                        return transactionHash;
                    } else if (receipt != null && !receipt.isStatusOK()) {
                        // 交易失败 - 可能是权限问题
                        logger.error("❌ KYC status transaction failed. Hash: {}, Status: {}", 
                                transactionHash, receipt.getStatus());
                        
                        // 检查是否是权限问题（通常权限问题会导致交易回滚）
                        String errorMessage = "Transaction failed on-chain. Status: " + receipt.getStatus();
                        errorMessage += "\n可能的原因：";
                        errorMessage += "\n1. 后端钱包地址 (" + credentials.getAddress() + ") 没有 COMPLIANCE_ROLE 权限";
                        errorMessage += "\n2. 请在 KYCRegistry 合约中调用 grantRole(COMPLIANCE_ROLE, " + credentials.getAddress() + ")";
                        errorMessage += "\n3. 或者使用合约管理员地址来授予权限";
                        throw new RuntimeException(errorMessage);
                    } else {
                        // 交易收据为 null（不应该发生）
                        logger.error("❌ KYC status transaction receipt is null. Hash: {}", transactionHash);
                        throw new RuntimeException("Transaction receipt is null");
                    }
                    
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    throw new RuntimeException("Transaction interrupted", e);
                } catch (Exception e) {
                    String errorMessage = e.getMessage();
                    // 如果是 nonce 错误且还有重试机会，则重试
                    if (errorMessage != null && errorMessage.contains("nonce") && attempt < maxRetries - 1) {
                        logger.warn("Nonce error on attempt {}: {}. Will retry...", attempt + 1, errorMessage);
                        lastException = e;
                        continue; // 继续重试
                    }
                    // 其他错误，抛出异常
                    throw e;
                }
            }
            
            // 所有重试都失败了
            if (lastException != null) {
                throw lastException;
            }
            throw new RuntimeException("Failed to send transaction after " + maxRetries + " attempts");

        } catch (Exception e) {
            logger.error("Failed to set KYC status on-chain for {}: {}", userAddress, e.getMessage(), e);
            throw new RuntimeException("Failed to sync KYC status to blockchain: " + e.getMessage(), e);
        }
    }

    /**
     * 检查用户是否已通过 KYC（从链上读取）
     * @param userAddress 用户钱包地址
     * @return true 如果用户已通过 KYC
     */
    public boolean isKYCApproved(String userAddress) {
        if (!enabled || contractAddress == null || contractAddress.isEmpty()) {
            logger.debug("Blockchain check is disabled. Returning false.");
            return false;
        }

        try {
            // 构建函数调用
            Function function = new Function(
                    "isKYCApproved",
                    Arrays.asList(new org.web3j.abi.datatypes.Address(userAddress)),
                    Arrays.asList(new TypeReference<org.web3j.abi.datatypes.Bool>() {})
            );

            String encodedFunction = FunctionEncoder.encode(function);

            // 调用合约
            EthCall response = web3j.ethCall(
                    Transaction.createEthCallTransaction(null, contractAddress, encodedFunction),
                    DefaultBlockParameterName.LATEST
            ).send();

            if (response.hasError()) {
                logger.error("Failed to call contract: {}", response.getError().getMessage());
                return false;
            }

            String value = response.getValue();
            List<Type> decoded = FunctionReturnDecoder.decode(value, function.getOutputParameters());
            if (decoded.isEmpty()) {
                return false;
            }

            return (Boolean) decoded.get(0).getValue();

        } catch (Exception e) {
            logger.error("Failed to check KYC status on-chain for {}: {}", userAddress, e.getMessage(), e);
            return false;
        }
    }
    
    /**
     * 获取 COMPLIANCE_ROLE 的哈希值（从合约读取）
     * @return COMPLIANCE_ROLE 的 bytes32 哈希值
     */
    private String getComplianceRoleHash() {
        try {
            // 构建函数调用 - COMPLIANCE_ROLE() 是一个 public constant
            Function function = new Function(
                    "COMPLIANCE_ROLE",
                    Collections.emptyList(),
                    Arrays.asList(new TypeReference<Bytes32>() {})
            );

            String encodedFunction = FunctionEncoder.encode(function);

            // 调用合约
            EthCall response = web3j.ethCall(
                    Transaction.createEthCallTransaction(null, contractAddress, encodedFunction),
                    DefaultBlockParameterName.LATEST
            ).send();

            if (response.hasError()) {
                logger.error("Failed to get COMPLIANCE_ROLE hash: {}", response.getError().getMessage());
                // 如果失败，尝试计算（OpenZeppelin AccessControl 使用 keccak256(roleName)）
                byte[] roleBytes = "COMPLIANCE_ROLE".getBytes(StandardCharsets.UTF_8);
                byte[] hash = Hash.sha3(roleBytes);
                return Numeric.toHexString(hash);
            }

            String value = response.getValue();
            List<Type> decoded = FunctionReturnDecoder.decode(value, function.getOutputParameters());
            if (decoded.isEmpty()) {
                // 如果解码失败，尝试计算
                byte[] roleBytes = "COMPLIANCE_ROLE".getBytes(StandardCharsets.UTF_8);
                byte[] hash = Hash.sha3(roleBytes);
                return Numeric.toHexString(hash);
            }

            Bytes32 roleHash = (Bytes32) decoded.get(0);
            return Numeric.toHexString(roleHash.getValue());
        } catch (Exception e) {
            logger.warn("Failed to get COMPLIANCE_ROLE from contract, using calculated value: {}", e.getMessage());
            // 计算 fallback 值
            byte[] roleBytes = "COMPLIANCE_ROLE".getBytes(StandardCharsets.UTF_8);
            byte[] hash = Hash.sha3(roleBytes);
            return Numeric.toHexString(hash);
        }
    }
    
    /**
     * 检查后端钱包地址是否有 COMPLIANCE_ROLE 权限
     * @return true 如果有权限
     */
    public boolean hasComplianceRole() {
        if (!enabled || contractAddress == null || contractAddress.isEmpty()) {
            return false;
        }
        
        try {
            String roleHash = getComplianceRoleHash();
            String backendAddress = credentials.getAddress();
            
            // 构建函数调用
            Function function = new Function(
                    "hasRole",
                    Arrays.asList(
                            new Bytes32(Numeric.hexStringToByteArray(roleHash)),
                            new org.web3j.abi.datatypes.Address(backendAddress)
                    ),
                    Arrays.asList(new TypeReference<org.web3j.abi.datatypes.Bool>() {})
            );

            String encodedFunction = FunctionEncoder.encode(function);

            // 调用合约
            EthCall response = web3j.ethCall(
                    Transaction.createEthCallTransaction(null, contractAddress, encodedFunction),
                    DefaultBlockParameterName.LATEST
            ).send();

            if (response.hasError()) {
                logger.error("Failed to check COMPLIANCE_ROLE: {}", response.getError().getMessage());
                return false;
            }

            String value = response.getValue();
            List<Type> decoded = FunctionReturnDecoder.decode(value, function.getOutputParameters());
            if (decoded.isEmpty()) {
                return false;
            }

            return (Boolean) decoded.get(0).getValue();
        } catch (Exception e) {
            logger.error("Failed to check COMPLIANCE_ROLE for {}: {}", credentials.getAddress(), e.getMessage(), e);
            return false;
        }
    }
    
    /**
     * 授予 COMPLIANCE_ROLE 权限给指定地址
     * 注意：调用此方法的地址必须是 KYCRegistry 合约的 DEFAULT_ADMIN_ROLE
     * @param address 要授予权限的地址
     * @return 交易哈希
     */
    public String grantComplianceRole(String address) {
        if (!enabled || contractAddress == null || contractAddress.isEmpty()) {
            logger.debug("Blockchain sync is disabled or contract address not configured. Skipping on-chain operation.");
            return null;
        }

        try {
            String roleHash = getComplianceRoleHash();
            logger.info("Granting COMPLIANCE_ROLE to: {} (role hash: {})", address, roleHash);

            // 构建函数调用
            Function function = new Function(
                    "grantRole",
                    Arrays.asList(
                            new Bytes32(Numeric.hexStringToByteArray(roleHash)),
                            new org.web3j.abi.datatypes.Address(address)
                    ),
                    Collections.emptyList()
            );

            String encodedFunction = FunctionEncoder.encode(function);

            // 构建交易参数
            org.web3j.tx.gas.ContractGasProvider gasProvider = new DefaultGasProvider();
            BigInteger gasPrice = gasProvider.getGasPrice();
            BigInteger txGasLimit = this.gasLimit != null ? this.gasLimit : gasProvider.getGasLimit();

            // 获取 nonce
            EthGetTransactionCount ethGetTransactionCount = web3j.ethGetTransactionCount(
                    credentials.getAddress(), DefaultBlockParameterName.LATEST).send();
            BigInteger nonce = ethGetTransactionCount.getTransactionCount();

            org.web3j.crypto.RawTransaction rawTransaction = org.web3j.crypto.RawTransaction.createTransaction(
                    nonce,
                    gasPrice,
                    txGasLimit,
                    contractAddress,
                    encodedFunction
            );

            // 签名并发送交易
            byte[] signedMessage = org.web3j.crypto.TransactionEncoder.signMessage(rawTransaction, chainId, credentials);
            String hexValue = Numeric.toHexString(signedMessage);

            EthSendTransaction ethSendTransaction = web3j.ethSendRawTransaction(hexValue).send();
            if (ethSendTransaction.hasError()) {
                String errorMessage = ethSendTransaction.getError().getMessage();
                logger.error("Failed to send grantRole transaction: {}", errorMessage);
                throw new RuntimeException("Failed to grant COMPLIANCE_ROLE: " + errorMessage);
            }

            String transactionHash = ethSendTransaction.getTransactionHash();
            logger.info("✅ grantRole transaction sent. Transaction hash: {}. Waiting for confirmation...", transactionHash);
            
            // 等待交易确认
            TransactionReceiptProcessor receiptProcessor = new PollingTransactionReceiptProcessor(
                    web3j, 
                    1000,  // 轮询间隔：1 秒
                    60     // 最多等待：60 秒
            );
            TransactionReceipt receipt = receiptProcessor.waitForTransactionReceipt(transactionHash);
            
            if (receipt != null && receipt.isStatusOK()) {
                logger.info("✅ COMPLIANCE_ROLE granted successfully. Hash: {}, Block: {}", 
                        transactionHash, receipt.getBlockNumber());
                return transactionHash;
            } else if (receipt != null && !receipt.isStatusOK()) {
                logger.error("❌ grantRole transaction failed. Hash: {}, Status: {}", 
                        transactionHash, receipt.getStatus());
                throw new RuntimeException("Transaction failed on-chain. Status: " + receipt.getStatus());
            } else {
                logger.error("❌ grantRole transaction receipt is null. Hash: {}", transactionHash);
                throw new RuntimeException("Transaction receipt is null");
            }

        } catch (Exception e) {
            logger.error("Failed to grant COMPLIANCE_ROLE to {}: {}", address, e.getMessage(), e);
            throw new RuntimeException("Failed to grant COMPLIANCE_ROLE: " + e.getMessage(), e);
        }
    }
}



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
import org.web3j.tx.RawTransactionManager;
import org.web3j.tx.TransactionManager;
import org.web3j.tx.gas.DefaultGasProvider;
import org.web3j.utils.Numeric;

import java.math.BigInteger;
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

    public KYCRegistryService(
            Web3j web3j,
            Credentials credentials,
            @Value("${blockchain.enabled:false}") boolean enabled,
            @Value("${blockchain.kyc-registry-contract:}") String contractAddress
    ) {
        this.web3j = web3j;
        this.credentials = credentials;
        this.enabled = enabled;
        this.contractAddress = contractAddress;
        this.transactionManager = new RawTransactionManager(web3j, credentials, 5003L); // Mantle Sepolia Chain ID

        if (enabled && (contractAddress == null || contractAddress.isEmpty())) {
            logger.warn("KYCRegistry contract address is not configured. KYC status will not be synced to blockchain.");
        } else if (enabled) {
            logger.info("KYCRegistryService initialized with contract address: {}", contractAddress);
        }
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

            // 获取 nonce
            EthGetTransactionCount ethGetTransactionCount = web3j.ethGetTransactionCount(
                    credentials.getAddress(), DefaultBlockParameterName.LATEST).send();
            BigInteger nonce = ethGetTransactionCount.getTransactionCount();

            // 构建交易
            org.web3j.tx.gas.ContractGasProvider gasProvider = new DefaultGasProvider();
            BigInteger gasPrice = gasProvider.getGasPrice();
            BigInteger gasLimit = gasProvider.getGasLimit();

            org.web3j.crypto.RawTransaction rawTransaction = org.web3j.crypto.RawTransaction.createTransaction(
                    nonce,
                    gasPrice,
                    gasLimit,
                    contractAddress,
                    encodedFunction
            );

            // 签名并发送交易
            byte[] signedMessage = org.web3j.crypto.TransactionEncoder.signMessage(rawTransaction, credentials);
            String hexValue = Numeric.toHexString(signedMessage);

            EthSendTransaction ethSendTransaction = web3j.ethSendRawTransaction(hexValue).send();
            if (ethSendTransaction.hasError()) {
                String errorMessage = ethSendTransaction.getError().getMessage();
                logger.error("Failed to send transaction: {}", errorMessage);
                throw new RuntimeException("Failed to set KYC status on-chain: " + errorMessage);
            }

            String transactionHash = ethSendTransaction.getTransactionHash();
            logger.info("✅ KYC status updated on-chain. Transaction hash: {}", transactionHash);
            return transactionHash;

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
}



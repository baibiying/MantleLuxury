package com.mantleluxury.backend.blockchain.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.web3j.abi.FunctionEncoder;
import org.web3j.abi.datatypes.Function;
import org.web3j.abi.datatypes.Type;
import org.web3j.abi.datatypes.Bool;
import org.web3j.abi.datatypes.Address;
import org.web3j.crypto.Credentials;
import org.web3j.protocol.Web3j;
import org.web3j.protocol.core.DefaultBlockParameterName;
import org.web3j.protocol.core.methods.response.TransactionReceipt;
import org.web3j.tx.RawTransactionManager;
import org.web3j.tx.TransactionManager;
import org.web3j.tx.gas.DefaultGasProvider;
import org.web3j.tx.response.PollingTransactionReceiptProcessor;
import org.web3j.tx.response.TransactionReceiptProcessor;

import java.math.BigInteger;
import java.util.Arrays;
import java.util.Collections;

/**
 * LuxuryToken 合约交互服务
 * 用于调用 LuxuryToken 合约的方法
 */
@Service
public class LuxuryTokenService {

    private static final Logger logger = LoggerFactory.getLogger(LuxuryTokenService.class);

    private final Web3j web3j;
    private final Credentials credentials;
    private final boolean enabled;
    
    @Value("${blockchain.chain-id:5003}")
    private long chainId;
    
    @Value("${blockchain.gas-limit:150000000}")
    private BigInteger gasLimit;

    public LuxuryTokenService(
            Web3j web3j,
            Credentials credentials,
            @Value("${blockchain.enabled:false}") boolean enabled
    ) {
        this.web3j = web3j;
        this.credentials = credentials;
        this.enabled = enabled;
    }

    /**
     * 转移合约所有权到新地址
     * @param tokenAddress LuxuryToken 合约地址
     * @param newOwner 新的 owner 地址
     * @return 交易哈希
     */
    public String transferOwnership(String tokenAddress, String newOwner) throws Exception {
        if (!this.enabled) {
            logger.warn("Blockchain operations are disabled. Cannot transfer ownership.");
            return null;
        }

        if (tokenAddress == null || tokenAddress.isEmpty()) {
            throw new IllegalArgumentException("Token address is required");
        }

        if (newOwner == null || newOwner.isEmpty()) {
            throw new IllegalArgumentException("New owner address is required");
        }

        logger.info("Transferring ownership of token {} to {}", tokenAddress, newOwner);

        // 构建 transferOwnership 函数调用
        Function function = new Function(
                "transferOwnership",
                Arrays.asList(new Address(newOwner)),
                Collections.emptyList()
        );

        String encodedFunction = FunctionEncoder.encode(function);

        // 使用 RawTransactionManager 发送交易
        TransactionManager transactionManager = new RawTransactionManager(web3j, credentials, chainId);
        org.web3j.protocol.core.methods.response.EthSendTransaction txResponse =
                transactionManager.sendTransaction(
                        DefaultGasProvider.GAS_PRICE,
                        gasLimit,
                        tokenAddress,
                        encodedFunction,
                        BigInteger.ZERO
                );

        if (txResponse.hasError()) {
            String message = "Failed to transfer ownership: " + txResponse.getError().getMessage();
            logger.error(message);
            throw new RuntimeException(message);
        }

        String txHash = txResponse.getTransactionHash();
        logger.info("Transaction sent. Hash: {}", txHash);

        // 等待交易确认
        TransactionReceiptProcessor receiptProcessor = new PollingTransactionReceiptProcessor(
                web3j,
                1000,  // 轮询间隔：1 秒
                60     // 最多等待：60 秒
        );
        TransactionReceipt receipt = receiptProcessor.waitForTransactionReceipt(txHash);

        if (receipt != null && receipt.isStatusOK()) {
            logger.info("✅ Ownership transferred successfully. Hash: {}, Block: {}", 
                    txHash, receipt.getBlockNumber());
            return txHash;
        } else if (receipt != null && !receipt.isStatusOK()) {
            logger.error("❌ Transaction failed. Hash: {}, Status: {}", txHash, receipt.getStatus());
            throw new RuntimeException("Transaction failed on-chain. Status: " + receipt.getStatus());
        } else {
            logger.error("❌ Transaction receipt is null. Hash: {}", txHash);
            throw new RuntimeException("Transaction receipt is null");
        }
    }

    /**
     * 设置托管检查启用/禁用状态
     * @param tokenAddress LuxuryToken 合约地址
     * @param enabled 是否启用托管检查
     * @return 交易哈希
     */
    public String setCustodyCheckEnabled(String tokenAddress, boolean enabled) throws Exception {
        if (!this.enabled) {
            logger.warn("Blockchain operations are disabled. Cannot set custody check enabled.");
            return null;
        }

        if (tokenAddress == null || tokenAddress.isEmpty()) {
            throw new IllegalArgumentException("Token address is required");
        }

        logger.info("Setting custody check enabled to {} for token {}", enabled, tokenAddress);

        // 构建函数调用
        Function function = new Function(
                "setCustodyCheckEnabled",
                Arrays.asList(new Bool(enabled)),
                Collections.emptyList()
        );

        String encodedFunction = FunctionEncoder.encode(function);

        // 使用 RawTransactionManager 发送交易
        TransactionManager transactionManager = new RawTransactionManager(web3j, credentials, chainId);
        org.web3j.protocol.core.methods.response.EthSendTransaction txResponse =
                transactionManager.sendTransaction(
                        DefaultGasProvider.GAS_PRICE,
                        gasLimit,
                        tokenAddress,
                        encodedFunction,
                        BigInteger.ZERO
                );

        if (txResponse.hasError()) {
            String message = "Failed to set custody check enabled: " + txResponse.getError().getMessage();
            logger.error(message);
            throw new RuntimeException(message);
        }

        String txHash = txResponse.getTransactionHash();
        logger.info("Transaction sent. Hash: {}", txHash);

        // 等待交易确认
        TransactionReceiptProcessor receiptProcessor = new PollingTransactionReceiptProcessor(
                web3j,
                1000,  // 轮询间隔：1 秒
                60     // 最多等待：60 秒
        );
        TransactionReceipt receipt = receiptProcessor.waitForTransactionReceipt(txHash);

        if (receipt != null && receipt.isStatusOK()) {
            logger.info("✅ Custody check enabled set to {} successfully. Hash: {}, Block: {}", 
                    enabled, txHash, receipt.getBlockNumber());
            return txHash;
        } else if (receipt != null && !receipt.isStatusOK()) {
            logger.error("❌ Transaction failed. Hash: {}, Status: {}", txHash, receipt.getStatus());
            throw new RuntimeException("Transaction failed on-chain. Status: " + receipt.getStatus());
        } else {
            logger.error("❌ Transaction receipt is null. Hash: {}", txHash);
            throw new RuntimeException("Transaction receipt is null");
        }
    }
}


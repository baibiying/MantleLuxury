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
import org.web3j.abi.datatypes.generated.Bytes32;
import org.web3j.abi.datatypes.generated.Uint8;
import org.web3j.crypto.Credentials;
import org.web3j.protocol.Web3j;
import org.web3j.protocol.core.DefaultBlockParameterName;
import org.web3j.protocol.core.methods.request.Transaction;
import org.web3j.protocol.core.methods.response.EthCall;
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
 * CustodyManager 服务
 * 用于与链上 CustodyManager 合约交互，管理资产托管和保险状态
 */
@Service
public class CustodyManagerService {

    private static final Logger logger = LoggerFactory.getLogger(CustodyManagerService.class);

    private final Web3j web3j;
    private final Credentials credentials;
    private final String custodyManagerContractAddress;
    private final boolean enabled;

    /**
     * 区块链 chainId，用于构造 EIP-155 保护的交易（Mantle Sepolia 默认 5003）
     */
    @Value("${blockchain.chain-id:5003}")
    private long chainId;

    /**
     * 全局 gas limit
     */
    @Value("${blockchain.gas-limit:80000000}")
    private BigInteger gasLimit;

    // 资产状态枚举值（对应合约中的 AssetStatus enum）
    public enum AssetStatus {
        Registered(0),
        InCustody(1),
        ForSale(2),
        Sold(3),
        Withdrawn(4);

        private final int value;

        AssetStatus(int value) {
            this.value = value;
        }

        public int getValue() {
            return value;
        }

        public static AssetStatus fromString(String status) {
            if (status == null) {
                return Registered;
            }
            switch (status.toLowerCase()) {
                case "in_custody":
                case "incustody":
                    return InCustody;
                case "for_sale":
                case "forsale":
                    return ForSale;
                case "sold":
                    return Sold;
                case "withdrawn":
                    return Withdrawn;
                default:
                    return Registered;
            }
        }

        public String toString() {
            switch (this) {
                case Registered:
                    return "registered";
                case InCustody:
                    return "in_custody";
                case ForSale:
                    return "for_sale";
                case Sold:
                    return "sold";
                case Withdrawn:
                    return "withdrawn";
                default:
                    return "registered";
            }
        }
    }

    public CustodyManagerService(
            Web3j web3j,
            Credentials credentials,
            @Value("${blockchain.custody-manager-contract:}") String custodyManagerContractAddress,
            @Value("${blockchain.enabled:false}") boolean enabled
    ) {
        this.web3j = web3j;
        this.credentials = credentials;
        this.custodyManagerContractAddress = custodyManagerContractAddress;
        this.enabled = enabled;

        if (enabled && !custodyManagerContractAddress.isEmpty()) {
            logger.info("CustodyManagerService initialized with contract address: {}", custodyManagerContractAddress);
        } else {
            logger.warn("CustodyManagerService is disabled or contract address is not configured.");
        }
    }

    /**
     * 注册资产到链上
     * @param assetIdBytes32 资产ID（bytes32格式）
     * @param tokenAddress LuxuryToken合约地址
     * @param custodyInfoHash 托管信息哈希
     * @param insuranceInfoHash 保险信息哈希
     * @return 交易哈希
     */
    public String registerAsset(
            String assetIdBytes32,
            String tokenAddress,
            String custodyInfoHash,
            String insuranceInfoHash
    ) throws Exception {
        if (!enabled || custodyManagerContractAddress == null || custodyManagerContractAddress.isEmpty()) {
            logger.warn("Blockchain operations are disabled or CustodyManager contract not configured. Cannot register asset.");
            return null;
        }

        byte[] assetIdBytes = hexStringToBytes32(assetIdBytes32);
        byte[] custodyHashBytes = hexStringToBytes32(custodyInfoHash);
        byte[] insuranceHashBytes = hexStringToBytes32(insuranceInfoHash);

        Function function = new Function(
                "registerAsset",
                Arrays.asList(
                        new Bytes32(assetIdBytes),
                        new org.web3j.abi.datatypes.Address(160, tokenAddress),
                        new Bytes32(custodyHashBytes),
                        new Bytes32(insuranceHashBytes)
                ),
                Collections.emptyList()
        );

        String encodedFunction = FunctionEncoder.encode(function);

        TransactionManager transactionManager = new RawTransactionManager(web3j, credentials, chainId);
        org.web3j.protocol.core.methods.response.EthSendTransaction txResponse =
                transactionManager.sendTransaction(
                        DefaultGasProvider.GAS_PRICE,
                        gasLimit,
                        custodyManagerContractAddress,
                        encodedFunction,
                        BigInteger.ZERO
                );

        if (txResponse.hasError()) {
            String message = "Failed to register asset on chain: " + txResponse.getError().getMessage();
            logger.error(message);
            throw new RuntimeException(message);
        }

        String txHash = txResponse.getTransactionHash();
        logger.info("Asset registered on chain. AssetId: {}, TxHash: {}", assetIdBytes32, txHash);
        return txHash;
    }

    /**
     * 更新资产状态
     * @param assetIdBytes32 资产ID（bytes32格式）
     * @param status 新状态
     * @return 交易哈希
     */
    public String updateStatus(String assetIdBytes32, AssetStatus status) throws Exception {
        if (!enabled || custodyManagerContractAddress == null || custodyManagerContractAddress.isEmpty()) {
            logger.warn("Blockchain operations are disabled or CustodyManager contract not configured. Cannot update status.");
            return null;
        }

        byte[] assetIdBytes = hexStringToBytes32(assetIdBytes32);

        Function function = new Function(
                "updateStatus",
                Arrays.asList(
                        new Bytes32(assetIdBytes),
                        new Uint8(BigInteger.valueOf(status.getValue()))
                ),
                Collections.emptyList()
        );

        String encodedFunction = FunctionEncoder.encode(function);

        TransactionManager transactionManager = new RawTransactionManager(web3j, credentials, chainId);
        org.web3j.protocol.core.methods.response.EthSendTransaction txResponse =
                transactionManager.sendTransaction(
                        DefaultGasProvider.GAS_PRICE,
                        gasLimit,
                        custodyManagerContractAddress,
                        encodedFunction,
                        BigInteger.ZERO
                );

        if (txResponse.hasError()) {
            String message = "Failed to update status on chain: " + txResponse.getError().getMessage();
            logger.error(message);
            throw new RuntimeException(message);
        }

        String txHash = txResponse.getTransactionHash();
        logger.info("Status updated on chain. AssetId: {}, Status: {}, TxHash: {}", assetIdBytes32, status, txHash);
        return txHash;
    }

    /**
     * 更新托管信息
     * @param assetIdBytes32 资产ID（bytes32格式）
     * @param newHash 新的托管信息哈希
     * @return 交易哈希
     */
    public String updateCustodyInfo(String assetIdBytes32, String newHash) throws Exception {
        if (!enabled || custodyManagerContractAddress == null || custodyManagerContractAddress.isEmpty()) {
            logger.warn("Blockchain operations are disabled or CustodyManager contract not configured. Cannot update custody info.");
            return null;
        }

        byte[] assetIdBytes = hexStringToBytes32(assetIdBytes32);
        byte[] hashBytes = hexStringToBytes32(newHash);

        Function function = new Function(
                "updateCustodyInfo",
                Arrays.asList(
                        new Bytes32(assetIdBytes),
                        new Bytes32(hashBytes)
                ),
                Collections.emptyList()
        );

        String encodedFunction = FunctionEncoder.encode(function);

        TransactionManager transactionManager = new RawTransactionManager(web3j, credentials, chainId);
        org.web3j.protocol.core.methods.response.EthSendTransaction txResponse =
                transactionManager.sendTransaction(
                        DefaultGasProvider.GAS_PRICE,
                        gasLimit,
                        custodyManagerContractAddress,
                        encodedFunction,
                        BigInteger.ZERO
                );

        if (txResponse.hasError()) {
            String message = "Failed to update custody info on chain: " + txResponse.getError().getMessage();
            logger.error(message);
            throw new RuntimeException(message);
        }

        String txHash = txResponse.getTransactionHash();
        logger.info("Custody info updated on chain. AssetId: {}, TxHash: {}", assetIdBytes32, txHash);
        return txHash;
    }

    /**
     * 更新保险信息
     * @param assetIdBytes32 资产ID（bytes32格式）
     * @param newHash 新的保险信息哈希
     * @return 交易哈希
     */
    public String updateInsuranceInfo(String assetIdBytes32, String newHash) throws Exception {
        if (!enabled || custodyManagerContractAddress == null || custodyManagerContractAddress.isEmpty()) {
            logger.warn("Blockchain operations are disabled or CustodyManager contract not configured. Cannot update insurance info.");
            return null;
        }

        byte[] assetIdBytes = hexStringToBytes32(assetIdBytes32);
        byte[] hashBytes = hexStringToBytes32(newHash);

        Function function = new Function(
                "updateInsuranceInfo",
                Arrays.asList(
                        new Bytes32(assetIdBytes),
                        new Bytes32(hashBytes)
                ),
                Collections.emptyList()
        );

        String encodedFunction = FunctionEncoder.encode(function);

        TransactionManager transactionManager = new RawTransactionManager(web3j, credentials, chainId);
        org.web3j.protocol.core.methods.response.EthSendTransaction txResponse =
                transactionManager.sendTransaction(
                        DefaultGasProvider.GAS_PRICE,
                        gasLimit,
                        custodyManagerContractAddress,
                        encodedFunction,
                        BigInteger.ZERO
                );

        if (txResponse.hasError()) {
            String message = "Failed to update insurance info on chain: " + txResponse.getError().getMessage();
            logger.error(message);
            throw new RuntimeException(message);
        }

        String txHash = txResponse.getTransactionHash();
        logger.info("Insurance info updated on chain. AssetId: {}, TxHash: {}", assetIdBytes32, txHash);
        return txHash;
    }

    /**
     * 获取资产状态（只读）
     * @param assetIdBytes32 资产ID（bytes32格式）
     * @return 资产状态字符串
     */
    public String getAssetStatus(String assetIdBytes32) throws Exception {
        if (!enabled || custodyManagerContractAddress == null || custodyManagerContractAddress.isEmpty()) {
            logger.warn("Blockchain operations are disabled or CustodyManager contract not configured. Returning 'registered'.");
            return "registered";
        }

        byte[] assetIdBytes = hexStringToBytes32(assetIdBytes32);

        Function function = new Function(
                "getAssetStatus",
                Arrays.asList(new Bytes32(assetIdBytes)),
                Arrays.asList(new TypeReference<Uint8>() {})
        );

        String encodedFunction = FunctionEncoder.encode(function);

        EthCall response = web3j.ethCall(
                Transaction.createEthCallTransaction(
                        credentials.getAddress(),
                        custodyManagerContractAddress,
                        encodedFunction
                ),
                DefaultBlockParameterName.LATEST
        ).send();

        if (response.hasError()) {
            logger.error("Failed to get asset status: {}", response.getError().getMessage());
            return "registered";
        }

        List<Type> decoded = FunctionReturnDecoder.decode(response.getValue(), function.getOutputParameters());
        if (decoded.isEmpty()) {
            return "registered";
        }

        Uint8 statusValue = (Uint8) decoded.get(0);
        int statusInt = statusValue.getValue().intValue();

        for (AssetStatus status : AssetStatus.values()) {
            if (status.getValue() == statusInt) {
                return status.toString();
            }
        }

        return "registered";
    }

    /**
     * 检查资产是否已注册
     * @param assetIdBytes32 资产ID（bytes32格式）
     * @return 是否已注册
     */
    public boolean isAssetRegistered(String assetIdBytes32) throws Exception {
        if (!enabled || custodyManagerContractAddress == null || custodyManagerContractAddress.isEmpty()) {
            logger.warn("Blockchain operations are disabled or CustodyManager contract not configured. Returning false.");
            return false;
        }

        byte[] assetIdBytes = hexStringToBytes32(assetIdBytes32);

        Function function = new Function(
                "isAssetRegistered",
                Arrays.asList(new Bytes32(assetIdBytes)),
                Arrays.asList(new TypeReference<org.web3j.abi.datatypes.Bool>() {})
        );

        String encodedFunction = FunctionEncoder.encode(function);

        EthCall response = web3j.ethCall(
                Transaction.createEthCallTransaction(
                        credentials.getAddress(),
                        custodyManagerContractAddress,
                        encodedFunction
                ),
                DefaultBlockParameterName.LATEST
        ).send();

        if (response.hasError()) {
            logger.error("Failed to check asset registration: {}", response.getError().getMessage());
            return false;
        }

        List<Type> decoded = FunctionReturnDecoder.decode(response.getValue(), function.getOutputParameters());
        if (decoded.isEmpty()) {
            return false;
        }

        org.web3j.abi.datatypes.Bool result = (org.web3j.abi.datatypes.Bool) decoded.get(0);
        return result.getValue();
    }

    /**
     * 将十六进制字符串转换为 bytes32
     */
    private byte[] hexStringToBytes32(String hex) {
        String cleanHex = hex.startsWith("0x") ? hex.substring(2) : hex;
        // 确保是64个字符（32字节）
        if (cleanHex.length() < 64) {
            cleanHex = String.format("%64s", cleanHex).replace(' ', '0');
        } else if (cleanHex.length() > 64) {
            cleanHex = cleanHex.substring(0, 64);
        }
        return Numeric.hexStringToByteArray("0x" + cleanHex);
    }
}



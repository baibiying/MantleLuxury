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
import org.web3j.tx.RawTransactionManager;
import org.web3j.tx.TransactionManager;
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
        if (yieldDistributionContractAddress == null || yieldDistributionContractAddress.isEmpty()) {
            throw new RuntimeException("YieldDistribution contract address is not configured. Please deploy the contract first.");
        }

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

        // 发送交易
        TransactionManager transactionManager = new RawTransactionManager(web3j, credentials);
        String txHash = transactionManager.sendTransaction(
                DefaultGasProvider.GAS_PRICE,
                DefaultGasProvider.GAS_LIMIT,
                yieldDistributionContractAddress,
                encodedFunction,
                BigInteger.ZERO
        ).getTransactionHash();

        distribution.setTransactionHash(txHash);
        yieldDistributionRepository.save(distribution);

        logger.info("Created distribution on chain. DistributionId: {}, TxHash: {}", distributionId, txHash);
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
     * 将 yieldType 字符串转换为枚举值（0 = Appreciation, 1 = Rental）
     */
    private int yieldTypeToEnum(String yieldType) {
        if ("rental".equalsIgnoreCase(yieldType)) {
            return 1;
        }
        return 0; // appreciation
    }
}


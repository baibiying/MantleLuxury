package com.mantleluxury.backend.blockchain.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.mantleluxury.backend.blockchain.domain.BlockchainEvent;
import com.mantleluxury.backend.blockchain.repository.BlockchainEventRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.web3j.abi.EventEncoder;
import org.web3j.abi.TypeReference;
import org.web3j.abi.datatypes.Event;
import org.web3j.protocol.Web3j;
import org.web3j.protocol.core.DefaultBlockParameter;
import org.web3j.protocol.core.methods.request.EthFilter;
import org.web3j.protocol.core.methods.response.EthBlock;
import org.web3j.protocol.core.methods.response.EthLog;
import org.web3j.protocol.core.methods.response.Log;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import java.math.BigInteger;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * 事件索引器服务 - 监听链上事件并同步到数据库
 * 替代 The Graph，直接使用 web3j 监听事件
 */
@Service
public class EventIndexerService {

    private static final Logger logger = LoggerFactory.getLogger(EventIndexerService.class);

    private final Web3j web3j;
    private final BlockchainEventRepository eventRepository;
    private final ObjectMapper objectMapper;
    private final boolean enabled;
    private final AtomicBoolean isRunning = new AtomicBoolean(false);

    @Value("${blockchain.kyc-registry-contract:}")
    private String kycRegistryAddress;

    @Value("${blockchain.custody-manager-contract:}")
    private String custodyManagerAddress;

    @Value("${blockchain.yield-distribution-contract:}")
    private String yieldDistributionAddress;

    @Value("${blockchain.rpc-url:}")
    private String rpcUrl;

    public EventIndexerService(
            Web3j web3j,
            BlockchainEventRepository eventRepository,
            @Value("${blockchain.enabled:false}") boolean enabled
    ) {
        this.web3j = web3j;
        this.eventRepository = eventRepository;
        this.objectMapper = new ObjectMapper();
        this.enabled = enabled;
    }

    @PostConstruct
    public void init() {
        if (!enabled) {
            logger.info("Event indexer is disabled");
            return;
        }

        logger.info("Event indexer service initialized");
        logger.info("KYCRegistry: {}", kycRegistryAddress);
        logger.info("CustodyManager: {}", custodyManagerAddress);
        logger.info("YieldDistribution: {}", yieldDistributionAddress);

        // 启动索引器
        startIndexing();
    }

    @PreDestroy
    public void shutdown() {
        isRunning.set(false);
        logger.info("Event indexer service stopped");
    }

    /**
     * 启动事件索引
     */
    private void startIndexing() {
        if (isRunning.get()) {
            return;
        }

        isRunning.set(true);
        logger.info("Starting event indexer...");

        // 在后台线程中运行，避免阻塞主线程
        new Thread(() -> {
            try {
                indexEvents();
            } catch (Exception e) {
                logger.error("Event indexer error", e);
            }
        }, "EventIndexer").start();
    }

    /**
     * 定期同步事件（每 30 秒）
     */
    @Scheduled(fixedDelay = 30000) // 30 秒
    public void syncEvents() {
        if (!enabled || !isRunning.get()) {
            return;
        }

        try {
            // 这里可以添加增量同步逻辑
            // 目前由 startIndexing() 中的持续监听处理
        } catch (Exception e) {
            logger.error("Error in scheduled sync", e);
        }
    }

    /**
     * 索引事件的主循环
     */
    private void indexEvents() {
        BigInteger lastProcessedBlock = BigInteger.ZERO;

        try {
            // 获取当前区块号
            BigInteger currentBlock = web3j.ethBlockNumber().send().getBlockNumber();
            logger.info("Current block: {}, Starting from: {}", currentBlock, lastProcessedBlock);

            // 如果 lastProcessedBlock 为 0，从当前区块开始（只监听新事件）
            if (lastProcessedBlock.equals(BigInteger.ZERO)) {
                lastProcessedBlock = currentBlock.subtract(BigInteger.ONE);
            }

        } catch (Exception e) {
            logger.error("Failed to get current block", e);
            return;
        }

        while (isRunning.get()) {
            try {
                // 获取最新区块
                BigInteger currentBlock = web3j.ethBlockNumber().send().getBlockNumber();

                if (currentBlock.compareTo(lastProcessedBlock) > 0) {
                    // 处理新区块
                    BigInteger fromBlock = lastProcessedBlock.add(BigInteger.ONE);
                    BigInteger toBlock = currentBlock;

                    logger.debug("Processing blocks {} to {}", fromBlock, toBlock);

                    // 监听 KYC 事件
                    if (kycRegistryAddress != null && !kycRegistryAddress.isEmpty()) {
                        processKYCEvents(fromBlock, toBlock);
                    }

                    // 监听 Custody 事件
                    if (custodyManagerAddress != null && !custodyManagerAddress.isEmpty()) {
                        processCustodyEvents(fromBlock, toBlock);
                    }

                    // 监听 Yield 事件
                    if (yieldDistributionAddress != null && !yieldDistributionAddress.isEmpty()) {
                        processYieldEvents(fromBlock, toBlock);
                    }

                    lastProcessedBlock = currentBlock;
                }

                // 等待 5 秒后再次检查
                Thread.sleep(5000);

            } catch (InterruptedException e) {
                logger.info("Event indexer interrupted");
                break;
            } catch (Exception e) {
                logger.error("Error in event indexing loop", e);
                try {
                    Thread.sleep(10000); // 出错后等待更长时间
                } catch (InterruptedException ie) {
                    break;
                }
            }
        }
    }

    /**
     * 处理 KYC 状态更新事件
     */
    private void processKYCEvents(BigInteger fromBlock, BigInteger toBlock) {
        try {
            // KYCStatusUpdated(address indexed user, Status indexed oldStatus, Status indexed newStatus)
            Event event = new Event(
                    "KYCStatusUpdated",
                    Arrays.asList(
                            TypeReference.create(org.web3j.abi.datatypes.Address.class, true),
                            TypeReference.create(org.web3j.abi.datatypes.generated.Uint8.class, true),
                            TypeReference.create(org.web3j.abi.datatypes.generated.Uint8.class, true)
                    )
            );

            String eventSignature = EventEncoder.encode(event);
            EthFilter filter = new EthFilter(
                    DefaultBlockParameter.valueOf(fromBlock),
                    DefaultBlockParameter.valueOf(toBlock),
                    kycRegistryAddress
            ).addSingleTopic(eventSignature);

            EthLog ethLog = web3j.ethGetLogs(filter).send();
            List<EthLog.LogResult> logs = ethLog.getLogs();

            for (EthLog.LogResult logResult : logs) {
                Log log = (Log) logResult.get();
                saveEvent("KYCStatusUpdated", kycRegistryAddress, log);
            }

        } catch (Exception e) {
            logger.error("Error processing KYC events", e);
        }
    }

    /**
     * 处理 Custody 事件
     */
    private void processCustodyEvents(BigInteger fromBlock, BigInteger toBlock) {
        try {
            // 监听多个事件：AssetRegistered, StatusUpdated, CustodyInfoUpdated, InsuranceInfoUpdated
            List<String> eventSignatures = Arrays.asList(
                    EventEncoder.encode(new Event("AssetRegistered", Arrays.asList(
                            TypeReference.create(org.web3j.abi.datatypes.generated.Bytes32.class, true),
                            TypeReference.create(org.web3j.abi.datatypes.Address.class, true),
                            TypeReference.create(org.web3j.abi.datatypes.generated.Bytes32.class, false),
                            TypeReference.create(org.web3j.abi.datatypes.generated.Bytes32.class, false)
                    ))),
                    EventEncoder.encode(new Event("StatusUpdated", Arrays.asList(
                            TypeReference.create(org.web3j.abi.datatypes.generated.Bytes32.class, true),
                            TypeReference.create(org.web3j.abi.datatypes.generated.Uint8.class, true),
                            TypeReference.create(org.web3j.abi.datatypes.generated.Uint8.class, true),
                            TypeReference.create(org.web3j.abi.datatypes.generated.Uint256.class, false)
                    )))
            );

            for (String eventSignature : eventSignatures) {
                EthFilter filter = new EthFilter(
                        DefaultBlockParameter.valueOf(fromBlock),
                        DefaultBlockParameter.valueOf(toBlock),
                        custodyManagerAddress
                ).addSingleTopic(eventSignature);

                EthLog ethLog = web3j.ethGetLogs(filter).send();
                List<EthLog.LogResult> logs = ethLog.getLogs();

                for (EthLog.LogResult logResult : logs) {
                    Log log = (Log) logResult.get();
                    String eventType = eventSignature.contains("AssetRegistered") ? "AssetRegistered" :
                                     eventSignature.contains("StatusUpdated") ? "StatusUpdated" :
                                     eventSignature.contains("CustodyInfoUpdated") ? "CustodyInfoUpdated" :
                                     "InsuranceInfoUpdated";
                    saveEvent(eventType, custodyManagerAddress, log);
                }
            }

        } catch (Exception e) {
            logger.error("Error processing Custody events", e);
        }
    }

    /**
     * 处理 Yield 事件
     */
    private void processYieldEvents(BigInteger fromBlock, BigInteger toBlock) {
        try {
            // DistributionCreated, DistributionCompleted, Claimed
            List<String> eventSignatures = Arrays.asList(
                    EventEncoder.encode(new Event("DistributionCreated", Arrays.asList(
                            TypeReference.create(org.web3j.abi.datatypes.generated.Bytes32.class, true),
                            TypeReference.create(org.web3j.abi.datatypes.Address.class, true),
                            TypeReference.create(org.web3j.abi.datatypes.generated.Uint8.class, true),
                            TypeReference.create(org.web3j.abi.datatypes.generated.Uint256.class, false)
                    ))),
                    EventEncoder.encode(new Event("Claimed", Arrays.asList(
                            TypeReference.create(org.web3j.abi.datatypes.generated.Bytes32.class, true),
                            TypeReference.create(org.web3j.abi.datatypes.Address.class, true),
                            TypeReference.create(org.web3j.abi.datatypes.generated.Uint256.class, false)
                    )))
            );

            for (String eventSignature : eventSignatures) {
                EthFilter filter = new EthFilter(
                        DefaultBlockParameter.valueOf(fromBlock),
                        DefaultBlockParameter.valueOf(toBlock),
                        yieldDistributionAddress
                ).addSingleTopic(eventSignature);

                EthLog ethLog = web3j.ethGetLogs(filter).send();
                List<EthLog.LogResult> logs = ethLog.getLogs();

                for (EthLog.LogResult logResult : logs) {
                    Log log = (Log) logResult.get();
                    String eventType = eventSignature.contains("DistributionCreated") ? "DistributionCreated" :
                                     eventSignature.contains("DistributionCompleted") ? "DistributionCompleted" :
                                     "Claimed";
                    saveEvent(eventType, yieldDistributionAddress, log);
                }
            }

        } catch (Exception e) {
            logger.error("Error processing Yield events", e);
        }
    }

    /**
     * 保存事件到数据库
     */
    private void saveEvent(String eventType, String contractAddress, Log log) {
        try {
            // 检查是否已存在
            String txHash = log.getTransactionHash();
            Integer logIndex = log.getLogIndex().intValue();
            
            if (eventRepository.findByTransactionHashAndLogIndex(txHash, logIndex).isPresent()) {
                logger.debug("Event already exists: txHash={}, logIndex={}", txHash, logIndex);
                return;
            }

            // 创建事件实体
            BlockchainEvent event = new BlockchainEvent();
            event.setId(java.util.UUID.randomUUID().toString());
            event.setEventType(eventType);
            event.setContractAddress(contractAddress);
            event.setTransactionHash(txHash);
            event.setBlockNumber(log.getBlockNumber().longValue());
            event.setLogIndex(logIndex);
            event.setProcessed(false);
            event.setCreatedAt(LocalDateTime.now());

            // 获取区块时间戳
            LocalDateTime blockTimestamp = getBlockTimestamp(log.getBlockNumber());
            event.setBlockTimestamp(blockTimestamp);

            // 保存事件数据（JSON格式）
            try {
                java.util.Map<String, Object> eventData = new java.util.HashMap<>();
                eventData.put("topics", log.getTopics());
                eventData.put("data", log.getData());
                event.setEventData(objectMapper.writeValueAsString(eventData));
            } catch (Exception e) {
                logger.warn("Failed to serialize event data", e);
            }

            eventRepository.save(event);
            logger.info("Saved event: type={}, txHash={}, blockNumber={}", eventType, txHash, log.getBlockNumber());

        } catch (Exception e) {
            logger.error("Failed to save event: type={}, txHash={}", eventType, log.getTransactionHash(), e);
        }
    }

    /**
     * 获取区块时间戳
     */
    private LocalDateTime getBlockTimestamp(BigInteger blockNumber) {
        try {
            EthBlock ethBlock = web3j.ethGetBlockByNumber(
                    DefaultBlockParameter.valueOf(blockNumber),
                    false
            ).send();

            if (ethBlock.getBlock() != null) {
                BigInteger timestamp = ethBlock.getBlock().getTimestamp();
                return LocalDateTime.ofInstant(
                        Instant.ofEpochSecond(timestamp.longValue()),
                        ZoneId.systemDefault()
                );
            }
        } catch (Exception e) {
            logger.error("Failed to get block timestamp for block {}", blockNumber, e);
        }
        return null;
    }
}


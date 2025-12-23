package com.mantleluxury.backend.blockchain.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import reactor.core.publisher.Mono;
import reactor.util.retry.Retry;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.time.Duration;
import java.time.Instant;
import java.util.*;

/**
 * The Graph 服务 - 查询链上事件数据
 */
@Service
public class TheGraphService {

    private static final Logger logger = LoggerFactory.getLogger(TheGraphService.class);

    private final WebClient webClient;
    private final ObjectMapper objectMapper;
    private final boolean enabled;
    private final String endpoint;

    public TheGraphService(
            @Value("${thegraph.enabled:false}") boolean enabled,
            @Value("${thegraph.endpoint:}") String endpoint,
            @Value("${thegraph.timeout-seconds:10}") int timeoutSeconds
    ) {
        this.enabled = enabled;
        this.endpoint = endpoint;
        this.objectMapper = new ObjectMapper();
        
        this.webClient = WebClient.builder()
                .baseUrl(endpoint)
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .build();
        
        logger.info("TheGraphService initialized. Enabled: {}, Endpoint: {}", enabled, endpoint);
    }

    /**
     * 查询 KYC 状态变更事件
     */
    public List<KYCStatusEvent> getKYCStatusEvents(String userAddress, Integer limit) {
        if (!enabled || endpoint == null || endpoint.isEmpty()) {
            logger.debug("The Graph is disabled or endpoint not configured");
            return Collections.emptyList();
        }

        String query = String.format("""
            {
              kycStatusEvents(
                where: { user: "%s" }
                orderBy: timestamp
                orderDirection: desc
                first: %d
              ) {
                id
                user
                oldStatus
                newStatus
                txHash
                blockNumber
                timestamp
              }
            }
            """, userAddress.toLowerCase(), limit != null ? limit : 100);

        try {
            JsonNode response = executeQuery(query);
            JsonNode events = response.path("data").path("kycStatusEvents");
            
            List<KYCStatusEvent> result = new ArrayList<>();
            if (events.isArray()) {
                for (JsonNode event : events) {
                    result.add(parseKYCStatusEvent(event));
                }
            }
            return result;
        } catch (Exception e) {
            logger.error("Failed to query KYC status events for {}", userAddress, e);
            return Collections.emptyList();
        }
    }

    /**
     * 查询收益分配创建事件
     */
    public List<YieldDistributionCreatedEvent> getYieldDistributionCreatedEvents(String tokenAddress, Integer limit) {
        if (!enabled || endpoint == null || endpoint.isEmpty()) {
            return Collections.emptyList();
        }

        String query = String.format("""
            {
              yieldDistributionCreateds(
                where: { tokenAddress: "%s" }
                orderBy: timestamp
                orderDirection: desc
                first: %d
              ) {
                id
                distributionId
                tokenAddress
                yieldType
                totalAmount
                txHash
                blockNumber
                timestamp
              }
            }
            """, tokenAddress.toLowerCase(), limit != null ? limit : 100);

        try {
            JsonNode response = executeQuery(query);
            JsonNode events = response.path("data").path("yieldDistributionCreateds");
            
            List<YieldDistributionCreatedEvent> result = new ArrayList<>();
            if (events.isArray()) {
                for (JsonNode event : events) {
                    result.add(parseYieldDistributionCreatedEvent(event));
                }
            }
            return result;
        } catch (Exception e) {
            logger.error("Failed to query yield distribution created events for {}", tokenAddress, e);
            return Collections.emptyList();
        }
    }

    /**
     * 查询收益领取事件
     */
    public List<YieldClaimedEvent> getYieldClaimedEvents(String distributionId, String userAddress, Integer limit) {
        if (!enabled || endpoint == null || endpoint.isEmpty()) {
            return Collections.emptyList();
        }

        StringBuilder whereClause = new StringBuilder();
        if (distributionId != null && !distributionId.isEmpty()) {
            whereClause.append("distributionId: \"").append(distributionId.toLowerCase()).append("\"");
        }
        if (userAddress != null && !userAddress.isEmpty()) {
            if (whereClause.length() > 0) whereClause.append(", ");
            whereClause.append("user: \"").append(userAddress.toLowerCase()).append("\"");
        }

        String query = String.format("""
            {
              yieldClaimeds(
                where: { %s }
                orderBy: timestamp
                orderDirection: desc
                first: %d
              ) {
                id
                distributionId
                user
                amount
                txHash
                blockNumber
                timestamp
              }
            }
            """, whereClause.toString(), limit != null ? limit : 100);

        try {
            JsonNode response = executeQuery(query);
            JsonNode events = response.path("data").path("yieldClaimeds");
            
            List<YieldClaimedEvent> result = new ArrayList<>();
            if (events.isArray()) {
                for (JsonNode event : events) {
                    result.add(parseYieldClaimedEvent(event));
                }
            }
            return result;
        } catch (Exception e) {
            logger.error("Failed to query yield claimed events", e);
            return Collections.emptyList();
        }
    }

    /**
     * 查询资产状态变更事件
     */
    public List<AssetStatusUpdatedEvent> getAssetStatusUpdatedEvents(String assetId, Integer limit) {
        if (!enabled || endpoint == null || endpoint.isEmpty()) {
            return Collections.emptyList();
        }

        String query = String.format("""
            {
              assetStatusUpdatedEvents(
                where: { assetId: "%s" }
                orderBy: timestamp
                orderDirection: desc
                first: %d
              ) {
                id
                assetId
                oldStatus
                newStatus
                timestamp
                txHash
                blockNumber
              }
            }
            """, assetId.toLowerCase(), limit != null ? limit : 100);

        try {
            JsonNode response = executeQuery(query);
            JsonNode events = response.path("data").path("assetStatusUpdatedEvents");
            
            List<AssetStatusUpdatedEvent> result = new ArrayList<>();
            if (events.isArray()) {
                for (JsonNode event : events) {
                    result.add(parseAssetStatusUpdatedEvent(event));
                }
            }
            return result;
        } catch (Exception e) {
            logger.error("Failed to query asset status updated events for {}", assetId, e);
            return Collections.emptyList();
        }
    }

    /**
     * 统计总收益分配次数和总金额（从链上事件）
     */
    public YieldStats getYieldStats() {
        if (!enabled || endpoint == null || endpoint.isEmpty()) {
            return new YieldStats(0, BigDecimal.ZERO, BigDecimal.ZERO);
        }

        String query = """
            {
              yieldDistributionCreateds(
                orderBy: timestamp
                orderDirection: desc
                first: 1000
              ) {
                totalAmount
              }
              yieldClaimeds(
                orderBy: timestamp
                orderDirection: desc
                first: 1000
              ) {
                amount
              }
            }
            """;

        try {
            JsonNode response = executeQuery(query);
            JsonNode createds = response.path("data").path("yieldDistributionCreateds");
            JsonNode claimeds = response.path("data").path("yieldClaimeds");

            int totalDistributions = createds.isArray() ? createds.size() : 0;
            BigDecimal totalAmount = BigDecimal.ZERO;
            BigDecimal totalClaimed = BigDecimal.ZERO;

            if (createds.isArray()) {
                for (JsonNode event : createds) {
                    String amountStr = event.path("totalAmount").asText();
                    if (amountStr != null && !amountStr.isEmpty()) {
                        try {
                            BigInteger amount = new BigInteger(amountStr);
                            totalAmount = totalAmount.add(new BigDecimal(amount).divide(new BigDecimal("1e18")));
                        } catch (Exception e) {
                            logger.warn("Failed to parse totalAmount: {}", amountStr);
                        }
                    }
                }
            }

            if (claimeds.isArray()) {
                for (JsonNode event : claimeds) {
                    String amountStr = event.path("amount").asText();
                    if (amountStr != null && !amountStr.isEmpty()) {
                        try {
                            BigInteger amount = new BigInteger(amountStr);
                            totalClaimed = totalClaimed.add(new BigDecimal(amount).divide(new BigDecimal("1e18")));
                        } catch (Exception e) {
                            logger.warn("Failed to parse amount: {}", amountStr);
                        }
                    }
                }
            }

            return new YieldStats(totalDistributions, totalAmount, totalClaimed);
        } catch (Exception e) {
            logger.error("Failed to get yield stats from The Graph", e);
            return new YieldStats(0, BigDecimal.ZERO, BigDecimal.ZERO);
        }
    }

    /**
     * 执行 GraphQL 查询
     */
    private JsonNode executeQuery(String query) {
        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("query", query);

        String responseBody = webClient.post()
                .bodyValue(requestBody)
                .retrieve()
                .bodyToMono(String.class)
                .timeout(Duration.ofSeconds(10))
                .retryWhen(Retry.backoff(2, Duration.ofSeconds(1))
                        .filter(throwable -> throwable instanceof WebClientResponseException))
                .block();

        if (responseBody == null) {
            throw new RuntimeException("Empty response from The Graph");
        }

        JsonNode root;
        try {
            // objectMapper.readTree throws checked JsonProcessingException/IOException
            // Wrap it into an unchecked exception so callers can handle it uniformly
            root = objectMapper.readTree(responseBody);
        } catch (Exception ex) {
            throw new RuntimeException("Failed to parse GraphQL response", ex);
        }

        if (root.has("errors")) {
            JsonNode errors = root.path("errors");
            logger.error("GraphQL errors: {}", errors.toString());
            throw new RuntimeException("GraphQL query failed: " + errors.toString());
        }

        return root;
    }

    private KYCStatusEvent parseKYCStatusEvent(JsonNode node) {
        return new KYCStatusEvent(
                node.path("id").asText(),
                node.path("user").asText(),
                node.path("oldStatus").asInt(),
                node.path("newStatus").asInt(),
                node.path("txHash").asText(),
                new BigInteger(node.path("blockNumber").asText()),
                new BigInteger(node.path("timestamp").asText())
        );
    }

    private YieldDistributionCreatedEvent parseYieldDistributionCreatedEvent(JsonNode node) {
        return new YieldDistributionCreatedEvent(
                node.path("id").asText(),
                node.path("distributionId").asText(),
                node.path("tokenAddress").asText(),
                node.path("yieldType").asInt(),
                new BigInteger(node.path("totalAmount").asText()),
                node.path("txHash").asText(),
                new BigInteger(node.path("blockNumber").asText()),
                new BigInteger(node.path("timestamp").asText())
        );
    }

    private YieldClaimedEvent parseYieldClaimedEvent(JsonNode node) {
        return new YieldClaimedEvent(
                node.path("id").asText(),
                node.path("distributionId").asText(),
                node.path("user").asText(),
                new BigInteger(node.path("amount").asText()),
                node.path("txHash").asText(),
                new BigInteger(node.path("blockNumber").asText()),
                new BigInteger(node.path("timestamp").asText())
        );
    }

    private AssetStatusUpdatedEvent parseAssetStatusUpdatedEvent(JsonNode node) {
        return new AssetStatusUpdatedEvent(
                node.path("id").asText(),
                node.path("assetId").asText(),
                node.path("oldStatus").asInt(),
                node.path("newStatus").asInt(),
                new BigInteger(node.path("timestamp").asText()),
                node.path("txHash").asText(),
                new BigInteger(node.path("blockNumber").asText())
        );
    }

    // DTOs
    public static class KYCStatusEvent {
        public final String id;
        public final String user;
        public final int oldStatus;
        public final int newStatus;
        public final String txHash;
        public final BigInteger blockNumber;
        public final BigInteger timestamp;

        public KYCStatusEvent(String id, String user, int oldStatus, int newStatus, String txHash, BigInteger blockNumber, BigInteger timestamp) {
            this.id = id;
            this.user = user;
            this.oldStatus = oldStatus;
            this.newStatus = newStatus;
            this.txHash = txHash;
            this.blockNumber = blockNumber;
            this.timestamp = timestamp;
        }
    }

    public static class YieldDistributionCreatedEvent {
        public final String id;
        public final String distributionId;
        public final String tokenAddress;
        public final int yieldType;
        public final BigInteger totalAmount;
        public final String txHash;
        public final BigInteger blockNumber;
        public final BigInteger timestamp;

        public YieldDistributionCreatedEvent(String id, String distributionId, String tokenAddress, int yieldType, BigInteger totalAmount, String txHash, BigInteger blockNumber, BigInteger timestamp) {
            this.id = id;
            this.distributionId = distributionId;
            this.tokenAddress = tokenAddress;
            this.yieldType = yieldType;
            this.totalAmount = totalAmount;
            this.txHash = txHash;
            this.blockNumber = blockNumber;
            this.timestamp = timestamp;
        }
    }

    public static class YieldClaimedEvent {
        public final String id;
        public final String distributionId;
        public final String user;
        public final BigInteger amount;
        public final String txHash;
        public final BigInteger blockNumber;
        public final BigInteger timestamp;

        public YieldClaimedEvent(String id, String distributionId, String user, BigInteger amount, String txHash, BigInteger blockNumber, BigInteger timestamp) {
            this.id = id;
            this.distributionId = distributionId;
            this.user = user;
            this.amount = amount;
            this.txHash = txHash;
            this.blockNumber = blockNumber;
            this.timestamp = timestamp;
        }
    }

    public static class AssetStatusUpdatedEvent {
        public final String id;
        public final String assetId;
        public final int oldStatus;
        public final int newStatus;
        public final BigInteger timestamp;
        public final String txHash;
        public final BigInteger blockNumber;

        public AssetStatusUpdatedEvent(String id, String assetId, int oldStatus, int newStatus, BigInteger timestamp, String txHash, BigInteger blockNumber) {
            this.id = id;
            this.assetId = assetId;
            this.oldStatus = oldStatus;
            this.newStatus = newStatus;
            this.timestamp = timestamp;
            this.txHash = txHash;
            this.blockNumber = blockNumber;
        }
    }

    public static class YieldStats {
        public final int totalDistributions;
        public final BigDecimal totalAmount;
        public final BigDecimal totalClaimed;

        public YieldStats(int totalDistributions, BigDecimal totalAmount, BigDecimal totalClaimed) {
            this.totalDistributions = totalDistributions;
            this.totalAmount = totalAmount;
            this.totalClaimed = totalClaimed;
        }
    }
}


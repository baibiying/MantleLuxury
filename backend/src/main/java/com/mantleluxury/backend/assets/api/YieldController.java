package com.mantleluxury.backend.assets.api;

import com.mantleluxury.backend.assets.domain.YieldDistribution;
import com.mantleluxury.backend.assets.service.YieldService;
import com.mantleluxury.backend.blockchain.service.TokenQueryService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 收益分配 API
 */
@RestController
@RequestMapping("/api/yields")
public class YieldController {

    private static final Logger logger = LoggerFactory.getLogger(YieldController.class);

    private final YieldService yieldService;
    private final TokenQueryService tokenQueryService;

    public YieldController(YieldService yieldService, TokenQueryService tokenQueryService) {
        this.yieldService = yieldService;
        this.tokenQueryService = tokenQueryService;
    }

    /**
     * 获取所有收益分配记录
     */
    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> getAllYields() {
        try {
            List<YieldDistribution> yields = yieldService.getAllYields();
            List<Map<String, Object>> result = yields.stream()
                    .map(this::toDto)
                    .collect(Collectors.toList());
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            logger.error("Failed to get yields", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(List.of(Map.of("error", e.getMessage())));
        }
    }

    /**
     * 获取最近的收益分配记录
     */
    @GetMapping("/recent")
    public ResponseEntity<List<Map<String, Object>>> getRecentYields(
            @RequestParam(defaultValue = "5") int limit
    ) {
        try {
            List<YieldDistribution> yields = yieldService.getRecentYields(limit);
            List<Map<String, Object>> result = yields.stream()
                    .map(this::toDto)
                    .collect(Collectors.toList());
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            logger.error("Failed to get recent yields", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(List.of(Map.of("error", e.getMessage())));
        }
    }

    /**
     * 获取用户的收益记录
     */
    @GetMapping("/user/{userAddress}")
    public ResponseEntity<List<Map<String, Object>>> getUserYields(
            @PathVariable String userAddress
    ) {
        try {
            List<YieldDistribution> yields = yieldService.getUserYields(userAddress);
            List<Map<String, Object>> result = yields.stream()
                    .map(yield -> toDto(yield, userAddress))
                    .collect(Collectors.toList());
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            logger.error("Failed to get user yields", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(List.of(Map.of("error", e.getMessage())));
        }
    }

    /**
     * 获取资产的所有收益分配记录
     */
    @GetMapping("/asset/{assetId}")
    public ResponseEntity<List<Map<String, Object>>> getAssetYields(
            @PathVariable String assetId
    ) {
        try {
            List<YieldDistribution> yields = yieldService.getAssetYields(assetId);
            List<Map<String, Object>> result = yields.stream()
                    .map(this::toDto)
                    .collect(Collectors.toList());
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            logger.error("Failed to get asset yields", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(List.of(Map.of("error", e.getMessage())));
        }
    }

    /**
     * 创建收益分配记录（仅链下，不触发链上合约）
     */
    @PostMapping("/create")
    public ResponseEntity<?> createDistribution(@RequestBody Map<String, Object> payload) {
        try {
            String assetId = (String) payload.get("assetId");
            String yieldType = (String) payload.getOrDefault("yieldType", "appreciation");
            BigDecimal totalAmount = new BigDecimal(String.valueOf(payload.get("totalAmount")));

            if (assetId == null || totalAmount == null) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "assetId and totalAmount are required"));
            }

            YieldDistribution distribution = yieldService.createDistribution(assetId, yieldType, totalAmount);
            return ResponseEntity.status(HttpStatus.CREATED).body(toDto(distribution));
        } catch (Exception e) {
            logger.error("Failed to create distribution", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * 在链上创建收益分配（调用合约）
     */
    @PostMapping("/{distributionId}/create-on-chain")
    public ResponseEntity<?> createDistributionOnChain(@PathVariable String distributionId) {
        try {
            String txHash = yieldService.createDistributionOnChain(distributionId);
            return ResponseEntity.ok(Map.of("transactionHash", txHash));
        } catch (Exception e) {
            logger.error("Failed to create distribution on chain", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * 转换为 DTO（不包含用户实际应得收益）
     */
    private Map<String, Object> toDto(YieldDistribution distribution) {
        return toDto(distribution, null);
    }

    /**
     * 转换为 DTO（包含用户实际应得收益）
     * @param distribution 收益分配记录
     * @param userAddress 用户地址（如果为 null，则不计算用户应得收益）
     */
    private Map<String, Object> toDto(YieldDistribution distribution, String userAddress) {
        Map<String, Object> dto = new java.util.HashMap<>();
        dto.put("id", distribution.getId());
        dto.put("distributionIdBytes32", distribution.getDistributionIdBytes32());
        dto.put("assetId", distribution.getAssetId());
        dto.put("tokenAddress", distribution.getTokenAddress());
        dto.put("yieldType", distribution.getYieldType());
        dto.put("totalAmount", distribution.getTotalAmount());
        dto.put("distributedAmount", distribution.getDistributedAmount());
        dto.put("isCompleted", distribution.getIsCompleted());
        dto.put("transactionHash", distribution.getTransactionHash());
        dto.put("createdAt", distribution.getCreatedAt());
        dto.put("completedAt", distribution.getCompletedAt());

        // 如果提供了用户地址，计算用户实际应得的收益
        if (userAddress != null && !userAddress.trim().isEmpty() && distribution.getTokenAddress() != null) {
            try {
                // 查询用户在代币合约中的余额
                BigInteger userBalance = tokenQueryService.getUserBalance(
                        distribution.getTokenAddress(),
                        userAddress.trim().toLowerCase()
                );

                // 查询代币总供应量
                BigInteger totalSupply = tokenQueryService.getTotalSupply(distribution.getTokenAddress());

                if (userBalance != null && totalSupply != null && totalSupply.compareTo(BigInteger.ZERO) > 0) {
                    // 计算用户应得的收益：userShare = (totalAmount * userBalance) / totalSupply
                    BigDecimal totalAmount = distribution.getTotalAmount();
                    BigDecimal userBalanceDecimal = tokenQueryService.weiToTokens(userBalance);
                    BigDecimal totalSupplyDecimal = tokenQueryService.weiToTokens(totalSupply);

                    if (totalSupplyDecimal.compareTo(BigDecimal.ZERO) > 0) {
                        BigDecimal userShare = totalAmount
                                .multiply(userBalanceDecimal)
                                .divide(totalSupplyDecimal, 18, java.math.RoundingMode.HALF_UP);
                        dto.put("userShare", userShare);
                    } else {
                        dto.put("userShare", BigDecimal.ZERO);
                    }
                } else {
                    // 如果查询失败或用户没有持有代币，用户应得收益为 0
                    dto.put("userShare", BigDecimal.ZERO);
                }
            } catch (Exception e) {
                logger.warn("Failed to calculate user share for distribution {}: {}", 
                        distribution.getId(), e.getMessage());
                dto.put("userShare", BigDecimal.ZERO);
            }
        }

        return dto;
    }
}






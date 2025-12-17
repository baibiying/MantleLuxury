package com.mantleluxury.backend.assets.api;

import com.mantleluxury.backend.assets.domain.YieldDistribution;
import com.mantleluxury.backend.assets.service.YieldService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 收益分配 API
 */
@RestController
@RequestMapping("/api/yields")
@CrossOrigin(origins = "http://localhost:3000")
public class YieldController {

    private static final Logger logger = LoggerFactory.getLogger(YieldController.class);

    private final YieldService yieldService;

    public YieldController(YieldService yieldService) {
        this.yieldService = yieldService;
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
                    .map(this::toDto)
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
     * 转换为 DTO
     */
    private Map<String, Object> toDto(YieldDistribution distribution) {
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
        return dto;
    }
}



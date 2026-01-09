package com.mantleluxury.backend.assets.api;

import com.mantleluxury.backend.assets.domain.YieldDistribution;
import com.mantleluxury.backend.assets.service.YieldService;
import com.mantleluxury.backend.config.AdminConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 收益分配管理后台接口（仅管理员）
 */
@RestController
@RequestMapping("/api/admin/yields")
public class AdminYieldController {

    private static final Logger logger = LoggerFactory.getLogger(AdminYieldController.class);

    private final YieldService yieldService;
    private final AdminConfig adminConfig;

    public AdminYieldController(
            YieldService yieldService,
            AdminConfig adminConfig
    ) {
        this.yieldService = yieldService;
        this.adminConfig = adminConfig;
    }

    /**
     * 检查管理员权限
     */
    private ResponseEntity<?> checkAdminPermission(String walletAddress) {
        if (walletAddress == null || walletAddress.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Wallet address is required"));
        }
        String normalizedAddress = walletAddress.toLowerCase();
        if (!adminConfig.isAdmin(normalizedAddress)) {
            logger.warn("Unauthorized access attempt for yield admin from: {} (normalized: {})", walletAddress, normalizedAddress);
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of(
                            "error", "Access denied. Admin privileges required.",
                            "providedAddress", normalizedAddress
                    ));
        }
        return null;
    }

    /**
     * 获取所有收益分配记录（按创建时间倒序）
     */
    @GetMapping
    public ResponseEntity<?> getAllYields(
            @RequestHeader(value = "X-Wallet-Address", required = false) String walletAddress
    ) {
        ResponseEntity<?> permissionCheck = checkAdminPermission(walletAddress);
        if (permissionCheck != null) {
            return permissionCheck;
        }

        List<YieldDistribution> yields = yieldService.getAllYields();
        List<Map<String, Object>> result = yields.stream()
                .map(this::toDto)
                .collect(Collectors.toList());
        return ResponseEntity.ok(result);
    }

    /**
     * 获取收益分配统计信息
     */
    @GetMapping("/stats")
    public ResponseEntity<?> getStats(
            @RequestHeader(value = "X-Wallet-Address", required = false) String walletAddress
    ) {
        ResponseEntity<?> permissionCheck = checkAdminPermission(walletAddress);
        if (permissionCheck != null) {
            return permissionCheck;
        }

        List<YieldDistribution> all = yieldService.getAllYields();
        long total = all.size();
        long completed = all.stream().filter(YieldDistribution::getIsCompleted).count();
        long pending = total - completed;
        
        // 分别计算已完成和进行中的金额
        BigDecimal completedAmount = all.stream()
                .filter(YieldDistribution::getIsCompleted)
                .map(YieldDistribution::getTotalAmount)
                .filter(a -> a != null)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal pendingAmount = all.stream()
                .filter(y -> !Boolean.TRUE.equals(y.getIsCompleted()))
                .map(YieldDistribution::getTotalAmount)
                .filter(a -> a != null)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        
        BigDecimal totalAmount = completedAmount.add(pendingAmount);
        BigDecimal distributedAmount = all.stream()
                .map(YieldDistribution::getDistributedAmount)
                .filter(a -> a != null)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        Map<String, Object> stats = new HashMap<>();
        stats.put("total", total);
        stats.put("completed", completed);
        stats.put("pending", pending);
        stats.put("totalAmount", totalAmount);
        stats.put("completedAmount", completedAmount);
        stats.put("pendingAmount", pendingAmount);
        stats.put("distributedAmount", distributedAmount);

        return ResponseEntity.ok(stats);
    }

    /**
     * 创建收益分配记录（链下）
     */
    @PostMapping("/create")
    public ResponseEntity<?> createDistribution(
            @RequestBody Map<String, Object> payload,
            @RequestHeader(value = "X-Wallet-Address", required = false) String walletAddress
    ) {
        ResponseEntity<?> permissionCheck = checkAdminPermission(walletAddress);
        if (permissionCheck != null) {
            return permissionCheck;
        }

        try {
            String assetId = (String) payload.get("assetId");
            String yieldType = (String) payload.getOrDefault("yieldType", "appreciation");
            Object totalAmountRaw = payload.get("totalAmount");
            if (assetId == null || totalAmountRaw == null) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "assetId and totalAmount are required"));
            }
            BigDecimal totalAmount = new BigDecimal(String.valueOf(totalAmountRaw));

            YieldDistribution distribution = yieldService.createDistribution(assetId, yieldType, totalAmount);
            logger.info("Admin {} created yield distribution {} for asset {}", walletAddress, distribution.getId(), assetId);
            return ResponseEntity.status(HttpStatus.CREATED).body(toDto(distribution));
        } catch (Exception e) {
            logger.error("Failed to create distribution by admin", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * 在链上创建收益分配（调用合约）
     */
    @PostMapping("/{distributionId}/create-on-chain")
    public ResponseEntity<?> createDistributionOnChain(
            @PathVariable String distributionId,
            @RequestHeader(value = "X-Wallet-Address", required = false) String walletAddress
    ) {
        ResponseEntity<?> permissionCheck = checkAdminPermission(walletAddress);
        if (permissionCheck != null) {
            return permissionCheck;
        }

        try {
            String txHash = yieldService.createDistributionOnChain(distributionId);
            java.util.Map<String, Object> result = new java.util.HashMap<>();
            result.put("distributionId", distributionId);
            // txHash 可能为 null，这里允许为空返回给前端，而不是抛 NPE
            result.put("transactionHash", txHash);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            logger.error("Failed to create distribution on chain by admin, id={}", distributionId, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * 在链上执行收益分配（调用合约 distribute），并在本地标记为已完成
     */
    @PostMapping("/{distributionId}/distribute-on-chain")
    public ResponseEntity<?> distributeOnChain(
            @PathVariable String distributionId,
            @RequestHeader(value = "X-Wallet-Address", required = false) String walletAddress
    ) {
        ResponseEntity<?> permissionCheck = checkAdminPermission(walletAddress);
        if (permissionCheck != null) {
            return permissionCheck;
        }

        try {
            String txHash = yieldService.distributeOnChain(distributionId);
            java.util.Map<String, Object> result = new java.util.HashMap<>();
            result.put("distributionId", distributionId);
            result.put("transactionHash", txHash);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            logger.error("Failed to execute distribution on chain by admin, id={}", distributionId, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * 转换为 DTO
     */
    private Map<String, Object> toDto(YieldDistribution distribution) {
        Map<String, Object> dto = new HashMap<>();
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



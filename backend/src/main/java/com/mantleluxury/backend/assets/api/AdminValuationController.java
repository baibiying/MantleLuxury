package com.mantleluxury.backend.assets.api;

import com.mantleluxury.backend.assets.domain.Valuation;
import com.mantleluxury.backend.assets.service.ValuationService;
import com.mantleluxury.backend.config.AdminConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * 估值报告管理后台API（仅管理员）
 */
@RestController
@RequestMapping("/api/admin/valuations")
@CrossOrigin(origins = "http://localhost:3000")
public class AdminValuationController {

    private static final Logger logger = LoggerFactory.getLogger(AdminValuationController.class);

    private final ValuationService valuationService;
    private final AdminConfig adminConfig;

    public AdminValuationController(
            ValuationService valuationService,
            AdminConfig adminConfig
    ) {
        this.valuationService = valuationService;
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
            logger.warn("Unauthorized access attempt for valuation admin from: {}", normalizedAddress);
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "Access denied. Admin privileges required."));
        }
        return null;
    }

    /**
     * 创建估值记录
     */
    @PostMapping
    public ResponseEntity<?> createValuation(
            @RequestBody Map<String, Object> payload,
            @RequestHeader(value = "X-Wallet-Address", required = false) String walletAddress
    ) {
        ResponseEntity<?> permissionCheck = checkAdminPermission(walletAddress);
        if (permissionCheck != null) {
            return permissionCheck;
        }

        try {
            String assetId = (String) payload.get("assetId");
            Object amountRaw = payload.get("valuationAmount");
            String currency = (String) payload.getOrDefault("valuationCurrency", "USD");
            Object dateRaw = payload.get("valuationDate");
            String agency = (String) payload.get("valuationAgency");
            String reportUrl = (String) payload.get("reportUrl");

            if (assetId == null || amountRaw == null) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "assetId and valuationAmount are required"));
            }

            BigDecimal valuationAmount = new BigDecimal(String.valueOf(amountRaw));
            LocalDate valuationDate = dateRaw != null 
                    ? LocalDate.parse(String.valueOf(dateRaw))
                    : LocalDate.now();

            Valuation valuation = valuationService.createValuation(
                    assetId, valuationAmount, currency, valuationDate, agency, reportUrl
            );

            logger.info("Admin {} created valuation {} for asset {}", walletAddress, valuation.getId(), assetId);
            return ResponseEntity.status(HttpStatus.CREATED).body(valuation);
        } catch (Exception e) {
            logger.error("Failed to create valuation by admin", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * 更新估值记录
     */
    @PutMapping("/{valuationId}")
    public ResponseEntity<?> updateValuation(
            @PathVariable String valuationId,
            @RequestBody Map<String, Object> payload,
            @RequestHeader(value = "X-Wallet-Address", required = false) String walletAddress
    ) {
        ResponseEntity<?> permissionCheck = checkAdminPermission(walletAddress);
        if (permissionCheck != null) {
            return permissionCheck;
        }

        try {
            Object amountRaw = payload.get("valuationAmount");
            String currency = (String) payload.get("valuationCurrency");
            Object dateRaw = payload.get("valuationDate");
            String agency = (String) payload.get("valuationAgency");
            String reportUrl = (String) payload.get("reportUrl");

            BigDecimal valuationAmount = amountRaw != null 
                    ? new BigDecimal(String.valueOf(amountRaw))
                    : null;
            LocalDate valuationDate = dateRaw != null 
                    ? LocalDate.parse(String.valueOf(dateRaw))
                    : null;

            Valuation valuation = valuationService.updateValuation(
                    valuationId, valuationAmount, currency, valuationDate, agency, reportUrl
            );

            logger.info("Admin {} updated valuation {}", walletAddress, valuationId);
            return ResponseEntity.ok(valuation);
        } catch (Exception e) {
            logger.error("Failed to update valuation by admin", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * 获取资产的所有估值记录
     */
    @GetMapping("/asset/{assetId}")
    public ResponseEntity<?> getAssetValuations(
            @PathVariable String assetId,
            @RequestHeader(value = "X-Wallet-Address", required = false) String walletAddress
    ) {
        ResponseEntity<?> permissionCheck = checkAdminPermission(walletAddress);
        if (permissionCheck != null) {
            return permissionCheck;
        }

        List<Valuation> valuations = valuationService.getValuationsByAssetId(assetId);
        return ResponseEntity.ok(valuations);
    }

    /**
     * 删除估值记录
     */
    @DeleteMapping("/{valuationId}")
    public ResponseEntity<?> deleteValuation(
            @PathVariable String valuationId,
            @RequestHeader(value = "X-Wallet-Address", required = false) String walletAddress
    ) {
        ResponseEntity<?> permissionCheck = checkAdminPermission(walletAddress);
        if (permissionCheck != null) {
            return permissionCheck;
        }

        try {
            valuationService.deleteValuation(valuationId);
            logger.info("Admin {} deleted valuation {}", walletAddress, valuationId);
            return ResponseEntity.ok(Map.of("message", "Valuation deleted successfully"));
        } catch (Exception e) {
            logger.error("Failed to delete valuation by admin", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }
}



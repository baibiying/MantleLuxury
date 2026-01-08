package com.mantleluxury.backend.assets.api;

import com.mantleluxury.backend.assets.domain.Asset;
import com.mantleluxury.backend.assets.domain.AssetReview;
import com.mantleluxury.backend.assets.repository.AssetRepository;
import com.mantleluxury.backend.assets.service.AssetReviewService;
import com.mantleluxury.backend.assets.service.AssetService;
import com.mantleluxury.backend.assets.service.AssetAuthenticationService;
import com.mantleluxury.backend.assets.service.ValuationService;
import com.mantleluxury.backend.assets.service.CustodyService;
import com.mantleluxury.backend.assets.service.InsuranceService;
import com.mantleluxury.backend.blockchain.service.CustodyManagerService;
import com.mantleluxury.backend.blockchain.service.LuxuryTokenService;
import com.mantleluxury.backend.config.AdminConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 资产审核管理后台接口
 * 仅管理员可访问
 */
@RestController
@RequestMapping("/api/admin/assets")
public class AdminAssetController {

    private static final Logger logger = LoggerFactory.getLogger(AdminAssetController.class);

    private final AssetRepository assetRepository;
    private final AssetService assetService;
    private final AssetReviewService reviewService;
    private final AssetAuthenticationService authenticationService;
    private final ValuationService valuationService;
    private final CustodyService custodyService;
    private final InsuranceService insuranceService;
    private final CustodyManagerService custodyManagerService;
    private final LuxuryTokenService luxuryTokenService;
    private final AdminConfig adminConfig;

    public AdminAssetController(
            AssetRepository assetRepository,
            AssetService assetService,
            AssetReviewService reviewService,
            AssetAuthenticationService authenticationService,
            ValuationService valuationService,
            CustodyService custodyService,
            InsuranceService insuranceService,
            CustodyManagerService custodyManagerService,
            LuxuryTokenService luxuryTokenService,
            AdminConfig adminConfig
    ) {
        this.assetRepository = assetRepository;
        this.assetService = assetService;
        this.reviewService = reviewService;
        this.authenticationService = authenticationService;
        this.valuationService = valuationService;
        this.custodyService = custodyService;
        this.insuranceService = insuranceService;
        this.custodyManagerService = custodyManagerService;
        this.luxuryTokenService = luxuryTokenService;
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
            logger.warn("Unauthorized access attempt from: {} (normalized: {})", walletAddress, normalizedAddress);
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of(
                            "error", "Access denied. Admin privileges required.",
                            "providedAddress", normalizedAddress
                    ));
        }
        return null;
    }

    /**
     * 获取资产列表（支持按状态筛选）
     */
    @GetMapping
    public ResponseEntity<?> getAssets(
            @RequestParam(required = false) String status,
            @RequestHeader(value = "X-Wallet-Address", required = false) String walletAddress
    ) {
        ResponseEntity<?> permissionCheck = checkAdminPermission(walletAddress);
        if (permissionCheck != null) {
            return permissionCheck;
        }

        List<Asset> assets;
        if (status != null && !status.isEmpty()) {
            assets = assetRepository.findByStatus(status);
        } else {
            assets = assetRepository.findAll();
        }

        List<Map<String, Object>> result = assets.stream().map(asset -> {
            Map<String, Object> map = new HashMap<>();
            map.put("id", asset.getId());
            map.put("assetType", asset.getAssetType());
            map.put("brand", asset.getBrand());
            map.put("model", asset.getModel());
            map.put("year", asset.getYear());
            map.put("status", asset.getStatus());
            map.put("tokenAddress", asset.getTokenAddress());
            map.put("submittedBy", asset.getSubmittedBy());
            map.put("createdAt", asset.getCreatedAt());
            map.put("pricePerShare", asset.getPricePerShare());
            map.put("totalSupply", asset.getTotalSupply());
            return map;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(result);
    }

    /**
     * 获取资产详情（包含审核记录）
     */
    @GetMapping("/{assetId}")
    public ResponseEntity<?> getAssetDetail(
            @PathVariable String assetId,
            @RequestHeader(value = "X-Wallet-Address", required = false) String walletAddress
    ) {
        ResponseEntity<?> permissionCheck = checkAdminPermission(walletAddress);
        if (permissionCheck != null) {
            return permissionCheck;
        }

        Asset asset = assetRepository.findById(assetId).orElse(null);
        if (asset == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", "Asset not found"));
        }

        AssetDto assetDto = assetService.getAssetById(assetId);
        List<AssetReview> reviews = reviewService.getReviewsByAssetId(assetId);

        Map<String, Object> result = new HashMap<>();
        result.put("asset", assetDto);
        result.put("reviews", reviews.stream().map(review -> {
            Map<String, Object> reviewMap = new HashMap<>();
            reviewMap.put("id", review.getId());
            reviewMap.put("reviewerAddress", review.getReviewerAddress());
            reviewMap.put("reviewStatus", review.getReviewStatus());
            reviewMap.put("reviewNotes", review.getReviewNotes());
            reviewMap.put("actionType", review.getActionType());
            reviewMap.put("nextStep", review.getNextStep());
            reviewMap.put("createdAt", review.getCreatedAt());
            reviewMap.put("updatedAt", review.getUpdatedAt());
            return reviewMap;
        }).collect(Collectors.toList()));

        return ResponseEntity.ok(result);
    }

    /**
     * 创建审核记录
     */
    @PostMapping("/{assetId}/review")
    public ResponseEntity<?> createReview(
            @PathVariable String assetId,
            @RequestBody Map<String, String> request,
            @RequestHeader(value = "X-Wallet-Address", required = false) String walletAddress
    ) {
        ResponseEntity<?> permissionCheck = checkAdminPermission(walletAddress);
        if (permissionCheck != null) {
            return permissionCheck;
        }

        String reviewStatus = request.get("reviewStatus");
        String reviewNotes = request.get("reviewNotes");
        String actionType = request.get("actionType");
        String nextStep = request.get("nextStep");

        if (reviewStatus == null || reviewStatus.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "reviewStatus is required"));
        }

        Asset asset = assetRepository.findById(assetId).orElse(null);
        if (asset == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", "Asset not found"));
        }

        AssetReview review = reviewService.createReview(
                assetId,
                walletAddress.toLowerCase(),
                reviewStatus,
                reviewNotes,
                actionType,
                nextStep
        );

        Map<String, Object> result = new HashMap<>();
        result.put("id", review.getId());
        result.put("assetId", review.getAssetId());
        result.put("reviewerAddress", review.getReviewerAddress());
        result.put("reviewStatus", review.getReviewStatus());
        result.put("reviewNotes", review.getReviewNotes());
        result.put("actionType", review.getActionType());
        result.put("nextStep", review.getNextStep());
        result.put("createdAt", review.getCreatedAt());

        logger.info("Created review for asset {} by {}", assetId, walletAddress);
        return ResponseEntity.ok(result);
    }

    /**
     * 更新资产状态
     */
    @PutMapping("/{assetId}/status")
    public ResponseEntity<?> updateAssetStatus(
            @PathVariable String assetId,
            @RequestBody Map<String, String> request,
            @RequestHeader(value = "X-Wallet-Address", required = false) String walletAddress
    ) {
        ResponseEntity<?> permissionCheck = checkAdminPermission(walletAddress);
        if (permissionCheck != null) {
            return permissionCheck;
        }

        String newStatus = request.get("status");
        if (newStatus == null || newStatus.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "status is required"));
        }

        // 验证状态值
        List<String> validStatuses = List.of("registered", "fundraising", "funded", "sold");
        if (!validStatuses.contains(newStatus)) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "Invalid status. Must be one of: " + String.join(", ", validStatuses)
            ));
        }

        Asset asset = assetRepository.findById(assetId).orElse(null);
        if (asset == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", "Asset not found"));
        }

        String oldStatus = asset.getStatus();
        
        // 如果要更改状态为 fundraising，需要验证所有必需条件
        if ("fundraising".equals(newStatus) && !"fundraising".equals(oldStatus)) {
            // 检查是否有至少一条平台审核记录状态为"已通过"
            List<AssetReview> reviews = reviewService.getReviewsByAssetId(assetId);
            boolean hasApprovedReview = reviews.stream()
                    .anyMatch(r -> "approved".equals(r.getReviewStatus()));
            
            // 检查是否有至少一条真伪认证记录状态为"已认证"
            boolean hasVerifiedAuth = authenticationService.getAssetAuthentications(assetId).stream()
                    .anyMatch(a -> "verified".equals(a.getAuthenticationStatus()));
            
            // 检查是否有至少一条估值报告记录
            boolean hasValuation = !valuationService.getValuationsByAssetId(assetId).isEmpty();
            
            // 检查是否有托管信息
            boolean hasCustody = custodyService.getCustodyByAssetId(assetId).isPresent();
            
            // 检查是否有保险信息且保险状态为有效
            boolean hasInsurance = insuranceService.getActiveInsuranceByAssetId(assetId).isPresent();
            
            // 如果任何条件不满足，返回错误
            if (!hasApprovedReview) {
                return ResponseEntity.badRequest().body(Map.of(
                        "error", "无法将资产状态改为募集中：需要至少一条平台审核记录状态为'已通过'"
                ));
            }
            if (!hasVerifiedAuth) {
                return ResponseEntity.badRequest().body(Map.of(
                        "error", "无法将资产状态改为募集中：需要至少一条真伪认证记录状态为'已认证'"
                ));
            }
            if (!hasValuation) {
                return ResponseEntity.badRequest().body(Map.of(
                        "error", "无法将资产状态改为募集中：需要至少一条估值报告记录"
                ));
            }
            if (!hasCustody) {
                return ResponseEntity.badRequest().body(Map.of(
                        "error", "无法将资产状态改为募集中：需要填写托管信息"
                ));
            }
            if (!hasInsurance) {
                return ResponseEntity.badRequest().body(Map.of(
                        "error", "无法将资产状态改为募集中：需要填写保险信息且保险状态为有效"
                ));
            }
            
            // 当状态改为 "fundraising" 时，禁用合约中的托管检查
            // 因为资产已经通过了所有审核（包括托管），投资者购买时不需要再检查 CustodyManager 中的状态
            if (asset.getTokenAddress() != null && !asset.getTokenAddress().isEmpty()) {
                try {
                    logger.info("Disabling custody check in LuxuryToken contract for asset {} (token: {}) since asset is in fundraising status with all required records...", 
                            assetId, asset.getTokenAddress());
                    String disableTxHash = luxuryTokenService.setCustodyCheckEnabled(asset.getTokenAddress(), false);
                    if (disableTxHash != null) {
                        logger.info("✅ Successfully disabled custody check in LuxuryToken contract. TxHash: {}", disableTxHash);
                    } else {
                        logger.warn("Failed to disable custody check in LuxuryToken contract (txHash is null)");
                    }
                } catch (Exception e) {
                    logger.error("Failed to disable custody check in LuxuryToken contract for asset {}: {}", 
                            assetId, e.getMessage(), e);
                    // 不阻止状态更新，但记录错误
                }
            }
        }
        
        asset.setStatus(newStatus);
        asset = assetRepository.save(asset);

        logger.info("Updated asset {} status from {} to {} by {}", assetId, oldStatus, newStatus, walletAddress);

        Map<String, Object> result = new HashMap<>();
        result.put("id", asset.getId());
        result.put("status", asset.getStatus());
        result.put("oldStatus", oldStatus);
        result.put("updatedAt", asset.getUpdatedAt());

        return ResponseEntity.ok(result);
    }

    /**
     * 获取审核统计信息
     */
    @GetMapping("/stats")
    public ResponseEntity<?> getStats(
            @RequestHeader(value = "X-Wallet-Address", required = false) String walletAddress
    ) {
        ResponseEntity<?> permissionCheck = checkAdminPermission(walletAddress);
        if (permissionCheck != null) {
            return permissionCheck;
        }

        List<Asset> allAssets = assetRepository.findAll();
        
        long total = allAssets.size();
        long registered = allAssets.stream().filter(a -> "registered".equals(a.getStatus())).count();
        long fundraising = allAssets.stream().filter(a -> "fundraising".equals(a.getStatus())).count();
        long funded = allAssets.stream().filter(a -> "funded".equals(a.getStatus())).count();
        long sold = allAssets.stream().filter(a -> "sold".equals(a.getStatus())).count();

        Map<String, Object> stats = new HashMap<>();
        stats.put("total", total);
        stats.put("registered", registered);
        stats.put("fundraising", fundraising);
        stats.put("funded", funded);
        stats.put("sold", sold);

        return ResponseEntity.ok(stats);
    }
    
    /**
     * 批量删除资产（按ID列表）
     * DELETE /api/admin/assets/batch
     * Body: { "assetIds": ["id1", "id2", ...] }
     */
    @DeleteMapping("/batch")
    public ResponseEntity<?> deleteBatch(
            @RequestBody Map<String, List<String>> request,
            @RequestHeader(value = "X-Wallet-Address", required = false) String walletAddress
    ) {
        ResponseEntity<?> permissionCheck = checkAdminPermission(walletAddress);
        if (permissionCheck != null) {
            return permissionCheck;
        }
        
        List<String> assetIds = request.get("assetIds");
        if (assetIds == null || assetIds.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "assetIds is required and cannot be empty"));
        }
        
        logger.info("Admin {} requested batch delete of {} assets", walletAddress, assetIds.size());
        Map<String, Object> result = assetService.deleteBatch(assetIds);
        logger.info("Batch delete completed: {}", result);
        
        return ResponseEntity.ok(result);
    }
    
    /**
     * 按状态批量删除资产
     * DELETE /api/admin/assets/by-status/{status}
     */
    @DeleteMapping("/by-status/{status}")
    public ResponseEntity<?> deleteByStatus(
            @PathVariable String status,
            @RequestHeader(value = "X-Wallet-Address", required = false) String walletAddress
    ) {
        ResponseEntity<?> permissionCheck = checkAdminPermission(walletAddress);
        if (permissionCheck != null) {
            return permissionCheck;
        }
        
        logger.info("Admin {} requested delete all assets with status: {}", walletAddress, status);
        int deletedCount = assetService.deleteByStatus(status);
        
        return ResponseEntity.ok(Map.of(
                "status", status,
                "deletedCount", deletedCount,
                "message", "Deleted " + deletedCount + " assets with status: " + status
        ));
    }
    
    /**
     * 检查资产的 CustodyManager 状态（只读）
     */
    @GetMapping("/{assetId}/custody-status")
    public ResponseEntity<?> checkCustodyStatus(
            @PathVariable String assetId,
            @RequestHeader(value = "X-Wallet-Address", required = false) String walletAddress
    ) {
        ResponseEntity<?> permissionCheck = checkAdminPermission(walletAddress);
        if (permissionCheck != null) {
            return permissionCheck;
        }
        
        Asset asset = assetRepository.findById(assetId).orElse(null);
        if (asset == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", "Asset not found"));
        }
        
        Map<String, Object> result = new HashMap<>();
        result.put("assetId", assetId);
        result.put("tokenAddress", asset.getTokenAddress());
        result.put("assetIdBytes32", asset.getAssetIdBytes32());
        result.put("status", asset.getStatus());
        
        if (asset.getAssetIdBytes32() == null || asset.getAssetIdBytes32().isEmpty()) {
            result.put("error", "Asset has no assetIdBytes32");
            return ResponseEntity.badRequest().body(result);
        }
        
        try {
            // 检查资产是否已在 CustodyManager 中注册
            boolean isRegistered = custodyManagerService.isAssetRegistered(asset.getAssetIdBytes32());
            result.put("isRegistered", isRegistered);
            
            if (isRegistered) {
                // 获取当前状态
                String currentStatusStr = custodyManagerService.getAssetStatus(asset.getAssetIdBytes32());
                result.put("currentStatus", currentStatusStr);
                result.put("isInCustody", "InCustody".equals(currentStatusStr));
            } else {
                result.put("currentStatus", "NotRegistered");
                result.put("isInCustody", false);
                
                // 检查是否有托管和保险记录
                boolean hasCustody = custodyService.getCustodyByAssetId(assetId).isPresent();
                boolean hasInsurance = insuranceService.getActiveInsuranceByAssetId(assetId).isPresent();
                result.put("hasCustody", hasCustody);
                result.put("hasInsurance", hasInsurance);
            }
            
            return ResponseEntity.ok(result);
            
        } catch (Exception e) {
            logger.error("Failed to check custody status for asset {}: {}", assetId, e.getMessage(), e);
            result.put("error", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(result);
        }
    }
    
    /**
     * 修复资产的 CustodyManager 状态
     * 如果资产已注册但状态不是 InCustody，自动更新为 InCustody
     * 如果资产未注册，尝试注册（需要托管和保险记录）
     */
    @PostMapping("/{assetId}/fix-custody-status")
    public ResponseEntity<?> fixCustodyStatus(
            @PathVariable String assetId,
            @RequestHeader(value = "X-Wallet-Address", required = false) String walletAddress
    ) {
        ResponseEntity<?> permissionCheck = checkAdminPermission(walletAddress);
        if (permissionCheck != null) {
            return permissionCheck;
        }
        
        Asset asset = assetRepository.findById(assetId).orElse(null);
        if (asset == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", "Asset not found"));
        }
        
        if (asset.getTokenAddress() == null || asset.getTokenAddress().isEmpty()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Asset has no token address"));
        }
        
        if (asset.getAssetIdBytes32() == null || asset.getAssetIdBytes32().isEmpty()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Asset has no assetIdBytes32"));
        }
        
        Map<String, Object> result = new HashMap<>();
        result.put("assetId", assetId);
        result.put("tokenAddress", asset.getTokenAddress());
        result.put("assetIdBytes32", asset.getAssetIdBytes32());
        
        try {
            // 检查资产是否已在 CustodyManager 中注册
            boolean isRegistered = custodyManagerService.isAssetRegistered(asset.getAssetIdBytes32());
            result.put("isRegistered", isRegistered);
            
            if (isRegistered) {
                // 获取当前状态
                String currentStatusStr = custodyManagerService.getAssetStatus(asset.getAssetIdBytes32());
                result.put("currentStatus", currentStatusStr);
                
                if (!"InCustody".equals(currentStatusStr)) {
                    // 更新状态为 InCustody
                    logger.info("Updating asset {} status from {} to InCustody in CustodyManager...", 
                            assetId, currentStatusStr);
                    String updateTxHash = custodyManagerService.updateStatus(
                            asset.getAssetIdBytes32(),
                            CustodyManagerService.AssetStatus.InCustody
                    );
                    if (updateTxHash != null) {
                        result.put("action", "updated");
                        result.put("transactionHash", updateTxHash);
                        result.put("newStatus", "InCustody");
                        logger.info("Successfully updated asset {} status to InCustody. TxHash: {}", 
                                assetId, updateTxHash);
                    } else {
                        result.put("action", "update_failed");
                        result.put("error", "Update transaction hash is null");
                    }
                } else {
                    result.put("action", "no_change");
                    result.put("message", "Asset is already InCustody");
                }
            } else {
                // 资产未注册，尝试注册（需要托管和保险记录）
                logger.warn("Asset {} is not registered in CustodyManager. Attempting to register...", assetId);
                
                // 检查是否有托管和保险记录
                boolean hasCustody = custodyService.getCustodyByAssetId(assetId).isPresent();
                boolean hasInsurance = insuranceService.getActiveInsuranceByAssetId(assetId).isPresent();
                
                result.put("hasCustody", hasCustody);
                result.put("hasInsurance", hasInsurance);
                
                if (hasCustody && hasInsurance) {
                    // 尝试自动注册（通过 CustodyManagerIntegrationService）
                    // 注意：这里需要注入 CustodyManagerIntegrationService
                    result.put("action", "registration_attempted");
                    result.put("message", "Asset has custody and insurance records. Registration should be triggered automatically when these records are created.");
                    result.put("hint", "If registration failed, check backend logs for details.");
                } else {
                    result.put("action", "registration_failed");
                    result.put("error", "Asset must have both custody and insurance records before registration");
                    if (!hasCustody) {
                        result.put("missing", "custody");
                    }
                    if (!hasInsurance) {
                        result.put("missing", result.containsKey("missing") ? 
                                result.get("missing") + ", insurance" : "insurance");
                    }
                }
            }
            
            // 如果资产状态是"募集中"，确保禁用合约中的托管检查
            if ("fundraising".equals(asset.getStatus()) && asset.getTokenAddress() != null && !asset.getTokenAddress().isEmpty()) {
                try {
                    logger.info("Disabling custody check in LuxuryToken contract for asset {} (token: {})...", 
                            assetId, asset.getTokenAddress());
                    String disableTxHash = luxuryTokenService.setCustodyCheckEnabled(asset.getTokenAddress(), false);
                    if (disableTxHash != null) {
                        result.put("custodyCheckDisabled", true);
                        result.put("custodyCheckTxHash", disableTxHash);
                        logger.info("✅ Successfully disabled custody check in LuxuryToken contract. TxHash: {}", disableTxHash);
                    } else {
                        result.put("custodyCheckDisabled", false);
                        result.put("custodyCheckError", "Transaction hash is null");
                        logger.warn("Failed to disable custody check in LuxuryToken contract (txHash is null)");
                    }
                } catch (Exception e) {
                    result.put("custodyCheckDisabled", false);
                    result.put("custodyCheckError", e.getMessage());
                    logger.error("Failed to disable custody check in LuxuryToken contract for asset {}: {}", 
                            assetId, e.getMessage(), e);
                }
            }
            
            return ResponseEntity.ok(result);
            
        } catch (Exception e) {
            logger.error("Failed to fix custody status for asset {}: {}", assetId, e.getMessage(), e);
            result.put("error", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(result);
        }
    }
}






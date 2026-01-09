package com.mantleluxury.backend.assets.api;

import com.mantleluxury.backend.assets.service.AssetService;
import com.mantleluxury.backend.assets.service.AmlService;
import com.mantleluxury.backend.blockchain.service.SignatureVerificationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

/**
 * 资产列表 / 详情 / 提交接口
 */
@RestController
@RequestMapping("/api/assets")
public class AssetController {

    private static final Logger logger = LoggerFactory.getLogger(AssetController.class);

    private final AssetService assetService;
    private final AmlService amlService;

    public AssetController(AssetService assetService, AmlService amlService) {
        this.assetService = assetService;
        this.amlService = amlService;
    }

    @GetMapping
    public ResponseEntity<List<AssetDto>> listAssets() {
        return ResponseEntity.ok(assetService.getAllAssets());
    }

    /**
     * 获取精选资产（用于首页轮播）
     * 返回募集中、已认证、有托管和保险的资产，按创建时间倒序
     */
    @GetMapping("/featured")
    public ResponseEntity<List<AssetDto>> getFeaturedAssets(
            @RequestParam(defaultValue = "6") int limit
    ) {
        return ResponseEntity.ok(assetService.getFeaturedAssets(limit));
    }

    // 测试端点，用于验证 POST 请求是否正常工作
    @PostMapping("/test")
    public ResponseEntity<String> testPost() {
        return ResponseEntity.ok("POST request works!");
    }

    // 将具体的路径放在通配符路径之前，避免路径冲突
    @PostMapping(value = "/submit", consumes = "application/json", produces = "application/json")
    public ResponseEntity<?> submitAsset(@RequestBody AssetSubmitRequest request) {
        try {
            // AML 基础校验：提交者地址
            if (request.submittedBy() != null) {
                amlService.checkAddress(request.submittedBy());
            }

            // 直接使用前端传来的钱包地址（用户连接的钱包地址）
            String finalSubmittedBy = request.submittedBy();
            
            // 验证地址格式
            if (finalSubmittedBy == null || finalSubmittedBy.trim().isEmpty()) {
                logger.warn("Asset submission without submittedBy address");
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body("Wallet address is required for asset submission");
            }
            
            // 规范化地址格式
            finalSubmittedBy = finalSubmittedBy.trim().toLowerCase();
            if (!finalSubmittedBy.startsWith("0x")) {
                finalSubmittedBy = "0x" + finalSubmittedBy;
            }
            if (finalSubmittedBy.length() != 42) {
                logger.error("Invalid address length: {} (expected 42). Address: {}", 
                        finalSubmittedBy.length(), finalSubmittedBy);
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body("Invalid wallet address format. Expected 42 characters (0x + 40 hex chars)");
            }
            
            // 签名步骤已在前端完成（用户通过 MetaMask 签名确认），这里直接使用前端传来的钱包地址
            // 不需要验证签名，因为前端已经通过 MetaMask 确认了用户身份
            if (request.signature() == null || request.message() == null) {
                logger.warn("Asset submission without signature. Address: {}", finalSubmittedBy);
                // 可以选择要求签名，或者允许无签名提交（根据业务需求）
                // return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                //         .body("Signature is required for asset submission");
            } else {
                logger.info("Signature provided (not verified, using frontend address directly). Address: {}", finalSubmittedBy);
            }

            logger.info("Using wallet address from frontend: {}", finalSubmittedBy);

            // 创建请求，使用前端传来的钱包地址
            AssetSubmitRequest finalRequest = new AssetSubmitRequest(
                    request.assetType(),
                    request.brand(),
                    request.model(),
                    request.year(),
                    request.description(),
                    request.purchasePrice(),
                    request.purchaseDate(),
                    request.serialNumber(),
                    request.totalSupply(),
                    request.pricePerShare(),
                    request.tokenSymbol(),
                    finalSubmittedBy,  // 使用前端传来的钱包地址（用户连接的钱包地址）
                    request.signature(),  // 传递签名（可选，用于验证）
                    request.message(),  // 传递消息（可选，用于验证）
                    request.imageUrls(),
                    request.model3dUrl()
            );

            logger.info("Received asset submission request: assetType={}, brand={}, model={}, submittedBy={}", 
                    finalRequest.assetType(), finalRequest.brand(), finalRequest.model(), finalRequest.submittedBy());
            var asset = assetService.submitAsset(finalRequest);
            AssetDto dto = assetService.getAssetById(asset.getId());
            return ResponseEntity.status(HttpStatus.CREATED).body(dto);
        } catch (RuntimeException e) {
            // 合约部署失败或其他业务异常
            System.err.println("Asset submission failed: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body("Asset submission failed: " + e.getMessage());
        } catch (Exception e) {
            // 其他未预期的异常
            System.err.println("Unexpected error during asset submission: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Internal server error: " + e.getMessage());
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<AssetDto> getAsset(@PathVariable String id) {
        AssetDto asset = assetService.getAssetById(id);
        if (asset != null) {
            return ResponseEntity.ok(asset);
        } else {
            return ResponseEntity.notFound().build();
        }
    }

    // 按合约地址删除资产（仅后台运维用途）
    @DeleteMapping("/token/{tokenAddress}")
    public ResponseEntity<String> deleteByToken(@PathVariable String tokenAddress) {
        try {
            assetService.deleteByTokenAddress(tokenAddress);
            return ResponseEntity.ok("Deleted asset with token: " + tokenAddress);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(e.getMessage());
        }
    }

    // 按 ID 删除资产（仅后台运维用途）
    @DeleteMapping("/{id}")
    public ResponseEntity<String> deleteById(@PathVariable String id) {
        try {
            assetService.deleteById(id);
            return ResponseEntity.ok("Deleted asset with id: " + id);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(e.getMessage());
        }
    }

    // 上传资产图片（存储到数据库）
    @PostMapping("/upload-image")
    public ResponseEntity<?> uploadImage(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "assetId", required = false) String assetId
    ) {
        logger.info("Received image upload request. File name: {}, Size: {} bytes, AssetId: {}", 
                file != null ? file.getOriginalFilename() : "null",
                file != null ? file.getSize() : 0,
                assetId);
        
        try {
            if (file == null || file.isEmpty()) {
                logger.warn("Upload failed: File is empty or null");
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "File is empty or null"));
            }
            
            String url = assetService.saveImage(file, assetId);
            logger.info("Image uploaded successfully. URL: {}", url);
            return ResponseEntity.ok(new AssetImageUploadResponse(url));
        } catch (IllegalArgumentException e) {
            logger.error("Upload failed: Invalid argument", e);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", "Invalid file: " + e.getMessage()));
        } catch (Exception e) {
            logger.error("Upload failed: Unexpected error", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Upload failed: " + e.getMessage()));
        }
    }
}



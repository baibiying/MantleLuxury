package com.mantleluxury.backend.assets.api;

import com.mantleluxury.backend.assets.service.AssetService;
import com.mantleluxury.backend.assets.service.AmlService;
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
@CrossOrigin(origins = "http://localhost:3000")
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

            System.out.println("Received asset submission request: " + request);
            var asset = assetService.submitAsset(request);
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

    // 上传资产图片（简单本地存储）
    @PostMapping("/upload-image")
    public ResponseEntity<?> uploadImage(@RequestParam("file") MultipartFile file) {
        logger.info("Received image upload request. File name: {}, Size: {} bytes", 
                file != null ? file.getOriginalFilename() : "null",
                file != null ? file.getSize() : 0);
        
        try {
            if (file == null || file.isEmpty()) {
                logger.warn("Upload failed: File is empty or null");
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "File is empty or null"));
            }
            
            String url = assetService.saveImage(file);
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



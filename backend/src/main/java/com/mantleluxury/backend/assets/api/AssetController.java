package com.mantleluxury.backend.assets.api;

import com.mantleluxury.backend.assets.service.AssetService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 资产列表 / 详情 / 提交接口
 */
@RestController
@RequestMapping("/api/assets")
@CrossOrigin(origins = "http://localhost:3000")
public class AssetController {

    private final AssetService assetService;

    public AssetController(AssetService assetService) {
        this.assetService = assetService;
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
}



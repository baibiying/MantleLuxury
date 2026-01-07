package com.mantleluxury.backend.assets.api;

import com.mantleluxury.backend.assets.domain.AssetImage;
import com.mantleluxury.backend.assets.repository.AssetImageRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 资产图片获取接口
 * 从数据库读取图片二进制数据并返回
 */
@RestController
@RequestMapping("/api/assets")
public class AssetImageController {
    
    private static final Logger logger = LoggerFactory.getLogger(AssetImageController.class);
    
    private final AssetImageRepository assetImageRepository;
    
    public AssetImageController(AssetImageRepository assetImageRepository) {
        this.assetImageRepository = assetImageRepository;
    }
    
    /**
     * 获取资产的指定图片
     * GET /api/assets/{assetId}/images/{index}
     */
    @GetMapping("/{assetId}/images/{index}")
    public ResponseEntity<byte[]> getAssetImage(
            @PathVariable String assetId,
            @PathVariable Integer index
    ) {
        try {
            AssetImage image = assetImageRepository
                    .findByAssetIdAndImageIndex(assetId, index)
                    .orElse(null);
            
            if (image == null || image.getImageData() == null) {
                logger.warn("Image not found: assetId={}, index={}", assetId, index);
                return ResponseEntity.notFound().build();
            }
            
            // 设置响应头
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.parseMediaType(image.getContentType()));
            headers.setContentLength(image.getImageData().length);
            headers.setCacheControl("public, max-age=31536000"); // 缓存1年
            
            return ResponseEntity.ok()
                    .headers(headers)
                    .body(image.getImageData());
                    
        } catch (Exception e) {
            logger.error("Failed to get image: assetId={}, index={}", assetId, index, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    /**
     * 获取资产的所有图片索引列表
     * GET /api/assets/{assetId}/images
     */
    @GetMapping("/{assetId}/images")
    public ResponseEntity<List<Integer>> getAssetImageIndices(@PathVariable String assetId) {
        try {
            List<AssetImage> images = assetImageRepository.findByAssetIdOrderByImageIndexAsc(assetId);
            List<Integer> indices = images.stream()
                    .map(AssetImage::getImageIndex)
                    .toList();
            return ResponseEntity.ok(indices);
        } catch (Exception e) {
            logger.error("Failed to get image indices: assetId={}", assetId, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
}


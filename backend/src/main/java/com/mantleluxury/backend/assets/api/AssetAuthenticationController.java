package com.mantleluxury.backend.assets.api;

import com.mantleluxury.backend.assets.domain.AssetAuthentication;
import com.mantleluxury.backend.assets.service.AssetAuthenticationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/asset-authentications")
public class AssetAuthenticationController {

    private static final Logger logger = LoggerFactory.getLogger(AssetAuthenticationController.class);

    private final AssetAuthenticationService authenticationService;

    public AssetAuthenticationController(AssetAuthenticationService authenticationService) {
        this.authenticationService = authenticationService;
    }

    /**
     * 创建认证记录
     */
    @PostMapping
    public ResponseEntity<?> createAuthentication(@RequestBody Map<String, Object> payload) {
        try {
            String assetId = (String) payload.get("assetId");
            String authenticatorName = (String) payload.get("authenticatorName");
            String authenticatorType = (String) payload.getOrDefault("authenticatorType", "third_party");
            String reportUrl = (String) payload.get("reportUrl");
            String reportHash = (String) payload.get("reportHash");
            String verifierSignature = (String) payload.get("verifierSignature");
            String notes = (String) payload.get("notes");

            if (assetId == null || authenticatorName == null) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "assetId and authenticatorName are required"));
            }

            AssetAuthentication authentication = authenticationService.createAuthentication(
                    assetId, authenticatorName, authenticatorType, reportUrl, reportHash,
                    verifierSignature, notes);

            return ResponseEntity.status(HttpStatus.CREATED).body(toDto(authentication));
        } catch (Exception e) {
            logger.error("Failed to create authentication", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * 审核认证（通过或拒绝）
     */
    @PostMapping("/{authenticationId}/review")
    public ResponseEntity<?> reviewAuthentication(
            @PathVariable String authenticationId,
            @RequestBody Map<String, String> payload) {
        try {
            String status = payload.get("status");
            String notes = payload.get("notes");

            if (status == null || (!"verified".equals(status) && !"rejected".equals(status))) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "status must be 'verified' or 'rejected'"));
            }

            AssetAuthentication authentication = authenticationService.reviewAuthentication(
                    authenticationId, status, notes);

            return ResponseEntity.ok(toDto(authentication));
        } catch (Exception e) {
            logger.error("Failed to review authentication", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * 获取资产的所有认证记录
     */
    @GetMapping("/asset/{assetId}")
    public ResponseEntity<List<Map<String, Object>>> getAssetAuthentications(
            @PathVariable String assetId) {
        List<AssetAuthentication> authentications = authenticationService.getAssetAuthentications(assetId);
        List<Map<String, Object>> dtos = authentications.stream()
                .map(this::toDto)
                .collect(Collectors.toList());
        return ResponseEntity.ok(dtos);
    }

    /**
     * 获取资产已通过的认证记录
     */
    @GetMapping("/asset/{assetId}/verified")
    public ResponseEntity<List<Map<String, Object>>> getVerifiedAuthentications(
            @PathVariable String assetId) {
        List<AssetAuthentication> authentications = authenticationService.getVerifiedAuthentications(assetId);
        List<Map<String, Object>> dtos = authentications.stream()
                .map(this::toDto)
                .collect(Collectors.toList());
        return ResponseEntity.ok(dtos);
    }

    /**
     * 获取认证记录详情
     */
    @GetMapping("/{authenticationId}")
    public ResponseEntity<?> getAuthentication(@PathVariable String authenticationId) {
        return authenticationService.getAuthentication(authenticationId)
                .map(auth -> ResponseEntity.ok(toDto(auth)))
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("error", "Authentication not found")));
    }

    /**
     * 转换为 DTO
     */
    private Map<String, Object> toDto(AssetAuthentication authentication) {
        Map<String, Object> dto = new HashMap<>();
        dto.put("id", authentication.getId());
        dto.put("assetId", authentication.getAssetId());
        dto.put("authenticationStatus", authentication.getAuthenticationStatus());
        dto.put("authenticatorName", authentication.getAuthenticatorName());
        dto.put("authenticatorType", authentication.getAuthenticatorType());
        dto.put("verificationDate", authentication.getVerificationDate());
        dto.put("reportUrl", authentication.getReportUrl());
        dto.put("reportHash", authentication.getReportHash());
        dto.put("verifierSignature", authentication.getVerifierSignature());
        dto.put("notes", authentication.getNotes());
        dto.put("createdAt", authentication.getCreatedAt());
        dto.put("updatedAt", authentication.getUpdatedAt());
        return dto;
    }
}






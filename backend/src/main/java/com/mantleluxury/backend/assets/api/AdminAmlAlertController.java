package com.mantleluxury.backend.assets.api;

import com.mantleluxury.backend.assets.domain.AmlAlert;
import com.mantleluxury.backend.assets.repository.AmlAlertRepository;
import com.mantleluxury.backend.config.AdminConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * AML 告警管理后台接口（仅管理员）
 */
@RestController
@RequestMapping("/api/admin/aml-alerts")
public class AdminAmlAlertController {

    private static final Logger logger = LoggerFactory.getLogger(AdminAmlAlertController.class);

    private final AmlAlertRepository alertRepository;
    private final AdminConfig adminConfig;

    public AdminAmlAlertController(
            AmlAlertRepository alertRepository,
            AdminConfig adminConfig
    ) {
        this.alertRepository = alertRepository;
        this.adminConfig = adminConfig;
    }

    private ResponseEntity<?> checkAdminPermission(String walletAddress) {
        if (walletAddress == null || walletAddress.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Wallet address is required"));
        }
        String normalizedAddress = walletAddress.toLowerCase();
        if (!adminConfig.isAdmin(normalizedAddress)) {
            logger.warn("Unauthorized AML alert access from: {} (normalized: {})", walletAddress, normalizedAddress);
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of(
                            "error", "Access denied. Admin privileges required.",
                            "providedAddress", normalizedAddress
                    ));
        }
        return null;
    }

    @GetMapping
    public ResponseEntity<?> listAlerts(
            @RequestParam(required = false) String status,
            @RequestHeader(value = "X-Wallet-Address", required = false) String walletAddress
    ) {
        ResponseEntity<?> permissionCheck = checkAdminPermission(walletAddress);
        if (permissionCheck != null) {
            return permissionCheck;
        }
        List<AmlAlert> alerts;
        if (status != null && !status.isEmpty()) {
            alerts = alertRepository.findByStatusOrderByCreatedAtDesc(status);
        } else {
            alerts = alertRepository.findAllByOrderByCreatedAtDesc();
        }
        List<Map<String, Object>> result = alerts.stream()
                .map(this::toDto)
                .collect(Collectors.toList());
        return ResponseEntity.ok(result);
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getAlert(
            @PathVariable String id,
            @RequestHeader(value = "X-Wallet-Address", required = false) String walletAddress
    ) {
        ResponseEntity<?> permissionCheck = checkAdminPermission(walletAddress);
        if (permissionCheck != null) {
            return permissionCheck;
        }
        return alertRepository.findById(id)
                .map(alert -> ResponseEntity.ok(toDto(alert)))
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("error", "Alert not found")));
    }

    /**
     * 更新告警状态（open / in_review / resolved / ignored）和处理备注
     */
    @PostMapping("/{id}/handle")
    public ResponseEntity<?> handleAlert(
            @PathVariable String id,
            @RequestBody Map<String, String> payload,
            @RequestHeader(value = "X-Wallet-Address", required = false) String walletAddress
    ) {
        ResponseEntity<?> permissionCheck = checkAdminPermission(walletAddress);
        if (permissionCheck != null) {
            return permissionCheck;
        }

        String status = payload.getOrDefault("status", "").trim();
        String notes = payload.get("handleNotes");

        if (status.isEmpty() ||
                !(status.equals("open") || status.equals("in_review") ||
                        status.equals("resolved") || status.equals("ignored"))) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Invalid status. Must be one of: open, in_review, resolved, ignored"));
        }

        return alertRepository.findById(id)
                .map(alert -> {
                    alert.setStatus(status);
                    if (notes != null && !notes.isEmpty()) {
                        alert.setHandleNotes(notes);
                    }
                    alert.setHandledBy(walletAddress != null ? walletAddress.toLowerCase() : null);
                    alert.setHandledAt(LocalDateTime.now());
                    AmlAlert saved = alertRepository.save(alert);
                    logger.info("AML alert {} handled by {} with status {}", id, walletAddress, status);
                    return ResponseEntity.ok(toDto(saved));
                })
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("error", "Alert not found")));
    }

    private Map<String, Object> toDto(AmlAlert alert) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", alert.getId());
        map.put("walletAddress", alert.getWalletAddress());
        map.put("alertType", alert.getAlertType());
        map.put("riskLevel", alert.getRiskLevel());
        map.put("source", alert.getSource());
        map.put("message", alert.getMessage());
        map.put("status", alert.getStatus());
        map.put("createdAt", alert.getCreatedAt());
        map.put("updatedAt", alert.getUpdatedAt());
        map.put("handledBy", alert.getHandledBy());
        map.put("handledAt", alert.getHandledAt());
        map.put("handleNotes", alert.getHandleNotes());
        return map;
    }
}






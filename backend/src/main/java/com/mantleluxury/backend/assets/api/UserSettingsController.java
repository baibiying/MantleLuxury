package com.mantleluxury.backend.assets.api;

import com.mantleluxury.backend.assets.service.UserSettingsService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Optional;

/**
 * 用户设置接口
 */
@RestController
@RequestMapping("/api/user-settings")
@CrossOrigin(origins = "http://localhost:3000")
public class UserSettingsController {

    private static final Logger logger = LoggerFactory.getLogger(UserSettingsController.class);

    private final UserSettingsService userSettingsService;

    public UserSettingsController(UserSettingsService userSettingsService) {
        this.userSettingsService = userSettingsService;
    }

    /**
     * 获取用户设置
     */
    @GetMapping("/{walletAddress}")
    public ResponseEntity<?> getUserSettings(@PathVariable String walletAddress) {
        Optional<UserSettingsService.UserSettingsDto> settingsOpt = userSettingsService.getUserSettings(walletAddress);
        if (settingsOpt.isEmpty()) {
            // 返回默认设置
            UserSettingsService.UserSettingsDto defaultSettings = new UserSettingsService.UserSettingsDto(
                    null, true, true, true
            );
            return ResponseEntity.ok(defaultSettings);
        }
        return ResponseEntity.ok(settingsOpt.get());
    }

    /**
     * 更新用户邮箱
     */
    @PutMapping("/{walletAddress}/email")
    public ResponseEntity<?> updateEmail(
            @PathVariable String walletAddress,
            @RequestBody Map<String, String> request
    ) {
        String email = request.get("email");
        if (email == null || email.trim().isEmpty()) {
            return ResponseEntity.badRequest().body("Email is required");
        }
        // 简单的邮箱格式验证
        if (!email.matches("^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$")) {
            return ResponseEntity.badRequest().body("Invalid email format");
        }
        boolean success = userSettingsService.updateEmail(walletAddress, email.trim());
        if (success) {
            return ResponseEntity.ok(Map.of("message", "Email updated successfully"));
        }
        return ResponseEntity.internalServerError().body("Failed to update email");
    }

    /**
     * 更新通知偏好
     */
    @PutMapping("/{walletAddress}/notifications")
    public ResponseEntity<?> updateNotificationPreferences(
            @PathVariable String walletAddress,
            @RequestBody Map<String, Boolean> request
    ) {
        Boolean emailNotifications = request.get("emailNotifications");
        Boolean yieldNotifications = request.get("yieldNotifications");
        Boolean announcementNotifications = request.get("announcementNotifications");
        
        boolean success = userSettingsService.updateNotificationPreferences(
                walletAddress,
                emailNotifications,
                yieldNotifications,
                announcementNotifications
        );
        if (success) {
            return ResponseEntity.ok(Map.of("message", "Notification preferences updated successfully"));
        }
        return ResponseEntity.internalServerError().body("Failed to update notification preferences");
    }
}


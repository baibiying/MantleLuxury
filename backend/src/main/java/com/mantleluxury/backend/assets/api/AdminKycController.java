package com.mantleluxury.backend.assets.api;

import com.mantleluxury.backend.assets.domain.AmlBlacklist;
import com.mantleluxury.backend.assets.domain.User;
import com.mantleluxury.backend.assets.repository.AmlBlacklistRepository;
import com.mantleluxury.backend.assets.repository.UserRepository;
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
 * KYC/AML 管理后台接口
 * 仅管理员可访问
 */
@RestController
@RequestMapping("/api/admin/kyc")
public class AdminKycController {

    private static final Logger logger = LoggerFactory.getLogger(AdminKycController.class);

    private final UserRepository userRepository;
    private final AmlBlacklistRepository blacklistRepository;
    private final AdminConfig adminConfig;
    private final com.mantleluxury.backend.blockchain.service.KYCRegistryService kycRegistryService;
    private final com.mantleluxury.backend.assets.service.EmailService emailService;

    public AdminKycController(
            UserRepository userRepository,
            AmlBlacklistRepository blacklistRepository,
            AdminConfig adminConfig,
            com.mantleluxury.backend.blockchain.service.KYCRegistryService kycRegistryService,
            com.mantleluxury.backend.assets.service.EmailService emailService
    ) {
        this.userRepository = userRepository;
        this.blacklistRepository = blacklistRepository;
        this.adminConfig = adminConfig;
        this.kycRegistryService = kycRegistryService;
        this.emailService = emailService;
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
            logger.debug("Configured admin addresses: {}", adminConfig.getAdminAddresses());
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of(
                            "error", "Access denied. Admin privileges required.",
                            "providedAddress", normalizedAddress
                    ));
        }
        return null;
    }

    /**
     * 获取所有用户 KYC 状态列表
     */
    @GetMapping("/users")
    public ResponseEntity<?> getAllUsers(
            @RequestParam(required = false) String status,
            @RequestHeader(value = "X-Wallet-Address", required = false) String walletAddress
    ) {
        ResponseEntity<?> permissionCheck = checkAdminPermission(walletAddress);
        if (permissionCheck != null) {
            return permissionCheck;
        }
        List<User> users;
        if (status != null && !status.isEmpty()) {
            users = userRepository.findAll().stream()
                    .filter(u -> status.equals(u.getKycStatus()))
                    .collect(Collectors.toList());
        } else {
            users = userRepository.findAll();
        }

        List<Map<String, Object>> result = users.stream().map(user -> {
            Map<String, Object> map = new HashMap<>();
            map.put("id", user.getId());
            map.put("walletAddress", user.getWalletAddress());
            map.put("email", user.getEmail());
            map.put("kycStatus", user.getKycStatus());
            map.put("kycSubmittedAt", user.getKycSubmittedAt());
            map.put("kycApprovedAt", user.getKycApprovedAt());
            map.put("kycRejectedAt", user.getKycRejectedAt());
            map.put("kycRejectionReason", user.getKycRejectionReason());
            map.put("createdAt", user.getCreatedAt());
            // 检查是否在黑名单中
            boolean isBlacklisted = blacklistRepository.findByWalletAddress(user.getWalletAddress().toLowerCase()).isPresent();
            map.put("isBlacklisted", isBlacklisted);
            return map;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(result);
    }

    /**
     * 获取用户详情
     */
    @GetMapping("/users/{walletAddress}")
    public ResponseEntity<?> getUserDetail(
            @PathVariable String walletAddress,
            @RequestHeader(value = "X-Wallet-Address", required = false) String adminAddress
    ) {
        ResponseEntity<?> permissionCheck = checkAdminPermission(adminAddress);
        if (permissionCheck != null) {
            return permissionCheck;
        }
        User user = userRepository.findByWalletAddress(walletAddress.toLowerCase()).orElse(null);
        if (user == null) {
            return ResponseEntity.notFound().build();
        }

        Map<String, Object> result = new HashMap<>();
        result.put("id", user.getId());
        result.put("walletAddress", user.getWalletAddress());
        result.put("email", user.getEmail());
        result.put("kycStatus", user.getKycStatus());
        result.put("kycSubmittedAt", user.getKycSubmittedAt());
        result.put("kycApprovedAt", user.getKycApprovedAt());
        result.put("kycRejectedAt", user.getKycRejectedAt());
        result.put("kycRejectionReason", user.getKycRejectionReason());
        result.put("fullName", user.getFullName());
        result.put("idNumber", user.getIdNumber());
        result.put("idType", user.getIdType());
        result.put("address", user.getAddress());
        result.put("phone", user.getPhone());
        result.put("email", user.getEmail());
        result.put("createdAt", user.getCreatedAt());
        
        // 检查黑名单状态
        blacklistRepository.findByWalletAddress(walletAddress.toLowerCase()).ifPresent(blacklist -> {
            Map<String, Object> blacklistInfo = new HashMap<>();
            blacklistInfo.put("id", blacklist.getId());
            blacklistInfo.put("reason", blacklist.getReason());
            blacklistInfo.put("createdAt", blacklist.getCreatedAt());
            result.put("blacklist", blacklistInfo);
        });

        return ResponseEntity.ok(result);
    }

    /**
     * 审核 KYC（通过或拒绝）
     */
    @PostMapping("/users/{walletAddress}/review")
    public ResponseEntity<?> reviewKyc(
            @PathVariable String walletAddress,
            @RequestBody Map<String, String> request,
            @RequestHeader(value = "X-Wallet-Address", required = false) String adminAddress
    ) {
        ResponseEntity<?> permissionCheck = checkAdminPermission(adminAddress);
        if (permissionCheck != null) {
            return permissionCheck;
        }
        String status = request.get("status"); // "approved" or "rejected"
        if (status == null || (!status.equals("approved") && !status.equals("rejected"))) {
            return ResponseEntity.badRequest().body("Invalid status. Must be 'approved' or 'rejected'");
        }

        User user = userRepository.findByWalletAddress(walletAddress.toLowerCase()).orElse(null);
        if (user == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "User not found"));
        }

        // 保存原始状态，以便在链上同步失败时回滚
        String originalStatus = user.getKycStatus();
        LocalDateTime originalApprovedAt = user.getKycApprovedAt();
        LocalDateTime originalRejectedAt = user.getKycRejectedAt();
        String originalRejectionReason = user.getKycRejectionReason();

        // 更新数据库状态
        user.setKycStatus(status);
        if (status.equals("approved")) {
            user.setKycApprovedAt(LocalDateTime.now());
            user.setKycRejectedAt(null);
            user.setKycRejectionReason(null);
        } else if (status.equals("rejected")) {
            user.setKycRejectedAt(LocalDateTime.now());
            String rejectionReason = request.get("rejectionReason");
            user.setKycRejectionReason(rejectionReason);
        }
        userRepository.save(user);

        // 同步 KYC 状态到链上 KYCRegistry 合约
        // 注意：只有在链上同步成功后才返回成功
        // 如果链上同步失败，回滚数据库状态
        String transactionHash = null;
        String syncStatus = "success";
        String syncMessage = "KYC status synced to blockchain";
        try {
            // 在批准 KYC 时，检查并自动授予 COMPLIANCE_ROLE 权限（如果需要）
            if (status.equals("approved")) {
                try {
                    boolean hasRole = kycRegistryService.hasComplianceRole();
                    if (!hasRole) {
                        logger.info("⚠️ Backend wallet does not have COMPLIANCE_ROLE. Attempting to auto-grant...");
                        try {
                            String grantTxHash = kycRegistryService.grantComplianceRole(
                                    kycRegistryService.getCredentialsAddress()
                            );
                            logger.info("✅ Auto-granted COMPLIANCE_ROLE. Transaction hash: {}", grantTxHash);
                        } catch (Exception grantException) {
                            logger.warn("⚠️ Failed to auto-grant COMPLIANCE_ROLE: {}. " +
                                    "This may be because the caller does not have DEFAULT_ADMIN_ROLE. " +
                                    "The sync may still fail due to missing permissions.", grantException.getMessage());
                        }
                    }
                } catch (Exception checkException) {
                    logger.warn("⚠️ Failed to check COMPLIANCE_ROLE: {}. Proceeding with sync anyway.", 
                            checkException.getMessage());
                }
            }
            
            transactionHash = kycRegistryService.setKYCStatus(walletAddress, status);
            if (transactionHash != null) {
                logger.info("✅ KYC status synced to blockchain. Transaction hash: {}", transactionHash);
            } else {
                // 区块链同步被禁用（可能是测试环境）
                logger.warn("⚠️ KYC status sync to blockchain returned null. Blockchain may be disabled.");
                syncStatus = "skipped";
                syncMessage = "Blockchain sync skipped (blockchain may be disabled)";
                // 如果区块链被禁用，允许链下状态更新成功
            }
        } catch (Exception e) {
            logger.error("❌ Failed to sync KYC status to blockchain for {}: {}", walletAddress, e.getMessage(), e);
            syncStatus = "failed";
            syncMessage = "Blockchain sync failed: " + e.getMessage();
            
            // 检查是否是权限问题，如果是，再次尝试授予权限
            if (e.getMessage() != null && e.getMessage().contains("COMPLIANCE_ROLE")) {
                logger.info("🔄 Detected permission issue. Retrying to grant COMPLIANCE_ROLE...");
                try {
                    String grantTxHash = kycRegistryService.grantComplianceRole(
                            kycRegistryService.getCredentialsAddress()
                    );
                    logger.info("✅ Granted COMPLIANCE_ROLE. Transaction hash: {}. Retrying sync...", grantTxHash);
                    
                    // 等待一下让交易确认
                    Thread.sleep(3000);
                    
                    // 重试同步
                    transactionHash = kycRegistryService.setKYCStatus(walletAddress, status);
                    if (transactionHash != null) {
                        logger.info("✅ KYC status synced to blockchain after granting role. Transaction hash: {}", 
                                transactionHash);
                        syncStatus = "success";
                        syncMessage = "KYC status synced to blockchain (after auto-granting COMPLIANCE_ROLE)";
                    } else {
                        throw new RuntimeException("Sync still failed after granting role");
                    }
                } catch (Exception retryException) {
                    logger.error("❌ Failed to grant COMPLIANCE_ROLE or retry sync: {}", 
                            retryException.getMessage(), retryException);
                    // 继续到回滚逻辑
                }
            }
            
            // 如果重试后仍然失败，回滚数据库状态
            if (!syncStatus.equals("success")) {
                logger.warn("Rolling back database state for user {} due to blockchain sync failure", walletAddress);
                user.setKycStatus(originalStatus);
                user.setKycApprovedAt(originalApprovedAt);
                user.setKycRejectedAt(originalRejectedAt);
                user.setKycRejectionReason(originalRejectionReason);
                userRepository.save(user);
                
                // 返回错误响应
                Map<String, Object> errorResponse = new HashMap<>();
                errorResponse.put("error", "Failed to sync KYC status to blockchain");
                errorResponse.put("message", syncMessage);
                errorResponse.put("walletAddress", walletAddress);
                errorResponse.put("blockchainSync", Map.of(
                        "status", syncStatus,
                        "message", syncMessage,
                        "transactionHash", transactionHash != null ? transactionHash : "N/A",
                        "hint", "If this is a permission error, make sure the backend wallet has DEFAULT_ADMIN_ROLE " +
                                "in KYCRegistry contract, or manually grant COMPLIANCE_ROLE to: " + 
                                kycRegistryService.getCredentialsAddress()
                ));
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
            }
        }

        // 发送邮件通知（已禁用）
        String emailStatus = "disabled";
        String emailMessage = "邮件发送功能已禁用";
        logger.info("Email sending is disabled. Skipping email notification for user: {}", walletAddress);
        
        // 邮件发送功能已禁用，以下代码暂时不执行
        /*
        if (user.getEmailNotifications() == null || user.getEmailNotifications()) {
            String userEmail = user.getEmail();
            String fullName = user.getFullName();
            
            if (userEmail == null || userEmail.trim().isEmpty()) {
                emailStatus = "no_email";
                emailMessage = "用户未设置邮箱地址";
                logger.warn("Cannot send email to user {}: email address is not set", walletAddress);
            } else {
                try {
                    if (status.equals("approved")) {
                        emailService.sendKycApprovedEmail(userEmail, fullName);
                        emailStatus = "sent";
                        emailMessage = "邮件已发送";
                        logger.info("KYC approved email sent to: {} ({})", userEmail, walletAddress);
                    } else if (status.equals("rejected")) {
                        emailService.sendKycRejectedEmail(userEmail, fullName, user.getKycRejectionReason());
                        emailStatus = "sent";
                        emailMessage = "邮件已发送";
                        logger.info("KYC rejected email sent to: {} ({})", userEmail, walletAddress);
                    }
                } catch (Exception e) {
                    emailStatus = "failed";
                    emailMessage = "邮件发送失败: " + e.getMessage();
                    logger.error("Failed to send email to user {} ({}): {}", walletAddress, userEmail, e.getMessage(), e);
                }
            }
        } else {
            emailStatus = "disabled";
            emailMessage = "用户已禁用邮件通知";
            logger.info("Email notifications disabled for user: {}, skipping email", walletAddress);
        }
        */

        logger.info("KYC reviewed for {}: {} (email: {}, blockchain sync: {})", walletAddress, status, emailStatus, syncStatus);
        Map<String, Object> response = new HashMap<>();
        response.put("walletAddress", walletAddress);
        response.put("status", status);
        response.put("message", "KYC status updated successfully");
        response.put("blockchainSync", Map.of(
                "status", syncStatus,
                "message", syncMessage,
                "transactionHash", transactionHash != null ? transactionHash : "N/A"
        ));
        response.put("emailStatus", emailStatus);
        response.put("emailMessage", emailMessage);
        return ResponseEntity.ok(response);
    }

    /**
     * 获取黑名单列表
     */
    @GetMapping("/blacklist")
    public ResponseEntity<?> getBlacklist(
            @RequestHeader(value = "X-Wallet-Address", required = false) String walletAddress
    ) {
        ResponseEntity<?> permissionCheck = checkAdminPermission(walletAddress);
        if (permissionCheck != null) {
            return permissionCheck;
        }
        List<Map<String, Object>> result = blacklistRepository.findAll().stream().map(blacklist -> {
            Map<String, Object> map = new HashMap<>();
            map.put("id", blacklist.getId());
            map.put("walletAddress", blacklist.getWalletAddress());
            map.put("reason", blacklist.getReason());
            map.put("createdAt", blacklist.getCreatedAt());
            return map;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(result);
    }

    /**
     * 添加用户到黑名单
     */
    @PostMapping("/blacklist")
    public ResponseEntity<?> addToBlacklist(
            @RequestBody Map<String, String> request,
            @RequestHeader(value = "X-Wallet-Address", required = false) String adminAddress
    ) {
        ResponseEntity<?> permissionCheck = checkAdminPermission(adminAddress);
        if (permissionCheck != null) {
            return permissionCheck;
        }
        String walletAddress = request.get("walletAddress");
        String reason = request.get("reason");

        if (walletAddress == null || walletAddress.isEmpty()) {
            return ResponseEntity.badRequest().body("walletAddress is required");
        }

        final String normalizedAddress = walletAddress.toLowerCase();

        // 检查是否已在黑名单中
        if (blacklistRepository.findByWalletAddress(normalizedAddress).isPresent()) {
            return ResponseEntity.badRequest().body("Address already in blacklist");
        }

        AmlBlacklist blacklist = new AmlBlacklist();
        blacklist.setWalletAddress(normalizedAddress);
        blacklist.setReason(reason);
        blacklistRepository.save(blacklist);

        // 如果用户已通过 KYC，撤销其 KYC 状态
        userRepository.findByWalletAddress(normalizedAddress).ifPresent(user -> {
            if ("approved".equals(user.getKycStatus())) {
                user.setKycStatus("rejected");
                userRepository.save(user);
                
                // 同步到链上（设置为 Blacklisted）
                try {
                    kycRegistryService.setKYCStatus(normalizedAddress, "blacklisted");
                } catch (Exception e) {
                    logger.error("Failed to sync blacklist status to blockchain for {}: {}", normalizedAddress, e.getMessage(), e);
                }
            }
        });

        logger.info("Added {} to blacklist, reason: {}", normalizedAddress, reason);
        return ResponseEntity.ok(Map.of(
                "walletAddress", normalizedAddress,
                "message", "Address added to blacklist successfully"
        ));
    }

    /**
     * 从黑名单中移除用户
     */
    @DeleteMapping("/blacklist/{walletAddress}")
    public ResponseEntity<?> removeFromBlacklist(
            @PathVariable String walletAddress,
            @RequestHeader(value = "X-Wallet-Address", required = false) String adminAddress
    ) {
        ResponseEntity<?> permissionCheck = checkAdminPermission(adminAddress);
        if (permissionCheck != null) {
            return permissionCheck;
        }
        walletAddress = walletAddress.toLowerCase();
        
        AmlBlacklist blacklist = blacklistRepository.findByWalletAddress(walletAddress).orElse(null);
        if (blacklist == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Address not found in blacklist"));
        }

        blacklistRepository.delete(blacklist);
        logger.info("Removed {} from blacklist", walletAddress);
        return ResponseEntity.ok(Map.of(
                "walletAddress", walletAddress,
                "message", "Address removed from blacklist successfully"
        ));
    }

    /**
     * 获取 KYC 统计信息
     */
    @GetMapping("/stats")
    public ResponseEntity<?> getStats(
            @RequestHeader(value = "X-Wallet-Address", required = false) String walletAddress
    ) {
        ResponseEntity<?> permissionCheck = checkAdminPermission(walletAddress);
        if (permissionCheck != null) {
            return permissionCheck;
        }
        List<User> allUsers = userRepository.findAll();
        
        long total = allUsers.size();
        long none = allUsers.stream().filter(u -> "none".equals(u.getKycStatus())).count();
        long pending = allUsers.stream().filter(u -> "pending".equals(u.getKycStatus())).count();
        long approved = allUsers.stream().filter(u -> "approved".equals(u.getKycStatus())).count();
        long rejected = allUsers.stream().filter(u -> "rejected".equals(u.getKycStatus())).count();
        long blacklisted = blacklistRepository.count();

        Map<String, Object> stats = new HashMap<>();
        stats.put("total", total);
        stats.put("none", none);
        stats.put("pending", pending);
        stats.put("approved", approved);
        stats.put("rejected", rejected);
        stats.put("blacklisted", blacklisted);

        return ResponseEntity.ok(stats);
    }

    /**
     * 删除/重置用户的 KYC 记录
     * 将用户的 KYC 状态重置为 "none"，清除所有 KYC 相关数据，让用户重新提交
     */
    @DeleteMapping("/users/{walletAddress}/reset")
    public ResponseEntity<?> deleteKycRecord(
            @PathVariable String walletAddress,
            @RequestParam(required = false, defaultValue = "false") boolean clearData,
            @RequestHeader(value = "X-Wallet-Address", required = false) String adminAddress
    ) {
        ResponseEntity<?> permissionCheck = checkAdminPermission(adminAddress);
        if (permissionCheck != null) {
            return permissionCheck;
        }

        User user = userRepository.findByWalletAddress(walletAddress.toLowerCase()).orElse(null);
        if (user == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "User not found"));
        }

        // 重置 KYC 状态
        user.setKycStatus("none");
        user.setKycSubmittedAt(null);
        user.setKycApprovedAt(null);
        user.setKycRejectedAt(null);
        user.setKycRejectionReason(null);

        // 如果 clearData 为 true，清除所有 KYC 数据
        if (clearData) {
            user.setFullName(null);
            user.setIdNumber(null);
            user.setIdType(null);
            user.setAddress(null);
            user.setPhone(null);
            user.setIdDocumentFrontUrl(null);
            user.setIdDocumentBackUrl(null);
            user.setSelfieUrl(null);
            logger.info("Cleared all KYC data for user: {}", walletAddress);
        }

        userRepository.save(user);

        // 同步 KYC 状态到链上 KYCRegistry 合约（设置为 None）
        try {
            String transactionHash = kycRegistryService.setKYCStatus(walletAddress.toLowerCase(), "none");
            if (transactionHash != null) {
                logger.info("KYC status reset synced to blockchain. Transaction hash: {}", transactionHash);
            }
        } catch (Exception e) {
            logger.error("Failed to sync KYC reset status to blockchain for {}: {}", walletAddress, e.getMessage(), e);
            // 不抛出异常，允许链下状态更新成功，但记录错误
        }

        logger.info("KYC record deleted/reset for user: {} (clearData: {})", walletAddress, clearData);
        Map<String, Object> response = new HashMap<>();
        response.put("walletAddress", walletAddress);
        response.put("message", "KYC record deleted successfully. User needs to resubmit KYC application.");
        response.put("clearData", clearData);
        return ResponseEntity.ok(response);
    }

    /**
     * 批量删除/重置已审核的 KYC 记录
     * 删除所有状态为 "approved" 或 "rejected" 的用户记录
     */
    @DeleteMapping("/reset-reviewed")
    public ResponseEntity<?> resetAllReviewedKycRecords(
            @RequestParam(required = false, defaultValue = "false") boolean clearData,
            @RequestHeader(value = "X-Wallet-Address", required = false) String adminAddress
    ) {
        ResponseEntity<?> permissionCheck = checkAdminPermission(adminAddress);
        if (permissionCheck != null) {
            return permissionCheck;
        }

        List<User> reviewedUsers = userRepository.findAll().stream()
                .filter(u -> "approved".equals(u.getKycStatus()) || "rejected".equals(u.getKycStatus()))
                .collect(Collectors.toList());

        int resetCount = 0;
        for (User user : reviewedUsers) {
            // 重置 KYC 状态
            user.setKycStatus("none");
            user.setKycSubmittedAt(null);
            user.setKycApprovedAt(null);
            user.setKycRejectedAt(null);
            user.setKycRejectionReason(null);

            // 如果 clearData 为 true，清除所有 KYC 数据
            if (clearData) {
                user.setFullName(null);
                user.setIdNumber(null);
                user.setIdType(null);
                user.setAddress(null);
                user.setPhone(null);
                user.setIdDocumentFrontUrl(null);
                user.setIdDocumentBackUrl(null);
                user.setSelfieUrl(null);
            }

            userRepository.save(user);
            resetCount++;

            // 同步到链上（可选，批量操作可能较慢）
            try {
                kycRegistryService.setKYCStatus(user.getWalletAddress().toLowerCase(), "none");
            } catch (Exception e) {
                logger.error("Failed to sync KYC reset to blockchain for {}: {}", user.getWalletAddress(), e.getMessage());
            }
        }

        logger.info("Reset {} reviewed KYC records (clearData: {})", resetCount, clearData);
        Map<String, Object> response = new HashMap<>();
        response.put("resetCount", resetCount);
        response.put("message", String.format("Successfully reset %d reviewed KYC records", resetCount));
        response.put("clearData", clearData);
        return ResponseEntity.ok(response);
    }

    /**
     * 调试端点：检查当前地址是否为管理员（仅用于调试）
     */
    @GetMapping("/check-admin")
    public ResponseEntity<?> checkAdmin(
            @RequestHeader(value = "X-Wallet-Address", required = false) String walletAddress
    ) {
        Map<String, Object> result = new HashMap<>();
        if (walletAddress == null || walletAddress.isEmpty()) {
            result.put("isAdmin", false);
            result.put("message", "Wallet address is required");
            result.put("configuredAdmins", adminConfig.getAdminAddresses());
            return ResponseEntity.ok(result);
        }
        String normalizedAddress = walletAddress.toLowerCase();
        boolean isAdmin = adminConfig.isAdmin(normalizedAddress);
        result.put("isAdmin", isAdmin);
        result.put("providedAddress", normalizedAddress);
        result.put("configuredAdmins", adminConfig.getAdminAddresses());
        return ResponseEntity.ok(result);
    }

    /**
     * 授予 COMPLIANCE_ROLE 权限给后端钱包地址
     * 注意：调用此端点的地址必须是 KYCRegistry 合约的 DEFAULT_ADMIN_ROLE
     */
    @PostMapping("/grant-compliance-role")
    public ResponseEntity<?> grantComplianceRole(
            @RequestHeader(value = "X-Wallet-Address", required = false) String adminAddress
    ) {
        ResponseEntity<?> permissionCheck = checkAdminPermission(adminAddress);
        if (permissionCheck != null) {
            return permissionCheck;
        }

        try {
            // 获取后端钱包地址（需要授予权限的地址）
            String backendAddress = kycRegistryService.getCredentialsAddress();
            
            // 检查是否已有权限
            boolean hasRole = kycRegistryService.hasComplianceRole();
            if (hasRole) {
                Map<String, Object> response = new HashMap<>();
                response.put("message", "Backend address already has COMPLIANCE_ROLE");
                response.put("backendAddress", backendAddress);
                response.put("hasRole", true);
                return ResponseEntity.ok(response);
            }

            // 授予权限
            String transactionHash = kycRegistryService.grantComplianceRole(backendAddress);
            
            Map<String, Object> response = new HashMap<>();
            response.put("message", "COMPLIANCE_ROLE granted successfully");
            response.put("backendAddress", backendAddress);
            response.put("transactionHash", transactionHash);
            response.put("hasRole", true);
            return ResponseEntity.ok(response);

        } catch (Exception e) {
            logger.error("Failed to grant COMPLIANCE_ROLE: {}", e.getMessage(), e);
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("error", "Failed to grant COMPLIANCE_ROLE");
            errorResponse.put("message", e.getMessage());
            errorResponse.put("hint", "Make sure the caller address has DEFAULT_ADMIN_ROLE in KYCRegistry contract");
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
        }
    }

    /**
     * 检查后端钱包地址是否有 COMPLIANCE_ROLE 权限
     */
    @GetMapping("/check-compliance-role")
    public ResponseEntity<?> checkComplianceRole(
            @RequestHeader(value = "X-Wallet-Address", required = false) String walletAddress
    ) {
        ResponseEntity<?> permissionCheck = checkAdminPermission(walletAddress);
        if (permissionCheck != null) {
            return permissionCheck;
        }

        try {
            String backendAddress = kycRegistryService.getCredentialsAddress();
            boolean hasRole = kycRegistryService.hasComplianceRole();
            
            Map<String, Object> response = new HashMap<>();
            response.put("backendAddress", backendAddress);
            response.put("hasComplianceRole", hasRole);
            response.put("message", hasRole ? "Backend has COMPLIANCE_ROLE" : "Backend does not have COMPLIANCE_ROLE");
            
            if (!hasRole) {
                response.put("hint", "Call POST /api/admin/kyc/grant-compliance-role to grant permission");
            }
            
            return ResponseEntity.ok(response);

        } catch (Exception e) {
            logger.error("Failed to check COMPLIANCE_ROLE: {}", e.getMessage(), e);
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("error", "Failed to check COMPLIANCE_ROLE");
            errorResponse.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
        }
    }
}


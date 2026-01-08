package com.mantleluxury.backend.assets.api;

import com.mantleluxury.backend.assets.domain.User;
import com.mantleluxury.backend.assets.repository.UserRepository;
import com.mantleluxury.backend.assets.service.AmlService;
import com.mantleluxury.backend.blockchain.service.KYCRegistryService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/kyc")
public class KycController {

    private static final Logger logger = LoggerFactory.getLogger(KycController.class);

    private final UserRepository userRepository;
    private final AmlService amlService;
    private final KYCRegistryService kycRegistryService;

    public KycController(
            UserRepository userRepository, 
            AmlService amlService,
            KYCRegistryService kycRegistryService
    ) {
        this.userRepository = userRepository;
        this.amlService = amlService;
        this.kycRegistryService = kycRegistryService;
    }

    @GetMapping("/{walletAddress}")
    public ResponseEntity<Map<String, Object>> getStatus(@PathVariable String walletAddress) {
        User user = userRepository.findByWalletAddress(walletAddress.toLowerCase()).orElse(null);
        if (user == null) {
            return ResponseEntity.ok(Map.of(
                    "walletAddress", walletAddress,
                    "status", "none"
            ));
        }
        Map<String, Object> result = new HashMap<>();
        result.put("walletAddress", user.getWalletAddress());
        result.put("status", user.getKycStatus());
        result.put("email", user.getEmail());
        result.put("fullName", user.getFullName());
        result.put("idNumber", user.getIdNumber());
        result.put("idType", user.getIdType());
        result.put("address", user.getAddress());
        result.put("phone", user.getPhone());
        result.put("kycSubmittedAt", user.getKycSubmittedAt());
        result.put("kycApprovedAt", user.getKycApprovedAt());
        result.put("kycRejectedAt", user.getKycRejectedAt());
        result.put("kycRejectionReason", user.getKycRejectionReason());
        return ResponseEntity.ok(result);
    }

    @PostMapping("/submit")
    public ResponseEntity<?> submitKyc(@RequestBody Map<String, Object> payload) {
        try {
            String walletAddress = ((String) payload.get("walletAddress")).toLowerCase();
            String email = (String) payload.getOrDefault("email", null);
            String fullName = (String) payload.getOrDefault("fullName", null);
            String idNumber = (String) payload.getOrDefault("idNumber", null);
            String idType = (String) payload.getOrDefault("idType", null);
            String address = (String) payload.getOrDefault("address", null);
            String phone = (String) payload.getOrDefault("phone", null);
            String idDocumentFrontUrl = (String) payload.getOrDefault("idDocumentFrontUrl", null);
            String idDocumentBackUrl = (String) payload.getOrDefault("idDocumentBackUrl", null);
            String selfieUrl = (String) payload.getOrDefault("selfieUrl", null);

            if (walletAddress == null || walletAddress.isEmpty()) {
                return ResponseEntity.badRequest().body("walletAddress is required");
            }

            // 基本验证
            if (email == null || email.trim().isEmpty()) {
                return ResponseEntity.badRequest().body("email is required");
            }
            if (fullName == null || fullName.trim().isEmpty()) {
                return ResponseEntity.badRequest().body("fullName is required");
            }
            if (idNumber == null || idNumber.trim().isEmpty()) {
                return ResponseEntity.badRequest().body("idNumber is required");
            }

            // AML 基础校验
            amlService.checkAddress(walletAddress);

            User user = userRepository.findByWalletAddress(walletAddress).orElseGet(() -> {
                User newUser = new User();
                newUser.setWalletAddress(walletAddress);
                return newUser;
            });
            
            // 如果已经是pending或approved状态，不允许重新提交（除非被驳回）
            if ("pending".equals(user.getKycStatus())) {
                return ResponseEntity.badRequest().body("KYC application is already pending review");
            }
            if ("approved".equals(user.getKycStatus())) {
                return ResponseEntity.badRequest().body("KYC has already been approved");
            }

            // 更新用户信息
            user.setEmail(email);
            user.setFullName(fullName);
            user.setIdNumber(idNumber);
            user.setIdType(idType != null ? idType : "id_card");
            user.setAddress(address);
            user.setPhone(phone);
            user.setIdDocumentFrontUrl(idDocumentFrontUrl);
            user.setIdDocumentBackUrl(idDocumentBackUrl);
            user.setSelfieUrl(selfieUrl);
            user.setKycStatus("pending");
            user.setKycSubmittedAt(LocalDateTime.now());
            // 清除之前的驳回信息（如果重新提交）
            user.setKycRejectedAt(null);
            user.setKycRejectionReason(null);

            userRepository.save(user);
            return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
                    "walletAddress", walletAddress,
                    "status", "pending"
            ));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body("Failed to submit KYC: " + e.getMessage());
        }
    }

    // 简单的审批接口：实际中应有鉴权；这里用于 Demo
    // 注意：此接口会同步 KYC 状态到链上
    @PostMapping("/approve/{walletAddress}")
    public ResponseEntity<?> approve(@PathVariable String walletAddress) {
        User user = userRepository.findByWalletAddress(walletAddress.toLowerCase()).orElse(null);
        if (user == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("User not found");
        }
        
        // 保存 KYC 状态到数据库
        user.setKycStatus("approved");
        user.setKycApprovedAt(LocalDateTime.now());
        user.setKycRejectedAt(null);
        user.setKycRejectionReason(null);
        userRepository.save(user);
        
        // 同步 KYC 状态到链上 KYCRegistry 合约
        String transactionHash = null;
        String syncStatus = "success";
        String syncMessage = "KYC status synced to blockchain";
        try {
            transactionHash = kycRegistryService.setKYCStatus(walletAddress, "approved");
            if (transactionHash != null) {
                logger.info("KYC status synced to blockchain. Transaction hash: {}", transactionHash);
            } else {
                logger.warn("KYC status sync to blockchain returned null. Blockchain may be disabled.");
                syncStatus = "skipped";
                syncMessage = "Blockchain sync skipped (blockchain may be disabled)";
            }
        } catch (Exception e) {
            logger.error("Failed to sync KYC status to blockchain for {}: {}", walletAddress, e.getMessage(), e);
            syncStatus = "failed";
            syncMessage = "Blockchain sync failed: " + e.getMessage();
            // 即使链上同步失败，也返回成功，但记录错误日志
            // 实际生产环境可能需要重试机制或告警
        }
        
        Map<String, Object> response = new HashMap<>();
        response.put("walletAddress", walletAddress);
        response.put("status", "approved");
        response.put("blockchainSync", Map.of(
                "status", syncStatus,
                "message", syncMessage,
                "transactionHash", transactionHash != null ? transactionHash : "N/A"
        ));
        
        return ResponseEntity.ok(response);
    }
}



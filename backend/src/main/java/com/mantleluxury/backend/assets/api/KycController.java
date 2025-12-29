package com.mantleluxury.backend.assets.api;

import com.mantleluxury.backend.assets.domain.User;
import com.mantleluxury.backend.assets.repository.UserRepository;
import com.mantleluxury.backend.assets.service.AmlService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/kyc")
public class KycController {

    private final UserRepository userRepository;
    private final AmlService amlService;

    public KycController(UserRepository userRepository, AmlService amlService) {
        this.userRepository = userRepository;
        this.amlService = amlService;
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
    @PostMapping("/approve/{walletAddress}")
    public ResponseEntity<?> approve(@PathVariable String walletAddress) {
        User user = userRepository.findByWalletAddress(walletAddress).orElse(null);
        if (user == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("User not found");
        }
        user.setKycStatus("approved");
        user.setKycApprovedAt(LocalDateTime.now());
        userRepository.save(user);
        return ResponseEntity.ok(Map.of("walletAddress", walletAddress, "status", "approved"));
    }
}



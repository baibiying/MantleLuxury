package com.mantleluxury.backend.assets.api;

import com.mantleluxury.backend.assets.domain.User;
import com.mantleluxury.backend.assets.repository.UserRepository;
import com.mantleluxury.backend.assets.service.AmlService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.Map;

@RestController
@RequestMapping("/api/kyc")
@CrossOrigin(origins = "http://localhost:3000")
public class KycController {

    private final UserRepository userRepository;
    private final AmlService amlService;

    public KycController(UserRepository userRepository, AmlService amlService) {
        this.userRepository = userRepository;
        this.amlService = amlService;
    }

    @GetMapping("/{walletAddress}")
    public ResponseEntity<Map<String, Object>> getStatus(@PathVariable String walletAddress) {
        User user = userRepository.findByWalletAddress(walletAddress).orElse(null);
        String status = user != null ? user.getKycStatus() : "none";
        return ResponseEntity.ok(Map.of("walletAddress", walletAddress, "status", status));
    }

    @PostMapping("/submit")
    public ResponseEntity<?> submitKyc(@RequestBody Map<String, Object> payload) {
        try {
            String walletAddress = ((String) payload.get("walletAddress")).toLowerCase();
            String email = (String) payload.getOrDefault("email", null);

            if (walletAddress == null || walletAddress.isEmpty()) {
                return ResponseEntity.badRequest().body("walletAddress is required");
            }

            // AML 基础校验
            amlService.checkAddress(walletAddress);

            User user = userRepository.findByWalletAddress(walletAddress).orElseGet(User::new);
            user.setWalletAddress(walletAddress);
            user.setEmail(email);
            user.setKycStatus("pending");
            user.setKycSubmittedAt(LocalDateTime.now());

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



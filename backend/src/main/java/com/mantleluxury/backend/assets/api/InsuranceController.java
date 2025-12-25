package com.mantleluxury.backend.assets.api;

import com.mantleluxury.backend.assets.domain.Insurance;
import com.mantleluxury.backend.assets.service.InsuranceService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/insurances")
@CrossOrigin(origins = "http://localhost:3000")
public class InsuranceController {

    private static final Logger logger = LoggerFactory.getLogger(InsuranceController.class);

    private final InsuranceService insuranceService;

    public InsuranceController(InsuranceService insuranceService) {
        this.insuranceService = insuranceService;
    }

    /**
     * 创建保险记录
     */
    @PostMapping
    public ResponseEntity<?> createInsurance(@RequestBody Map<String, Object> payload) {
        try {
            String assetId = (String) payload.get("assetId");
            String insuranceCompany = (String) payload.get("insuranceCompany");
            String policyNumber = (String) payload.get("policyNumber");
            BigDecimal coverageAmount = payload.get("coverageAmount") != null
                    ? new BigDecimal(String.valueOf(payload.get("coverageAmount")))
                    : null;
            String coverageCurrency = (String) payload.getOrDefault("coverageCurrency", "USD");
            String policyStartDateStr = (String) payload.get("policyStartDate");
            String policyEndDateStr = (String) payload.get("policyEndDate");
            BigDecimal premiumAmount = payload.get("premiumAmount") != null
                    ? new BigDecimal(String.valueOf(payload.get("premiumAmount")))
                    : null;
            String coverageType = (String) payload.getOrDefault("coverageType", "全险");
            String policyDocumentUrl = (String) payload.get("policyDocumentUrl");
            String policyDocumentHash = (String) payload.get("policyDocumentHash");
            String notes = (String) payload.get("notes");

            if (assetId == null || insuranceCompany == null || coverageAmount == null || policyEndDateStr == null) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "assetId, insuranceCompany, coverageAmount, and policyEndDate are required"));
            }

            LocalDate policyStartDate = policyStartDateStr != null ? LocalDate.parse(policyStartDateStr) : null;
            LocalDate policyEndDate = LocalDate.parse(policyEndDateStr);

            Insurance insurance = insuranceService.createInsurance(
                    assetId, insuranceCompany, policyNumber, coverageAmount, coverageCurrency,
                    policyStartDate, policyEndDate, premiumAmount, coverageType,
                    policyDocumentUrl, policyDocumentHash, notes);

            return ResponseEntity.status(HttpStatus.CREATED).body(toDto(insurance));
        } catch (Exception e) {
            logger.error("Failed to create insurance", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * 续保
     */
    @PostMapping("/renew")
    public ResponseEntity<?> renewInsurance(@RequestBody Map<String, Object> payload) {
        try {
            String assetId = (String) payload.get("assetId");
            String insuranceCompany = (String) payload.get("insuranceCompany");
            String policyNumber = (String) payload.get("policyNumber");
            BigDecimal coverageAmount = new BigDecimal(String.valueOf(payload.get("coverageAmount")));
            String coverageCurrency = (String) payload.getOrDefault("coverageCurrency", "USD");
            String policyStartDateStr = (String) payload.get("policyStartDate");
            String policyEndDateStr = (String) payload.get("policyEndDate");
            BigDecimal premiumAmount = payload.get("premiumAmount") != null
                    ? new BigDecimal(String.valueOf(payload.get("premiumAmount")))
                    : null;
            String coverageType = (String) payload.getOrDefault("coverageType", "全险");
            String policyDocumentUrl = (String) payload.get("policyDocumentUrl");
            String policyDocumentHash = (String) payload.get("policyDocumentHash");
            String notes = (String) payload.get("notes");

            LocalDate policyStartDate = policyStartDateStr != null ? LocalDate.parse(policyStartDateStr) : null;
            LocalDate policyEndDate = LocalDate.parse(policyEndDateStr);

            Insurance insurance = insuranceService.renewInsurance(
                    assetId, insuranceCompany, policyNumber, coverageAmount, coverageCurrency,
                    policyStartDate, policyEndDate, premiumAmount, coverageType,
                    policyDocumentUrl, policyDocumentHash, notes);

            return ResponseEntity.status(HttpStatus.CREATED).body(toDto(insurance));
        } catch (Exception e) {
            logger.error("Failed to renew insurance", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * 获取资产的有效保险记录
     */
    @GetMapping("/asset/{assetId}")
    public ResponseEntity<?> getActiveInsuranceByAssetId(@PathVariable String assetId) {
        return insuranceService.getActiveInsuranceByAssetId(assetId)
                .map(insurance -> ResponseEntity.ok(toDto(insurance)))
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("error", "Active insurance record not found")));
    }

    /**
     * 获取资产的所有保险记录
     */
    @GetMapping("/asset/{assetId}/all")
    public ResponseEntity<List<Map<String, Object>>> getAllInsurancesByAssetId(@PathVariable String assetId) {
        List<Insurance> insurances = insuranceService.getInsurancesByAssetId(assetId);
        return ResponseEntity.ok(insurances.stream()
                .map(this::toDto)
                .collect(Collectors.toList()));
    }

    /**
     * 获取即将到期的保险（30天内）
     */
    @GetMapping("/expiring")
    public ResponseEntity<List<Map<String, Object>>> getExpiringInsurances(
            @RequestParam(defaultValue = "30") int daysBeforeExpiry) {
        List<Insurance> insurances = insuranceService.getExpiringInsurances(daysBeforeExpiry);
        return ResponseEntity.ok(insurances.stream()
                .map(this::toDto)
                .collect(Collectors.toList()));
    }

    /**
     * 转换为 DTO
     */
    private Map<String, Object> toDto(Insurance insurance) {
        Map<String, Object> dto = new HashMap<>();
        dto.put("id", insurance.getId());
        dto.put("assetId", insurance.getAssetId());
        dto.put("insuranceCompany", insurance.getInsuranceCompany());
        dto.put("policyNumber", insurance.getPolicyNumber());
        dto.put("coverageAmount", insurance.getCoverageAmount());
        dto.put("coverageCurrency", insurance.getCoverageCurrency());
        dto.put("policyStartDate", insurance.getPolicyStartDate());
        dto.put("policyEndDate", insurance.getPolicyEndDate());
        dto.put("premiumAmount", insurance.getPremiumAmount());
        dto.put("coverageType", insurance.getCoverageType());
        dto.put("policyDocumentUrl", insurance.getPolicyDocumentUrl());
        dto.put("policyDocumentHash", insurance.getPolicyDocumentHash());
        dto.put("isActive", insurance.getIsActive());
        dto.put("notes", insurance.getNotes());
        dto.put("createdAt", insurance.getCreatedAt());
        dto.put("updatedAt", insurance.getUpdatedAt());
        return dto;
    }
}






package com.mantleluxury.backend.assets.service;

import com.mantleluxury.backend.assets.domain.Asset;
import com.mantleluxury.backend.assets.domain.Insurance;
import com.mantleluxury.backend.assets.repository.AssetRepository;
import com.mantleluxury.backend.assets.repository.InsuranceRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

/**
 * 资产保险服务
 */
@Service
public class InsuranceService {

    private static final Logger logger = LoggerFactory.getLogger(InsuranceService.class);

    private final InsuranceRepository insuranceRepository;
    private final AssetRepository assetRepository;
    private final CustodyManagerIntegrationService custodyManagerIntegrationService;

    public InsuranceService(
            InsuranceRepository insuranceRepository,
            AssetRepository assetRepository,
            CustodyManagerIntegrationService custodyManagerIntegrationService
    ) {
        this.insuranceRepository = insuranceRepository;
        this.assetRepository = assetRepository;
        this.custodyManagerIntegrationService = custodyManagerIntegrationService;
    }

    /**
     * 创建保险记录
     */
    @Transactional
    public Insurance createInsurance(
            String assetId,
            String insuranceCompany,
            String policyNumber,
            BigDecimal coverageAmount,
            String coverageCurrency,
            LocalDate policyStartDate,
            LocalDate policyEndDate,
            BigDecimal premiumAmount,
            String coverageType,
            String policyDocumentUrl,
            String policyDocumentHash,
            String notes) {
        
        // 验证资产是否存在
        Asset asset = assetRepository.findById(assetId)
                .orElseThrow(() -> new RuntimeException("Asset not found: " + assetId));

        // 验证保额是否不低于估值（如果有估值）
        if (asset.getPurchasePrice() != null && coverageAmount != null) {
            BigDecimal valuation = asset.getPurchasePrice();
            if (coverageAmount.compareTo(valuation) < 0) {
                throw new RuntimeException(
                    String.format("保险金额 (%.2f %s) 不得低于资产估值 (%.2f)。", 
                        coverageAmount, coverageCurrency, valuation)
                );
            }
        }

        // 检查是否已有有效保险
        Optional<Insurance> existing = insuranceRepository.findByAssetId(assetId);
        if (existing.isPresent() && existing.get().getIsActive()) {
            // 将旧保险设为非活跃
            Insurance oldInsurance = existing.get();
            oldInsurance.setIsActive(false);
            insuranceRepository.save(oldInsurance);
        }

        Insurance insurance = new Insurance();
        insurance.setAssetId(assetId);
        insurance.setInsuranceCompany(insuranceCompany);
        insurance.setPolicyNumber(policyNumber);
        insurance.setCoverageAmount(coverageAmount);
        insurance.setCoverageCurrency(coverageCurrency != null ? coverageCurrency : "USD");
        insurance.setPolicyStartDate(policyStartDate != null ? policyStartDate : LocalDate.now());
        insurance.setPolicyEndDate(policyEndDate);
        insurance.setPremiumAmount(premiumAmount);
        insurance.setCoverageType(coverageType != null ? coverageType : "全险");
        insurance.setPolicyDocumentUrl(policyDocumentUrl);
        insurance.setPolicyDocumentHash(policyDocumentHash);
        insurance.setIsActive(true);
        insurance.setNotes(notes);

        // 更新资产的 insurance_info_hash
        if (policyDocumentHash != null && !policyDocumentHash.isEmpty()) {
            asset.setInsuranceInfoHash(policyDocumentHash);
            assetRepository.save(asset);
        }

        Insurance saved = insuranceRepository.save(insurance);
        logger.info("Created insurance record for asset {}: {}", assetId, saved.getId());
        
        // 尝试注册到链上 CustodyManager（如果资产同时有托管和保险）
        try {
            custodyManagerIntegrationService.tryRegisterAssetToCustodyManager(assetId);
        } catch (Exception e) {
            logger.warn("Failed to register asset to CustodyManager after creating insurance: {}", e.getMessage());
            // 不抛出异常，避免影响保险记录的创建
        }
        
        return saved;
    }

    /**
     * 更新保险记录
     */
    @Transactional
    public Insurance updateInsurance(
            String insuranceId,
            String policyNumber,
            BigDecimal coverageAmount,
            LocalDate policyEndDate,
            String notes) {
        
        Insurance insurance = insuranceRepository.findById(insuranceId)
                .orElseThrow(() -> new RuntimeException("Insurance record not found: " + insuranceId));

        if (policyNumber != null) {
            insurance.setPolicyNumber(policyNumber);
        }
        if (coverageAmount != null) {
            insurance.setCoverageAmount(coverageAmount);
        }
        if (policyEndDate != null) {
            insurance.setPolicyEndDate(policyEndDate);
        }
        if (notes != null) {
            insurance.setNotes(notes);
        }

        Insurance saved = insuranceRepository.save(insurance);
        logger.info("Updated insurance record: {}", insuranceId);
        return saved;
    }

    /**
     * 续保（创建新的保险记录，将旧的设为非活跃）
     */
    @Transactional
    public Insurance renewInsurance(
            String assetId,
            String insuranceCompany,
            String policyNumber,
            BigDecimal coverageAmount,
            String coverageCurrency,
            LocalDate policyStartDate,
            LocalDate policyEndDate,
            BigDecimal premiumAmount,
            String coverageType,
            String policyDocumentUrl,
            String policyDocumentHash,
            String notes) {
        
        // 将旧保险设为非活跃
        Optional<Insurance> oldInsurance = insuranceRepository.findByAssetId(assetId);
        if (oldInsurance.isPresent() && oldInsurance.get().getIsActive()) {
            oldInsurance.get().setIsActive(false);
            insuranceRepository.save(oldInsurance.get());
        }

        // 创建新保险记录
        return createInsurance(
                assetId, insuranceCompany, policyNumber, coverageAmount, coverageCurrency,
                policyStartDate, policyEndDate, premiumAmount, coverageType,
                policyDocumentUrl, policyDocumentHash, notes
        );
    }

    /**
     * 获取资产的有效保险记录
     */
    public Optional<Insurance> getActiveInsuranceByAssetId(String assetId) {
        List<Insurance> insurances = insuranceRepository.findByAssetIdAndIsActive(assetId, true);
        return insurances.isEmpty() ? Optional.empty() : Optional.of(insurances.get(0));
    }

    /**
     * 获取资产的所有保险记录
     */
    public List<Insurance> getInsurancesByAssetId(String assetId) {
        return insuranceRepository.findAllByAssetId(assetId);
    }

    /**
     * 获取所有有效保险
     */
    public List<Insurance> getAllActiveInsurances() {
        return insuranceRepository.findAll().stream()
                .filter(Insurance::getIsActive)
                .toList();
    }

    /**
     * 检查保险是否即将到期（30天内）
     */
    public List<Insurance> getExpiringInsurances(int daysBeforeExpiry) {
        LocalDate expiryDate = LocalDate.now().plusDays(daysBeforeExpiry);
        return insuranceRepository.findByIsActiveAndPolicyEndDateBefore(true, expiryDate);
    }
}


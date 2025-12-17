package com.mantleluxury.backend.assets.service;

import com.mantleluxury.backend.assets.domain.Asset;
import com.mantleluxury.backend.assets.domain.AssetAuthentication;
import com.mantleluxury.backend.assets.repository.AssetAuthenticationRepository;
import com.mantleluxury.backend.assets.repository.AssetRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

/**
 * 资产真伪认证服务
 */
@Service
public class AssetAuthenticationService {

    private static final Logger logger = LoggerFactory.getLogger(AssetAuthenticationService.class);

    private final AssetAuthenticationRepository authenticationRepository;
    private final AssetRepository assetRepository;

    public AssetAuthenticationService(
            AssetAuthenticationRepository authenticationRepository,
            AssetRepository assetRepository) {
        this.authenticationRepository = authenticationRepository;
        this.assetRepository = assetRepository;
    }

    /**
     * 创建认证记录
     */
    @Transactional
    public AssetAuthentication createAuthentication(
            String assetId,
            String authenticatorName,
            String authenticatorType,
            String reportUrl,
            String reportHash,
            String verifierSignature,
            String notes) {
        
        // 验证资产是否存在
        Asset asset = assetRepository.findById(assetId)
                .orElseThrow(() -> new RuntimeException("Asset not found: " + assetId));

        AssetAuthentication authentication = new AssetAuthentication();
        authentication.setAssetId(assetId);
        authentication.setAuthenticatorName(authenticatorName);
        authentication.setAuthenticatorType(authenticatorType);
        authentication.setAuthenticationStatus("pending");
        authentication.setVerificationDate(LocalDate.now());
        authentication.setReportUrl(reportUrl);
        authentication.setReportHash(reportHash);
        authentication.setVerifierSignature(verifierSignature);
        authentication.setNotes(notes);

        AssetAuthentication saved = authenticationRepository.save(authentication);
        logger.info("Created authentication record for asset {}: {}", assetId, saved.getId());
        return saved;
    }

    /**
     * 审核认证（通过或拒绝）
     * 当认证通过时，如果资产状态为 registered，且至少有一个已通过的认证，则自动将资产状态更新为 fundraising
     */
    @Transactional
    public AssetAuthentication reviewAuthentication(
            String authenticationId,
            String status, // "verified" or "rejected"
            String notes) {
        
        AssetAuthentication authentication = authenticationRepository.findById(authenticationId)
                .orElseThrow(() -> new RuntimeException("Authentication not found: " + authenticationId));

        if (!"verified".equals(status) && !"rejected".equals(status)) {
            throw new RuntimeException("Invalid status. Must be 'verified' or 'rejected'");
        }

        authentication.setAuthenticationStatus(status);
        if (notes != null && !notes.isEmpty()) {
            authentication.setNotes(notes);
        }

        AssetAuthentication saved = authenticationRepository.save(authentication);
        logger.info("Reviewed authentication {}: status = {}", authenticationId, status);
        
        // 如果认证通过，检查资产是否可以进入募集中状态
        if ("verified".equals(status)) {
            updateAssetStatusIfAuthenticated(authentication.getAssetId());
        }
        
        return saved;
    }
    
    /**
     * 检查资产是否有已通过的认证，如果有且资产状态为 registered，则更新为 fundraising
     */
    @Transactional
    private void updateAssetStatusIfAuthenticated(String assetId) {
        // 检查是否有至少一个已通过的认证
        long verifiedCount = authenticationRepository.countByAssetIdAndAuthenticationStatus(assetId, "verified");
        
        if (verifiedCount > 0) {
            // 获取资产并检查状态
            Asset asset = assetRepository.findById(assetId)
                    .orElse(null);
            
            if (asset != null && "registered".equals(asset.getStatus())) {
                asset.setStatus("fundraising");
                assetRepository.save(asset);
                logger.info("Asset {} status updated to fundraising after authentication verification", assetId);
            }
        }
    }

    /**
     * 获取资产的所有认证记录
     */
    public List<AssetAuthentication> getAssetAuthentications(String assetId) {
        return authenticationRepository.findByAssetId(assetId);
    }

    /**
     * 获取资产已通过的认证记录
     */
    public List<AssetAuthentication> getVerifiedAuthentications(String assetId) {
        return authenticationRepository.findByAssetIdAndAuthenticationStatus(assetId, "verified");
    }

    /**
     * 检查资产是否有至少一个已通过的认证
     */
    public boolean hasVerifiedAuthentication(String assetId) {
        return authenticationRepository.countByAssetIdAndAuthenticationStatus(assetId, "verified") > 0;
    }

    /**
     * 获取认证记录详情
     */
    public Optional<AssetAuthentication> getAuthentication(String authenticationId) {
        return authenticationRepository.findById(authenticationId);
    }
}


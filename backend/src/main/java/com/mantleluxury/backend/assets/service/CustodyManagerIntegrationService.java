package com.mantleluxury.backend.assets.service;

import com.mantleluxury.backend.assets.domain.Asset;
import com.mantleluxury.backend.assets.domain.Custody;
import com.mantleluxury.backend.assets.domain.Insurance;
import com.mantleluxury.backend.assets.repository.AssetRepository;
import com.mantleluxury.backend.assets.repository.CustodyRepository;
import com.mantleluxury.backend.assets.repository.InsuranceRepository;
import com.mantleluxury.backend.blockchain.service.CustodyManagerService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Optional;

/**
 * CustodyManager 集成服务
 * 负责在资产有托管和保险后，自动注册到链上 CustodyManager 合约
 */
@Service
public class CustodyManagerIntegrationService {

    private static final Logger logger = LoggerFactory.getLogger(CustodyManagerIntegrationService.class);

    private final CustodyManagerService custodyManagerService;
    private final AssetRepository assetRepository;
    private final CustodyRepository custodyRepository;
    private final InsuranceRepository insuranceRepository;

    public CustodyManagerIntegrationService(
            CustodyManagerService custodyManagerService,
            AssetRepository assetRepository,
            CustodyRepository custodyRepository,
            InsuranceRepository insuranceRepository
    ) {
        this.custodyManagerService = custodyManagerService;
        this.assetRepository = assetRepository;
        this.custodyRepository = custodyRepository;
        this.insuranceRepository = insuranceRepository;
    }

    /**
     * 检查资产是否同时有托管和保险，如果有则注册到链上 CustodyManager
     * 这个方法应该在创建托管或保险记录后调用
     * @param assetId 资产ID
     */
    @Transactional
    public void tryRegisterAssetToCustodyManager(String assetId) {
        try {
            Asset asset = assetRepository.findById(assetId)
                    .orElse(null);
            
            if (asset == null) {
                logger.debug("Asset not found: {}, skipping CustodyManager registration", assetId);
                return;
            }

            // 检查资产是否有代币地址（必须要有代币才能注册到 CustodyManager）
            if (asset.getTokenAddress() == null || asset.getTokenAddress().isEmpty()) {
                logger.debug("Asset {} has no token address, skipping CustodyManager registration", assetId);
                return;
            }

            // 检查是否已有托管记录
            Optional<Custody> custodyOpt = custodyRepository.findByAssetId(assetId);
            if (custodyOpt.isEmpty()) {
                logger.debug("Asset {} has no custody record, skipping CustodyManager registration", assetId);
                return;
            }

            Custody custody = custodyOpt.get();
            if (!"in_custody".equals(custody.getCustodyStatus())) {
                logger.debug("Asset {} custody status is not 'in_custody', skipping CustodyManager registration", assetId);
                return;
            }

            // 检查是否已有有效保险
            Optional<Insurance> insuranceOpt = insuranceRepository.findAllByAssetId(assetId)
                    .stream()
                    .filter(Insurance::getIsActive)
                    .findFirst();
            
            if (insuranceOpt.isEmpty()) {
                logger.debug("Asset {} has no active insurance, skipping CustodyManager registration", assetId);
                return;
            }

            Insurance insurance = insuranceOpt.get();

            // 检查资产是否已经在 CustodyManager 中注册
            try {
                boolean isRegistered = custodyManagerService.isAssetRegistered(asset.getAssetIdBytes32());
                if (isRegistered) {
                    logger.info("Asset {} is already registered in CustodyManager, skipping", assetId);
                    return;
                }
            } catch (Exception e) {
                logger.warn("Failed to check if asset is registered in CustodyManager: {}", e.getMessage());
                // 继续尝试注册
            }

            // 准备托管信息哈希（优先使用 custodyContractHash，否则生成一个）
            String custodyInfoHash = asset.getCustodyInfoHash();
            if (custodyInfoHash == null || custodyInfoHash.isEmpty()) {
                // 如果没有哈希，基于托管信息生成一个
                custodyInfoHash = generateHashFromCustody(custody);
                asset.setCustodyInfoHash(custodyInfoHash);
            }

            // 准备保险信息哈希（优先使用 policyDocumentHash，否则生成一个）
            String insuranceInfoHash = asset.getInsuranceInfoHash();
            if (insuranceInfoHash == null || insuranceInfoHash.isEmpty()) {
                // 如果没有哈希，基于保险信息生成一个
                insuranceInfoHash = generateHashFromInsurance(insurance);
                asset.setInsuranceInfoHash(insuranceInfoHash);
            }

            // 确保哈希格式正确（bytes32，66字符，0x开头）
            custodyInfoHash = normalizeHash(custodyInfoHash);
            insuranceInfoHash = normalizeHash(insuranceInfoHash);

            // 注册到链上 CustodyManager
            logger.info("Registering asset {} to CustodyManager on-chain...", assetId);
            String txHash = custodyManagerService.registerAsset(
                    asset.getAssetIdBytes32(),
                    asset.getTokenAddress(),
                    custodyInfoHash,
                    insuranceInfoHash
            );

            if (txHash != null) {
                logger.info("Successfully registered asset {} to CustodyManager. TxHash: {}", assetId, txHash);
                // 更新资产状态（可选：可以更新为 in_custody 或保持 registered）
                // asset.setStatus("in_custody");
                assetRepository.save(asset);
            } else {
                logger.warn("CustodyManager registration returned null txHash for asset {}", assetId);
            }

        } catch (Exception e) {
            logger.error("Failed to register asset {} to CustodyManager: {}", assetId, e.getMessage(), e);
            // 不抛出异常，避免影响托管/保险记录的创建
        }
    }

    /**
     * 基于托管信息生成哈希
     */
    private String generateHashFromCustody(Custody custody) {
        try {
            String data = String.format("%s|%s|%s|%s",
                    custody.getCustodyOrganization(),
                    custody.getWarehouseLocation(),
                    custody.getEntryDate(),
                    custody.getCustodyContractHash() != null ? custody.getCustodyContractHash() : ""
            );
            return generateHash(data);
        } catch (Exception e) {
            logger.error("Failed to generate hash from custody: {}", e.getMessage());
            // 返回一个默认哈希
            return generateHash(custody.getId() + custody.getCreatedAt().toString());
        }
    }

    /**
     * 基于保险信息生成哈希
     */
    private String generateHashFromInsurance(Insurance insurance) {
        try {
            String data = String.format("%s|%s|%s|%s|%s",
                    insurance.getInsuranceCompany(),
                    insurance.getPolicyNumber(),
                    insurance.getCoverageAmount(),
                    insurance.getPolicyStartDate(),
                    insurance.getPolicyDocumentHash() != null ? insurance.getPolicyDocumentHash() : ""
            );
            return generateHash(data);
        } catch (Exception e) {
            logger.error("Failed to generate hash from insurance: {}", e.getMessage());
            // 返回一个默认哈希
            return generateHash(insurance.getId() + insurance.getCreatedAt().toString());
        }
    }

    /**
     * 生成 SHA-256 哈希（bytes32 格式）
     */
    private String generateHash(String data) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(data.getBytes(StandardCharsets.UTF_8));
            // 取前32字节（bytes32）
            byte[] bytes32 = new byte[32];
            System.arraycopy(hash, 0, bytes32, 0, 32);
            return "0x" + bytesToHex(bytes32);
        } catch (Exception e) {
            logger.error("Failed to generate hash: {}", e.getMessage());
            // 返回一个基于数据的简单哈希
            return "0x" + Integer.toHexString(data.hashCode()).repeat(16).substring(0, 64);
        }
    }

    /**
     * 规范化哈希格式（确保是 0x + 64 个十六进制字符）
     */
    private String normalizeHash(String hash) {
        if (hash == null || hash.isEmpty()) {
            return "0x" + "0".repeat(64);
        }
        String clean = hash.startsWith("0x") ? hash.substring(2) : hash;
        if (clean.length() < 64) {
            clean = String.format("%64s", clean).replace(' ', '0');
        } else if (clean.length() > 64) {
            clean = clean.substring(0, 64);
        }
        return "0x" + clean;
    }

    /**
     * 将字节数组转换为十六进制字符串
     */
    private String bytesToHex(byte[] bytes) {
        StringBuilder result = new StringBuilder();
        for (byte b : bytes) {
            result.append(String.format("%02x", b));
        }
        return result.toString();
    }
}


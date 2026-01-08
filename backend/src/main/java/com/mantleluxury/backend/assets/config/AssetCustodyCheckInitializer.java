package com.mantleluxury.backend.assets.config;

import com.mantleluxury.backend.assets.domain.Asset;
import com.mantleluxury.backend.assets.repository.AssetRepository;
import com.mantleluxury.backend.blockchain.service.LuxuryTokenService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * 应用启动时自动修复所有"募集中"资产的托管检查
 * 确保所有"募集中"状态的资产都禁用了托管检查，这样投资者购买时不需要检查托管状态
 */
@Component
public class AssetCustodyCheckInitializer implements ApplicationRunner {

    private static final Logger logger = LoggerFactory.getLogger(AssetCustodyCheckInitializer.class);

    private final AssetRepository assetRepository;
    private final LuxuryTokenService luxuryTokenService;

    public AssetCustodyCheckInitializer(
            AssetRepository assetRepository,
            LuxuryTokenService luxuryTokenService
    ) {
        this.assetRepository = assetRepository;
        this.luxuryTokenService = luxuryTokenService;
    }

    @Override
    public void run(ApplicationArguments args) throws Exception {
        logger.info("Starting asset custody check initialization...");
        
        // 查找所有"募集中"状态的资产
        List<Asset> fundraisingAssets = assetRepository.findByStatus("fundraising");
        logger.info("Found {} assets with fundraising status", fundraisingAssets.size());
        
        if (fundraisingAssets.isEmpty()) {
            logger.info("No fundraising assets found. Skipping custody check initialization.");
            return;
        }
        
        int successCount = 0;
        int failCount = 0;
        int skipCount = 0;
        
        for (Asset asset : fundraisingAssets) {
            if (asset.getTokenAddress() == null || asset.getTokenAddress().isEmpty()) {
                logger.debug("Skipping asset {} - no token address", asset.getId());
                skipCount++;
                continue;
            }
            
            try {
                logger.info("Disabling custody check for asset {} (token: {})...", 
                        asset.getId(), asset.getTokenAddress());
                String txHash = luxuryTokenService.setCustodyCheckEnabled(asset.getTokenAddress(), false);
                if (txHash != null) {
                    successCount++;
                    logger.info("✅ Successfully disabled custody check for asset {} ({}). TxHash: {}", 
                            asset.getId(), asset.getBrand() + " " + asset.getModel(), txHash);
                } else {
                    failCount++;
                    logger.warn("Failed to disable custody check for asset {} (txHash is null)", asset.getId());
                }
            } catch (Exception e) {
                failCount++;
                logger.error("Failed to disable custody check for asset {}: {}", 
                        asset.getId(), e.getMessage(), e);
            }
        }
        
        logger.info("Asset custody check initialization completed: {} total, {} success, {} failed, {} skipped", 
                fundraisingAssets.size(), successCount, failCount, skipCount);
    }
}


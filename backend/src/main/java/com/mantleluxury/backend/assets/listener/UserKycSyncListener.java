package com.mantleluxury.backend.assets.listener;

import com.mantleluxury.backend.assets.domain.User;
import com.mantleluxury.backend.blockchain.service.KYCRegistryService;
import jakarta.persistence.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.BeansException;
import org.springframework.context.ApplicationContext;

/**
 * User 实体的 KYC 状态同步监听器
 * 当 KYC 状态变更为 "approved"、"rejected"、"none" 或 "blacklisted" 时，自动同步到链上
 * 
 * 注意：JPA Entity Listener 不能直接注入 Spring Bean，需要通过 ApplicationContext 获取
 */
public class UserKycSyncListener {

    private static final Logger logger = LoggerFactory.getLogger(UserKycSyncListener.class);

    private static ApplicationContext applicationContext;

    /**
     * 设置 ApplicationContext（由 Spring 容器调用）
     */
    public static void setApplicationContext(ApplicationContext context) {
        applicationContext = context;
    }

    /**
     * 在 User 实体更新后触发
     * 如果 KYC 状态变更为需要同步的状态（approved/rejected/none/blacklisted），自动同步到链上
     * 
     * 注意：由于 Controller/Service 层已经显式同步，这里作为兜底机制。
     * 如果 KYC 状态从其他途径（如直接数据库操作）被修改，也会自动同步。
     */
    @PostUpdate
    public void syncKycStatusToBlockchain(User user) {
        // 从 ApplicationContext 获取 Service（因为 JPA Listener 不能直接注入）
        if (applicationContext == null) {
            logger.debug("ApplicationContext not initialized. Skipping blockchain sync.");
            return;
        }

        try {
            KYCRegistryService kycRegistryService = applicationContext.getBean(KYCRegistryService.class);
            
            String walletAddress = user.getWalletAddress();
            String kycStatus = user.getKycStatus();

            if (walletAddress == null || kycStatus == null) {
                return;
            }

            // 只有在状态为 approved、rejected、none 或 blacklisted 时才同步
            // pending 状态不需要同步到链上
            if ("approved".equals(kycStatus) || 
                "rejected".equals(kycStatus) || 
                "none".equals(kycStatus) || 
                "blacklisted".equals(kycStatus)) {
                
                logger.info("Auto-syncing KYC status to blockchain via Entity Listener: {} -> {}", walletAddress, kycStatus);
                
                try {
                    // 使用异步方式同步，避免阻塞数据库事务
                    // 注意：这里仍然会等待交易提交，但在事务提交后执行
                    String transactionHash = kycRegistryService.setKYCStatus(walletAddress, kycStatus);
                    if (transactionHash != null) {
                        logger.info("KYC status auto-synced to blockchain via Entity Listener. Transaction hash: {}", transactionHash);
                    } else {
                        logger.debug("KYC status auto-sync returned null (blockchain may be disabled or already synced)");
                    }
                } catch (Exception e) {
                    logger.error("Failed to auto-sync KYC status to blockchain for {}: {}", 
                            walletAddress, e.getMessage(), e);
                    // 不抛出异常，避免影响正常的数据库操作
                }
            }
        } catch (BeansException e) {
            logger.error("Failed to get KYCRegistryService from ApplicationContext: {}", e.getMessage(), e);
        } catch (Exception e) {
            logger.error("Unexpected error in UserKycSyncListener: {}", e.getMessage(), e);
        }
    }
}


package com.mantleluxury.backend.assets.service;

import com.mantleluxury.backend.assets.domain.User;
import com.mantleluxury.backend.assets.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

/**
 * 用户设置服务
 */
@Service
public class UserSettingsService {

    private static final Logger logger = LoggerFactory.getLogger(UserSettingsService.class);

    private final UserRepository userRepository;

    public UserSettingsService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    /**
     * 获取用户设置
     */
    public Optional<UserSettingsDto> getUserSettings(String walletAddress) {
        Optional<User> userOpt = userRepository.findByWalletAddress(walletAddress);
        if (userOpt.isEmpty()) {
            return Optional.empty();
        }
        User user = userOpt.get();
        return Optional.of(new UserSettingsDto(
                user.getEmail(),
                user.getEmailNotifications() != null ? user.getEmailNotifications() : true,
                user.getYieldNotifications() != null ? user.getYieldNotifications() : true,
                user.getAnnouncementNotifications() != null ? user.getAnnouncementNotifications() : true
        ));
    }

    /**
     * 更新用户邮箱
     */
    @Transactional
    public boolean updateEmail(String walletAddress, String email) {
        Optional<User> userOpt = userRepository.findByWalletAddress(walletAddress);
        if (userOpt.isEmpty()) {
            // 如果用户不存在，创建新用户
            User newUser = new User();
            newUser.setWalletAddress(walletAddress);
            newUser.setEmail(email);
            newUser.setKycStatus("none");
            userRepository.save(newUser);
            logger.info("Created new user with wallet address: {}", walletAddress);
            return true;
        }
        User user = userOpt.get();
        user.setEmail(email);
        userRepository.save(user);
        logger.info("Updated email for user: {}", walletAddress);
        return true;
    }

    /**
     * 更新通知偏好
     */
    @Transactional
    public boolean updateNotificationPreferences(String walletAddress, Boolean emailNotifications, Boolean yieldNotifications, Boolean announcementNotifications) {
        Optional<User> userOpt = userRepository.findByWalletAddress(walletAddress);
        if (userOpt.isEmpty()) {
            // 如果用户不存在，创建新用户
            User newUser = new User();
            newUser.setWalletAddress(walletAddress);
            newUser.setEmailNotifications(emailNotifications != null ? emailNotifications : true);
            newUser.setYieldNotifications(yieldNotifications != null ? yieldNotifications : true);
            newUser.setAnnouncementNotifications(announcementNotifications != null ? announcementNotifications : true);
            newUser.setKycStatus("none");
            userRepository.save(newUser);
            logger.info("Created new user with wallet address: {}", walletAddress);
            return true;
        }
        User user = userOpt.get();
        if (emailNotifications != null) {
            user.setEmailNotifications(emailNotifications);
        }
        if (yieldNotifications != null) {
            user.setYieldNotifications(yieldNotifications);
        }
        if (announcementNotifications != null) {
            user.setAnnouncementNotifications(announcementNotifications);
        }
        userRepository.save(user);
        logger.info("Updated notification preferences for user: {}", walletAddress);
        return true;
    }

    /**
     * 用户设置 DTO
     */
    public record UserSettingsDto(
            String email,
            Boolean emailNotifications,
            Boolean yieldNotifications,
            Boolean announcementNotifications
    ) {
    }
}






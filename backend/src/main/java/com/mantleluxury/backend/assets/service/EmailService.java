package com.mantleluxury.backend.assets.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

/**
 * 邮件服务
 * 用于发送 KYC 审核结果通知等邮件
 */
@Service
public class EmailService {

    private static final Logger logger = LoggerFactory.getLogger(EmailService.class);

    private final JavaMailSender mailSender;

    @Value("${spring.mail.from:noreply@mantleluxury.com}")
    private String fromEmail;

    public EmailService(JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    /**
     * 发送 KYC 审核通过通知
     * @throws RuntimeException 如果邮件发送失败
     */
    public void sendKycApprovedEmail(String toEmail, String fullName) {
        if (toEmail == null || toEmail.trim().isEmpty()) {
            logger.warn("Cannot send KYC approved email: email address is empty");
            throw new IllegalArgumentException("Email address is empty");
        }

        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(fromEmail);
            message.setTo(toEmail);
            message.setSubject("【MantleLuxury】KYC 审核通过通知");
            message.setText(buildKycApprovedEmailContent(fullName));
            mailSender.send(message);
            logger.info("KYC approved email sent successfully to: {}", toEmail);
        } catch (Exception e) {
            logger.error("Failed to send KYC approved email to {}: {}", toEmail, e.getMessage(), e);
            throw new RuntimeException("Failed to send email: " + e.getMessage(), e);
        }
    }

    /**
     * 发送 KYC 审核拒绝通知
     * @throws RuntimeException 如果邮件发送失败
     */
    public void sendKycRejectedEmail(String toEmail, String fullName, String rejectionReason) {
        if (toEmail == null || toEmail.trim().isEmpty()) {
            logger.warn("Cannot send KYC rejected email: email address is empty");
            throw new IllegalArgumentException("Email address is empty");
        }

        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(fromEmail);
            message.setTo(toEmail);
            message.setSubject("【MantleLuxury】KYC 审核结果通知");
            message.setText(buildKycRejectedEmailContent(fullName, rejectionReason));
            mailSender.send(message);
            logger.info("KYC rejected email sent successfully to: {}", toEmail);
        } catch (Exception e) {
            logger.error("Failed to send KYC rejected email to {}: {}", toEmail, e.getMessage(), e);
            throw new RuntimeException("Failed to send email: " + e.getMessage(), e);
        }
    }

    /**
     * 构建 KYC 审核通过邮件内容
     */
    private String buildKycApprovedEmailContent(String fullName) {
        return String.format(
            "尊敬的 %s，\n\n" +
            "恭喜！您的 KYC（了解您的客户）审核已通过。\n\n" +
            "您现在可以：\n" +
            "• 浏览和投资平台上的奢侈品 RWA 资产\n" +
            "• 提交您的奢侈品资产进行代币化\n" +
            "• 查看您的投资组合和收益记录\n\n" +
            "如有任何问题，请随时联系我们的客服团队。\n\n" +
            "感谢您选择 MantleLuxury！\n\n" +
            "此邮件由系统自动发送，请勿回复。\n" +
            "MantleLuxury 团队",
            fullName != null && !fullName.isEmpty() ? fullName : "用户"
        );
    }

    /**
     * 构建 KYC 审核拒绝邮件内容
     */
    private String buildKycRejectedEmailContent(String fullName, String rejectionReason) {
        String reasonText = rejectionReason != null && !rejectionReason.trim().isEmpty()
            ? "\n拒绝原因：" + rejectionReason + "\n"
            : "\n";
        
        return String.format(
            "尊敬的 %s，\n\n" +
            "很遗憾，您的 KYC（了解您的客户）审核未通过。%s" +
            "您可以：\n" +
            "• 根据拒绝原因修正您的信息\n" +
            "• 重新提交 KYC 申请\n" +
            "• 如有疑问，请联系我们的客服团队\n\n" +
            "感谢您的理解与配合。\n\n" +
            "此邮件由系统自动发送，请勿回复。\n" +
            "MantleLuxury 团队",
            fullName != null && !fullName.isEmpty() ? fullName : "用户",
            reasonText
        );
    }
}


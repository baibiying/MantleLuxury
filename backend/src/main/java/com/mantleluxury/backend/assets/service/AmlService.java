package com.mantleluxury.backend.assets.service;

import com.mantleluxury.backend.assets.domain.AmlAlert;
import com.mantleluxury.backend.assets.repository.AmlAlertRepository;
import com.mantleluxury.backend.assets.repository.AmlBlacklistRepository;
import com.mantleluxury.backend.assets.repository.UserInvestmentRepository;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;

@Service
public class AmlService {

    private final AmlBlacklistRepository blacklistRepository;
    private final UserInvestmentRepository investmentRepository;
    private final AmlAlertRepository alertRepository;

    // 简单额度阈值（可改为配置）
    private static final BigDecimal SINGLE_TX_LIMIT = new BigDecimal("10000"); // MNT
    private static final BigDecimal TOTAL_LIMIT = new BigDecimal("50000"); // MNT

    public AmlService(
            AmlBlacklistRepository blacklistRepository,
            UserInvestmentRepository investmentRepository,
            AmlAlertRepository alertRepository
    ) {
        this.blacklistRepository = blacklistRepository;
        this.investmentRepository = investmentRepository;
        this.alertRepository = alertRepository;
    }

    /**
     * 基础黑名单与额度校验，不通过则抛异常
     */
    public void checkAddress(String walletAddress) {
        if (walletAddress == null) {
            throw new RuntimeException("钱包地址缺失");
        }
        String addr = walletAddress.toLowerCase();
        blacklistRepository.findByWalletAddress(addr).ifPresent(b -> {
            // 记录 AML 告警
            AmlAlert alert = new AmlAlert();
            alert.setWalletAddress(addr);
            alert.setAlertType("blacklist_hit");
            alert.setRiskLevel("high");
            alert.setSource("internal_rule");
            alert.setMessage("地址在 AML 黑名单中，原因: " + (b.getReason() == null ? "风控限制" : b.getReason()));
            alertRepository.save(alert);

            throw new RuntimeException("地址在黑名单中，原因: " + (b.getReason() == null ? "风控限制" : b.getReason()));
        });
    }

    /**
     * 校验投资额度：单笔 + 累计
     */
    public void checkInvestmentLimits(String walletAddress, BigDecimal amountMnt) {
        if (amountMnt == null) amountMnt = BigDecimal.ZERO;
        // 单笔限额
        if (amountMnt.compareTo(SINGLE_TX_LIMIT) > 0) {
            AmlAlert alert = new AmlAlert();
            alert.setWalletAddress(walletAddress.toLowerCase());
            alert.setAlertType("single_tx_limit");
            alert.setRiskLevel("medium");
            alert.setSource("internal_rule");
            alert.setMessage("单笔投资超出限额: " + amountMnt.toPlainString() + " MNT");
            alertRepository.save(alert);

            throw new RuntimeException("单笔投资超出限额，请联系人工审核");
        }
        // 累计限额
        BigDecimal total = investmentRepository.findByUserAddress(walletAddress.toLowerCase()).stream()
                .map(inv -> inv.getInvestedAmountMnt() == null ? BigDecimal.ZERO : inv.getInvestedAmountMnt())
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal newTotal = total.add(amountMnt);
        if (newTotal.compareTo(TOTAL_LIMIT) > 0) {
            AmlAlert alert = new AmlAlert();
            alert.setWalletAddress(walletAddress.toLowerCase());
            alert.setAlertType("total_limit");
            alert.setRiskLevel("medium");
            alert.setSource("internal_rule");
            alert.setMessage("累计投资超出限额: 当前累计 " + newTotal.toPlainString() + " MNT");
            alertRepository.save(alert);

            throw new RuntimeException("累计投资超出限额，请联系人工审核");
        }
    }
}





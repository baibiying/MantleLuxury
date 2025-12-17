package com.mantleluxury.backend.assets.api;

import com.mantleluxury.backend.assets.domain.User;
import com.mantleluxury.backend.assets.domain.UserInvestment;
import com.mantleluxury.backend.assets.domain.YieldDistribution;
import com.mantleluxury.backend.assets.repository.UserInvestmentRepository;
import com.mantleluxury.backend.assets.repository.UserRepository;
import com.mantleluxury.backend.assets.repository.YieldDistributionRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 平台概览统计 API（用于首页关键指标）
 */
@RestController
@RequestMapping("/api/stats")
@CrossOrigin(origins = "http://localhost:3000")
public class StatsController {

    private final UserRepository userRepository;
    private final UserInvestmentRepository investmentRepository;
    private final YieldDistributionRepository yieldDistributionRepository;

    public StatsController(
            UserRepository userRepository,
            UserInvestmentRepository investmentRepository,
            YieldDistributionRepository yieldDistributionRepository
    ) {
        this.userRepository = userRepository;
        this.investmentRepository = investmentRepository;
        this.yieldDistributionRepository = yieldDistributionRepository;
    }

    @GetMapping("/overview")
    public ResponseEntity<Map<String, Object>> getOverview() {
        List<User> users = userRepository.findAll();
        List<UserInvestment> investments = investmentRepository.findAll();
        List<YieldDistribution> yields = yieldDistributionRepository.findAll();

        long totalUsers = users.size();
        long kycApprovedUsers = users.stream()
                .filter(u -> "approved".equalsIgnoreCase(u.getKycStatus()))
                .count();

        // 简化的 AUM：所有投资记录的投资金额总和（MNT）
        BigDecimal aum = investments.stream()
                .map(inv -> inv.getInvestedAmountMnt() == null ? BigDecimal.ZERO : inv.getInvestedAmountMnt())
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // 累计收益：对每条分配记录，已完成用 distributedAmount，未完成用 totalAmount
        BigDecimal totalYield = yields.stream()
                .map(dist -> {
                    if (Boolean.TRUE.equals(dist.getIsCompleted())) {
                        return dist.getDistributedAmount() == null ? BigDecimal.ZERO : dist.getDistributedAmount();
                    }
                    return dist.getTotalAmount() == null ? BigDecimal.ZERO : dist.getTotalAmount();
                })
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        Map<String, Object> overview = new HashMap<>();
        overview.put("totalUsers", totalUsers);
        overview.put("kycApprovedUsers", kycApprovedUsers);
        overview.put("aum", aum);
        overview.put("totalYield", totalYield);
        overview.put("yieldDistributions", yields.size());

        return ResponseEntity.ok(overview);
    }
}



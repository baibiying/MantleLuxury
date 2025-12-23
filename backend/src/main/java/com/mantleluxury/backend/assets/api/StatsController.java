package com.mantleluxury.backend.assets.api;

import com.mantleluxury.backend.assets.domain.Asset;
import com.mantleluxury.backend.assets.domain.User;
import com.mantleluxury.backend.assets.domain.UserHolding;
import com.mantleluxury.backend.assets.domain.UserInvestment;
import com.mantleluxury.backend.assets.domain.YieldDistribution;
import com.mantleluxury.backend.assets.repository.AssetRepository;
import com.mantleluxury.backend.assets.repository.UserHoldingRepository;
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
import java.util.Set;
import java.util.stream.Collectors;

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
    private final AssetRepository assetRepository;
    private final UserHoldingRepository holdingRepository;

    public StatsController(
            UserRepository userRepository,
            UserInvestmentRepository investmentRepository,
            YieldDistributionRepository yieldDistributionRepository,
            AssetRepository assetRepository,
            UserHoldingRepository holdingRepository
    ) {
        this.userRepository = userRepository;
        this.investmentRepository = investmentRepository;
        this.yieldDistributionRepository = yieldDistributionRepository;
        this.assetRepository = assetRepository;
        this.holdingRepository = holdingRepository;
    }

    @GetMapping("/overview")
    public ResponseEntity<Map<String, Object>> getOverview() {
        List<User> users = userRepository.findAll();
        List<UserInvestment> investments = investmentRepository.findAll();
        List<YieldDistribution> yields = yieldDistributionRepository.findAll();
        List<Asset> assets = assetRepository.findAll();
        List<UserHolding> holdings = holdingRepository.findAll();

        // 用户统计
        long totalUsers = users.size();
        long kycApprovedUsers = users.stream()
                .filter(u -> "approved".equalsIgnoreCase(u.getKycStatus()))
                .count();
        
        // 活跃投资者：有持仓的用户数
        Set<String> activeInvestors = holdings.stream()
                .map(UserHolding::getUserAddress)
                .collect(Collectors.toSet());
        long activeInvestorCount = activeInvestors.size();

        // 资产统计
        long totalAssets = assets.size();
        long fundraisingAssets = assets.stream()
                .filter(a -> "fundraising".equalsIgnoreCase(a.getStatus()))
                .count();
        long fundedAssets = assets.stream()
                .filter(a -> "funded".equalsIgnoreCase(a.getStatus()))
                .count();
        long soldAssets = assets.stream()
                .filter(a -> "sold".equalsIgnoreCase(a.getStatus()))
                .count();

        // AUM 计算：基于资产总价值和已售份额
        // 方法1：所有已部署代币的资产，基于总供应量和单价
        BigDecimal aumByAssets = assets.stream()
                .filter(a -> a.getTokenAddress() != null && !a.getTokenAddress().isEmpty())
                .filter(a -> a.getTotalSupply() != null && a.getPricePerShare() != null)
                .map(a -> {
                    BigDecimal supply = a.getTotalSupply();
                    BigDecimal price = a.getPricePerShare();
                    return supply.multiply(price);
                })
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // 方法2：基于实际投资记录（已售份额）
        BigDecimal aumByInvestments = investments.stream()
                .map(inv -> inv.getInvestedAmountMnt() == null ? BigDecimal.ZERO : inv.getInvestedAmountMnt())
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // 使用两种方法的最大值，确保准确性
        BigDecimal aum = aumByAssets.max(aumByInvestments);

        // 累计收益：已完成分配的收益总和
        BigDecimal totalYield = yields.stream()
                .filter(dist -> Boolean.TRUE.equals(dist.getIsCompleted()))
                .map(dist -> dist.getDistributedAmount() == null ? BigDecimal.ZERO : dist.getDistributedAmount())
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // 待分配收益：未完成的分配总额
        BigDecimal pendingYield = yields.stream()
                .filter(dist -> !Boolean.TRUE.equals(dist.getIsCompleted()))
                .map(dist -> dist.getTotalAmount() == null ? BigDecimal.ZERO : dist.getTotalAmount())
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // 总交易次数
        long totalTransactions = investments.size();

        // 平均投资金额
        BigDecimal avgInvestment = totalTransactions > 0
                ? aumByInvestments.divide(BigDecimal.valueOf(totalTransactions), 2, BigDecimal.ROUND_HALF_UP)
                : BigDecimal.ZERO;

        Map<String, Object> overview = new HashMap<>();
        overview.put("totalUsers", totalUsers);
        overview.put("kycApprovedUsers", kycApprovedUsers);
        overview.put("activeInvestors", activeInvestorCount);
        overview.put("totalAssets", totalAssets);
        overview.put("fundraisingAssets", fundraisingAssets);
        overview.put("fundedAssets", fundedAssets);
        overview.put("soldAssets", soldAssets);
        overview.put("aum", aum);
        overview.put("totalYield", totalYield);
        overview.put("pendingYield", pendingYield);
        overview.put("yieldDistributions", yields.size());
        overview.put("totalTransactions", totalTransactions);
        overview.put("avgInvestment", avgInvestment);

        return ResponseEntity.ok(overview);
    }
}





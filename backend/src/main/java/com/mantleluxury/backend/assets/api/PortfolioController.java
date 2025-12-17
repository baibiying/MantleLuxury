package com.mantleluxury.backend.assets.api;

import com.mantleluxury.backend.assets.domain.Asset;
import com.mantleluxury.backend.assets.domain.UserHolding;
import com.mantleluxury.backend.assets.domain.UserInvestment;
import com.mantleluxury.backend.assets.domain.YieldDistribution;
import com.mantleluxury.backend.assets.repository.AssetRepository;
import com.mantleluxury.backend.assets.repository.UserHoldingRepository;
import com.mantleluxury.backend.assets.repository.UserInvestmentRepository;
import com.mantleluxury.backend.assets.repository.YieldDistributionRepository;
import com.mantleluxury.backend.assets.service.AmlService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/portfolio")
@CrossOrigin(origins = "http://localhost:3000")
public class PortfolioController {

    private final UserHoldingRepository holdingRepository;
    private final AssetRepository assetRepository;
    private final UserInvestmentRepository investmentRepository;
    private final YieldDistributionRepository yieldDistributionRepository;
    private final AmlService amlService;

    public PortfolioController(UserHoldingRepository holdingRepository,
                               AssetRepository assetRepository,
                               UserInvestmentRepository investmentRepository,
                               YieldDistributionRepository yieldDistributionRepository,
                               AmlService amlService) {
        this.holdingRepository = holdingRepository;
        this.assetRepository = assetRepository;
        this.investmentRepository = investmentRepository;
        this.yieldDistributionRepository = yieldDistributionRepository;
        this.amlService = amlService;
    }

    @GetMapping("/{userAddress}")
    public ResponseEntity<List<Map<String, Object>>> getPortfolio(@PathVariable String userAddress) {
        // 聚合投资记录，计算成本和持仓份额（当前 MVP 不支持卖出）
        List<UserInvestment> investments = investmentRepository.findByUserAddress(userAddress);
        if (investments.isEmpty()) {
            return ResponseEntity.ok(List.of());
        }

        Map<String, Asset> assetsById = assetRepository.findAll().stream()
                .collect(Collectors.toMap(Asset::getId, a -> a, (a, b) -> a));

        Map<String, Map<String, BigDecimal>> aggregated = investments.stream()
                .collect(Collectors.groupingBy(
                        UserInvestment::getAssetId,
                        Collectors.collectingAndThen(
                                Collectors.toList(),
                                list -> {
                                    BigDecimal totalShares = list.stream()
                                            .map(UserInvestment::getShares)
                                            .reduce(BigDecimal.ZERO, BigDecimal::add);
                                    BigDecimal totalCost = list.stream()
                                            .map(UserInvestment::getInvestedAmountMnt)
                                            .reduce(BigDecimal.ZERO, BigDecimal::add);
                                    Map<String, BigDecimal> m = new java.util.HashMap<>();
                                    m.put("shares", totalShares);
                                    m.put("cost", totalCost);
                                    return m;
                                }
                        )
                ));

        // 获取用户持有的所有 token 地址
        List<String> userTokenAddresses = investments.stream()
                .map(UserInvestment::getTokenAddress)
                .distinct()
                .collect(Collectors.toList());

        // 计算每个资产的累计收益（统计所有收益记录，包括未完成的）
        // 对于未完成的，使用 totalAmount；对于已完成的，使用 distributedAmount
        Map<String, BigDecimal> assetYields = yieldDistributionRepository.findByTokenAddressIn(userTokenAddresses)
                .stream()
                .collect(Collectors.groupingBy(
                        YieldDistribution::getAssetId,
                        Collectors.reducing(
                                BigDecimal.ZERO,
                                dist -> dist.getIsCompleted() 
                                    ? dist.getDistributedAmount() 
                                    : dist.getTotalAmount(),
                                BigDecimal::add
                        )
                ));

        List<Map<String, Object>> result = aggregated.entrySet().stream()
                .map(entry -> {
                    String assetId = entry.getKey();
                    Map<String, BigDecimal> agg = entry.getValue();
                    Asset asset = assetsById.get(assetId);

                    BigDecimal price = asset != null && asset.getPricePerShare() != null
                            ? asset.getPricePerShare()
                            : BigDecimal.ZERO;
                    BigDecimal shares = agg.getOrDefault("shares", BigDecimal.ZERO);
                    BigDecimal cost = agg.getOrDefault("cost", BigDecimal.ZERO);
                    BigDecimal currentValue = shares.multiply(price);
                    
                    // 获取该资产的累计收益（简化：假设按持币比例分配）
                    BigDecimal totalYield = assetYields.getOrDefault(assetId, BigDecimal.ZERO);
                    
                    // 计算总收益：浮动收益（市值 - 成本）+ 累计收益分配
                    BigDecimal pnl = currentValue.subtract(cost);
                    BigDecimal totalReturn = pnl.add(totalYield);
                    
                    // ROI = (浮动收益 + 累计收益) / 成本
                    BigDecimal roi = cost.compareTo(BigDecimal.ZERO) > 0
                            ? totalReturn.divide(cost, 8, BigDecimal.ROUND_HALF_UP)
                            : BigDecimal.ZERO;

                    java.util.Map<String, Object> m = new java.util.HashMap<>();
                    m.put("assetId", assetId);
                    m.put("assetType", asset != null ? asset.getAssetType() : null);
                    m.put("brand", asset != null ? asset.getBrand() : null);
                    m.put("model", asset != null ? asset.getModel() : null);
                    m.put("year", asset != null ? asset.getYear() : null);
                    m.put("tokenAddress", asset != null ? asset.getTokenAddress() : null);
                    m.put("balance", shares);
                    m.put("pricePerShare", price);
                    m.put("estimatedValue", currentValue);
                    m.put("totalCost", cost);
                    m.put("pnl", pnl);
                    m.put("roi", roi);
                    m.put("totalYield", totalYield); // 累计收益
                    return m;
                })
                .collect(Collectors.toList());

        return ResponseEntity.ok(result);
    }
    
    /**
     * 获取用户的总收益统计
     */
    @GetMapping("/{userAddress}/yields")
    public ResponseEntity<Map<String, Object>> getUserYieldSummary(@PathVariable String userAddress) {
        // 获取用户持有的所有 token 地址
        List<UserInvestment> investments = investmentRepository.findByUserAddress(userAddress);
        List<String> userTokenAddresses = investments.stream()
                .map(UserInvestment::getTokenAddress)
                .distinct()
                .collect(Collectors.toList());

        // 计算总收益（统计所有收益记录，包括未完成的）
        // 对于未完成的，使用 totalAmount；对于已完成的，使用 distributedAmount
        BigDecimal totalYield = yieldDistributionRepository.findByTokenAddressIn(userTokenAddresses)
                .stream()
                .map(dist -> dist.getIsCompleted() 
                    ? dist.getDistributedAmount() 
                    : dist.getTotalAmount())
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        Map<String, Object> summary = new java.util.HashMap<>();
        summary.put("userAddress", userAddress);
        summary.put("totalYield", totalYield);
        summary.put("yieldCount", yieldDistributionRepository.findByTokenAddressIn(userTokenAddresses)
                .stream()
                .filter(YieldDistribution::getIsCompleted)
                .count());

        return ResponseEntity.ok(summary);
    }

    @PostMapping("/investment")
    public ResponseEntity<?> recordInvestment(@RequestBody Map<String, Object> payload) {
        try {
            String userAddress = (String) payload.get("userAddress");
            String assetId = (String) payload.get("assetId");
            String tokenAddress = (String) payload.get("tokenAddress");
            String amountStr = String.valueOf(payload.get("investedAmountMnt"));
            String sharesStr = String.valueOf(payload.get("shares"));
            String txHash = (String) payload.getOrDefault("txHash", null);

            if (userAddress == null || assetId == null || tokenAddress == null) {
                return ResponseEntity.badRequest().body("Missing required fields");
            }

            // AML：黑名单 + 投资额度
            amlService.checkAddress(userAddress);
            amlService.checkInvestmentLimits(userAddress, new BigDecimal(amountStr));

            UserInvestment inv = new UserInvestment();
            inv.setUserAddress(userAddress);
            inv.setAssetId(assetId);
            inv.setTokenAddress(tokenAddress);
            inv.setInvestedAmountMnt(new BigDecimal(amountStr));
            inv.setShares(new BigDecimal(sharesStr));
            inv.setTxHash(txHash);

            investmentRepository.save(inv);
            return ResponseEntity.ok("Recorded investment");
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Failed to record investment: " + e.getMessage());
        }
    }
}



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
import com.mantleluxury.backend.assets.service.CustodyService;
import com.mantleluxury.backend.assets.service.InsuranceService;
import com.mantleluxury.backend.assets.service.AssetAuthenticationService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/portfolio")
public class PortfolioController {

    private final UserHoldingRepository holdingRepository;
    private final AssetRepository assetRepository;
    private final UserInvestmentRepository investmentRepository;
    private final YieldDistributionRepository yieldDistributionRepository;
    private final AmlService amlService;
    private final CustodyService custodyService;
    private final InsuranceService insuranceService;
    private final AssetAuthenticationService authenticationService;

    public PortfolioController(UserHoldingRepository holdingRepository,
                               AssetRepository assetRepository,
                               UserInvestmentRepository investmentRepository,
                               YieldDistributionRepository yieldDistributionRepository,
                               AmlService amlService,
                               CustodyService custodyService,
                               InsuranceService insuranceService,
                               AssetAuthenticationService authenticationService) {
        this.holdingRepository = holdingRepository;
        this.assetRepository = assetRepository;
        this.investmentRepository = investmentRepository;
        this.yieldDistributionRepository = yieldDistributionRepository;
        this.amlService = amlService;
        this.custodyService = custodyService;
        this.insuranceService = insuranceService;
        this.authenticationService = authenticationService;
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

    /**
     * 获取用户收益历史数据（用于绘制收益曲线）
     */
    @GetMapping("/{userAddress}/yields/history")
    public ResponseEntity<List<Map<String, Object>>> getUserYieldHistory(@PathVariable String userAddress) {
        // 获取用户持有的所有 token 地址
        List<UserInvestment> investments = investmentRepository.findByUserAddress(userAddress);
        List<String> userTokenAddresses = investments.stream()
                .map(UserInvestment::getTokenAddress)
                .distinct()
                .collect(Collectors.toList());

        if (userTokenAddresses.isEmpty()) {
            return ResponseEntity.ok(List.of());
        }

        // 获取所有收益分配记录，按时间排序
        List<YieldDistribution> yields = yieldDistributionRepository.findByTokenAddressIn(userTokenAddresses)
                .stream()
                .filter(YieldDistribution::getIsCompleted) // 只统计已完成的收益
                .sorted((a, b) -> {
                    LocalDateTime timeA = a.getCompletedAt() != null ? a.getCompletedAt() : a.getCreatedAt();
                    LocalDateTime timeB = b.getCompletedAt() != null ? b.getCompletedAt() : b.getCreatedAt();
                    return timeA.compareTo(timeB);
                })
                .collect(Collectors.toList());

        // 计算累计收益时间序列
        BigDecimal cumulativeYield = BigDecimal.ZERO;
        List<Map<String, Object>> history = new java.util.ArrayList<>();

        for (YieldDistribution yield : yields) {
            cumulativeYield = cumulativeYield.add(yield.getDistributedAmount());
            LocalDateTime timestamp = yield.getCompletedAt() != null ? yield.getCompletedAt() : yield.getCreatedAt();
            
            Map<String, Object> point = new java.util.HashMap<>();
            point.put("date", timestamp.format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
            point.put("timestamp", timestamp.toEpochSecond(java.time.ZoneOffset.UTC));
            point.put("amount", yield.getDistributedAmount());
            point.put("cumulativeYield", cumulativeYield);
            point.put("yieldType", yield.getYieldType());
            point.put("assetId", yield.getAssetId());
            
            history.add(point);
        }

        return ResponseEntity.ok(history);
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

            // 合规性检查：资产必须通过认证、有托管和保险
            Asset asset = assetRepository.findById(assetId)
                    .orElseThrow(() -> new RuntimeException("Asset not found: " + assetId));
            
            // 检查资产状态
            if (!"fundraising".equals(asset.getStatus())) {
                return ResponseEntity.badRequest()
                        .body("Asset is not in fundraising status. Current status: " + asset.getStatus());
            }
            
            // 检查是否有已通过的认证
            if (!authenticationService.hasVerifiedAuthentication(assetId)) {
                return ResponseEntity.badRequest()
                        .body("Asset has not been verified. Investment is not allowed.");
            }
            
            // 检查是否有托管记录
            if (!custodyService.getCustodyByAssetId(assetId).isPresent()) {
                return ResponseEntity.badRequest()
                        .body("Asset is not in custody. Investment is not allowed for security reasons.");
            }
            
            // 检查是否有有效保险
            if (!insuranceService.getActiveInsuranceByAssetId(assetId).isPresent()) {
                return ResponseEntity.badRequest()
                        .body("Asset does not have active insurance. Investment is not allowed to protect investor interests.");
            }

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

    /**
     * 导出持仓列表 CSV
     */
    @GetMapping("/{userAddress}/export/holdings")
    public ResponseEntity<String> exportHoldingsCSV(@PathVariable String userAddress) {
        List<Map<String, Object>> portfolio = getPortfolio(userAddress).getBody();
        if (portfolio == null || portfolio.isEmpty()) {
            return ResponseEntity.ok("资产类型,品牌,型号,年份,持有份额,单份价格(MNT),持仓成本(MNT),当前市值(MNT),浮动收益(MNT),累计收益(MNT),收益率(%)\n");
        }

        StringBuilder csv = new StringBuilder();
        csv.append("\uFEFF"); // BOM for Excel compatibility
        csv.append("资产类型,品牌,型号,年份,持有份额,单份价格(MNT),持仓成本(MNT),当前市值(MNT),浮动收益(MNT),累计收益(MNT),收益率(%)\n");

        for (Map<String, Object> item : portfolio) {
            String assetType = (String) item.get("assetType");
            String typeLabel = "watch".equals(assetType) ? "名表" : "jewelry".equals(assetType) ? "珠宝" : "其他";
            String brand = item.get("brand") != null ? item.get("brand").toString() : "";
            String model = item.get("model") != null ? item.get("model").toString() : "";
            Integer year = (Integer) item.get("year");
            BigDecimal balance = (BigDecimal) item.get("balance");
            BigDecimal pricePerShare = (BigDecimal) item.get("pricePerShare");
            BigDecimal totalCost = (BigDecimal) item.get("totalCost");
            BigDecimal estimatedValue = (BigDecimal) item.get("estimatedValue");
            BigDecimal pnl = (BigDecimal) item.get("pnl");
            BigDecimal totalYield = (BigDecimal) item.getOrDefault("totalYield", BigDecimal.ZERO);
            BigDecimal roi = (BigDecimal) item.get("roi");

            csv.append(String.format("\"%s\",\"%s\",\"%s\",\"%s\",%s,%s,%s,%s,%s,%s,%s\n",
                    typeLabel,
                    brand,
                    model,
                    year != null ? year.toString() : "",
                    balance != null ? balance.toPlainString() : "0",
                    pricePerShare != null ? pricePerShare.toPlainString() : "0",
                    totalCost != null ? totalCost.toPlainString() : "0",
                    estimatedValue != null ? estimatedValue.toPlainString() : "0",
                    pnl != null ? pnl.toPlainString() : "0",
                    totalYield.toPlainString(),
                    roi != null ? roi.multiply(new BigDecimal("100")).toPlainString() : "0"
            ));
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("text/csv; charset=UTF-8"));
        headers.setContentDispositionFormData("attachment", 
                String.format("持仓列表_%s.csv", LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd"))));

        return ResponseEntity.ok()
                .headers(headers)
                .body(csv.toString());
    }

    /**
     * 导出交易记录 CSV
     */
    @GetMapping("/{userAddress}/export/transactions")
    public ResponseEntity<String> exportTransactionsCSV(@PathVariable String userAddress) {
        List<UserInvestment> investments = investmentRepository.findByUserAddress(userAddress);
        if (investments.isEmpty()) {
            return ResponseEntity.ok("交易时间,资产,投资金额(MNT),购买份额,交易哈希\n");
        }

        Map<String, Asset> assetsById = assetRepository.findAll().stream()
                .collect(Collectors.toMap(Asset::getId, a -> a, (a, b) -> a));

        StringBuilder csv = new StringBuilder();
        csv.append("\uFEFF"); // BOM for Excel compatibility
        csv.append("交易时间,资产,投资金额(MNT),购买份额,交易哈希\n");

        for (UserInvestment inv : investments) {
            Asset asset = assetsById.get(inv.getAssetId());
            String assetName = asset != null 
                    ? String.format("%s %s", asset.getBrand(), asset.getModel())
                    : "未知资产";
            String txHash = inv.getTxHash() != null ? inv.getTxHash() : "";
            String createdAt = inv.getCreatedAt() != null 
                    ? inv.getCreatedAt().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"))
                    : "";

            csv.append(String.format("\"%s\",\"%s\",%s,%s,\"%s\"\n",
                    createdAt,
                    assetName,
                    inv.getInvestedAmountMnt().toPlainString(),
                    inv.getShares().toPlainString(),
                    txHash
            ));
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("text/csv; charset=UTF-8"));
        headers.setContentDispositionFormData("attachment", 
                String.format("交易记录_%s.csv", LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd"))));

        return ResponseEntity.ok()
                .headers(headers)
                .body(csv.toString());
    }

    /**
     * 导出收益记录 CSV
     */
    @GetMapping("/{userAddress}/export/yields")
    public ResponseEntity<String> exportYieldsCSV(@PathVariable String userAddress) {
        List<UserInvestment> investments = investmentRepository.findByUserAddress(userAddress);
        List<String> userTokenAddresses = investments.stream()
                .map(UserInvestment::getTokenAddress)
                .distinct()
                .collect(Collectors.toList());

        if (userTokenAddresses.isEmpty()) {
            return ResponseEntity.ok("收益时间,资产,收益类型,收益金额(MNT),交易哈希\n");
        }

        List<YieldDistribution> yields = yieldDistributionRepository.findByTokenAddressIn(userTokenAddresses);
        Map<String, Asset> assetsById = assetRepository.findAll().stream()
                .collect(Collectors.toMap(Asset::getId, a -> a, (a, b) -> a));

        StringBuilder csv = new StringBuilder();
        csv.append("\uFEFF"); // BOM for Excel compatibility
        csv.append("收益时间,资产,收益类型,收益金额(MNT),交易哈希\n");

        for (YieldDistribution yield : yields) {
            Asset asset = assetsById.get(yield.getAssetId());
            String assetName = asset != null 
                    ? String.format("%s %s", asset.getBrand(), asset.getModel())
                    : "未知资产";
            String yieldType = "appreciation".equals(yield.getYieldType()) ? "升值收益" : "rental".equals(yield.getYieldType()) ? "租赁收益" : yield.getYieldType();
            BigDecimal amount = yield.getIsCompleted() ? yield.getDistributedAmount() : yield.getTotalAmount();
            String txHash = yield.getTransactionHash() != null ? yield.getTransactionHash() : "";
            String createdAt = yield.getCreatedAt() != null 
                    ? yield.getCreatedAt().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"))
                    : "";

            csv.append(String.format("\"%s\",\"%s\",\"%s\",%s,\"%s\"\n",
                    createdAt,
                    assetName,
                    yieldType,
                    amount.toPlainString(),
                    txHash
            ));
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("text/csv; charset=UTF-8"));
        headers.setContentDispositionFormData("attachment", 
                String.format("收益记录_%s.csv", LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd"))));

        return ResponseEntity.ok()
                .headers(headers)
                .body(csv.toString());
    }
}



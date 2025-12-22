package com.mantleluxury.backend.assets.api;

import com.mantleluxury.backend.assets.domain.Asset;
import com.mantleluxury.backend.assets.domain.YieldDistribution;
import com.mantleluxury.backend.assets.domain.UserInvestment;
import com.mantleluxury.backend.assets.repository.AssetRepository;
import com.mantleluxury.backend.assets.repository.UserInvestmentRepository;
import com.mantleluxury.backend.assets.repository.YieldDistributionRepository;
import com.mantleluxury.backend.config.AdminConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.ByteArrayOutputStream;
import java.io.OutputStreamWriter;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * 后台报表导出接口（仅管理员）
 */
@RestController
@RequestMapping("/api/admin/reports")
@CrossOrigin(origins = "http://localhost:3000")
public class AdminReportController {

    private static final Logger logger = LoggerFactory.getLogger(AdminReportController.class);

    private final AssetRepository assetRepository;
    private final YieldDistributionRepository yieldDistributionRepository;
    private final UserInvestmentRepository userInvestmentRepository;
    private final AdminConfig adminConfig;

    public AdminReportController(
            AssetRepository assetRepository,
            YieldDistributionRepository yieldDistributionRepository,
            UserInvestmentRepository userInvestmentRepository,
            AdminConfig adminConfig
    ) {
        this.assetRepository = assetRepository;
        this.yieldDistributionRepository = yieldDistributionRepository;
        this.userInvestmentRepository = userInvestmentRepository;
        this.adminConfig = adminConfig;
    }

    private ResponseEntity<byte[]> forbidden(String message) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(message.getBytes(StandardCharsets.UTF_8));
    }

    private boolean isAdmin(String walletAddress) {
        return walletAddress != null && adminConfig.isAdmin(walletAddress.toLowerCase());
    }

    /**
     * 资产级收益与投资报表（CSV）
     */
    @GetMapping("/asset/{assetId}/yields.csv")
    public ResponseEntity<byte[]> exportAssetYieldReport(
            @PathVariable String assetId,
            @RequestHeader(value = "X-Wallet-Address", required = false) String walletAddress
    ) {
        if (!isAdmin(walletAddress)) {
            return forbidden("Access denied. Admin privileges required.");
        }

        Asset asset = assetRepository.findById(assetId).orElse(null);
        if (asset == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(("Asset not found: " + assetId).getBytes(StandardCharsets.UTF_8));
        }

        List<YieldDistribution> distributions = yieldDistributionRepository.findByAssetId(assetId);
        List<UserInvestment> investments = userInvestmentRepository.findAll().stream()
                .filter(inv -> assetId.equals(inv.getAssetId()))
                .toList();

        try {
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            OutputStreamWriter writer = new OutputStreamWriter(baos, StandardCharsets.UTF_8);

            // CSV header
            writer.write("Asset ID,Brand,Model,Status,Total Yields,Distributed Yields\n");

            BigDecimal totalYield = distributions.stream()
                    .map(YieldDistribution::getTotalAmount)
                    .filter(a -> a != null)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            BigDecimal distributed = distributions.stream()
                    .map(YieldDistribution::getDistributedAmount)
                    .filter(a -> a != null)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            writer.write(String.join(",",
                    quote(asset.getId()),
                    quote(asset.getBrand()),
                    quote(asset.getModel()),
                    quote(asset.getStatus()),
                    totalYield.toPlainString(),
                    distributed.toPlainString()
            ));
            writer.write("\n\n");

            // 明细 - 收益分配
            writer.write("=== Yield Distributions ===\n");
            writer.write("Distribution ID,Yield Type,Total Amount,Distributed Amount,Is Completed,Created At,Completed At,Transaction Hash\n");
            for (YieldDistribution d : distributions) {
                writer.write(String.join(",",
                        quote(d.getId()),
                        quote(d.getYieldType()),
                        d.getTotalAmount() != null ? d.getTotalAmount().toPlainString() : "",
                        d.getDistributedAmount() != null ? d.getDistributedAmount().toPlainString() : "",
                        String.valueOf(Boolean.TRUE.equals(d.getIsCompleted())),
                        d.getCreatedAt() != null ? d.getCreatedAt().toString() : "",
                        d.getCompletedAt() != null ? d.getCompletedAt().toString() : "",
                        quote(d.getTransactionHash() != null ? d.getTransactionHash() : "")
                ));
                writer.write("\n");
            }

            writer.write("\n=== User Investments ===\n");
            writer.write("User Address,Invested Amount MNT,Shares,Tx Hash,Created At\n");
            for (UserInvestment inv : investments) {
                writer.write(String.join(",",
                        quote(inv.getUserAddress()),
                        inv.getInvestedAmountMnt() != null ? inv.getInvestedAmountMnt().toPlainString() : "",
                        inv.getShares() != null ? inv.getShares().toPlainString() : "",
                        quote(inv.getTxHash() != null ? inv.getTxHash() : ""),
                        inv.getCreatedAt() != null ? inv.getCreatedAt().toString() : ""
                ));
                writer.write("\n");
            }

            writer.flush();

            String filename = "asset-yields-" + assetId + ".csv";
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(new MediaType("text", "csv"));
            headers.setContentDispositionFormData("attachment", filename);

            return new ResponseEntity<>(baos.toByteArray(), headers, HttpStatus.OK);
        } catch (Exception e) {
            logger.error("Failed to export asset yield report for {}", assetId, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(("Failed to export report: " + e.getMessage()).getBytes(StandardCharsets.UTF_8));
        }
    }

    /**
     * 用户级交易与收益报表（CSV）
     */
    @GetMapping("/user/{walletAddress}/activity.csv")
    public ResponseEntity<byte[]> exportUserActivityReport(
            @PathVariable String walletAddress,
            @RequestHeader(value = "X-Wallet-Address", required = false) String adminWallet,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to
    ) {
        if (!isAdmin(adminWallet)) {
            return forbidden("Access denied. Admin privileges required.");
        }

        String normalizedUser = walletAddress.toLowerCase();
        List<UserInvestment> investments = userInvestmentRepository.findByUserAddress(normalizedUser);
        List<String> userTokenAddresses = investments.stream()
                .map(UserInvestment::getTokenAddress)
                .distinct()
                .toList();

        List<YieldDistribution> yields = userTokenAddresses.isEmpty()
                ? List.of()
                : yieldDistributionRepository.findByTokenAddressIn(userTokenAddresses);

        try {
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            OutputStreamWriter writer = new OutputStreamWriter(baos, StandardCharsets.UTF_8);

            String periodLabel = "";
            DateTimeFormatter fmt = DateTimeFormatter.ISO_DATE;
            if (from != null || to != null) {
                periodLabel = (from != null ? from.format(fmt) : "N/A") +
                        " ~ " +
                        (to != null ? to.format(fmt) : "N/A");
            }

            // Header summary
            writer.write("User Address,Period\n");
            writer.write(String.join(",", quote(normalizedUser), quote(periodLabel)));
            writer.write("\n\n");

            // 投资记录
            writer.write("=== Investments ===\n");
            writer.write("Asset ID,Token Address,Invested Amount MNT,Shares,Tx Hash,Created At\n");
            for (UserInvestment inv : investments) {
                if (from != null && inv.getCreatedAt() != null && inv.getCreatedAt().toLocalDate().isBefore(from)) {
                    continue;
                }
                if (to != null && inv.getCreatedAt() != null && inv.getCreatedAt().toLocalDate().isAfter(to)) {
                    continue;
                }
                writer.write(String.join(",",
                        quote(inv.getAssetId()),
                        quote(inv.getTokenAddress()),
                        inv.getInvestedAmountMnt() != null ? inv.getInvestedAmountMnt().toPlainString() : "",
                        inv.getShares() != null ? inv.getShares().toPlainString() : "",
                        quote(inv.getTxHash() != null ? inv.getTxHash() : ""),
                        inv.getCreatedAt() != null ? inv.getCreatedAt().toString() : ""
                ));
                writer.write("\n");
            }

            writer.write("\n=== Yield Distributions (Asset Level) ===\n");
            writer.write("Distribution ID,Asset ID,Token Address,Yield Type,Total Amount,Distributed Amount,Is Completed,Created At,Completed At\n");
            for (YieldDistribution d : yields) {
                writer.write(String.join(",",
                        quote(d.getId()),
                        quote(d.getAssetId()),
                        quote(d.getTokenAddress()),
                        quote(d.getYieldType()),
                        d.getTotalAmount() != null ? d.getTotalAmount().toPlainString() : "",
                        d.getDistributedAmount() != null ? d.getDistributedAmount().toPlainString() : "",
                        String.valueOf(Boolean.TRUE.equals(d.getIsCompleted())),
                        d.getCreatedAt() != null ? d.getCreatedAt().toString() : "",
                        d.getCompletedAt() != null ? d.getCompletedAt().toString() : ""
                ));
                writer.write("\n");
            }

            writer.flush();

            String filename = "user-activity-" + normalizedUser + ".csv";
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(new MediaType("text", "csv"));
            headers.setContentDispositionFormData("attachment", filename);

            return new ResponseEntity<>(baos.toByteArray(), headers, HttpStatus.OK);
        } catch (Exception e) {
            logger.error("Failed to export user activity report for {}", walletAddress, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(("Failed to export report: " + e.getMessage()).getBytes(StandardCharsets.UTF_8));
        }
    }

    private String quote(String value) {
        if (value == null) {
            return "\"\"";
        }
        String escaped = value.replace("\"", "\"\"");
        return "\"" + escaped + "\"";
    }
}





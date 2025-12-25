package com.mantleluxury.backend.assets.service;

import com.mantleluxury.backend.assets.domain.Asset;
import com.mantleluxury.backend.assets.domain.Valuation;
import com.mantleluxury.backend.assets.repository.AssetRepository;
import com.mantleluxury.backend.assets.repository.ValuationRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * 资产估值服务
 */
@Service
public class ValuationService {

    private static final Logger logger = LoggerFactory.getLogger(ValuationService.class);

    private final ValuationRepository valuationRepository;
    private final AssetRepository assetRepository;

    public ValuationService(
            ValuationRepository valuationRepository,
            AssetRepository assetRepository
    ) {
        this.valuationRepository = valuationRepository;
        this.assetRepository = assetRepository;
    }

    /**
     * 创建估值记录
     */
    @Transactional
    public Valuation createValuation(
            String assetId,
            BigDecimal valuationAmount,
            String valuationCurrency,
            LocalDate valuationDate,
            String valuationAgency,
            String reportUrl
    ) {
        // 验证资产是否存在
        Asset asset = assetRepository.findById(assetId)
                .orElseThrow(() -> new RuntimeException("Asset not found: " + assetId));

        Valuation valuation = new Valuation();
        valuation.setAssetId(assetId);
        valuation.setValuationAmount(valuationAmount);
        valuation.setValuationCurrency(valuationCurrency != null ? valuationCurrency : "USD");
        valuation.setValuationDate(valuationDate != null ? valuationDate : LocalDate.now());
        valuation.setValuationAgency(valuationAgency);
        valuation.setReportUrl(reportUrl);

        Valuation saved = valuationRepository.save(valuation);
        logger.info("Created valuation record for asset {}: {}", assetId, saved.getId());
        return saved;
    }

    /**
     * 更新估值记录
     */
    @Transactional
    public Valuation updateValuation(
            String valuationId,
            BigDecimal valuationAmount,
            String valuationCurrency,
            LocalDate valuationDate,
            String valuationAgency,
            String reportUrl
    ) {
        Valuation valuation = valuationRepository.findById(valuationId)
                .orElseThrow(() -> new RuntimeException("Valuation not found: " + valuationId));

        if (valuationAmount != null) {
            valuation.setValuationAmount(valuationAmount);
        }
        if (valuationCurrency != null) {
            valuation.setValuationCurrency(valuationCurrency);
        }
        if (valuationDate != null) {
            valuation.setValuationDate(valuationDate);
        }
        if (valuationAgency != null) {
            valuation.setValuationAgency(valuationAgency);
        }
        if (reportUrl != null) {
            valuation.setReportUrl(reportUrl);
        }

        Valuation saved = valuationRepository.save(valuation);
        logger.info("Updated valuation record: {}", valuationId);
        return saved;
    }

    /**
     * 获取资产的所有估值记录（按日期倒序）
     */
    public List<Valuation> getValuationsByAssetId(String assetId) {
        return valuationRepository.findByAssetIdOrderByValuationDateDesc(assetId);
    }

    /**
     * 获取资产的最新估值
     */
    public Valuation getLatestValuation(String assetId) {
        List<Valuation> valuations = valuationRepository.findByAssetIdOrderByValuationDateDesc(assetId);
        return valuations.isEmpty() ? null : valuations.get(0);
    }

    /**
     * 获取所有估值记录
     */
    public List<Valuation> getAllValuations() {
        return valuationRepository.findAll();
    }

    /**
     * 删除估值记录
     */
    @Transactional
    public void deleteValuation(String valuationId) {
        if (!valuationRepository.existsById(valuationId)) {
            throw new RuntimeException("Valuation not found: " + valuationId);
        }
        valuationRepository.deleteById(valuationId);
        logger.info("Deleted valuation record: {}", valuationId);
    }
}



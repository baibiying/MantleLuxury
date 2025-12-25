package com.mantleluxury.backend.assets.domain;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * 资产估值实体
 */
@Entity
@Table(name = "valuations")
public class Valuation {

    @Id
    @Column(columnDefinition = "CHAR(36)")
    private String id;

    @Column(name = "asset_id", nullable = false, columnDefinition = "CHAR(36)")
    private String assetId;

    @Column(name = "valuation_amount", precision = 36, scale = 18)
    private BigDecimal valuationAmount; // 估值金额

    @Column(name = "valuation_currency", length = 10)
    private String valuationCurrency; // 估值币种（USD, MNT等）

    @Column(name = "valuation_date")
    private LocalDate valuationDate; // 估值日期

    @Column(name = "valuation_agency", length = 100)
    private String valuationAgency; // 估值机构名称

    @Column(name = "report_url", columnDefinition = "TEXT")
    private String reportUrl; // 估值报告URL（IPFS或S3）

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (id == null) {
            id = UUID.randomUUID().toString();
        }
        createdAt = LocalDateTime.now();
        if (valuationCurrency == null) {
            valuationCurrency = "USD";
        }
    }

    // Getters and Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getAssetId() { return assetId; }
    public void setAssetId(String assetId) { this.assetId = assetId; }

    public BigDecimal getValuationAmount() { return valuationAmount; }
    public void setValuationAmount(BigDecimal valuationAmount) { this.valuationAmount = valuationAmount; }

    public String getValuationCurrency() { return valuationCurrency; }
    public void setValuationCurrency(String valuationCurrency) { this.valuationCurrency = valuationCurrency; }

    public LocalDate getValuationDate() { return valuationDate; }
    public void setValuationDate(LocalDate valuationDate) { this.valuationDate = valuationDate; }

    public String getValuationAgency() { return valuationAgency; }
    public void setValuationAgency(String valuationAgency) { this.valuationAgency = valuationAgency; }

    public String getReportUrl() { return reportUrl; }
    public void setReportUrl(String reportUrl) { this.reportUrl = reportUrl; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}



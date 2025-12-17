package com.mantleluxury.backend.assets.domain;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * 资产保险实体
 */
@Entity
@Table(name = "insurances")
public class Insurance {

    @Id
    @Column(columnDefinition = "CHAR(36)")
    private String id;

    @Column(name = "asset_id", nullable = false, columnDefinition = "CHAR(36)")
    private String assetId;

    @Column(name = "insurance_company", nullable = false, length = 200)
    private String insuranceCompany; // 保险公司名称

    @Column(name = "policy_number", length = 100)
    private String policyNumber; // 保单号

    @Column(name = "coverage_amount", precision = 36, scale = 18, nullable = false)
    private BigDecimal coverageAmount; // 保额

    @Column(name = "coverage_currency", length = 10, nullable = false)
    private String coverageCurrency; // 保额币种（USD, MNT等）

    @Column(name = "policy_start_date", nullable = false)
    private LocalDate policyStartDate; // 保单生效日期

    @Column(name = "policy_end_date", nullable = false)
    private LocalDate policyEndDate; // 保单到期日期

    @Column(name = "premium_amount", precision = 36, scale = 18)
    private BigDecimal premiumAmount; // 保费

    @Column(name = "coverage_type", length = 50)
    private String coverageType; // 保险类型（全险、盗窃险等）

    @Column(name = "policy_document_url", columnDefinition = "TEXT")
    private String policyDocumentUrl; // 保单文档 URL

    @Column(name = "policy_document_hash", length = 66)
    private String policyDocumentHash; // 保单文档哈希（链上存证）

    @Column(name = "is_active", nullable = false)
    private Boolean isActive; // 保单是否有效

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        if (id == null) {
            id = UUID.randomUUID().toString();
        }
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (isActive == null) {
            isActive = true;
        }
        if (coverageCurrency == null) {
            coverageCurrency = "USD";
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    // Getters and Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getAssetId() { return assetId; }
    public void setAssetId(String assetId) { this.assetId = assetId; }

    public String getInsuranceCompany() { return insuranceCompany; }
    public void setInsuranceCompany(String insuranceCompany) { this.insuranceCompany = insuranceCompany; }

    public String getPolicyNumber() { return policyNumber; }
    public void setPolicyNumber(String policyNumber) { this.policyNumber = policyNumber; }

    public BigDecimal getCoverageAmount() { return coverageAmount; }
    public void setCoverageAmount(BigDecimal coverageAmount) { this.coverageAmount = coverageAmount; }

    public String getCoverageCurrency() { return coverageCurrency; }
    public void setCoverageCurrency(String coverageCurrency) { this.coverageCurrency = coverageCurrency; }

    public LocalDate getPolicyStartDate() { return policyStartDate; }
    public void setPolicyStartDate(LocalDate policyStartDate) { this.policyStartDate = policyStartDate; }

    public LocalDate getPolicyEndDate() { return policyEndDate; }
    public void setPolicyEndDate(LocalDate policyEndDate) { this.policyEndDate = policyEndDate; }

    public BigDecimal getPremiumAmount() { return premiumAmount; }
    public void setPremiumAmount(BigDecimal premiumAmount) { this.premiumAmount = premiumAmount; }

    public String getCoverageType() { return coverageType; }
    public void setCoverageType(String coverageType) { this.coverageType = coverageType; }

    public String getPolicyDocumentUrl() { return policyDocumentUrl; }
    public void setPolicyDocumentUrl(String policyDocumentUrl) { this.policyDocumentUrl = policyDocumentUrl; }

    public String getPolicyDocumentHash() { return policyDocumentHash; }
    public void setPolicyDocumentHash(String policyDocumentHash) { this.policyDocumentHash = policyDocumentHash; }

    public Boolean getIsActive() { return isActive; }
    public void setIsActive(Boolean isActive) { this.isActive = isActive; }

    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}


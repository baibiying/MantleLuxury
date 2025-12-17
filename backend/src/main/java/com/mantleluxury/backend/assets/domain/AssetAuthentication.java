package com.mantleluxury.backend.assets.domain;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * 资产真伪认证实体
 */
@Entity
@Table(name = "asset_authentications")
public class AssetAuthentication {
    
    @Id
    @Column(columnDefinition = "CHAR(36)")
    private String id;
    
    @Column(name = "asset_id", nullable = false, columnDefinition = "CHAR(36)")
    private String assetId;
    
    @Column(name = "authentication_status", nullable = false, length = 20)
    private String authenticationStatus; // pending, verified, rejected
    
    @Column(name = "authenticator_name", nullable = false, length = 200)
    private String authenticatorName; // 鉴定机构名称
    
    @Column(name = "authenticator_type", nullable = false, length = 50)
    private String authenticatorType; // official_brand, third_party, ai_system
    
    @Column(name = "verification_date")
    private LocalDate verificationDate;
    
    @Column(name = "report_url", columnDefinition = "TEXT")
    private String reportUrl; // IPFS 或 S3 URL
    
    @Column(name = "report_hash", length = 66)
    private String reportHash; // 报告哈希（链上存证）
    
    @Column(name = "verifier_signature", columnDefinition = "TEXT")
    private String verifierSignature; // 鉴定师签名/证书信息
    
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
        if (authenticationStatus == null) {
            authenticationStatus = "pending";
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
    
    public String getAuthenticationStatus() { return authenticationStatus; }
    public void setAuthenticationStatus(String authenticationStatus) { this.authenticationStatus = authenticationStatus; }
    
    public String getAuthenticatorName() { return authenticatorName; }
    public void setAuthenticatorName(String authenticatorName) { this.authenticatorName = authenticatorName; }
    
    public String getAuthenticatorType() { return authenticatorType; }
    public void setAuthenticatorType(String authenticatorType) { this.authenticatorType = authenticatorType; }
    
    public LocalDate getVerificationDate() { return verificationDate; }
    public void setVerificationDate(LocalDate verificationDate) { this.verificationDate = verificationDate; }
    
    public String getReportUrl() { return reportUrl; }
    public void setReportUrl(String reportUrl) { this.reportUrl = reportUrl; }
    
    public String getReportHash() { return reportHash; }
    public void setReportHash(String reportHash) { this.reportHash = reportHash; }
    
    public String getVerifierSignature() { return verifierSignature; }
    public void setVerifierSignature(String verifierSignature) { this.verifierSignature = verifierSignature; }
    
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
    
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}


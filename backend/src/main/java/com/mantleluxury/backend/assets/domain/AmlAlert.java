package com.mantleluxury.backend.assets.domain;

import jakarta.persistence.*;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * AML 告警记录实体
 * 用于记录高风险地址、异常交易等风控事件，供合规跟踪与处理。
 */
@Entity
@Table(name = "aml_alerts")
public class AmlAlert {

    @Id
    @Column(columnDefinition = "CHAR(36)")
    private String id;

    @Column(name = "wallet_address", length = 42, nullable = false)
    private String walletAddress;

    @Column(name = "alert_type", length = 50, nullable = false)
    private String alertType; // blacklist_hit, single_tx_limit, total_limit, external_risk, manual

    @Column(name = "risk_level", length = 20, nullable = false)
    private String riskLevel; // low, medium, high, critical

    @Column(name = "source", length = 100)
    private String source; // internal_rule, chainalysis, elliptic, manual

    @Column(name = "message", columnDefinition = "TEXT")
    private String message;

    @Column(name = "status", length = 20, nullable = false)
    private String status; // open, in_review, resolved, ignored

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Column(name = "handled_by", length = 42)
    private String handledBy; // 管理员钱包地址

    @Column(name = "handled_at")
    private LocalDateTime handledAt;

    @Column(name = "handle_notes", columnDefinition = "TEXT")
    private String handleNotes;

    @PrePersist
    protected void onCreate() {
        if (id == null) {
            id = UUID.randomUUID().toString();
        }
        LocalDateTime now = LocalDateTime.now();
        if (createdAt == null) {
            createdAt = now;
        }
        updatedAt = now;
        if (status == null) {
            status = "open";
        }
        if (riskLevel == null) {
            riskLevel = "medium";
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getWalletAddress() {
        return walletAddress;
    }

    public void setWalletAddress(String walletAddress) {
        this.walletAddress = walletAddress;
    }

    public String getAlertType() {
        return alertType;
    }

    public void setAlertType(String alertType) {
        this.alertType = alertType;
    }

    public String getRiskLevel() {
        return riskLevel;
    }

    public void setRiskLevel(String riskLevel) {
        this.riskLevel = riskLevel;
    }

    public String getSource() {
        return source;
    }

    public void setSource(String source) {
        this.source = source;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }

    public String getHandledBy() {
        return handledBy;
    }

    public void setHandledBy(String handledBy) {
        this.handledBy = handledBy;
    }

    public LocalDateTime getHandledAt() {
        return handledAt;
    }

    public void setHandledAt(LocalDateTime handledAt) {
        this.handledAt = handledAt;
    }

    public String getHandleNotes() {
        return handleNotes;
    }

    public void setHandleNotes(String handleNotes) {
        this.handleNotes = handleNotes;
    }
}



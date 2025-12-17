package com.mantleluxury.backend.assets.domain;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * 收益分配实体
 */
@Entity
@Table(name = "yield_distributions")
public class YieldDistribution {
    
    @Id
    @Column(columnDefinition = "CHAR(36)")
    private String id;
    
    @Column(name = "distribution_id_bytes32", unique = true, nullable = false, length = 66)
    private String distributionIdBytes32;
    
    @Column(name = "asset_id", nullable = false, columnDefinition = "CHAR(36)")
    private String assetId;
    
    @Column(name = "token_address", nullable = false, length = 42)
    private String tokenAddress;
    
    @Column(name = "yield_type", nullable = false, length = 20)
    private String yieldType; // appreciation, rental
    
    @Column(name = "total_amount", precision = 36, scale = 18)
    private BigDecimal totalAmount;
    
    @Column(name = "distributed_amount", precision = 36, scale = 18)
    private BigDecimal distributedAmount;
    
    @Column(name = "is_completed", nullable = false)
    private Boolean isCompleted;
    
    @Column(name = "transaction_hash", length = 66)
    private String transactionHash;
    
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
    
    @Column(name = "completed_at")
    private LocalDateTime completedAt;
    
    @PrePersist
    protected void onCreate() {
        if (id == null) {
            id = UUID.randomUUID().toString();
        }
        createdAt = LocalDateTime.now();
        if (isCompleted == null) {
            isCompleted = false;
        }
        if (distributedAmount == null) {
            distributedAmount = BigDecimal.ZERO;
        }
    }
    
    @PreUpdate
    protected void onUpdate() {
        if (isCompleted && completedAt == null) {
            completedAt = LocalDateTime.now();
        }
    }
    
    // Getters and Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    
    public String getDistributionIdBytes32() { return distributionIdBytes32; }
    public void setDistributionIdBytes32(String distributionIdBytes32) { this.distributionIdBytes32 = distributionIdBytes32; }
    
    public String getAssetId() { return assetId; }
    public void setAssetId(String assetId) { this.assetId = assetId; }
    
    public String getTokenAddress() { return tokenAddress; }
    public void setTokenAddress(String tokenAddress) { this.tokenAddress = tokenAddress; }
    
    public String getYieldType() { return yieldType; }
    public void setYieldType(String yieldType) { this.yieldType = yieldType; }
    
    public BigDecimal getTotalAmount() { return totalAmount; }
    public void setTotalAmount(BigDecimal totalAmount) { this.totalAmount = totalAmount; }
    
    public BigDecimal getDistributedAmount() { return distributedAmount; }
    public void setDistributedAmount(BigDecimal distributedAmount) { this.distributedAmount = distributedAmount; }
    
    public Boolean getIsCompleted() { return isCompleted; }
    public void setIsCompleted(Boolean isCompleted) { this.isCompleted = isCompleted; }
    
    public String getTransactionHash() { return transactionHash; }
    public void setTransactionHash(String transactionHash) { this.transactionHash = transactionHash; }
    
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    
    public LocalDateTime getCompletedAt() { return completedAt; }
    public void setCompletedAt(LocalDateTime completedAt) { this.completedAt = completedAt; }
}


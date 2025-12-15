package com.mantleluxury.backend.assets.domain;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "user_investments")
public class UserInvestment {

    @Id
    @Column(columnDefinition = "CHAR(36)")
    private String id;

    @Column(name = "user_address", length = 42, nullable = false)
    private String userAddress;

    @Column(name = "asset_id", length = 36, nullable = false, columnDefinition = "CHAR(36)")
    private String assetId;

    @Column(name = "token_address", length = 42, nullable = false)
    private String tokenAddress;

    @Column(name = "invested_amount_mnt", precision = 36, scale = 18, nullable = false)
    private BigDecimal investedAmountMnt;

    @Column(name = "shares", precision = 36, scale = 18, nullable = false)
    private BigDecimal shares;

    @Column(name = "tx_hash", length = 66)
    private String txHash;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (id == null) {
            id = UUID.randomUUID().toString();
        }
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getUserAddress() {
        return userAddress;
    }

    public void setUserAddress(String userAddress) {
        this.userAddress = userAddress;
    }

    public String getAssetId() {
        return assetId;
    }

    public void setAssetId(String assetId) {
        this.assetId = assetId;
    }

    public String getTokenAddress() {
        return tokenAddress;
    }

    public void setTokenAddress(String tokenAddress) {
        this.tokenAddress = tokenAddress;
    }

    public BigDecimal getInvestedAmountMnt() {
        return investedAmountMnt;
    }

    public void setInvestedAmountMnt(BigDecimal investedAmountMnt) {
        this.investedAmountMnt = investedAmountMnt;
    }

    public BigDecimal getShares() {
        return shares;
    }

    public void setShares(BigDecimal shares) {
        this.shares = shares;
    }

    public String getTxHash() {
        return txHash;
    }

    public void setTxHash(String txHash) {
        this.txHash = txHash;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}



package com.mantleluxury.backend.assets.domain;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "user_holdings")
public class UserHolding {

    @Id
    @Column(columnDefinition = "CHAR(36)")
    private String id;

    @Column(name = "user_address", length = 42, nullable = false)
    private String userAddress;

    @Column(name = "token_address", length = 42, nullable = false)
    private String tokenAddress;

    @Column(name = "balance", precision = 36, scale = 18, nullable = false)
    private BigDecimal balance;

    @Column(name = "last_updated_at")
    private LocalDateTime lastUpdatedAt;

    @PrePersist
    protected void onCreate() {
        if (id == null) {
            id = java.util.UUID.randomUUID().toString();
        }
        lastUpdatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        lastUpdatedAt = LocalDateTime.now();
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

    public String getTokenAddress() {
        return tokenAddress;
    }

    public void setTokenAddress(String tokenAddress) {
        this.tokenAddress = tokenAddress;
    }

    public BigDecimal getBalance() {
        return balance;
    }

    public void setBalance(BigDecimal balance) {
        this.balance = balance;
    }

    public LocalDateTime getLastUpdatedAt() {
        return lastUpdatedAt;
    }

    public void setLastUpdatedAt(LocalDateTime lastUpdatedAt) {
        this.lastUpdatedAt = lastUpdatedAt;
    }
}







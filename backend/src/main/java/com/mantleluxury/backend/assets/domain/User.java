package com.mantleluxury.backend.assets.domain;

import jakarta.persistence.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "users")
public class User {

    @Id
    @Column(columnDefinition = "CHAR(36)")
    private String id;

    @Column(name = "wallet_address", length = 42, nullable = false, unique = true)
    private String walletAddress;

    @Column(name = "email")
    private String email;

    @Column(name = "kyc_status", length = 20, nullable = false)
    private String kycStatus;

    @Column(name = "kyc_submitted_at")
    private LocalDateTime kycSubmittedAt;

    @Column(name = "kyc_approved_at")
    private LocalDateTime kycApprovedAt;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        if (id == null) {
            id = UUID.randomUUID().toString();
        }
        if (kycStatus == null) {
            kycStatus = "none";
        }
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
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

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getKycStatus() {
        return kycStatus;
    }

    public void setKycStatus(String kycStatus) {
        this.kycStatus = kycStatus;
    }

    public LocalDateTime getKycSubmittedAt() {
        return kycSubmittedAt;
    }

    public void setKycSubmittedAt(LocalDateTime kycSubmittedAt) {
        this.kycSubmittedAt = kycSubmittedAt;
    }

    public LocalDateTime getKycApprovedAt() {
        return kycApprovedAt;
    }

    public void setKycApprovedAt(LocalDateTime kycApprovedAt) {
        this.kycApprovedAt = kycApprovedAt;
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
}




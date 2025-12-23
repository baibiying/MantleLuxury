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

    @Column(name = "kyc_rejected_at")
    private LocalDateTime kycRejectedAt;

    @Column(name = "kyc_rejection_reason", columnDefinition = "TEXT")
    private String kycRejectionReason;

    // KYC基本信息
    @Column(name = "full_name", length = 200)
    private String fullName;

    @Column(name = "id_number", length = 50)
    private String idNumber;

    @Column(name = "id_type", length = 20)
    private String idType; // id_card, passport, driver_license

    @Column(name = "address", columnDefinition = "TEXT")
    private String address;

    @Column(name = "phone", length = 20)
    private String phone;

    // 证件上传
    @Column(name = "id_document_front_url", columnDefinition = "TEXT")
    private String idDocumentFrontUrl;

    @Column(name = "id_document_back_url", columnDefinition = "TEXT")
    private String idDocumentBackUrl;

    @Column(name = "selfie_url", columnDefinition = "TEXT")
    private String selfieUrl;

    @Column(name = "email_notifications")
    private Boolean emailNotifications;

    @Column(name = "yield_notifications")
    private Boolean yieldNotifications;

    @Column(name = "announcement_notifications")
    private Boolean announcementNotifications;

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
        if (emailNotifications == null) {
            emailNotifications = true;
        }
        if (yieldNotifications == null) {
            yieldNotifications = true;
        }
        if (announcementNotifications == null) {
            announcementNotifications = true;
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

    public Boolean getEmailNotifications() {
        return emailNotifications;
    }

    public void setEmailNotifications(Boolean emailNotifications) {
        this.emailNotifications = emailNotifications;
    }

    public Boolean getYieldNotifications() {
        return yieldNotifications;
    }

    public void setYieldNotifications(Boolean yieldNotifications) {
        this.yieldNotifications = yieldNotifications;
    }

    public Boolean getAnnouncementNotifications() {
        return announcementNotifications;
    }

    public void setAnnouncementNotifications(Boolean announcementNotifications) {
        this.announcementNotifications = announcementNotifications;
    }

    public LocalDateTime getKycRejectedAt() {
        return kycRejectedAt;
    }

    public void setKycRejectedAt(LocalDateTime kycRejectedAt) {
        this.kycRejectedAt = kycRejectedAt;
    }

    public String getKycRejectionReason() {
        return kycRejectionReason;
    }

    public void setKycRejectionReason(String kycRejectionReason) {
        this.kycRejectionReason = kycRejectionReason;
    }

    public String getFullName() {
        return fullName;
    }

    public void setFullName(String fullName) {
        this.fullName = fullName;
    }

    public String getIdNumber() {
        return idNumber;
    }

    public void setIdNumber(String idNumber) {
        this.idNumber = idNumber;
    }

    public String getIdType() {
        return idType;
    }

    public void setIdType(String idType) {
        this.idType = idType;
    }

    public String getAddress() {
        return address;
    }

    public void setAddress(String address) {
        this.address = address;
    }

    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    public String getIdDocumentFrontUrl() {
        return idDocumentFrontUrl;
    }

    public void setIdDocumentFrontUrl(String idDocumentFrontUrl) {
        this.idDocumentFrontUrl = idDocumentFrontUrl;
    }

    public String getIdDocumentBackUrl() {
        return idDocumentBackUrl;
    }

    public void setIdDocumentBackUrl(String idDocumentBackUrl) {
        this.idDocumentBackUrl = idDocumentBackUrl;
    }

    public String getSelfieUrl() {
        return selfieUrl;
    }

    public void setSelfieUrl(String selfieUrl) {
        this.selfieUrl = selfieUrl;
    }
}




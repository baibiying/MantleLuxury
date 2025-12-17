package com.mantleluxury.backend.assets.domain;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * 资产审核记录实体
 */
@Entity
@Table(name = "asset_reviews")
public class AssetReview {

    @Id
    @Column(columnDefinition = "CHAR(36)")
    private String id;

    // 与数据库中的 CHAR(36) 对齐，避免 Hibernate 校验错误
    @Column(name = "asset_id", nullable = false, columnDefinition = "CHAR(36)")
    private String assetId;

    @Column(name = "reviewer_address", nullable = false, length = 42)
    private String reviewerAddress;

    @Column(name = "review_status", nullable = false, length = 20)
    private String reviewStatus; // pending, approved, rejected, needs_revision

    @Column(name = "review_notes", columnDefinition = "TEXT")
    private String reviewNotes;

    @Column(name = "action_type", length = 50)
    private String actionType; // initial_review, authentication_review, custody_review, insurance_review, final_approval

    @Column(name = "next_step", length = 255)
    private String nextStep;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        if (id == null) {
            id = UUID.randomUUID().toString();
        }
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    // Getters and Setters
    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getAssetId() {
        return assetId;
    }

    public void setAssetId(String assetId) {
        this.assetId = assetId;
    }

    public String getReviewerAddress() {
        return reviewerAddress;
    }

    public void setReviewerAddress(String reviewerAddress) {
        this.reviewerAddress = reviewerAddress;
    }

    public String getReviewStatus() {
        return reviewStatus;
    }

    public void setReviewStatus(String reviewStatus) {
        this.reviewStatus = reviewStatus;
    }

    public String getReviewNotes() {
        return reviewNotes;
    }

    public void setReviewNotes(String reviewNotes) {
        this.reviewNotes = reviewNotes;
    }

    public String getActionType() {
        return actionType;
    }

    public void setActionType(String actionType) {
        this.actionType = actionType;
    }

    public String getNextStep() {
        return nextStep;
    }

    public void setNextStep(String nextStep) {
        this.nextStep = nextStep;
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


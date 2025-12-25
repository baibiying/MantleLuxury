package com.mantleluxury.backend.assets.domain;

import jakarta.persistence.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "risk_assessments")
public class RiskAssessment {

    @Id
    @Column(columnDefinition = "CHAR(36)")
    private String id;

    @Column(name = "wallet_address", length = 42, nullable = false)
    private String walletAddress;

    // 投资经验 (1-5分)
    @Column(name = "investment_experience_score")
    private Integer investmentExperienceScore;

    // 风险承受能力 (1-5分)
    @Column(name = "risk_tolerance_score")
    private Integer riskToleranceScore;

    // 投资目标 (1-5分)
    @Column(name = "investment_goal_score")
    private Integer investmentGoalScore;

    // 投资期限偏好 (1-5分)
    @Column(name = "investment_horizon_score")
    private Integer investmentHorizonScore;

    // 总分数
    @Column(name = "total_score")
    private Integer totalScore;

    // 风险等级: conservative, moderate, aggressive
    @Column(name = "risk_level", length = 20)
    private String riskLevel;

    // 测评结果描述
    @Column(name = "assessment_result", columnDefinition = "TEXT")
    private String assessmentResult;

    @Column(name = "created_at")
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

    public String getWalletAddress() {
        return walletAddress;
    }

    public void setWalletAddress(String walletAddress) {
        this.walletAddress = walletAddress;
    }

    public Integer getInvestmentExperienceScore() {
        return investmentExperienceScore;
    }

    public void setInvestmentExperienceScore(Integer investmentExperienceScore) {
        this.investmentExperienceScore = investmentExperienceScore;
    }

    public Integer getRiskToleranceScore() {
        return riskToleranceScore;
    }

    public void setRiskToleranceScore(Integer riskToleranceScore) {
        this.riskToleranceScore = riskToleranceScore;
    }

    public Integer getInvestmentGoalScore() {
        return investmentGoalScore;
    }

    public void setInvestmentGoalScore(Integer investmentGoalScore) {
        this.investmentGoalScore = investmentGoalScore;
    }

    public Integer getInvestmentHorizonScore() {
        return investmentHorizonScore;
    }

    public void setInvestmentHorizonScore(Integer investmentHorizonScore) {
        this.investmentHorizonScore = investmentHorizonScore;
    }

    public Integer getTotalScore() {
        return totalScore;
    }

    public void setTotalScore(Integer totalScore) {
        this.totalScore = totalScore;
    }

    public String getRiskLevel() {
        return riskLevel;
    }

    public void setRiskLevel(String riskLevel) {
        this.riskLevel = riskLevel;
    }

    public String getAssessmentResult() {
        return assessmentResult;
    }

    public void setAssessmentResult(String assessmentResult) {
        this.assessmentResult = assessmentResult;
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





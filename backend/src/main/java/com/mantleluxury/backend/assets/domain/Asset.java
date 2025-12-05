package com.mantleluxury.backend.assets.domain;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * 资产实体类
 */
@Entity
@Table(name = "assets")
public class Asset {
    
    @Id
    @Column(columnDefinition = "CHAR(36)")
    private String id;
    
    @Column(name = "asset_id_bytes32", unique = true, nullable = false, length = 66)
    private String assetIdBytes32;
    
    @Column(name = "token_address", length = 42, nullable = true)
    private String tokenAddress;
    
    @Column(name = "asset_type", nullable = false, length = 50)
    private String assetType; // watch, jewelry
    
    @Column(name = "brand", length = 100)
    private String brand;
    
    @Column(name = "model", length = 100)
    private String model;
    
    @Column(name = "year")
    private Integer year;
    
    @Column(name = "total_supply", precision = 36, scale = 18)
    private BigDecimal totalSupply;
    
    @Column(name = "price_per_share", precision = 36, scale = 18)
    private BigDecimal pricePerShare;
    
    @Column(name = "metadata_hash", length = 66)
    private String metadataHash;
    
    @Column(name = "custody_info_hash", length = 66)
    private String custodyInfoHash;
    
    @Column(name = "insurance_info_hash", length = 66)
    private String insuranceInfoHash;
    
    @Column(name = "status", nullable = false, length = 20)
    private String status; // registered, fundraising, funded, sold
    
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
    
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
    
    // 提交者信息（后续可以关联到用户表）
    @Column(name = "submitted_by", length = 42)
    private String submittedBy; // 钱包地址或用户ID
    
    @Column(name = "description", columnDefinition = "TEXT")
    private String description;
    
    @Column(name = "purchase_price", precision = 36, scale = 18)
    private BigDecimal purchasePrice;
    
    @Column(name = "purchase_date")
    private java.time.LocalDate purchaseDate;
    
    @Column(name = "serial_number", length = 200)
    private String serialNumber;
    
    @PrePersist
    protected void onCreate() {
        if (id == null) {
            id = UUID.randomUUID().toString();
        }
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (status == null) {
            status = "registered";
        }
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
    
    public String getAssetIdBytes32() {
        return assetIdBytes32;
    }
    
    public void setAssetIdBytes32(String assetIdBytes32) {
        this.assetIdBytes32 = assetIdBytes32;
    }
    
    public String getTokenAddress() {
        return tokenAddress;
    }
    
    public void setTokenAddress(String tokenAddress) {
        this.tokenAddress = tokenAddress;
    }
    
    public String getAssetType() {
        return assetType;
    }
    
    public void setAssetType(String assetType) {
        this.assetType = assetType;
    }
    
    public String getBrand() {
        return brand;
    }
    
    public void setBrand(String brand) {
        this.brand = brand;
    }
    
    public String getModel() {
        return model;
    }
    
    public void setModel(String model) {
        this.model = model;
    }
    
    public Integer getYear() {
        return year;
    }
    
    public void setYear(Integer year) {
        this.year = year;
    }
    
    public BigDecimal getTotalSupply() {
        return totalSupply;
    }
    
    public void setTotalSupply(BigDecimal totalSupply) {
        this.totalSupply = totalSupply;
    }
    
    public BigDecimal getPricePerShare() {
        return pricePerShare;
    }
    
    public void setPricePerShare(BigDecimal pricePerShare) {
        this.pricePerShare = pricePerShare;
    }
    
    public String getMetadataHash() {
        return metadataHash;
    }
    
    public void setMetadataHash(String metadataHash) {
        this.metadataHash = metadataHash;
    }
    
    public String getCustodyInfoHash() {
        return custodyInfoHash;
    }
    
    public void setCustodyInfoHash(String custodyInfoHash) {
        this.custodyInfoHash = custodyInfoHash;
    }
    
    public String getInsuranceInfoHash() {
        return insuranceInfoHash;
    }
    
    public void setInsuranceInfoHash(String insuranceInfoHash) {
        this.insuranceInfoHash = insuranceInfoHash;
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
    
    public String getSubmittedBy() {
        return submittedBy;
    }
    
    public void setSubmittedBy(String submittedBy) {
        this.submittedBy = submittedBy;
    }
    
    public String getDescription() {
        return description;
    }
    
    public void setDescription(String description) {
        this.description = description;
    }
    
    public BigDecimal getPurchasePrice() {
        return purchasePrice;
    }
    
    public void setPurchasePrice(BigDecimal purchasePrice) {
        this.purchasePrice = purchasePrice;
    }
    
    public java.time.LocalDate getPurchaseDate() {
        return purchaseDate;
    }
    
    public void setPurchaseDate(java.time.LocalDate purchaseDate) {
        this.purchaseDate = purchaseDate;
    }
    
    public String getSerialNumber() {
        return serialNumber;
    }
    
    public void setSerialNumber(String serialNumber) {
        this.serialNumber = serialNumber;
    }
}


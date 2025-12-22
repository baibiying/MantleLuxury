package com.mantleluxury.backend.assets.domain;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * 资产托管实体
 */
@Entity
@Table(name = "custodies")
public class Custody {

    @Id
    @Column(columnDefinition = "CHAR(36)")
    private String id;

    @Column(name = "asset_id", nullable = false, columnDefinition = "CHAR(36)")
    private String assetId;

    @Column(name = "custody_status", nullable = false, length = 20)
    private String custodyStatus; // registered, in_custody, for_sale, sold, withdrawn

    @Column(name = "custody_organization", nullable = false, length = 200)
    private String custodyOrganization; // 托管机构名称

    @Column(name = "warehouse_location", length = 500)
    private String warehouseLocation; // 仓储位置（模糊显示，如"香港-XX区"）

    @Column(name = "warehouse_address_hash", length = 66)
    private String warehouseAddressHash; // 详细地址哈希（链上存证）

    @Column(name = "entry_date")
    private LocalDate entryDate; // 入库日期

    @Column(name = "custody_contract_url", columnDefinition = "TEXT")
    private String custodyContractUrl; // 托管合同 URL

    @Column(name = "custody_contract_hash", length = 66)
    private String custodyContractHash; // 托管合同哈希（链上存证）

    @Column(name = "facility_standards", columnDefinition = "TEXT")
    private String facilityStandards; // 设施标准（恒温恒湿、防火防盗等）

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
        if (custodyStatus == null) {
            custodyStatus = "registered";
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

    public String getCustodyStatus() { return custodyStatus; }
    public void setCustodyStatus(String custodyStatus) { this.custodyStatus = custodyStatus; }

    public String getCustodyOrganization() { return custodyOrganization; }
    public void setCustodyOrganization(String custodyOrganization) { this.custodyOrganization = custodyOrganization; }

    public String getWarehouseLocation() { return warehouseLocation; }
    public void setWarehouseLocation(String warehouseLocation) { this.warehouseLocation = warehouseLocation; }

    public String getWarehouseAddressHash() { return warehouseAddressHash; }
    public void setWarehouseAddressHash(String warehouseAddressHash) { this.warehouseAddressHash = warehouseAddressHash; }

    public LocalDate getEntryDate() { return entryDate; }
    public void setEntryDate(LocalDate entryDate) { this.entryDate = entryDate; }

    public String getCustodyContractUrl() { return custodyContractUrl; }
    public void setCustodyContractUrl(String custodyContractUrl) { this.custodyContractUrl = custodyContractUrl; }

    public String getCustodyContractHash() { return custodyContractHash; }
    public void setCustodyContractHash(String custodyContractHash) { this.custodyContractHash = custodyContractHash; }

    public String getFacilityStandards() { return facilityStandards; }
    public void setFacilityStandards(String facilityStandards) { this.facilityStandards = facilityStandards; }

    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}





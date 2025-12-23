package com.mantleluxury.backend.blockchain.domain;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/**
 * 链上事件实体
 */
@Entity
@Table(name = "blockchain_events")
public class BlockchainEvent {

    @Id
    @Column(columnDefinition = "CHAR(36)")
    private String id;

    @Column(name = "event_type", nullable = false, length = 50)
    private String eventType;

    @Column(name = "contract_address", nullable = false, length = 42)
    private String contractAddress;

    @Column(name = "transaction_hash", nullable = false, length = 66)
    private String transactionHash;

    @Column(name = "block_number", nullable = false)
    private Long blockNumber;

    @Column(name = "block_timestamp")
    private LocalDateTime blockTimestamp;

    @Column(name = "log_index", nullable = false)
    private Integer logIndex;

    @Column(name = "event_data", columnDefinition = "JSON")
    private String eventData;

    @Column(name = "processed", nullable = false)
    private Boolean processed = false;

    @Column(name = "processed_at")
    private LocalDateTime processedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    // Getters and Setters
    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getEventType() {
        return eventType;
    }

    public void setEventType(String eventType) {
        this.eventType = eventType;
    }

    public String getContractAddress() {
        return contractAddress;
    }

    public void setContractAddress(String contractAddress) {
        this.contractAddress = contractAddress;
    }

    public String getTransactionHash() {
        return transactionHash;
    }

    public void setTransactionHash(String transactionHash) {
        this.transactionHash = transactionHash;
    }

    public Long getBlockNumber() {
        return blockNumber;
    }

    public void setBlockNumber(Long blockNumber) {
        this.blockNumber = blockNumber;
    }

    public LocalDateTime getBlockTimestamp() {
        return blockTimestamp;
    }

    public void setBlockTimestamp(LocalDateTime blockTimestamp) {
        this.blockTimestamp = blockTimestamp;
    }

    public Integer getLogIndex() {
        return logIndex;
    }

    public void setLogIndex(Integer logIndex) {
        this.logIndex = logIndex;
    }

    public String getEventData() {
        return eventData;
    }

    public void setEventData(String eventData) {
        this.eventData = eventData;
    }

    public Boolean getProcessed() {
        return processed;
    }

    public void setProcessed(Boolean processed) {
        this.processed = processed;
    }

    public LocalDateTime getProcessedAt() {
        return processedAt;
    }

    public void setProcessedAt(LocalDateTime processedAt) {
        this.processedAt = processedAt;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}


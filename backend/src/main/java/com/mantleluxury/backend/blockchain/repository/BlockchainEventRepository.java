package com.mantleluxury.backend.blockchain.repository;

import com.mantleluxury.backend.blockchain.domain.BlockchainEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface BlockchainEventRepository extends JpaRepository<BlockchainEvent, String> {

    Optional<BlockchainEvent> findByTransactionHashAndLogIndex(String transactionHash, Integer logIndex);

    List<BlockchainEvent> findByEventType(String eventType);

    List<BlockchainEvent> findByContractAddress(String contractAddress);

    List<BlockchainEvent> findByProcessed(Boolean processed);

    @Query("SELECT MAX(e.blockNumber) FROM BlockchainEvent e WHERE e.contractAddress = ?1")
    Long findMaxBlockNumberByContractAddress(String contractAddress);
}


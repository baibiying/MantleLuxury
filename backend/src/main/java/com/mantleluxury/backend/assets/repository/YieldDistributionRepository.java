package com.mantleluxury.backend.assets.repository;

import com.mantleluxury.backend.assets.domain.YieldDistribution;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface YieldDistributionRepository extends JpaRepository<YieldDistribution, String> {
    
    Optional<YieldDistribution> findByDistributionIdBytes32(String distributionIdBytes32);
    
    List<YieldDistribution> findByAssetId(String assetId);
    
    List<YieldDistribution> findByTokenAddress(String tokenAddress);
    
    List<YieldDistribution> findByTokenAddressIn(List<String> tokenAddresses);
    
    List<YieldDistribution> findByIsCompletedOrderByCreatedAtDesc(Boolean isCompleted);
    
    List<YieldDistribution> findAllByOrderByCreatedAtDesc();
}


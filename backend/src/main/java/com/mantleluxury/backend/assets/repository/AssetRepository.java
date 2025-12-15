package com.mantleluxury.backend.assets.repository;

import com.mantleluxury.backend.assets.domain.Asset;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AssetRepository extends JpaRepository<Asset, String> {
    
    Optional<Asset> findByAssetIdBytes32(String assetIdBytes32);
    Optional<Asset> findByTokenAddress(String tokenAddress);
    void deleteByTokenAddress(String tokenAddress);
    
    List<Asset> findByStatus(String status);
    
    List<Asset> findByAssetType(String assetType);
    
    List<Asset> findBySubmittedBy(String submittedBy);
}


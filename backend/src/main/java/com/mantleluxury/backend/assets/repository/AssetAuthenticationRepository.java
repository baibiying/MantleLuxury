package com.mantleluxury.backend.assets.repository;

import com.mantleluxury.backend.assets.domain.AssetAuthentication;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AssetAuthenticationRepository extends JpaRepository<AssetAuthentication, String> {
    
    List<AssetAuthentication> findByAssetId(String assetId);
    
    List<AssetAuthentication> findByAssetIdAndAuthenticationStatus(String assetId, String status);
    
    long countByAssetIdAndAuthenticationStatus(String assetId, String status);
}


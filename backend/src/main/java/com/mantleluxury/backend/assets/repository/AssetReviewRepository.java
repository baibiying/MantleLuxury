package com.mantleluxury.backend.assets.repository;

import com.mantleluxury.backend.assets.domain.AssetReview;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AssetReviewRepository extends JpaRepository<AssetReview, String> {
    
    List<AssetReview> findByAssetIdOrderByCreatedAtDesc(String assetId);
    
    List<AssetReview> findByReviewStatus(String reviewStatus);
    
    List<AssetReview> findByReviewerAddress(String reviewerAddress);
}






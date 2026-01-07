package com.mantleluxury.backend.assets.repository;

import com.mantleluxury.backend.assets.domain.AssetImage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AssetImageRepository extends JpaRepository<AssetImage, String> {
    
    /**
     * 根据资产ID查找所有图片
     */
    List<AssetImage> findByAssetIdOrderByImageIndexAsc(String assetId);
    
    /**
     * 根据资产ID和图片索引查找特定图片
     */
    Optional<AssetImage> findByAssetIdAndImageIndex(String assetId, Integer imageIndex);
    
    /**
     * 删除资产的所有图片
     */
    void deleteByAssetId(String assetId);
    
    /**
     * 统计资产的图片数量
     */
    long countByAssetId(String assetId);
}


package com.mantleluxury.backend.assets.service;

import com.mantleluxury.backend.assets.domain.Asset;
import com.mantleluxury.backend.assets.domain.AssetReview;
import com.mantleluxury.backend.assets.repository.AssetRepository;
import com.mantleluxury.backend.assets.repository.AssetReviewRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * 资产审核服务
 */
@Service
public class AssetReviewService {

    private static final Logger logger = LoggerFactory.getLogger(AssetReviewService.class);

    private final AssetReviewRepository reviewRepository;
    private final AssetRepository assetRepository;

    public AssetReviewService(
            AssetReviewRepository reviewRepository,
            AssetRepository assetRepository
    ) {
        this.reviewRepository = reviewRepository;
        this.assetRepository = assetRepository;
    }

    /**
     * 创建审核记录
     */
    @Transactional
    public AssetReview createReview(
            String assetId,
            String reviewerAddress,
            String reviewStatus,
            String reviewNotes,
            String actionType,
            String nextStep
    ) {
        AssetReview review = new AssetReview();
        review.setAssetId(assetId);
        review.setReviewerAddress(reviewerAddress);
        review.setReviewStatus(reviewStatus);
        review.setReviewNotes(reviewNotes);
        review.setActionType(actionType);
        review.setNextStep(nextStep);
        
        AssetReview saved = reviewRepository.save(review);
        logger.info("Created review for asset {} by reviewer {}", assetId, reviewerAddress);
        return saved;
    }

    /**
     * 获取资产的所有审核记录
     */
    public List<AssetReview> getReviewsByAssetId(String assetId) {
        return reviewRepository.findByAssetIdOrderByCreatedAtDesc(assetId);
    }

    /**
     * 获取指定状态的审核记录
     */
    public List<AssetReview> getReviewsByStatus(String status) {
        return reviewRepository.findByReviewStatus(status);
    }

    /**
     * 获取审核人的所有审核记录
     */
    public List<AssetReview> getReviewsByReviewer(String reviewerAddress) {
        return reviewRepository.findByReviewerAddress(reviewerAddress);
    }

    /**
     * 更新审核记录
     */
    @Transactional
    public AssetReview updateReview(
            String reviewId,
            String reviewStatus,
            String reviewNotes,
            String nextStep
    ) {
        Optional<AssetReview> reviewOpt = reviewRepository.findById(reviewId);
        if (reviewOpt.isEmpty()) {
            throw new RuntimeException("Review not found: " + reviewId);
        }
        
        AssetReview review = reviewOpt.get();
        if (reviewStatus != null) {
            review.setReviewStatus(reviewStatus);
        }
        if (reviewNotes != null) {
            review.setReviewNotes(reviewNotes);
        }
        if (nextStep != null) {
            review.setNextStep(nextStep);
        }
        
        return reviewRepository.save(review);
    }
}



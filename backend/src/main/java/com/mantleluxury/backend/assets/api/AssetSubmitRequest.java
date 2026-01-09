package com.mantleluxury.backend.assets.api;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * 资产提交请求 DTO
 */
public record AssetSubmitRequest(
        String assetType,          // watch / jewelry
        String brand,
        String model,
        Integer year,
        String description,
        BigDecimal purchasePrice,
        LocalDate purchaseDate,
        String serialNumber,
        BigDecimal totalSupply,    // 代币总份数
        BigDecimal pricePerShare,  // 每份价格
        String tokenSymbol,        // 代币符号（可选，如果不提供则自动生成）
        String submittedBy,        // 提交者钱包地址（用户连接的钱包地址）
        String signature,         // 钱包签名（用于验证地址所有权，可选）
        String message,           // 签名的原始消息（用于验证，可选）
        String imageUrls,          // 图片 JSON 字符串
        String model3dUrl          // 3D模型文件URL（可选）
) {
}



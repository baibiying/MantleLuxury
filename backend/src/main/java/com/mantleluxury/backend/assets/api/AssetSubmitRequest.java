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
        String submittedBy         // 提交者钱包地址或用户ID
) {
}



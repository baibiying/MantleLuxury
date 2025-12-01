package com.mantleluxury.backend.assets.api;

import java.math.BigDecimal;

/**
 * 资产对外展示用 DTO（简化版），后续可以与数据库实体解耦。
 *
 * 使用 Java 17 record，避免对 Lombok 的依赖。
 */
public record AssetDto(
        String id,
        String assetType,      // watch / jewelry
        String brand,
        String model,
        Integer year,
        BigDecimal pricePerShare,
        BigDecimal totalSupply,
        BigDecimal remainingSupply,
        String status          // fundraising / funded / sold
) {
}



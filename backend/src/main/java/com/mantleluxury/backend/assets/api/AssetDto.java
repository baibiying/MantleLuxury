package com.mantleluxury.backend.assets.api;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

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
        String status,          // fundraising / funded / sold
        String tokenAddress,   // 合约地址（用于前端调用合约）
        String description,    // 资产描述
        String imageUrls,      // 资产图片（JSON 字符串）
        BigDecimal totalYield, // 累计收益（升值收益）
        List<Map<String, Object>> authentications,  // 认证信息列表
        Map<String, Object> custody,  // 托管信息
        Map<String, Object> insurance  // 保险信息
) {
}



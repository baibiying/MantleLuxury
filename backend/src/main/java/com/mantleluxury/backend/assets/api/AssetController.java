package com.mantleluxury.backend.assets.api;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

/**
 * 资产列表 / 详情接口（MVP：使用内存 mock 数据，后续替换为数据库 + 链上数据）。
 */
@RestController
@RequestMapping("/api/assets")
@CrossOrigin(origins = "http://localhost:3000")
public class AssetController {

    // TODO: 替换成 service + repository，从 PostgreSQL 和链上读取真实数据
    private final List<AssetDto> mockAssets = List.of(
            new AssetDto(
                    "asset-pp-watch-001",
                    "watch",
                    "Patek Philippe",
                    "Nautilus 5711",
                    2019,
                    new BigDecimal("500"),
                    new BigDecimal("1000"),
                    new BigDecimal("600"),
                    "fundraising"
            ),
            new AssetDto(
                    "asset-cartier-jewelry-001",
                    "jewelry",
                    "Cartier",
                    "LOVE Bracelet",
                    2021,
                    new BigDecimal("250"),
                    new BigDecimal("2000"),
                    new BigDecimal("0"),
                    "funded"
            )
    );

    @GetMapping
    public ResponseEntity<List<AssetDto>> listAssets() {
        return ResponseEntity.ok(mockAssets);
    }

    @GetMapping("/{id}")
    public ResponseEntity<AssetDto> getAsset(@PathVariable String id) {
        Optional<AssetDto> found = mockAssets.stream()
                .filter(a -> a.id().equals(id))
                .findFirst();
        return found.map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}



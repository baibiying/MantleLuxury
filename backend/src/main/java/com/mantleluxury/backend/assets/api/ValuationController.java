package com.mantleluxury.backend.assets.api;

import com.mantleluxury.backend.assets.domain.Valuation;
import com.mantleluxury.backend.assets.service.ValuationService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 估值报告前端API
 */
@RestController
@RequestMapping("/api/assets")
@CrossOrigin(origins = "http://localhost:3000")
public class ValuationController {

    private final ValuationService valuationService;

    public ValuationController(ValuationService valuationService) {
        this.valuationService = valuationService;
    }

    /**
     * 获取资产的所有估值记录
     */
    @GetMapping("/{assetId}/valuations")
    public ResponseEntity<List<Valuation>> getAssetValuations(@PathVariable String assetId) {
        List<Valuation> valuations = valuationService.getValuationsByAssetId(assetId);
        return ResponseEntity.ok(valuations);
    }

    /**
     * 获取资产的最新估值
     */
    @GetMapping("/{assetId}/valuations/latest")
    public ResponseEntity<Valuation> getLatestValuation(@PathVariable String assetId) {
        Valuation valuation = valuationService.getLatestValuation(assetId);
        if (valuation == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(valuation);
    }
}



package com.mantleluxury.backend.assets.api;

import com.mantleluxury.backend.assets.domain.Custody;
import com.mantleluxury.backend.assets.service.CustodyService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/custodies")
@CrossOrigin(origins = "http://localhost:3000")
public class CustodyController {

    private static final Logger logger = LoggerFactory.getLogger(CustodyController.class);

    private final CustodyService custodyService;

    public CustodyController(CustodyService custodyService) {
        this.custodyService = custodyService;
    }

    /**
     * 创建托管记录
     */
    @PostMapping
    public ResponseEntity<?> createCustody(@RequestBody Map<String, Object> payload) {
        try {
            String assetId = (String) payload.get("assetId");
            String custodyOrganization = (String) payload.get("custodyOrganization");
            String warehouseLocation = (String) payload.get("warehouseLocation");
            String warehouseAddressHash = (String) payload.get("warehouseAddressHash");
            String entryDateStr = (String) payload.get("entryDate");
            String custodyContractUrl = (String) payload.get("custodyContractUrl");
            String custodyContractHash = (String) payload.get("custodyContractHash");
            String facilityStandards = (String) payload.get("facilityStandards");
            String notes = (String) payload.get("notes");

            if (assetId == null || custodyOrganization == null) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "assetId and custodyOrganization are required"));
            }

            LocalDate entryDate = entryDateStr != null ? LocalDate.parse(entryDateStr) : null;

            Custody custody = custodyService.createCustody(
                    assetId, custodyOrganization, warehouseLocation, warehouseAddressHash,
                    entryDate, custodyContractUrl, custodyContractHash, facilityStandards, notes);

            return ResponseEntity.status(HttpStatus.CREATED).body(toDto(custody));
        } catch (Exception e) {
            logger.error("Failed to create custody", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * 更新托管状态
     */
    @PostMapping("/{assetId}/status")
    public ResponseEntity<?> updateCustodyStatus(
            @PathVariable String assetId,
            @RequestBody Map<String, String> payload) {
        try {
            String status = payload.get("status");
            if (status == null) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "status is required"));
            }

            Custody custody = custodyService.updateCustodyStatus(assetId, status);
            return ResponseEntity.ok(toDto(custody));
        } catch (Exception e) {
            logger.error("Failed to update custody status", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * 获取资产的托管记录
     */
    @GetMapping("/asset/{assetId}")
    public ResponseEntity<?> getCustodyByAssetId(@PathVariable String assetId) {
        return custodyService.getCustodyByAssetId(assetId)
                .map(custody -> ResponseEntity.ok(toDto(custody)))
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("error", "Custody record not found")));
    }

    /**
     * 获取所有托管记录
     */
    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> getAllCustodies() {
        List<Custody> custodies = custodyService.getAllCustodies();
        return ResponseEntity.ok(custodies.stream()
                .map(this::toDto)
                .collect(Collectors.toList()));
    }

    /**
     * 转换为 DTO
     */
    private Map<String, Object> toDto(Custody custody) {
        Map<String, Object> dto = new HashMap<>();
        dto.put("id", custody.getId());
        dto.put("assetId", custody.getAssetId());
        dto.put("custodyStatus", custody.getCustodyStatus());
        dto.put("custodyOrganization", custody.getCustodyOrganization());
        dto.put("warehouseLocation", custody.getWarehouseLocation());
        dto.put("warehouseAddressHash", custody.getWarehouseAddressHash());
        dto.put("entryDate", custody.getEntryDate());
        dto.put("custodyContractUrl", custody.getCustodyContractUrl());
        dto.put("custodyContractHash", custody.getCustodyContractHash());
        dto.put("facilityStandards", custody.getFacilityStandards());
        dto.put("notes", custody.getNotes());
        dto.put("createdAt", custody.getCreatedAt());
        dto.put("updatedAt", custody.getUpdatedAt());
        return dto;
    }
}



package com.mantleluxury.backend.assets.service;

import com.mantleluxury.backend.assets.domain.Asset;
import com.mantleluxury.backend.assets.domain.Custody;
import com.mantleluxury.backend.assets.repository.AssetRepository;
import com.mantleluxury.backend.assets.repository.CustodyRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

/**
 * 资产托管服务
 */
@Service
public class CustodyService {

    private static final Logger logger = LoggerFactory.getLogger(CustodyService.class);

    private final CustodyRepository custodyRepository;
    private final AssetRepository assetRepository;

    public CustodyService(CustodyRepository custodyRepository, AssetRepository assetRepository) {
        this.custodyRepository = custodyRepository;
        this.assetRepository = assetRepository;
    }

    /**
     * 创建托管记录
     */
    @Transactional
    public Custody createCustody(
            String assetId,
            String custodyOrganization,
            String warehouseLocation,
            String warehouseAddressHash,
            LocalDate entryDate,
            String custodyContractUrl,
            String custodyContractHash,
            String facilityStandards,
            String notes) {
        
        // 验证资产是否存在
        Asset asset = assetRepository.findById(assetId)
                .orElseThrow(() -> new RuntimeException("Asset not found: " + assetId));

        // 检查是否已有托管记录
        Optional<Custody> existing = custodyRepository.findByAssetId(assetId);
        if (existing.isPresent()) {
            throw new RuntimeException("Custody record already exists for asset: " + assetId);
        }

        Custody custody = new Custody();
        custody.setAssetId(assetId);
        custody.setCustodyStatus("in_custody");
        custody.setCustodyOrganization(custodyOrganization);
        custody.setWarehouseLocation(warehouseLocation);
        custody.setWarehouseAddressHash(warehouseAddressHash);
        custody.setEntryDate(entryDate != null ? entryDate : LocalDate.now());
        custody.setCustodyContractUrl(custodyContractUrl);
        custody.setCustodyContractHash(custodyContractHash);
        custody.setFacilityStandards(facilityStandards);
        custody.setNotes(notes);

        // 更新资产的 custody_info_hash
        if (custodyContractHash != null && !custodyContractHash.isEmpty()) {
            asset.setCustodyInfoHash(custodyContractHash);
            assetRepository.save(asset);
        }

        Custody saved = custodyRepository.save(custody);
        logger.info("Created custody record for asset {}: {}", assetId, saved.getId());
        return saved;
    }

    /**
     * 更新托管状态
     */
    @Transactional
    public Custody updateCustodyStatus(String assetId, String status) {
        Custody custody = custodyRepository.findByAssetId(assetId)
                .orElseThrow(() -> new RuntimeException("Custody record not found for asset: " + assetId));

        if (!isValidStatus(status)) {
            throw new RuntimeException("Invalid custody status: " + status);
        }

        custody.setCustodyStatus(status);
        Custody saved = custodyRepository.save(custody);
        logger.info("Updated custody status for asset {}: {}", assetId, status);
        return saved;
    }

    /**
     * 更新托管信息
     */
    @Transactional
    public Custody updateCustody(String custodyId, String warehouseLocation, String notes) {
        Custody custody = custodyRepository.findById(custodyId)
                .orElseThrow(() -> new RuntimeException("Custody record not found: " + custodyId));

        if (warehouseLocation != null) {
            custody.setWarehouseLocation(warehouseLocation);
        }
        if (notes != null) {
            custody.setNotes(notes);
        }

        Custody saved = custodyRepository.save(custody);
        logger.info("Updated custody record: {}", custodyId);
        return saved;
    }

    /**
     * 获取资产的托管记录
     */
    public Optional<Custody> getCustodyByAssetId(String assetId) {
        return custodyRepository.findByAssetId(assetId);
    }

    /**
     * 获取所有托管记录
     */
    public List<Custody> getAllCustodies() {
        return custodyRepository.findAll();
    }

    /**
     * 按状态获取托管记录
     */
    public List<Custody> getCustodiesByStatus(String status) {
        return custodyRepository.findByCustodyStatus(status);
    }

    /**
     * 验证托管状态是否有效
     */
    private boolean isValidStatus(String status) {
        return status != null && (
                "registered".equals(status) ||
                "in_custody".equals(status) ||
                "for_sale".equals(status) ||
                "sold".equals(status) ||
                "withdrawn".equals(status)
        );
    }
}





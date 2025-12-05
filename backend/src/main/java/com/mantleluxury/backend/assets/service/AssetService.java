package com.mantleluxury.backend.assets.service;

import com.mantleluxury.backend.assets.api.AssetDto;
import com.mantleluxury.backend.assets.api.AssetSubmitRequest;
import com.mantleluxury.backend.assets.domain.Asset;
import com.mantleluxury.backend.assets.repository.AssetRepository;
import com.mantleluxury.backend.blockchain.service.TokenDeploymentService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class AssetService {
    
    private static final Logger logger = LoggerFactory.getLogger(AssetService.class);
    
    private final AssetRepository assetRepository;
    private final TokenDeploymentService tokenDeploymentService;
    
    public AssetService(
            AssetRepository assetRepository,
            TokenDeploymentService tokenDeploymentService
    ) {
        this.assetRepository = assetRepository;
        this.tokenDeploymentService = tokenDeploymentService;
    }
    
    /**
     * 提交新资产并部署代币合约（原子操作）
     * 如果合约部署失败，不会保存资产到数据库
     */
    @Transactional(rollbackFor = Exception.class)
    public Asset submitAsset(AssetSubmitRequest request) {
        // 准备资产数据（但不保存到数据库）
        Asset asset = new Asset();
        asset.setAssetType(request.assetType());
        asset.setBrand(request.brand());
        asset.setModel(request.model());
        asset.setYear(request.year());
        asset.setDescription(request.description());
        asset.setPurchasePrice(request.purchasePrice());
        asset.setPurchaseDate(request.purchaseDate());
        asset.setSerialNumber(request.serialNumber());
        asset.setTotalSupply(request.totalSupply());
        asset.setPricePerShare(request.pricePerShare());
        asset.setSubmittedBy(request.submittedBy());
        
        // 生成 assetIdBytes32（简化版：使用 UUID 的哈希，后续可以改为链上生成的 ID）
        String assetId = UUID.randomUUID().toString().replace("-", "");
        asset.setAssetIdBytes32("0x" + assetId);
        
        // 生成元数据哈希（简化版，实际应该从 IPFS 获取）
        String metadataHash = "0x" + UUID.randomUUID().toString().replace("-", "");
        asset.setMetadataHash(metadataHash);
        
        // 先部署代币合约（如果失败会抛出异常，事务回滚，不会保存资产）
        logger.info("Deploying token contract before saving asset...");
        String tokenName = String.format("%s %s Token", request.brand(), request.model());
        String tokenSymbol = generateTokenSymbol(request.brand(), request.model());
        BigInteger totalSupply = request.totalSupply() != null 
                ? request.totalSupply().toBigInteger() 
                : BigInteger.ZERO;
        
        String tokenAddress;
        try {
            tokenAddress = tokenDeploymentService.deployToken(
                    asset.getAssetIdBytes32(),
                    tokenName,
                    tokenSymbol,
                    totalSupply,
                    metadataHash
            );
            
            if (tokenAddress == null || tokenAddress.isEmpty()) {
                throw new RuntimeException("Token deployment returned empty address");
            }
            
            logger.info("Token deployed successfully. Contract address: {}", tokenAddress);
        } catch (Exception e) {
            logger.error("Failed to deploy token contract. Asset will not be saved.", e);
            // 抛出异常，触发事务回滚，确保资产不会保存到数据库
            throw new RuntimeException("Token deployment failed: " + e.getMessage(), e);
        }
        
        // 合约部署成功后，更新资产信息并保存
        asset.setTokenAddress(tokenAddress);
        asset.setStatus("fundraising"); // 代币部署成功后，状态改为募集中
        
        asset = assetRepository.save(asset);
        logger.info("Asset saved successfully with token address: {}", tokenAddress);
        
        return asset;
    }
    
    /**
     * 生成代币符号（简化版）
     */
    private String generateTokenSymbol(String brand, String model) {
        // 例如：Patek Philippe Nautilus -> PPT
        String[] brandWords = brand.split(" ");
        StringBuilder symbol = new StringBuilder();
        for (String word : brandWords) {
            if (!word.isEmpty()) {
                symbol.append(word.charAt(0));
            }
        }
        // 添加模型首字母
        if (model != null && !model.isEmpty()) {
            symbol.append(model.charAt(0));
        }
        return symbol.toString().toUpperCase().substring(0, Math.min(symbol.length(), 6));
    }
    
    /**
     * 获取所有资产
     */
    public List<AssetDto> getAllAssets() {
        return assetRepository.findAll().stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }
    
    /**
     * 根据 ID 获取资产
     */
    public AssetDto getAssetById(String id) {
        return assetRepository.findById(id)
                .map(this::toDto)
                .orElse(null);
    }
    
    /**
     * 转换为 DTO
     */
    private AssetDto toDto(Asset asset) {
        // 计算剩余可购份数（简化版：假设已售出为 0）
        BigDecimal remainingSupply = asset.getTotalSupply() != null 
                ? asset.getTotalSupply() 
                : BigDecimal.ZERO;
        
        return new AssetDto(
                asset.getId().toString(),
                asset.getAssetType(),
                asset.getBrand(),
                asset.getModel(),
                asset.getYear(),
                asset.getPricePerShare(),
                asset.getTotalSupply(),
                remainingSupply,
                asset.getStatus()
        );
    }
}


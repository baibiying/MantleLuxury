package com.mantleluxury.backend.assets.service;

import com.mantleluxury.backend.assets.api.AssetDto;
import com.mantleluxury.backend.assets.api.AssetSubmitRequest;
import com.mantleluxury.backend.assets.domain.Asset;
import com.mantleluxury.backend.assets.domain.AssetAuthentication;
import com.mantleluxury.backend.assets.domain.YieldDistribution;
import com.mantleluxury.backend.assets.repository.AssetRepository;
import com.mantleluxury.backend.assets.repository.YieldDistributionRepository;
import com.mantleluxury.backend.assets.service.AssetAuthenticationService;
import com.mantleluxury.backend.blockchain.service.TokenDeploymentService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class AssetService {
    
    private static final Logger logger = LoggerFactory.getLogger(AssetService.class);
    
    private final AssetRepository assetRepository;
    private final TokenDeploymentService tokenDeploymentService;
    private final YieldDistributionRepository yieldDistributionRepository;
    private final AssetAuthenticationService authenticationService;
    private final org.springframework.core.io.ResourceLoader resourceLoader;
    
    public AssetService(
            AssetRepository assetRepository,
            TokenDeploymentService tokenDeploymentService,
            YieldDistributionRepository yieldDistributionRepository,
            AssetAuthenticationService authenticationService,
            org.springframework.core.io.ResourceLoader resourceLoader
    ) {
        this.assetRepository = assetRepository;
        this.tokenDeploymentService = tokenDeploymentService;
        this.yieldDistributionRepository = yieldDistributionRepository;
        this.authenticationService = authenticationService;
        this.resourceLoader = resourceLoader;
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
        asset.setImageUrls(request.imageUrls());
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
                    metadataHash,
                    request.pricePerShare()  // 传递每份价格
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
        asset.setStatus("registered"); // 代币部署成功后，状态为已注册（待认证），只有认证通过后才能进入募集中
        
        asset = assetRepository.save(asset);
        logger.info("Asset saved successfully with token address: {}. Status: registered (awaiting authentication)", tokenAddress);
        
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
     * 按合约地址删除资产
     */
    @Transactional
    public void deleteByTokenAddress(String tokenAddress) {
        assetRepository.findByTokenAddress(tokenAddress)
                .ifPresentOrElse(
                        asset -> assetRepository.deleteByTokenAddress(tokenAddress),
                        () -> { throw new RuntimeException("Asset not found for token address: " + tokenAddress); }
                );
    }

    /**
     * 按 ID 删除资产
     */
    @Transactional
    public void deleteById(String id) {
        assetRepository.findById(id)
                .ifPresentOrElse(
                        asset -> assetRepository.deleteById(id),
                        () -> { throw new RuntimeException("Asset not found with id: " + id); }
                );
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
     * 保存上传的图片到本地 uploads 目录，返回相对访问路径
     */
    public String saveImage(org.springframework.web.multipart.MultipartFile file) throws Exception {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("File is empty or null");
        }
        
        // 使用绝对路径，确保目录创建在项目根目录下
        java.nio.file.Path uploadsDir = java.nio.file.Paths.get("uploads").toAbsolutePath();
        
        // 创建目录（如果不存在）
        if (!java.nio.file.Files.exists(uploadsDir)) {
            java.nio.file.Files.createDirectories(uploadsDir);
            logger.info("Created uploads directory: {}", uploadsDir);
        }
        
        // 生成安全的文件名
        String original = file.getOriginalFilename();
        String safeName = original != null 
                ? original.replaceAll("[^a-zA-Z0-9._-]", "_") 
                : "image";
        String filename = java.util.UUID.randomUUID().toString() + "_" + safeName;
        java.nio.file.Path dest = uploadsDir.resolve(filename);
        
        // 保存文件
        try {
            file.transferTo(dest.toFile());
            logger.info("Image saved successfully: {}", dest);
        } catch (Exception e) {
            logger.error("Failed to save image to: {}", dest, e);
            throw new Exception("Failed to save image: " + e.getMessage(), e);
        }
        
        // 返回相对路径，前端通过 /uploads/** 访问
        return "/uploads/" + filename;
    }
    
    /**
     * 转换为 DTO
     */
    private AssetDto toDto(Asset asset) {
        // 计算剩余可购份数（简化版：假设已售出为 0）
        // TODO: 后续应该从链上读取实际已售出数量
        BigDecimal remainingSupply = asset.getTotalSupply() != null 
                ? asset.getTotalSupply() 
                : BigDecimal.ZERO;
        
        // 计算累计收益（统计所有收益记录，包括未完成的）
        BigDecimal totalYield = BigDecimal.ZERO;
        if (asset.getId() != null) {
            List<YieldDistribution> yields = yieldDistributionRepository.findByAssetId(asset.getId());
            totalYield = yields.stream()
                    .map(dist -> dist.getIsCompleted() 
                        ? dist.getDistributedAmount() 
                        : dist.getTotalAmount())
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
        }
        
        // 获取认证信息
        List<Map<String, Object>> authentications = List.of();
        if (asset.getId() != null) {
            List<AssetAuthentication> authList = authenticationService.getAssetAuthentications(asset.getId());
            authentications = authList.stream()
                    .map(this::authenticationToDto)
                    .collect(Collectors.toList());
        }
        
        return new AssetDto(
                asset.getId().toString(),
                asset.getAssetType(),
                asset.getBrand(),
                asset.getModel(),
                asset.getYear(),
                asset.getPricePerShare(),
                asset.getTotalSupply(),
                remainingSupply,
                asset.getStatus(),
                asset.getTokenAddress(),  // 合约地址
                asset.getDescription(),   // 描述
                asset.getImageUrls(),     // 图片
                totalYield,                // 累计收益
                authentications           // 认证信息
        );
    }
    
    /**
     * 将认证实体转换为 DTO
     */
    private Map<String, Object> authenticationToDto(AssetAuthentication auth) {
        Map<String, Object> dto = new HashMap<>();
        dto.put("id", auth.getId());
        dto.put("assetId", auth.getAssetId());
        dto.put("authenticationStatus", auth.getAuthenticationStatus());
        dto.put("authenticatorName", auth.getAuthenticatorName());
        dto.put("authenticatorType", auth.getAuthenticatorType());
        dto.put("verificationDate", auth.getVerificationDate());
        dto.put("reportUrl", auth.getReportUrl());
        dto.put("reportHash", auth.getReportHash());
        dto.put("verifierSignature", auth.getVerifierSignature());
        dto.put("notes", auth.getNotes());
        dto.put("createdAt", auth.getCreatedAt());
        dto.put("updatedAt", auth.getUpdatedAt());
        return dto;
    }
}


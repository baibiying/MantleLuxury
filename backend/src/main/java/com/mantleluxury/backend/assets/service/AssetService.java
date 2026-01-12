package com.mantleluxury.backend.assets.service;

import com.mantleluxury.backend.assets.api.AssetDto;
import com.mantleluxury.backend.assets.api.AssetSubmitRequest;
import com.mantleluxury.backend.assets.domain.Asset;
import com.mantleluxury.backend.assets.domain.AssetAuthentication;
import com.mantleluxury.backend.assets.domain.Custody;
import com.mantleluxury.backend.assets.domain.Insurance;
import com.mantleluxury.backend.assets.domain.YieldDistribution;
import com.mantleluxury.backend.assets.repository.AssetRepository;
import com.mantleluxury.backend.assets.repository.AssetImageRepository;
import com.mantleluxury.backend.assets.repository.YieldDistributionRepository;
import com.mantleluxury.backend.assets.domain.AssetImage;
import com.mantleluxury.backend.assets.service.AssetAuthenticationService;
import com.mantleluxury.backend.assets.service.CustodyService;
import com.mantleluxury.backend.assets.service.InsuranceService;
import com.mantleluxury.backend.blockchain.service.TokenDeploymentService;
import com.mantleluxury.backend.blockchain.service.TokenQueryService;
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
    private final AssetImageRepository assetImageRepository;
    private final TokenDeploymentService tokenDeploymentService;
    private final YieldDistributionRepository yieldDistributionRepository;
    private final AssetAuthenticationService authenticationService;
    private final CustodyService custodyService;
    private final InsuranceService insuranceService;
    private final org.springframework.core.io.ResourceLoader resourceLoader;
    private final TokenQueryService tokenQueryService;
    
    public AssetService(
            AssetRepository assetRepository,
            AssetImageRepository assetImageRepository,
            TokenDeploymentService tokenDeploymentService,
            YieldDistributionRepository yieldDistributionRepository,
            AssetAuthenticationService authenticationService,
            CustodyService custodyService,
            InsuranceService insuranceService,
            org.springframework.core.io.ResourceLoader resourceLoader,
            TokenQueryService tokenQueryService
    ) {
        this.assetRepository = assetRepository;
        this.assetImageRepository = assetImageRepository;
        this.tokenDeploymentService = tokenDeploymentService;
        this.yieldDistributionRepository = yieldDistributionRepository;
        this.authenticationService = authenticationService;
        this.custodyService = custodyService;
        this.insuranceService = insuranceService;
        this.resourceLoader = resourceLoader;
        this.tokenQueryService = tokenQueryService;
    }
    
    /**
     * 提交新资产并部署代币合约（原子操作）
     * 如果合约部署失败，不会保存资产到数据库
     */
    @Transactional(rollbackFor = Exception.class)
    public Asset submitAsset(AssetSubmitRequest request) {
        // 数据验证
        if (request.brand() == null || request.brand().trim().isEmpty()) {
            throw new IllegalArgumentException("品牌名称不能为空");
        }
        if (request.model() == null || request.model().trim().isEmpty()) {
            throw new IllegalArgumentException("型号不能为空");
        }
        if (request.totalSupply() == null || request.totalSupply().compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("总份数必须大于0");
        }
        if (request.pricePerShare() == null || request.pricePerShare().compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("每份价格必须大于0");
        }
        if (request.totalSupply().multiply(request.pricePerShare()).compareTo(new BigDecimal("10000000")) > 0) {
            throw new IllegalArgumentException("资产总价值过高，请检查总份数和每份价格");
        }
        
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
        asset.setModel3dUrl(request.model3dUrl());
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
        // 如果用户提供了 tokenSymbol，使用用户提供的；否则自动生成
        String tokenSymbol = (request.tokenSymbol() != null && !request.tokenSymbol().trim().isEmpty())
                ? request.tokenSymbol().trim().toUpperCase()
                : generateTokenSymbol(request.brand(), request.model());
        BigInteger totalSupply = request.totalSupply() != null 
                ? request.totalSupply().toBigInteger() 
                : BigInteger.ZERO;
        
        String tokenAddress;
        try {
            // 将资产提交者的地址作为合约 owner，这样投资者购买代币时资金会直接转给资产提交者
            // 注意：由于在 AssetController 中已经通过签名验证恢复了地址，request.submittedBy() 应该始终是有效的地址
            String ownerAddress = request.submittedBy();
            
            // 验证地址格式（确保是有效的 42 字符地址）
            if (ownerAddress == null || ownerAddress.trim().isEmpty()) {
                throw new IllegalArgumentException("Asset submitter address is required. This should be recovered from the signature in AssetController.");
            }
            
            ownerAddress = ownerAddress.trim().toLowerCase();
            if (!ownerAddress.startsWith("0x")) {
                ownerAddress = "0x" + ownerAddress;
            }
            if (ownerAddress.length() != 42) {
                throw new IllegalArgumentException("Invalid asset submitter address format: " + ownerAddress + ". Expected 42 characters (0x + 40 hex chars)");
            }
            
            logger.info("✅ Setting token contract owner to asset submitter address (from signature): {}", ownerAddress);
            
            tokenAddress = tokenDeploymentService.deployToken(
                    asset.getAssetIdBytes32(),
                    tokenName,
                    tokenSymbol,
                    totalSupply,
                    metadataHash,
                    request.pricePerShare(),  // 传递每份价格
                    ownerAddress  // 传递资产提交者的地址作为合约 owner（从签名恢复的地址）
            );
            
            logger.info("✅ Token contract deployed at: {}. Owner should be: {}", tokenAddress, ownerAddress);
            
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
        
        // 如果 imageUrls 中包含临时图片（格式：image:{imageId}），将它们关联到新创建的资产
        if (request.imageUrls() != null && !request.imageUrls().isEmpty()) {
            try {
                // 解析 imageUrls（可能是 JSON 数组字符串）
                String imageUrlsStr = request.imageUrls();
                if (imageUrlsStr.startsWith("[") && imageUrlsStr.endsWith("]")) {
                    // 是 JSON 数组，解析它
                    java.util.List<String> imageUrls = new java.util.ArrayList<>();
                    try {
                        com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
                        imageUrls = mapper.readValue(imageUrlsStr, java.util.List.class);
                    } catch (Exception e) {
                        logger.warn("Failed to parse imageUrls JSON: {}", imageUrlsStr, e);
                    }
                    // 关联临时图片到资产，并获取更新后的 API 路径列表
                    if (!imageUrls.isEmpty()) {
                        java.util.List<String> updatedImageUrls = associateImagesToAsset(imageUrls, asset.getId());
                        // 更新资产的 imageUrls 字段为新的 API 路径
                        if (!updatedImageUrls.isEmpty()) {
                            try {
                                com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
                                String updatedImageUrlsJson = mapper.writeValueAsString(updatedImageUrls);
                                asset.setImageUrls(updatedImageUrlsJson);
                                asset = assetRepository.save(asset);
                                logger.info("Updated asset {} imageUrls to API paths: {}", asset.getId(), updatedImageUrlsJson);
                            } catch (Exception e) {
                                logger.error("Failed to update asset imageUrls: {}", e.getMessage(), e);
                            }
                        }
                    }
                }
            } catch (Exception e) {
                logger.error("Failed to associate images to asset {}: {}", asset.getId(), e.getMessage(), e);
                // 不抛出异常，因为资产已经创建成功，图片关联失败不影响资产创建
            }
        }
        
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
     * 获取精选资产（用于首页轮播）
     * 筛选条件：
     * 1. 状态为 fundraising（募集中）
     * 2. 有已通过的认证
     * 3. 有托管和保险
     * 4. 按创建时间倒序（最新的在前）
     * 5. 限制返回数量
     */
    public List<AssetDto> getFeaturedAssets(int limit) {
        return assetRepository.findByStatus("fundraising").stream()
                .filter(asset -> {
                    // 检查是否有已通过的认证
                    if (asset.getId() == null) return false;
                    List<AssetAuthentication> auths = authenticationService.getAssetAuthentications(asset.getId());
                    boolean hasVerifiedAuth = auths.stream()
                            .anyMatch(auth -> "verified".equals(auth.getAuthenticationStatus()));
                    if (!hasVerifiedAuth) return false;
                    
                    // 检查是否有托管
                    boolean hasCustody = custodyService.getCustodyByAssetId(asset.getId()).isPresent();
                    if (!hasCustody) return false;
                    
                    // 检查是否有有效保险
                    boolean hasInsurance = insuranceService.getActiveInsuranceByAssetId(asset.getId()).isPresent();
                    return hasInsurance;
                })
                .sorted((a, b) -> {
                    // 按创建时间倒序（最新的在前）
                    if (a.getCreatedAt() == null && b.getCreatedAt() == null) return 0;
                    if (a.getCreatedAt() == null) return 1;
                    if (b.getCreatedAt() == null) return -1;
                    return b.getCreatedAt().compareTo(a.getCreatedAt());
                })
                .limit(limit)
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
     * 批量删除资产
     * @param assetIds 资产ID列表
     * @return 删除成功的数量和失败的ID列表
     */
    @Transactional
    public Map<String, Object> deleteBatch(List<String> assetIds) {
        int successCount = 0;
        List<String> failedIds = new java.util.ArrayList<>();
        
        for (String id : assetIds) {
            try {
                assetRepository.findById(id)
                        .ifPresentOrElse(
                                asset -> {
                                    assetRepository.deleteById(id);
                                    logger.info("Deleted asset: {}", id);
                                },
                                () -> { throw new RuntimeException("Asset not found: " + id); }
                        );
                successCount++;
            } catch (Exception e) {
                logger.error("Failed to delete asset {}: {}", id, e.getMessage());
                failedIds.add(id);
            }
        }
        
        Map<String, Object> result = new HashMap<>();
        result.put("successCount", successCount);
        result.put("failedIds", failedIds);
        result.put("totalRequested", assetIds.size());
        return result;
    }
    
    /**
     * 按状态批量删除资产
     * @param status 资产状态（如 "registered", "fundraising" 等）
     * @return 删除的数量
     */
    @Transactional
    public int deleteByStatus(String status) {
        List<Asset> assets = assetRepository.findByStatus(status);
        int count = assets.size();
        assetRepository.deleteAll(assets);
        logger.info("Deleted {} assets with status: {}", count, status);
        return count;
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
     * 保存上传的图片到数据库，返回图片ID（用于后续通过API访问）
     * @param file 上传的文件
     * @param assetId 资产ID（如果为null，则只保存图片，不关联资产）
     * @return 图片ID，前端通过 /api/assets/{assetId}/images/{index} 访问
     */
    public String saveImage(org.springframework.web.multipart.MultipartFile file, String assetId) throws Exception {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("File is empty or null");
        }
        
        // 读取文件内容
        byte[] imageData = file.getBytes();
        String contentType = file.getContentType();
        if (contentType == null || !contentType.startsWith("image/")) {
            contentType = "image/jpeg"; // 默认类型
        }
        
        // 确定图片索引（如果是新资产，从0开始；如果是已有资产，找到下一个索引）
        int imageIndex = 0;
        if (assetId != null && !assetId.isEmpty()) {
            long existingCount = assetImageRepository.countByAssetId(assetId);
            imageIndex = (int) existingCount;
        } else {
            // 如果 assetId 为 null（临时上传），使用 0 作为索引
            // 后续创建资产后，需要更新 assetId
            imageIndex = 0;
        }
        
        // 创建 AssetImage 实体
        AssetImage assetImage = new AssetImage();
        // 注意：如果 assetId 为 null，数据库表必须允许 asset_id 为 null
        // 如果数据库表不允许 null，需要先执行迁移脚本：database/migration-allow-null-asset-id.sql
        assetImage.setAssetId(assetId); // 允许为 null（用于临时存储）
        assetImage.setImageIndex(imageIndex);
        assetImage.setImageData(imageData);
        assetImage.setContentType(contentType);
        assetImage.setOriginalFilename(file.getOriginalFilename());
        assetImage.setFileSize(file.getSize());
        
        // 保存到数据库
        // 如果 assetId 为 null 且数据库不允许 null，这里会抛出异常
        try {
            assetImageRepository.save(assetImage);
        } catch (org.springframework.dao.DataIntegrityViolationException e) {
            if (assetId == null && e.getMessage() != null && e.getMessage().contains("asset_id")) {
                logger.error("Failed to save image with null assetId. Database table 'asset_images' may not allow null for 'asset_id' column. " +
                        "Please execute migration script: database/migration-allow-null-asset-id.sql");
                throw new IllegalStateException(
                        "Cannot save image without assetId. Database table 'asset_images' must allow null for 'asset_id' column. " +
                        "Please execute migration script: database/migration-allow-null-asset-id.sql", e);
            }
            throw e;
        }
        logger.info("Image saved to database. AssetId: {}, ImageIndex: {}, Size: {} bytes", 
                assetId, imageIndex, imageData.length);
        
        // 返回图片访问路径（格式：/api/assets/{assetId}/images/{index}）
        if (assetId != null && !assetId.isEmpty()) {
            return "/api/assets/" + assetId + "/images/" + imageIndex;
        } else {
            // 如果还没有 assetId，返回图片ID，后续需要关联资产
            // 格式：image:{imageId}，前端可以识别这是临时图片
            return "image:" + assetImage.getId();
        }
    }
    
    /**
     * 将临时图片（assetId 为 null）关联到资产
     * @param imageIds 图片ID列表（格式：image:{imageId} 或直接是 imageId）
     * @param assetId 资产ID
     * @return 更新后的图片URL列表（API路径格式）
     */
    @Transactional
    public List<String> associateImagesToAsset(List<String> imageIds, String assetId) {
        if (imageIds == null || imageIds.isEmpty() || assetId == null || assetId.isEmpty()) {
            return new java.util.ArrayList<>();
        }
        
        int imageIndex = 0;
        // 先统计该资产已有的图片数量，从该数量开始索引
        long existingCount = assetImageRepository.countByAssetId(assetId);
        imageIndex = (int) existingCount;
        
        List<String> updatedImageUrls = new java.util.ArrayList<>();
        
        for (String imageIdOrUrl : imageIds) {
            try {
                // 处理格式：image:{imageId} 或直接是 imageId
                String imageId = imageIdOrUrl;
                if (imageIdOrUrl.startsWith("image:")) {
                    imageId = imageIdOrUrl.substring(6); // 去掉 "image:" 前缀
                }
                
                // 查找图片
                AssetImage image = assetImageRepository.findById(imageId).orElse(null);
                if (image != null && (image.getAssetId() == null || image.getAssetId().isEmpty())) {
                    // 更新 assetId 和 imageIndex
                    image.setAssetId(assetId);
                    image.setImageIndex(imageIndex);
                    assetImageRepository.save(image);
                    logger.info("Associated image {} to asset {} with index {}", imageId, assetId, imageIndex);
                    
                    // 生成新的 API 路径并添加到列表
                    updatedImageUrls.add("/api/assets/" + assetId + "/images/" + imageIndex);
                    imageIndex++;
                } else if (image != null && assetId.equals(image.getAssetId())) {
                    // 图片已经关联到这个资产，直接使用现有路径
                    updatedImageUrls.add("/api/assets/" + assetId + "/images/" + image.getImageIndex());
                }
            } catch (Exception e) {
                logger.error("Failed to associate image {} to asset {}: {}", imageIdOrUrl, assetId, e.getMessage());
            }
        }
        
        return updatedImageUrls;
    }
    
    /**
     * 保存上传的图片到数据库（兼容旧接口，不关联资产）
     * @deprecated 使用 saveImage(file, assetId) 替代
     */
    @Deprecated
    public String saveImage(org.springframework.web.multipart.MultipartFile file) throws Exception {
        return saveImage(file, null);
    }
    
    /**
     * 转换为 DTO
     */
    private AssetDto toDto(Asset asset) {
        // 计算剩余可购份数：优先从链上读取，失败则使用数据库中的总供应量
        BigDecimal remainingSupply;
        if (asset.getTokenAddress() != null && !asset.getTokenAddress().isEmpty()) {
            try {
                BigInteger availableTokens = tokenQueryService.getAvailableTokens(asset.getTokenAddress());
                if (availableTokens != null) {
                    remainingSupply = tokenQueryService.weiToTokens(availableTokens);
                    logger.debug("Read remaining supply from chain for asset {}: {}", asset.getId(), remainingSupply);
                } else {
                    // 链上读取失败，使用数据库中的总供应量作为后备
                    remainingSupply = asset.getTotalSupply() != null ? asset.getTotalSupply() : BigDecimal.ZERO;
                    logger.debug("Failed to read from chain, using database value for asset {}: {}", asset.getId(), remainingSupply);
                }
            } catch (Exception e) {
                logger.warn("Error reading available tokens from chain for asset {}: {}", asset.getId(), e.getMessage());
                remainingSupply = asset.getTotalSupply() != null ? asset.getTotalSupply() : BigDecimal.ZERO;
            }
        } else {
            // 没有合约地址，使用数据库中的总供应量
            remainingSupply = asset.getTotalSupply() != null ? asset.getTotalSupply() : BigDecimal.ZERO;
        }
        
        // 计算累计收益（统计所有收益记录，包括未完成的）
        BigDecimal totalYield = BigDecimal.ZERO;
        BigDecimal rentalYield = BigDecimal.ZERO;
        BigDecimal appreciationYield = BigDecimal.ZERO;
        if (asset.getId() != null) {
            List<YieldDistribution> yields = yieldDistributionRepository.findByAssetId(asset.getId());
            for (YieldDistribution dist : yields) {
                BigDecimal amount = dist.getIsCompleted() 
                    ? (dist.getDistributedAmount() != null ? dist.getDistributedAmount() : BigDecimal.ZERO)
                    : (dist.getTotalAmount() != null ? dist.getTotalAmount() : BigDecimal.ZERO);
                totalYield = totalYield.add(amount);
                if ("rental".equals(dist.getYieldType())) {
                    rentalYield = rentalYield.add(amount);
                } else if ("appreciation".equals(dist.getYieldType())) {
                    appreciationYield = appreciationYield.add(amount);
                }
            }
        }
        
        // 获取认证信息
        List<Map<String, Object>> authentications = List.of();
        if (asset.getId() != null) {
            List<AssetAuthentication> authList = authenticationService.getAssetAuthentications(asset.getId());
            authentications = authList.stream()
                    .map(this::authenticationToDto)
                    .collect(Collectors.toList());
        }
        
        // 获取托管信息
        Map<String, Object> custody = null;
        if (asset.getId() != null) {
            custody = custodyService.getCustodyByAssetId(asset.getId())
                    .map(this::custodyToDto)
                    .orElse(null);
        }
        
        // 获取保险信息
        Map<String, Object> insurance = null;
        if (asset.getId() != null) {
            insurance = insuranceService.getActiveInsuranceByAssetId(asset.getId())
                    .map(this::insuranceToDto)
                    .orElse(null);
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
                asset.getModel3dUrl(),    // 3D模型URL
                totalYield,                // 累计收益
                rentalYield,               // 租赁收益
                appreciationYield,         // 升值收益
                authentications,           // 认证信息
                custody,                   // 托管信息
                insurance,                 // 保险信息
                asset.getSubmittedBy()     // 提交者钱包地址
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
    
    /**
     * 将托管实体转换为 DTO
     */
    private Map<String, Object> custodyToDto(Custody custody) {
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
    
    /**
     * 将保险实体转换为 DTO
     */
    private Map<String, Object> insuranceToDto(Insurance insurance) {
        Map<String, Object> dto = new HashMap<>();
        dto.put("id", insurance.getId());
        dto.put("assetId", insurance.getAssetId());
        dto.put("insuranceCompany", insurance.getInsuranceCompany());
        dto.put("policyNumber", insurance.getPolicyNumber());
        dto.put("coverageAmount", insurance.getCoverageAmount());
        dto.put("coverageCurrency", insurance.getCoverageCurrency());
        dto.put("policyStartDate", insurance.getPolicyStartDate());
        dto.put("policyEndDate", insurance.getPolicyEndDate());
        dto.put("premiumAmount", insurance.getPremiumAmount());
        dto.put("coverageType", insurance.getCoverageType());
        dto.put("policyDocumentUrl", insurance.getPolicyDocumentUrl());
        dto.put("policyDocumentHash", insurance.getPolicyDocumentHash());
        dto.put("isActive", insurance.getIsActive());
        dto.put("notes", insurance.getNotes());
        dto.put("createdAt", insurance.getCreatedAt());
        dto.put("updatedAt", insurance.getUpdatedAt());
        return dto;
    }
}


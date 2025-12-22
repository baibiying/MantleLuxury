// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * CustodyManager：托管与保险管理合约
 * - 记录实物资产的托管状态和保险信息
 * - 管理资产状态流转（Registered → InCustody → ForSale → Sold → Withdrawn）
 * - 仅存储信息哈希，详细内容存储在链下
 * - 关键操作需要特定角色授权
 */
contract CustodyManager is AccessControl {
    // 角色定义
    bytes32 public constant CUSTODY_ROLE = keccak256("CUSTODY_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    
    // 资产状态枚举
    enum AssetStatus {
        Registered,  // 已注册（待托管）
        InCustody,   // 托管中
        ForSale,     // 待出售
        Sold,        // 已出售
        Withdrawn    // 已撤回
    }
    
    // 资产信息结构
    struct AssetInfo {
        bytes32 assetId;
        AssetStatus status;
        bytes32 custodyInfoHash;   // 托管机构、位置等信息的哈希
        bytes32 insuranceInfoHash; // 保险信息的哈希
        address tokenAddress;       // 关联的 LuxuryToken 地址
        uint256 registeredAt;       // 注册时间戳
        uint256 updatedAt;          // 最后更新时间戳
    }
    
    // 资产ID到资产信息的映射
    mapping(bytes32 => AssetInfo) private assets;
    
    // 事件定义
    event AssetRegistered(
        bytes32 indexed assetId,
        address indexed tokenAddress,
        bytes32 custodyHash,
        bytes32 insuranceHash
    );
    
    event StatusUpdated(
        bytes32 indexed assetId,
        AssetStatus indexed oldStatus,
        AssetStatus indexed newStatus,
        uint256 timestamp
    );
    
    event CustodyInfoUpdated(
        bytes32 indexed assetId,
        bytes32 indexed oldHash,
        bytes32 indexed newHash
    );
    
    event InsuranceInfoUpdated(
        bytes32 indexed assetId,
        bytes32 indexed oldHash,
        bytes32 indexed newHash
    );
    
    constructor(address defaultAdmin) {
        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(CUSTODY_ROLE, defaultAdmin);
        _grantRole(OPERATOR_ROLE, defaultAdmin);
    }
    
    /**
     * 注册资产
     * @param assetId 资产ID（bytes32）
     * @param tokenAddress 关联的 LuxuryToken 合约地址
     * @param custodyInfoHash 托管信息哈希
     * @param insuranceInfoHash 保险信息哈希
     */
    function registerAsset(
        bytes32 assetId,
        address tokenAddress,
        bytes32 custodyInfoHash,
        bytes32 insuranceInfoHash
    ) external onlyRole(CUSTODY_ROLE) {
        require(assetId != bytes32(0), "Invalid asset ID");
        require(tokenAddress != address(0), "Invalid token address");
        require(assets[assetId].assetId == bytes32(0), "Asset already registered");
        
        assets[assetId] = AssetInfo({
            assetId: assetId,
            status: AssetStatus.Registered,
            custodyInfoHash: custodyInfoHash,
            insuranceInfoHash: insuranceInfoHash,
            tokenAddress: tokenAddress,
            registeredAt: block.timestamp,
            updatedAt: block.timestamp
        });
        
        emit AssetRegistered(assetId, tokenAddress, custodyInfoHash, insuranceInfoHash);
    }
    
    /**
     * 更新资产状态
     * @param assetId 资产ID
     * @param newStatus 新状态
     */
    function updateStatus(bytes32 assetId, AssetStatus newStatus) external onlyRole(OPERATOR_ROLE) {
        AssetInfo storage asset = assets[assetId];
        require(asset.assetId != bytes32(0), "Asset not registered");
        
        AssetStatus oldStatus = asset.status;
        require(oldStatus != newStatus, "Status unchanged");
        
        // 状态流转验证（可根据业务需求调整）
        require(
            _isValidStatusTransition(oldStatus, newStatus),
            "Invalid status transition"
        );
        
        asset.status = newStatus;
        asset.updatedAt = block.timestamp;
        
        emit StatusUpdated(assetId, oldStatus, newStatus, block.timestamp);
    }
    
    /**
     * 更新托管信息
     * @param assetId 资产ID
     * @param newHash 新的托管信息哈希
     */
    function updateCustodyInfo(bytes32 assetId, bytes32 newHash) external onlyRole(CUSTODY_ROLE) {
        AssetInfo storage asset = assets[assetId];
        require(asset.assetId != bytes32(0), "Asset not registered");
        
        bytes32 oldHash = asset.custodyInfoHash;
        asset.custodyInfoHash = newHash;
        asset.updatedAt = block.timestamp;
        
        emit CustodyInfoUpdated(assetId, oldHash, newHash);
    }
    
    /**
     * 更新保险信息
     * @param assetId 资产ID
     * @param newHash 新的保险信息哈希
     */
    function updateInsuranceInfo(bytes32 assetId, bytes32 newHash) external onlyRole(CUSTODY_ROLE) {
        AssetInfo storage asset = assets[assetId];
        require(asset.assetId != bytes32(0), "Asset not registered");
        
        bytes32 oldHash = asset.insuranceInfoHash;
        asset.insuranceInfoHash = newHash;
        asset.updatedAt = block.timestamp;
        
        emit InsuranceInfoUpdated(assetId, oldHash, newHash);
    }
    
    /**
     * 获取资产信息
     * @param assetId 资产ID
     * @return AssetInfo 资产信息结构
     */
    function getAssetInfo(bytes32 assetId) external view returns (AssetInfo memory) {
        return assets[assetId];
    }
    
    /**
     * 获取资产状态
     * @param assetId 资产ID
     * @return AssetStatus 资产状态
     */
    function getAssetStatus(bytes32 assetId) external view returns (AssetStatus) {
        return assets[assetId].status;
    }
    
    /**
     * 检查资产是否已注册
     * @param assetId 资产ID
     * @return bool 是否已注册
     */
    function isAssetRegistered(bytes32 assetId) external view returns (bool) {
        return assets[assetId].assetId != bytes32(0);
    }
    
    /**
     * 验证状态流转是否有效
     * @param oldStatus 旧状态
     * @param newStatus 新状态
     * @return bool 是否有效
     */
    function _isValidStatusTransition(
        AssetStatus oldStatus,
        AssetStatus newStatus
    ) private pure returns (bool) {
        // 定义允许的状态流转
        // Registered → InCustody → ForSale → Sold
        // 任何状态 → Withdrawn（撤回）
        // Sold 和 Withdrawn 是终态，不能再转换
        
        if (oldStatus == AssetStatus.Sold || oldStatus == AssetStatus.Withdrawn) {
            return false; // 终态不能再转换
        }
        
        if (newStatus == AssetStatus.Withdrawn) {
            return true; // 任何非终态都可以撤回
        }
        
        // 正常流转路径
        if (oldStatus == AssetStatus.Registered && newStatus == AssetStatus.InCustody) {
            return true;
        }
        if (oldStatus == AssetStatus.InCustody && newStatus == AssetStatus.ForSale) {
            return true;
        }
        if (oldStatus == AssetStatus.ForSale && newStatus == AssetStatus.Sold) {
            return true;
        }
        
        // 允许回退（例如从 ForSale 回到 InCustody）
        if (oldStatus == AssetStatus.ForSale && newStatus == AssetStatus.InCustody) {
            return true;
        }
        
        return false;
    }
    
    /**
     * 批量更新状态（仅管理员，用于紧急情况）
     */
    function batchUpdateStatus(
        bytes32[] calldata assetIds,
        AssetStatus[] calldata newStatuses
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(assetIds.length == newStatuses.length, "Arrays length mismatch");
        
        for (uint256 i = 0; i < assetIds.length; i++) {
            AssetInfo storage asset = assets[assetIds[i]];
            if (asset.assetId != bytes32(0)) {
                AssetStatus oldStatus = asset.status;
                if (_isValidStatusTransition(oldStatus, newStatuses[i])) {
                    asset.status = newStatuses[i];
                    asset.updatedAt = block.timestamp;
                    emit StatusUpdated(assetIds[i], oldStatus, newStatuses[i], block.timestamp);
                }
            }
        }
    }
}


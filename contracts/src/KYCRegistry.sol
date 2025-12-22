// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * KYCRegistry：KYC 状态注册表
 * - 维护地址与 KYC 状态的映射
 * - 供其他合约（如 LuxuryToken）检查用户 KYC 状态
 * - 仅合规角色（COMPLIANCE_ROLE）可更新 KYC 状态
 */
contract KYCRegistry is AccessControl {
    // 角色定义
    bytes32 public constant COMPLIANCE_ROLE = keccak256("COMPLIANCE_ROLE");
    
    // KYC 状态枚举
    enum Status {
        None,       // 未提交
        Pending,    // 审核中
        Approved,   // 已通过
        Rejected,   // 已拒绝
        Blacklisted // 黑名单
    }
    
    // 地址到 KYC 状态的映射
    mapping(address => Status) private kycStatus;
    
    // 事件
    event KYCStatusUpdated(
        address indexed user,
        Status indexed oldStatus,
        Status indexed newStatus
    );
    
    event BatchKYCStatusUpdated(
        address[] users,
        Status[] statuses
    );
    
    constructor(address defaultAdmin) {
        // 设置默认管理员
        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        // 默认管理员也拥有合规角色
        _grantRole(COMPLIANCE_ROLE, defaultAdmin);
    }
    
    /**
     * 设置单个用户的 KYC 状态（仅合规角色）
     * @param user 用户地址
     * @param status 新的 KYC 状态
     */
    function setKYCStatus(address user, Status status) external onlyRole(COMPLIANCE_ROLE) {
        require(user != address(0), "Invalid user address");
        
        Status oldStatus = kycStatus[user];
        kycStatus[user] = status;
        
        emit KYCStatusUpdated(user, oldStatus, status);
    }
    
    /**
     * 批量设置 KYC 状态（仅合规角色，降低 Gas 成本）
     * @param users 用户地址数组
     * @param statuses 对应的状态数组
     */
    function batchSetKYCStatus(
        address[] calldata users,
        Status[] calldata statuses
    ) external onlyRole(COMPLIANCE_ROLE) {
        require(users.length == statuses.length, "Arrays length mismatch");
        require(users.length > 0, "Empty arrays");
        
        for (uint256 i = 0; i < users.length; i++) {
            require(users[i] != address(0), "Invalid user address");
            Status oldStatus = kycStatus[users[i]];
            kycStatus[users[i]] = statuses[i];
            emit KYCStatusUpdated(users[i], oldStatus, statuses[i]);
        }
        
        emit BatchKYCStatusUpdated(users, statuses);
    }
    
    /**
     * 获取用户的 KYC 状态
     * @param user 用户地址
     * @return 用户的 KYC 状态
     */
    function getKYCStatus(address user) external view returns (Status) {
        return kycStatus[user];
    }
    
    /**
     * 检查用户是否已通过 KYC（供其他合约调用）
     * @param user 用户地址
     * @return 如果用户状态为 Approved，返回 true
     */
    function isKYCApproved(address user) external view returns (bool) {
        return kycStatus[user] == Status.Approved;
    }
    
    /**
     * 检查用户是否在黑名单中
     * @param user 用户地址
     * @return 如果用户状态为 Blacklisted，返回 true
     */
    function isBlacklisted(address user) external view returns (bool) {
        return kycStatus[user] == Status.Blacklisted;
    }
    
    /**
     * 授予合规角色（仅管理员）
     * @param account 要授予角色的地址
     */
    function grantComplianceRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(COMPLIANCE_ROLE, account);
    }
    
    /**
     * 撤销合规角色（仅管理员）
     * @param account 要撤销角色的地址
     */
    function revokeComplianceRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(COMPLIANCE_ROLE, account);
    }
}


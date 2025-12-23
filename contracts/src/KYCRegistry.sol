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
    
    constructor(address defaultAdmin) {
        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(COMPLIANCE_ROLE, defaultAdmin); // 部署者默认拥有合规角色
    }
    
    /**
     * 设置用户的 KYC 状态（仅 COMPLIANCE_ROLE）
     * @param user 用户地址
     * @param status 新状态
     */
    function setKYCStatus(address user, Status status) external onlyRole(COMPLIANCE_ROLE) {
        require(user != address(0), "Invalid user address");
        Status oldStatus = kycStatus[user];
        kycStatus[user] = status;
        emit KYCStatusUpdated(user, oldStatus, status);
    }
    
    /**
     * 获取用户的 KYC 状态
     * @param user 用户地址
     * @return 当前状态
     */
    function getKYCStatus(address user) external view returns (Status) {
        return kycStatus[user];
    }
    
    /**
     * 检查用户是否通过 KYC
     * @param user 用户地址
     * @return 是否通过
     */
    function isKYCApproved(address user) external view returns (bool) {
        return kycStatus[user] == Status.Approved;
    }
    
    /**
     * 批量设置 KYC 状态（仅 COMPLIANCE_ROLE）
     * @param users 用户地址数组
     * @param statuses 状态数组
     */
    function batchSetKYCStatus(
        address[] calldata users,
        Status[] calldata statuses
    ) external onlyRole(COMPLIANCE_ROLE) {
        require(users.length == statuses.length, "Arrays length mismatch");
        for (uint256 i = 0; i < users.length; i++) {
            address user = users[i];
            require(user != address(0), "Invalid user address");
            Status oldStatus = kycStatus[user];
            kycStatus[user] = statuses[i];
            emit KYCStatusUpdated(user, oldStatus, statuses[i]);
        }
    }
}


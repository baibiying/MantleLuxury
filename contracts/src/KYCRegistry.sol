// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * KYCRegistry 合约
 * 维护地址与 KYC 状态的映射，供其他合约检查权限
 * 
 * 状态枚举：
 * - None (0): 未提交
 * - Pending (1): 审核中
 * - Approved (2): 已通过
 * - Rejected (3): 已拒绝
 * - Blacklisted (4): 已加入黑名单
 */
contract KYCRegistry is AccessControl {
    // 角色定义
    bytes32 public constant COMPLIANCE_ROLE = keccak256("COMPLIANCE_ROLE");
    
    // KYC 状态枚举
    enum Status {
        None,       // 0
        Pending,    // 1
        Approved,   // 2
        Rejected,   // 3
        Blacklisted // 4
    }
    
    // 地址到状态的映射
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
    
    /**
     * 构造函数
     * @param defaultAdmin 默认管理员地址（拥有 DEFAULT_ADMIN_ROLE）
     */
    constructor(address defaultAdmin) {
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
     * 批量设置用户的 KYC 状态（仅合规角色）
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
     * 检查用户是否已通过 KYC
     * @param user 用户地址
     * @return true 如果用户状态为 Approved
     */
    function isKYCApproved(address user) external view returns (bool) {
        return kycStatus[user] == Status.Approved;
    }
    
    /**
     * 检查用户是否在黑名单中
     * @param user 用户地址
     * @return true 如果用户状态为 Blacklisted
     */
    function isBlacklisted(address user) external view returns (bool) {
        return kycStatus[user] == Status.Blacklisted;
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./LuxuryToken.sol";

/**
 * YieldDistribution：收益分配合约
 * - 支持按持币比例分配升值收益（Appreciation）
 * - 支持租赁收益（Rental，后续版本）
 * - MVP 采用直接循环分发方式（适合持有人 < 100）
 */
contract YieldDistribution is Ownable {
    enum YieldType { Appreciation, Rental }
    
    struct Distribution {
        bytes32 distributionId;
        address tokenAddress;  // LuxuryToken 地址
        YieldType yieldType;
        uint256 totalAmount;    // 总收益金额（wei）
        uint256 distributedAmount;  // 已分配金额
        bool isCompleted;
        uint256 createdAt;
    }
    
    // 分配记录映射
    mapping(bytes32 => Distribution) public distributions;
    
    // 用户已领取的分配记录（distributionId => user => claimed）
    mapping(bytes32 => mapping(address => bool)) public claimed;
    
    // 是否暂停分配（紧急情况）
    bool public paused;
    
    event DistributionCreated(
        bytes32 indexed distributionId,
        address indexed tokenAddress,
        YieldType indexed yieldType,
        uint256 totalAmount
    );
    
    event DistributionCompleted(
        bytes32 indexed distributionId,
        uint256 totalDistributed
    );
    
    event Claimed(
        bytes32 indexed distributionId,
        address indexed user,
        uint256 amount
    );
    
    event Paused(address account);
    event Unpaused(address account);
    
    constructor(address owner_) Ownable(owner_) {
        paused = false;
    }
    
    /**
     * 创建收益分配记录（仅 owner）
     * @param distributionId 分配 ID（链下生成，确保唯一）
     * @param tokenAddress LuxuryToken 合约地址
     * @param yieldType 收益类型（Appreciation 或 Rental）
     * @param totalAmount 总收益金额（wei）
     */
    function createDistribution(
        bytes32 distributionId,
        address tokenAddress,
        YieldType yieldType,
        uint256 totalAmount
    ) external onlyOwner {
        require(!paused, "Distribution is paused");
        require(tokenAddress != address(0), "Invalid token address");
        require(totalAmount > 0, "Total amount must be greater than 0");
        require(distributions[distributionId].distributionId == bytes32(0), "Distribution already exists");
        
        distributions[distributionId] = Distribution({
            distributionId: distributionId,
            tokenAddress: tokenAddress,
            yieldType: yieldType,
            totalAmount: totalAmount,
            distributedAmount: 0,
            isCompleted: false,
            createdAt: block.timestamp
        });
        
        emit DistributionCreated(distributionId, tokenAddress, yieldType, totalAmount);
    }
    
    /**
     * 执行收益分配（直接循环分发，适合持有人较少的情况）
     * 合约需要先接收 MNT，然后按持币比例分配给所有持有人
     * @param distributionId 分配 ID
     * @param holders 持有人地址列表（链下计算，避免 gas 过高）
     */
    function distribute(
        bytes32 distributionId,
        address[] calldata holders
    ) external onlyOwner {
        require(!paused, "Distribution is paused");
        Distribution storage dist = distributions[distributionId];
        require(dist.distributionId != bytes32(0), "Distribution does not exist");
        require(!dist.isCompleted, "Distribution already completed");
        require(address(this).balance >= dist.totalAmount, "Insufficient balance");
        
        LuxuryToken token = LuxuryToken(payable(dist.tokenAddress));
        uint256 totalSupply = token.totalSupply();
        require(totalSupply > 0, "Total supply is zero");
        
        uint256 totalDistributed = 0;
        
        // 遍历所有持有人，按比例分配
        for (uint256 i = 0; i < holders.length; i++) {
            address holder = holders[i];
            uint256 balance = token.balanceOf(holder);
            
            if (balance > 0 && !claimed[distributionId][holder]) {
                // 计算该持有人应得的收益
                uint256 share = (dist.totalAmount * balance) / totalSupply;
                
                if (share > 0) {
                    // 转账给持有人
                    payable(holder).transfer(share);
                    totalDistributed += share;
                    claimed[distributionId][holder] = true;
                    
                    emit Claimed(distributionId, holder, share);
                }
            }
        }
        
        dist.distributedAmount = totalDistributed;
        
        // 如果已分配完所有收益，标记为完成
        if (totalDistributed >= dist.totalAmount) {
            dist.isCompleted = true;
            emit DistributionCompleted(distributionId, totalDistributed);
        }
    }
    
    /**
     * 用户主动领取收益（备用方案，如果 distribute 失败）
     * @param distributionId 分配 ID
     */
    function claim(bytes32 distributionId) external {
        require(!paused, "Distribution is paused");
        Distribution storage dist = distributions[distributionId];
        require(dist.distributionId != bytes32(0), "Distribution does not exist");
        require(!dist.isCompleted, "Distribution already completed");
        require(!claimed[distributionId][msg.sender], "Already claimed");
        require(address(this).balance > 0, "Insufficient balance");
        
        LuxuryToken token = LuxuryToken(payable(dist.tokenAddress));
        uint256 balance = token.balanceOf(msg.sender);
        require(balance > 0, "No tokens held");
        
        uint256 totalSupply = token.totalSupply();
        require(totalSupply > 0, "Total supply is zero");
        
        // 计算应得收益
        uint256 share = (dist.totalAmount * balance) / totalSupply;
        require(share > 0, "No share to claim");
        require(address(this).balance >= share, "Insufficient contract balance");
        
        // 转账给用户
        payable(msg.sender).transfer(share);
        dist.distributedAmount += share;
        claimed[distributionId][msg.sender] = true;
        
        emit Claimed(distributionId, msg.sender, share);
        
        // 检查是否所有收益都已分配
        if (dist.distributedAmount >= dist.totalAmount) {
            dist.isCompleted = true;
            emit DistributionCompleted(distributionId, dist.distributedAmount);
        }
    }
    
    /**
     * 获取分配信息
     */
    function getDistribution(bytes32 distributionId) external view returns (Distribution memory) {
        return distributions[distributionId];
    }
    
    /**
     * 检查用户是否已领取
     */
    function hasClaimed(bytes32 distributionId, address user) external view returns (bool) {
        return claimed[distributionId][user];
    }
    
    /**
     * 计算用户应得的收益（不实际分配）
     */
    function calculateShare(bytes32 distributionId, address user) external view returns (uint256) {
        Distribution storage dist = distributions[distributionId];
        if (dist.distributionId == bytes32(0) || dist.isCompleted || claimed[distributionId][user]) {
            return 0;
        }
        
        LuxuryToken token = LuxuryToken(payable(dist.tokenAddress));
        uint256 balance = token.balanceOf(user);
        if (balance == 0) {
            return 0;
        }
        
        uint256 totalSupply = token.totalSupply();
        if (totalSupply == 0) {
            return 0;
        }
        
        return (dist.totalAmount * balance) / totalSupply;
    }
    
    /**
     * 暂停分配（紧急情况）
     */
    function pause() external onlyOwner {
        require(!paused, "Already paused");
        paused = true;
        emit Paused(msg.sender);
    }
    
    /**
     * 恢复分配
     */
    function unpause() external onlyOwner {
        require(paused, "Not paused");
        paused = false;
        emit Unpaused(msg.sender);
    }
    
    /**
     * 接收 MNT（用于收益分配）
     */
    receive() external payable {
        // 允许合约接收 MNT
    }
    
    /**
     * 提取合约中的 MNT（仅 owner，紧急情况）
     */
    function withdraw(uint256 amount) external onlyOwner {
        require(amount <= address(this).balance, "Insufficient balance");
        payable(owner()).transfer(amount);
    }
}


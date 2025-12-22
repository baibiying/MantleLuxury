// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./KYCRegistry.sol";

/**
 * LuxuryToken：
 * - 代表单个实物奢侈品资产的份额
 * - 支持投资者购买代币份额
 * - 集成 KYCRegistry，仅通过 KYC 的用户可以购买和持有代币
 */
contract LuxuryToken is ERC20, Ownable {
    bytes32 public assetId;
    bytes32 public metadataHash;
    
    // 每份代币的价格（以 wei 为单位，即 MNT 的最小单位）
    uint256 public pricePerToken;
    
    // 是否允许购买（owner 可以控制销售状态）
    bool public salesEnabled;
    
    // KYCRegistry 合约地址
    KYCRegistry public kycRegistry;
    
    // 是否启用 KYC 检查（owner 可以控制）
    bool public kycCheckEnabled;

    event TokensPurchased(address indexed buyer, uint256 amount, uint256 totalCost);
    event PriceUpdated(uint256 newPrice);
    event SalesToggled(bool enabled);
    event KYCRegistryUpdated(address indexed oldRegistry, address indexed newRegistry);
    event KYCCheckToggled(bool enabled);

    constructor(
        string memory name_,
        string memory symbol_,
        bytes32 assetId_,
        bytes32 metadataHash_,
        uint256 initialSupply_,
        uint256 pricePerToken_,  // 每份代币的价格（wei）
        address owner_,
        address kycRegistry_  // KYCRegistry 合约地址
    ) ERC20(name_, symbol_) Ownable(owner_) {
        assetId = assetId_;
        metadataHash = metadataHash_;
        pricePerToken = pricePerToken_;
        salesEnabled = true;  // 默认启用销售
        kycRegistry = KYCRegistry(kycRegistry_);
        kycCheckEnabled = true;  // 默认启用 KYC 检查
        _mint(owner_, initialSupply_);
    }

    /**
     * 购买代币
     * @param amount 要购买的代币数量（以最小单位计算，例如：1 份 = 10^18）
     */
    function buyTokens(uint256 amount) external payable {
        require(salesEnabled, "Sales are currently disabled");
        require(amount > 0, "Amount must be greater than 0");
        require(balanceOf(owner()) >= amount, "Insufficient tokens available");
        
        // KYC 检查：购买者必须通过 KYC
        if (kycCheckEnabled) {
            require(kycRegistry.isKYCApproved(msg.sender), "KYC verification required");
        }
        
        uint256 totalCost = amount * pricePerToken;
        require(msg.value >= totalCost, "Insufficient payment");
        
        // 从 owner 转移代币给购买者（会触发 _beforeTokenTransfer，再次检查 KYC）
        _transfer(owner(), msg.sender, amount);
        
        // 将多余的 MNT 退回给购买者
        if (msg.value > totalCost) {
            payable(msg.sender).transfer(msg.value - totalCost);
        }
        
        // 将收到的 MNT 转给 owner（用于后续分配收益等）
        payable(owner()).transfer(totalCost);
        
        emit TokensPurchased(msg.sender, amount, totalCost);
    }

    /**
     * 设置每份代币的价格（仅 owner）
     */
    function setPricePerToken(uint256 newPrice) external onlyOwner {
        require(newPrice > 0, "Price must be greater than 0");
        pricePerToken = newPrice;
        emit PriceUpdated(newPrice);
    }

    /**
     * 启用/禁用销售（仅 owner）
     */
    function setSalesEnabled(bool enabled) external onlyOwner {
        salesEnabled = enabled;
        emit SalesToggled(enabled);
    }

    /**
     * 获取可购买的代币数量
     */
    function getAvailableTokens() external view returns (uint256) {
        return balanceOf(owner());
    }

    /**
     * 计算购买指定数量代币所需的 MNT
     */
    function getCostForTokens(uint256 amount) external view returns (uint256) {
        return amount * pricePerToken;
    }

    function setMetadataHash(bytes32 newHash) external onlyOwner {
        metadataHash = newHash;
    }
    
    /**
     * 设置 KYCRegistry 合约地址（仅 owner）
     */
    function setKYCRegistry(address kycRegistry_) external onlyOwner {
        require(kycRegistry_ != address(0), "Invalid KYC registry address");
        address oldRegistry = address(kycRegistry);
        kycRegistry = KYCRegistry(kycRegistry_);
        emit KYCRegistryUpdated(oldRegistry, kycRegistry_);
    }
    
    /**
     * 启用/禁用 KYC 检查（仅 owner）
     */
    function setKYCCheckEnabled(bool enabled) external onlyOwner {
        kycCheckEnabled = enabled;
        emit KYCCheckToggled(enabled);
    }
    
    /**
     * 重写 _update，在转账前检查 KYC
     * 注意：owner 转账不受限制（用于初始分配和收益分配）
     * OpenZeppelin v5.0 使用 _update 替代了 _beforeTokenTransfer
     */
    function _update(
        address from,
        address to,
        uint256 value
    ) internal virtual override {
        // 如果启用 KYC 检查，且不是 owner 的转账，则检查接收方 KYC
        if (kycCheckEnabled && from != owner()) {
            // 接收方必须通过 KYC（除非是 owner 或零地址）
            if (to != owner() && to != address(0)) {
                require(kycRegistry.isKYCApproved(to), "Recipient must be KYC approved");
            }
        }
        
        // 调用父类的 _update 执行实际的转账
        super._update(from, to, value);
    }
}



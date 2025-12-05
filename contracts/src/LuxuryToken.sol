// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * LuxuryToken：
 * - 代表单个实物奢侈品资产的份额
 * - 支持投资者购买代币份额
 * - 暂时只实现基础 ERC20 + 购买功能，后续再接入 KYCRegistry 等限制逻辑
 */
contract LuxuryToken is ERC20, Ownable {
    bytes32 public assetId;
    bytes32 public metadataHash;
    
    // 每份代币的价格（以 wei 为单位，即 MNT 的最小单位）
    uint256 public pricePerToken;
    
    // 是否允许购买（owner 可以控制销售状态）
    bool public salesEnabled;

    event TokensPurchased(address indexed buyer, uint256 amount, uint256 totalCost);
    event PriceUpdated(uint256 newPrice);
    event SalesToggled(bool enabled);

    constructor(
        string memory name_,
        string memory symbol_,
        bytes32 assetId_,
        bytes32 metadataHash_,
        uint256 initialSupply_,
        uint256 pricePerToken_,  // 每份代币的价格（wei）
        address owner_
    ) ERC20(name_, symbol_) Ownable(owner_) {
        assetId = assetId_;
        metadataHash = metadataHash_;
        pricePerToken = pricePerToken_;
        salesEnabled = true;  // 默认启用销售
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
        
        uint256 totalCost = amount * pricePerToken;
        require(msg.value >= totalCost, "Insufficient payment");
        
        // 从 owner 转移代币给购买者
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
}



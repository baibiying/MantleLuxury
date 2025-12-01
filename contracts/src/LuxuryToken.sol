// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * 最小版 LuxuryToken：
 * - 代表单个实物奢侈品资产的份额
 * - 暂时只实现基础 ERC20 + 管理员铸币，后续再接入 KYCRegistry 等限制逻辑
 */
contract LuxuryToken is ERC20, Ownable {
    bytes32 public assetId;
    bytes32 public metadataHash;

    constructor(
        string memory name_,
        string memory symbol_,
        bytes32 assetId_,
        bytes32 metadataHash_,
        uint256 initialSupply_,
        address owner_
    ) ERC20(name_, symbol_) Ownable(owner_) {
        assetId = assetId_;
        metadataHash = metadataHash_;
        _mint(owner_, initialSupply_);
    }

    function setMetadataHash(bytes32 newHash) external onlyOwner {
        metadataHash = newHash;
    }
}



package com.mantleluxury.backend.blockchain.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.web3j.crypto.Credentials;
import org.web3j.protocol.Web3j;

import java.math.BigInteger;

/**
 * 代币部署服务（代理到 MantleTokenDeploymentService）
 */
@Service
public class TokenDeploymentService {

    private static final Logger logger = LoggerFactory.getLogger(TokenDeploymentService.class);

    private final MantleTokenDeploymentService mantleDeploymentService;

    public TokenDeploymentService(MantleTokenDeploymentService mantleDeploymentService) {
        this.mantleDeploymentService = mantleDeploymentService;
    }

    /**
     * 部署 LuxuryToken 合约
     * 
     * @param assetId 资产 ID (bytes32)
     * @param name 代币名称
     * @param symbol 代币符号
     * @param totalSupply 总供应量
     * @param metadataHash 元数据哈希 (bytes32)
     * @return 合约地址
     */
    public String deployToken(
            String assetId,
            String name,
            String symbol,
            BigInteger totalSupply,
            String metadataHash
    ) {
        return mantleDeploymentService.deployToken(assetId, name, symbol, totalSupply, metadataHash);
    }
}


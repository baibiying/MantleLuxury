package com.mantleluxury.backend.blockchain.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.web3j.crypto.Credentials;
import org.web3j.protocol.Web3j;
import org.web3j.protocol.http.HttpService;

/**
 * Web3j 配置类
 */
@Configuration
public class Web3jConfig {

    private static final Logger logger = LoggerFactory.getLogger(Web3jConfig.class);

    @Value("${blockchain.rpc-url:http://localhost:8545}")
    private String rpcUrl;

    @Value("${blockchain.private-key:}")
    private String privateKey;

    @Bean
    public Web3j web3j() {
        logger.info("Initializing Web3j with RPC URL: {}", rpcUrl);
        try {
            Web3j web3j = Web3j.build(new HttpService(rpcUrl));
            // 测试连接
            String clientVersion = web3j.web3ClientVersion().send().getWeb3ClientVersion();
            logger.info("Successfully connected to RPC. Client version: {}", clientVersion);
            return web3j;
        } catch (Exception e) {
            logger.error("Failed to connect to RPC URL: {}. Error: {}", rpcUrl, e.getMessage());
            logger.error("Please check if the RPC URL is correct. Common Mantle testnet RPC URLs:");
            logger.error("  - https://rpc.testnet.mantle.xyz");
            logger.error("  - https://mantle-testnet.rpc.thirdweb.com");
            throw new RuntimeException("Failed to initialize Web3j. Please check RPC URL configuration.", e);
        }
    }

    @Bean
    public Credentials credentials() {
        if (privateKey == null || privateKey.isEmpty()) {
            // 开发环境：使用模拟凭证（仅用于测试，不会实际部署）
            // 生产环境必须配置私钥
            return Credentials.create("0x0000000000000000000000000000000000000000000000000000000000000001");
        }
        return Credentials.create(privateKey);
    }
}


package com.mantleluxury.backend.blockchain.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.web3j.abi.FunctionEncoder;
import org.web3j.abi.FunctionReturnDecoder;
import org.web3j.abi.TypeReference;
import org.web3j.abi.datatypes.Function;
import org.web3j.abi.datatypes.Type;
import org.web3j.abi.datatypes.generated.Uint256;
import org.web3j.protocol.Web3j;
import org.web3j.protocol.core.DefaultBlockParameterName;
import org.web3j.protocol.core.methods.request.Transaction;
import org.web3j.protocol.core.methods.response.EthCall;
import org.web3j.utils.Convert;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;

/**
 * 代币查询服务
 * 用于从链上读取代币合约的状态信息
 */
@Service
public class TokenQueryService {

    private static final Logger logger = LoggerFactory.getLogger(TokenQueryService.class);

    private final Web3j web3j;
    private final boolean enabled;

    public TokenQueryService(
            Web3j web3j,
            @Value("${blockchain.enabled:false}") boolean enabled
    ) {
        this.web3j = web3j;
        this.enabled = enabled;
    }

    /**
     * 从链上读取可用代币数量（剩余可购份数）
     * @param tokenAddress 代币合约地址
     * @return 可用代币数量（以代币的最小单位，例如 10^18 = 1 份），如果读取失败返回 null
     */
    public BigInteger getAvailableTokens(String tokenAddress) {
        if (!enabled || tokenAddress == null || tokenAddress.isEmpty()) {
            return null;
        }

        try {
            // 构建 getAvailableTokens() 函数调用
            Function function = new Function(
                    "getAvailableTokens",
                    Collections.emptyList(),
                    Arrays.asList(new TypeReference<Uint256>() {})
            );

            String encodedFunction = FunctionEncoder.encode(function);

            // 调用合约
            EthCall response = web3j.ethCall(
                    Transaction.createEthCallTransaction(null, tokenAddress, encodedFunction),
                    DefaultBlockParameterName.LATEST
            ).send();

            if (response.hasError()) {
                logger.warn("Failed to call getAvailableTokens for {}: {}", tokenAddress, response.getError().getMessage());
                return null;
            }

            String value = response.getValue();
            if (value == null || value.isEmpty() || value.equals("0x")) {
                logger.warn("Empty response from getAvailableTokens for {}", tokenAddress);
                return null;
            }

            // 解码返回值
            List<Type> decoded = FunctionReturnDecoder.decode(value, function.getOutputParameters());
            if (decoded.isEmpty()) {
                logger.warn("Failed to decode response from getAvailableTokens for {}", tokenAddress);
                return null;
            }

            Uint256 result = (Uint256) decoded.get(0);
            BigInteger available = result.getValue();
            
            logger.debug("Available tokens for {}: {}", tokenAddress, available);
            return available;

        } catch (Exception e) {
            logger.warn("Error reading available tokens from chain for {}: {}", tokenAddress, e.getMessage());
            return null;
        }
    }

    /**
     * 从链上读取总供应量
     * @param tokenAddress 代币合约地址
     * @return 总供应量，如果读取失败返回 null
     */
    public BigInteger getTotalSupply(String tokenAddress) {
        if (!enabled || tokenAddress == null || tokenAddress.isEmpty()) {
            return null;
        }

        try {
            // 构建 totalSupply() 函数调用（ERC20 标准函数）
            Function function = new Function(
                    "totalSupply",
                    Collections.emptyList(),
                    Arrays.asList(new TypeReference<Uint256>() {})
            );

            String encodedFunction = FunctionEncoder.encode(function);

            EthCall response = web3j.ethCall(
                    Transaction.createEthCallTransaction(null, tokenAddress, encodedFunction),
                    DefaultBlockParameterName.LATEST
            ).send();

            if (response.hasError()) {
                logger.warn("Failed to call totalSupply for {}: {}", tokenAddress, response.getError().getMessage());
                return null;
            }

            String value = response.getValue();
            if (value == null || value.isEmpty() || value.equals("0x")) {
                return null;
            }

            List<Type> decoded = FunctionReturnDecoder.decode(value, function.getOutputParameters());
            if (decoded.isEmpty()) {
                return null;
            }

            Uint256 result = (Uint256) decoded.get(0);
            return result.getValue();

        } catch (Exception e) {
            logger.warn("Error reading totalSupply from chain for {}: {}", tokenAddress, e.getMessage());
            return null;
        }
    }

    /**
     * 将 wei 单位的代币数量转换为以"份"为单位的 BigDecimal
     * 假设代币使用 18 位小数（标准 ERC20）
     */
    public BigDecimal weiToTokens(BigInteger weiAmount) {
        if (weiAmount == null) {
            return BigDecimal.ZERO;
        }
        return Convert.fromWei(weiAmount.toString(), Convert.Unit.ETHER);
    }
}


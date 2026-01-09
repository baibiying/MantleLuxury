package com.mantleluxury.backend.blockchain.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.web3j.abi.FunctionEncoder;
import org.web3j.abi.FunctionReturnDecoder;
import org.web3j.abi.TypeReference;
import org.web3j.abi.datatypes.Function;
import org.web3j.abi.datatypes.Type;
import org.web3j.abi.datatypes.Address;
import org.web3j.protocol.Web3j;
import org.web3j.protocol.core.DefaultBlockParameterName;
import org.web3j.protocol.core.methods.response.EthCall;
import org.web3j.protocol.core.methods.request.Transaction;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;

/**
 * 合约 Owner 检查工具
 */
@Service
public class ContractOwnerChecker {
    
    private static final Logger logger = LoggerFactory.getLogger(ContractOwnerChecker.class);
    
    private final Web3j web3j;
    
    public ContractOwnerChecker(Web3j web3j) {
        this.web3j = web3j;
    }
    
    /**
     * 获取合约的 owner 地址
     */
    public String getContractOwner(String contractAddress) throws Exception {
        logger.info("Checking contract owner... Contract: {}", contractAddress);
        
        // 构建 owner() 函数调用
        Function function = new Function(
                "owner",
                Collections.emptyList(),
                Arrays.asList(new TypeReference<Address>() {})
        );
        
        String encodedFunction = FunctionEncoder.encode(function);
        
        // 调用合约
        EthCall response = web3j.ethCall(
                Transaction.createEthCallTransaction(
                        null, // from (可以是 null，因为是 view 函数)
                        contractAddress,
                        encodedFunction
                ),
                DefaultBlockParameterName.LATEST
        ).send();
        
        if (response.hasError()) {
            throw new RuntimeException("Failed to call owner() function: " + response.getError().getMessage());
        }
        
        // 解码返回值
        String result = response.getValue();
        if (result == null || result.equals("0x") || result.length() < 66) {
            throw new RuntimeException("Invalid owner() function result: " + result);
        }
        
        // 使用 FunctionReturnDecoder 解码返回值
        List<Type> decoded = FunctionReturnDecoder.decode(result, function.getOutputParameters());
        if (decoded == null || decoded.isEmpty()) {
            throw new RuntimeException("Failed to decode owner() function result");
        }
        
        Address ownerAddress = (Address) decoded.get(0);
        String owner = ownerAddress.getValue().toLowerCase();
        
        logger.info("Contract owner: {}", owner);
        return owner;
    }
    
    /**
     * 验证合约的 owner 地址是否匹配
     */
    public boolean verifyContractOwner(String contractAddress, String expectedOwner) throws Exception {
        String actualOwner = getContractOwner(contractAddress);
        expectedOwner = expectedOwner.toLowerCase();
        boolean matches = actualOwner.equals(expectedOwner);
        
        logger.info("Owner verification - Expected: {}, Actual: {}, Matches: {}", 
                expectedOwner, actualOwner, matches);
        
        return matches;
    }
}


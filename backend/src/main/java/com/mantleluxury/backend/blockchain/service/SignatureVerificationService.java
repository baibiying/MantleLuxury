package com.mantleluxury.backend.blockchain.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.web3j.crypto.Sign;
import org.web3j.utils.Keys;
import org.web3j.utils.Numeric;

import java.math.BigInteger;
import java.nio.charset.StandardCharsets;

/**
 * 签名验证服务
 * 用于验证用户钱包地址的所有权
 */
@Service
public class SignatureVerificationService {

    private static final Logger logger = LoggerFactory.getLogger(SignatureVerificationService.class);

    /**
     * 验证以太坊签名
     * @param message 原始消息
     * @param signature 签名（hex 格式，65 字节）
     * @param expectedAddress 期望的地址（用于验证签名是否来自该地址）
     * @return 验证是否通过
     */
    public boolean verifySignature(String message, String signature, String expectedAddress) {
        if (message == null || signature == null || expectedAddress == null) {
            logger.warn("Signature verification failed: missing parameters");
            return false;
        }

        try {
            // 将消息转换为以太坊签名消息格式（添加前缀）
            String ethMessage = "\u0019Ethereum Signed Message:\n" + message.length() + message;
            byte[] messageHash = org.web3j.crypto.Hash.sha3(ethMessage.getBytes(StandardCharsets.UTF_8));

            // 解析签名
            byte[] signatureBytes = Numeric.hexStringToByteArray(signature);
            if (signatureBytes.length != 65) {
                logger.warn("Invalid signature length: {}", signatureBytes.length);
                return false;
            }

            // 提取 r, s, v
            byte[] r = new byte[32];
            byte[] s = new byte[32];
            System.arraycopy(signatureBytes, 0, r, 0, 32);
            System.arraycopy(signatureBytes, 32, s, 0, 32);
            byte v = signatureBytes[64];

            // 调整 v 值（如果 v < 27，需要加 27）
            if (v < 27) {
                v += 27;
            }

            // 恢复签名者地址
            Sign.SignatureData signatureData = new Sign.SignatureData(v, r, s);
            org.web3j.crypto.ECDSASignature ecdsaSignature = new org.web3j.crypto.ECDSASignature(
                    new BigInteger(1, r),
                    new BigInteger(1, s)
            );
            BigInteger publicKey = Sign.recoverFromSignature(
                    (byte) (v - 27),
                    ecdsaSignature,
                    messageHash
            );
            String recoveredAddress = "0x" + org.web3j.utils.Keys.getAddress(publicKey).toLowerCase();

            // 比较地址（不区分大小写）
            boolean isValid = recoveredAddress.equals(expectedAddress.toLowerCase());

            if (!isValid) {
                logger.warn("Signature verification failed. Expected: {}, Recovered: {}", 
                        expectedAddress.toLowerCase(), recoveredAddress);
            }

            return isValid;
        } catch (Exception e) {
            logger.error("Error verifying signature: {}", e.getMessage(), e);
            return false;
        }
    }
}


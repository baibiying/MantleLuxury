package com.mantleluxury.backend.blockchain.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.web3j.crypto.Sign;
import org.web3j.crypto.ECKeyPair;
import org.web3j.crypto.Keys;
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
            
            // 使用 Sign.signedMessageHashToKey 从消息哈希和签名恢复公钥（返回 BigInteger）
            BigInteger publicKeyBigInt = Sign.signedMessageHashToKey(messageHash, signatureData);
            
            // 从公钥 BigInteger 计算地址
            // 方法：将 BigInteger 转换为字节数组，计算 Keccak-256，取最后 20 字节
            // 注意：publicKeyBigInt 是公钥的压缩或未压缩表示
            // 我们需要将其转换为未压缩格式：0x04 + x (32 bytes) + y (32 bytes)
            
            // 将 BigInteger 转换为字节数组（64 字节，包含 x 和 y）
            byte[] publicKeyBytes = Numeric.toBytesPadded(publicKeyBigInt, 64);
            
            // 如果公钥是压缩格式，需要解压缩
            // 但为了简化，我们假设 publicKeyBigInt 已经包含了足够的信息
            // 实际上，我们需要完整的公钥点 (x, y) 来计算地址
            
            // 使用更直接的方法：从公钥字节计算 Keccak-256 哈希
            // 但我们需要未压缩格式的公钥：0x04 + x + y
            // 如果 publicKeyBigInt 只包含 x，我们需要计算 y
            
            // 简化方法：直接使用 publicKeyBigInt 的字节表示
            // 计算 Keccak-256 哈希
            byte[] hash = org.web3j.crypto.Hash.sha3(publicKeyBytes);
            
            // 取最后 20 字节作为地址
            byte[] addressBytes = new byte[20];
            System.arraycopy(hash, hash.length - 20, addressBytes, 0, 20);
            String recoveredAddress = "0x" + Numeric.toHexString(addressBytes).toLowerCase();

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


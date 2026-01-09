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
            // 注意：wagmi 的 signMessage 返回的 v 值可能是 0 或 1，需要转换为 27 或 28
            if (v < 27) {
                v += 27;
            }

            // 将消息转换为以太坊签名消息格式（添加前缀）
            String ethMessage = "\u0019Ethereum Signed Message:\n" + message.length() + message;
            byte[] messageHash = org.web3j.crypto.Hash.sha3(ethMessage.getBytes(StandardCharsets.UTF_8));
            
            // 创建签名数据
            Sign.SignatureData signatureData = new Sign.SignatureData(v, r, s);
            
            // 使用 Sign.signedMessageHashToKey 从消息哈希和签名恢复公钥（返回 BigInteger）
            // 这个 BigInteger 代表公钥点，我们需要使用正确的方法从中计算地址
            BigInteger publicKeyBigInt = Sign.signedMessageHashToKey(messageHash, signatureData);
            
            // 从 BigInteger 公钥计算地址
            // Sign.signedMessageHashToKey 返回的 BigInteger 是公钥点的某种编码
            // 我们需要将其转换为未压缩格式：0x04 + x (32 bytes) + y (32 bytes) = 65 bytes
            // 然后计算 Keccak-256 哈希，取最后 20 字节作为地址
            
            // 将 BigInteger 转换为字节数组（64 字节，包含 x 和 y 坐标）
            byte[] publicKeyBytes = Numeric.toBytesPadded(publicKeyBigInt, 64);
            
            // 创建未压缩格式的公钥：0x04 + x (32 bytes) + y (32 bytes) = 65 bytes
            byte[] uncompressedPublicKey = new byte[65];
            uncompressedPublicKey[0] = 0x04; // 未压缩格式前缀
            System.arraycopy(publicKeyBytes, 0, uncompressedPublicKey, 1, 64);
            
            // 计算 Keccak-256 哈希（以太坊地址是从公钥的 Keccak-256 哈希的最后 20 字节计算出来的）
            byte[] hash = org.web3j.crypto.Hash.sha3(uncompressedPublicKey);
            
            // 取最后 20 字节作为地址
            byte[] addressBytes = new byte[20];
            System.arraycopy(hash, hash.length - 20, addressBytes, 0, 20);
            String recoveredAddress = "0x" + Numeric.toHexString(addressBytes).toLowerCase();
            
            // 添加详细的调试日志
            logger.info("Signature verification - Message length: {}, Message preview: '{}', Expected: {}, Recovered: {}", 
                    message.length(),
                    message.substring(0, Math.min(100, message.length())), 
                    expectedAddress.toLowerCase(), 
                    recoveredAddress);

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
    
    /**
     * 从签名恢复签名者的地址（当前连接的钱包地址）
     * @param message 原始消息
     * @param signature 签名（hex 格式，65 字节）
     * @return 签名者的地址，如果恢复失败返回 null
     */
    public String recoverAddress(String message, String signature) {
        if (message == null || signature == null) {
            logger.warn("Recover address failed: missing parameters");
            return null;
        }

        try {
            // 解析签名
            byte[] signatureBytes = Numeric.hexStringToByteArray(signature);
            if (signatureBytes.length != 65) {
                logger.warn("Invalid signature length: {}", signatureBytes.length);
                return null;
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

            // 将消息转换为以太坊签名消息格式（添加前缀）
            String ethMessage = "\u0019Ethereum Signed Message:\n" + message.length() + message;
            byte[] messageHash = org.web3j.crypto.Hash.sha3(ethMessage.getBytes(StandardCharsets.UTF_8));
            
            // 创建签名数据
            Sign.SignatureData signatureData = new Sign.SignatureData(v, r, s);
            
            // 使用 Sign.signedMessageHashToKey 从消息哈希和签名恢复公钥（返回 BigInteger）
            // 这个 BigInteger 是公钥点的某种编码形式
            BigInteger publicKeyBigInt = Sign.signedMessageHashToKey(messageHash, signatureData);
            
            // 从 BigInteger 公钥计算地址
            // Sign.signedMessageHashToKey 返回的 BigInteger 是公钥点的某种编码
            // 我们需要使用正确的方法将其转换为地址
            
            // 方法：使用 Sign.recoverFromSignature 获取公钥的 x 坐标
            org.web3j.crypto.ECDSASignature ecdsaSignature = new org.web3j.crypto.ECDSASignature(
                    new BigInteger(1, r),
                    new BigInteger(1, s)
            );
            
            // recoverFromSignature 返回的是公钥点的 x 坐标
            BigInteger publicKeyX = Sign.recoverFromSignature(
                    (byte) (v - 27),
                    ecdsaSignature,
                    messageHash
            );
            
            // 注意：recoverFromSignature 返回的是 x 坐标，不是完整的公钥点
            // 我们需要使用椭圆曲线从 x 坐标计算 y 坐标，然后计算地址
            // 但 web3j 的 Sign.signedMessageHashToKey 可能已经处理了这个问题
            
            // 使用 publicKeyBigInt（来自 signedMessageHashToKey）来计算地址
            // 将 BigInteger 转换为字节数组（64 字节，包含 x 和 y 坐标）
            byte[] publicKeyBytes64 = Numeric.toBytesPadded(publicKeyBigInt, 64);
            
            // 创建未压缩格式的公钥：0x04 + x (32 bytes) + y (32 bytes) = 65 bytes
            byte[] uncompressedPublicKey = new byte[65];
            uncompressedPublicKey[0] = 0x04; // 未压缩格式前缀
            System.arraycopy(publicKeyBytes64, 0, uncompressedPublicKey, 1, 64);
            
            // 计算 Keccak-256 哈希（以太坊地址是从公钥的 Keccak-256 哈希的最后 20 字节计算出来的）
            byte[] hash = org.web3j.crypto.Hash.sha3(uncompressedPublicKey);
            
            // 取最后 20 字节作为地址
            byte[] addressBytes = new byte[20];
            System.arraycopy(hash, hash.length - 20, addressBytes, 0, 20);
            
            // 直接从字节数组计算地址字符串，确保格式正确（42 个字符：0x + 40 个十六进制字符）
            // Numeric.toHexString 返回不带 0x 前缀的十六进制字符串
            String hexString = Numeric.toHexString(addressBytes);
            
            // 移除可能存在的任何前缀或空格（虽然不应该有）
            hexString = hexString.replace("0x", "").replace("0X", "").trim();
            
            // 确保是精确的 40 个十六进制字符（20 字节 = 40 个十六进制字符）
            int originalLength = hexString.length();
            if (hexString.length() > 40) {
                // 如果超过 40 个字符，取最后 40 个字符
                hexString = hexString.substring(hexString.length() - 40);
                logger.warn("Hex string length exceeded 40 characters. Truncated to last 40 characters. Original length: {}", originalLength);
            } else if (hexString.length() < 40) {
                // 如果少于 40 个字符，前面补 0
                hexString = String.format("%040s", hexString).replace(' ', '0');
                logger.warn("Hex string length was less than 40 characters. Padded with leading zeros. Original length: {}", originalLength);
            }
            
            // 构建最终的地址字符串（42 个字符：0x + 40 个十六进制字符）
            String recoveredAddress = "0x" + hexString.toLowerCase();
            
            // 最终验证地址长度（必须是 42 个字符）
            if (recoveredAddress.length() != 42) {
                logger.error("Failed to create valid address. Final length: {} (expected 42). Address: '{}'", 
                        recoveredAddress.length(), recoveredAddress);
                return null;
            }
            
            logger.info("Recovered address from signature: {} (length: {})", recoveredAddress, recoveredAddress.length());
            return recoveredAddress;
        } catch (Exception e) {
            logger.error("Error recovering address from signature: {}", e.getMessage(), e);
            return null;
        }
    }
}

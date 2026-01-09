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
     * 验证以太坊签名是否来自指定的地址
     * 注意：为了验证签名，我们仍然需要从签名恢复地址，但验证通过后，我们使用前端传来的地址
     * @param message 原始消息
     * @param signature 签名（hex 格式，65 字节）
     * @param expectedAddress 期望的地址（用户连接的钱包地址）
     * @return 验证是否通过
     */
    public boolean verifySignature(String message, String signature, String expectedAddress) {
        if (message == null || signature == null || expectedAddress == null) {
            logger.warn("Signature verification failed: missing parameters");
            return false;
        }

        try {
            // 从签名恢复地址（仅用于验证，不用于实际使用）
            String recoveredAddress = recoverAddress(message, signature);
            
            if (recoveredAddress == null) {
                logger.warn("Failed to recover address from signature");
                return false;
            }
            
            // 规范化地址格式进行比较（都转为小写）
            String normalizedExpected = expectedAddress.trim().toLowerCase();
            String normalizedRecovered = recoveredAddress.trim().toLowerCase();
            
            // 确保都有 0x 前缀
            if (!normalizedExpected.startsWith("0x")) {
                normalizedExpected = "0x" + normalizedExpected;
            }
            if (!normalizedRecovered.startsWith("0x")) {
                normalizedRecovered = "0x" + normalizedRecovered;
            }
            
            // 比较地址（不区分大小写）
            boolean isValid = normalizedRecovered.equals(normalizedExpected);
            
            // 添加详细的调试日志
            logger.info("Signature verification - Message length: {}, Message preview: '{}', Expected (from frontend): {}, Recovered (from signature): {}, Match: {}", 
                    message.length(),
                    message.substring(0, Math.min(100, message.length())), 
                    normalizedExpected, 
                    normalizedRecovered,
                    isValid);

            if (!isValid) {
                logger.warn("Signature verification failed. Expected (from frontend): {}, Recovered (from signature): {}", 
                        normalizedExpected, normalizedRecovered);
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
            // wagmi 的 signMessage 返回的 v 值可能是 0 或 1，需要转换为 27 或 28
            if (v < 27) {
                v += 27;
            }

            // 将消息转换为以太坊签名消息格式（添加前缀）
            // 格式：\u0019Ethereum Signed Message:\n{message.length}{message}
            // 注意：message.length() 应该是字节长度，不是字符长度（对于 UTF-8，英文和数字字符是 1 字节，但中文字符是 3 字节）
            // wagmi 的 signMessage 会自动处理这个消息格式，我们需要确保后端使用相同的格式
            byte[] messageBytes = message.getBytes(StandardCharsets.UTF_8);
            String ethMessage = "\u0019Ethereum Signed Message:\n" + messageBytes.length + message;
            byte[] messageHash = org.web3j.crypto.Hash.sha3(ethMessage.getBytes(StandardCharsets.UTF_8));
            
            // 创建 ECDSA 签名对象
            org.web3j.crypto.ECDSASignature ecdsaSignature = new org.web3j.crypto.ECDSASignature(
                    new BigInteger(1, r),
                    new BigInteger(1, s)
            );
            
            // 使用 Sign.recoverFromSignature 恢复公钥点的 x 坐标
            // recoverFromSignature 需要 v - 27（因为 v 值已经调整过了）
            byte recoveryId = (byte) (v - 27);
            BigInteger publicKeyX = Sign.recoverFromSignature(recoveryId, ecdsaSignature, messageHash);
            
            // 从公钥的 x 坐标和恢复 ID 计算完整的公钥点 (x, y)
            // 使用椭圆曲线 secp256k1 算法从 x 坐标和恢复 ID 计算 y 坐标
            // 注意：Sign.publicPointFromPrivate 返回的是 org.bouncycastle.math.ec.ECPoint
            org.bouncycastle.math.ec.ECPoint publicKeyPoint = org.web3j.crypto.Sign.publicPointFromPrivate(publicKeyX);
            
            // 将公钥点转换为未压缩格式：0x04 + x (32 bytes) + y (32 bytes) = 65 bytes
            byte[] publicKeyBytes = publicKeyPoint.getEncoded(false); // false = 未压缩格式
            
            // 计算 Keccak-256 哈希（以太坊地址是从公钥的 Keccak-256 哈希的最后 20 字节计算出来的）
            byte[] hash = org.web3j.crypto.Hash.sha3(publicKeyBytes);
            
            // 取最后 20 字节作为地址
            byte[] addressBytes = new byte[20];
            System.arraycopy(hash, hash.length - 20, addressBytes, 0, 20);
            
            // 使用 Keys.getAddress 从地址字节计算地址字符串（这会自动处理格式和校验和）
            String hexString = Numeric.toHexString(addressBytes);
            String recoveredAddress = Keys.toChecksumAddress(hexString);
            
            // 最终验证地址长度（必须是 42 个字符）
            if (recoveredAddress.length() != 42) {
                logger.error("Failed to create valid address. Final length: {} (expected 42). Address: '{}'", 
                        recoveredAddress.length(), recoveredAddress);
                return null;
            }
            
            logger.info("Recovered address from signature: {} (length: {}, message preview: '{}')", 
                    recoveredAddress, recoveredAddress.length(), 
                    message.substring(0, Math.min(100, message.length())));
            return recoveredAddress;
        } catch (Exception e) {
            logger.error("Error recovering address from signature: {}", e.getMessage(), e);
            return null;
        }
    }
}

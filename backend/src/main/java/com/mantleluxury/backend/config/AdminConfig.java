package com.mantleluxury.backend.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

/**
 * 管理员配置
 */
@Configuration
public class AdminConfig {

    private final Set<String> adminAddresses;

    public AdminConfig(@Value("${admin.wallet-addresses:}") String addresses) {
        this.adminAddresses = new HashSet<>();
        if (addresses != null && !addresses.trim().isEmpty()) {
            Arrays.stream(addresses.split(","))
                    .map(String::trim)
                    .map(String::toLowerCase)
                    .filter(addr -> !addr.isEmpty())
                    .forEach(adminAddresses::add);
        }
    }

    /**
     * 检查地址是否为管理员
     */
    public boolean isAdmin(String walletAddress) {
        if (walletAddress == null) {
            return false;
        }
        return adminAddresses.contains(walletAddress.toLowerCase());
    }

    /**
     * 获取管理员地址列表（用于调试）
     */
    public Set<String> getAdminAddresses() {
        return new HashSet<>(adminAddresses);
    }
}






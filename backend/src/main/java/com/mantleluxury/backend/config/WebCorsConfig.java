package com.mantleluxury.backend.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;

import java.util.Arrays;
import java.util.List;

/**
 * 全局 CORS 配置：
 * 允许本地前端 http://localhost:3000 和生产环境前端访问 /api/** 接口。
 * 支持通过环境变量 CORS_ALLOWED_ORIGINS 配置允许的源（多个源用逗号分隔）。
 * 
 * 本地开发：默认允许 http://localhost:3000
 * 生产环境：通过环境变量 CORS_ALLOWED_ORIGINS 配置，例如：
 *   CORS_ALLOWED_ORIGINS=https://ml-snowy-five.vercel.app,http://localhost:3000
 */
@Configuration
public class WebCorsConfig {

    private static final Logger logger = LoggerFactory.getLogger(WebCorsConfig.class);

    @Value("${cors.allowed-origins:http://localhost:3000}")
    private String allowedOrigins;

    @Bean
    public CorsFilter corsFilter() {
        CorsConfiguration config = new CorsConfiguration();
        
        // 从环境变量读取允许的源，支持多个源（用逗号分隔）
        List<String> origins = Arrays.asList(allowedOrigins.split(","));
        List<String> cleanedOrigins = origins.stream()
            .map(String::trim)
            .filter(s -> !s.isEmpty())
            .toList();
        
        config.setAllowedOrigins(cleanedOrigins);
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);

        // 记录配置的允许源，方便调试
        logger.info("CORS configuration - Allowed origins: {}", cleanedOrigins);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", config);
        return new CorsFilter(source);
    }
}



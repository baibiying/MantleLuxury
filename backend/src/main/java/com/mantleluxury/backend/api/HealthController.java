package com.mantleluxury.backend.api;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

/**
 * 简单健康检查接口，方便前端和运维探活。
 */
@RestController
@RequestMapping("/api/health")
public class HealthController {

    @GetMapping
    public ResponseEntity<Map<String, Object>> health() {
        Map<String, Object> body = new HashMap<>();
        body.put("status", "UP");
        body.put("service", "mantle-luxury-backend");
        body.put("timestamp", Instant.now().toString());
        return ResponseEntity.ok(body);
    }
}



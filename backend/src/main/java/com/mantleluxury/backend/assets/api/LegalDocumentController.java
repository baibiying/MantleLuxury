package com.mantleluxury.backend.assets.api;

import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

/**
 * 法律文档API
 * 提供使用条款、风险揭示书、投资者适当性说明等法律文档
 */
@RestController
@RequestMapping("/api/legal-documents")
public class LegalDocumentController {

    /**
     * 获取所有可用的法律文档列表
     */
    @GetMapping
    public ResponseEntity<Map<String, Object>> getDocuments() {
        Map<String, Object> documents = new HashMap<>();
        
        Map<String, Object> termsOfUse = new HashMap<>();
        termsOfUse.put("id", "terms-of-use");
        termsOfUse.put("title", "使用条款");
        termsOfUse.put("description", "平台服务使用条款和条件");
        termsOfUse.put("url", "/api/legal-documents/terms-of-use");
        termsOfUse.put("lastUpdated", "2025-01-01");
        
        Map<String, Object> riskDisclosure = new HashMap<>();
        riskDisclosure.put("id", "risk-disclosure");
        riskDisclosure.put("title", "风险揭示书");
        riskDisclosure.put("description", "投资风险提示和免责声明");
        riskDisclosure.put("url", "/api/legal-documents/risk-disclosure");
        riskDisclosure.put("lastUpdated", "2025-01-01");
        
        Map<String, Object> investorSuitability = new HashMap<>();
        investorSuitability.put("id", "investor-suitability");
        investorSuitability.put("title", "投资者适当性说明");
        investorSuitability.put("description", "适合性评估和投资建议");
        investorSuitability.put("url", "/api/legal-documents/investor-suitability");
        investorSuitability.put("lastUpdated", "2025-01-01");
        
        documents.put("termsOfUse", termsOfUse);
        documents.put("riskDisclosure", riskDisclosure);
        documents.put("investorSuitability", investorSuitability);
        
        return ResponseEntity.ok(documents);
    }

    /**
     * 获取文档（Markdown格式，用于前端渲染）
     * 注意：这个方法必须放在具体路径方法之前，或者使用更具体的路径匹配
     */
    @GetMapping(value = "/{documentId}", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> getDocumentById(@PathVariable String documentId) {
        // 排除 download 路径，避免冲突
        if (documentId.endsWith("/download")) {
            return ResponseEntity.notFound().build();
        }
        
        String resourcePath = null;
        String title = null;
        
        switch (documentId) {
            case "terms-of-use":
                resourcePath = "legal-documents/terms-of-use.md";
                title = "使用条款";
                break;
            case "risk-disclosure":
                resourcePath = "legal-documents/risk-disclosure.md";
                title = "风险揭示书";
                break;
            case "investor-suitability":
                resourcePath = "legal-documents/investor-suitability.md";
                title = "投资者适当性说明";
                break;
            default:
                return ResponseEntity.notFound().build();
        }
        
        try {
            Resource resource = new ClassPathResource(resourcePath);
            if (!resource.exists()) {
                return ResponseEntity.notFound().build();
            }
            
            String content = new String(resource.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
            
            Map<String, Object> response = new HashMap<>();
            response.put("id", documentId);
            response.put("title", title);
            response.put("content", content);
            response.put("format", "markdown");
            
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            
            return ResponseEntity.ok()
                    .headers(headers)
                    .body(response);
        } catch (IOException e) {
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("error", "读取文档失败: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(errorResponse);
        }
    }

    /**
     * 获取使用条款（纯文本格式，用于下载）
     */
    @GetMapping("/terms-of-use/download")
    public ResponseEntity<String> getTermsOfUseDownload() {
        return getDocument("legal-documents/terms-of-use.md");
    }

    /**
     * 获取风险揭示书（纯文本格式，用于下载）
     */
    @GetMapping("/risk-disclosure/download")
    public ResponseEntity<String> getRiskDisclosureDownload() {
        return getDocument("legal-documents/risk-disclosure.md");
    }

    /**
     * 获取投资者适当性说明（纯文本格式，用于下载）
     */
    @GetMapping("/investor-suitability/download")
    public ResponseEntity<String> getInvestorSuitabilityDownload() {
        return getDocument("legal-documents/investor-suitability.md");
    }

    /**
     * 通用文档获取方法（返回纯文本）
     */
    private ResponseEntity<String> getDocument(String resourcePath) {
        try {
            Resource resource = new ClassPathResource(resourcePath);
            if (!resource.exists()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body("文档未找到");
            }
            
            String content = new String(resource.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
            
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.TEXT_PLAIN);
            headers.setContentDispositionFormData("inline", resourcePath.substring(resourcePath.lastIndexOf("/") + 1));
            
            return ResponseEntity.ok()
                    .headers(headers)
                    .body(content);
        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("读取文档失败: " + e.getMessage());
        }
    }
}


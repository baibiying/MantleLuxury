package com.mantleluxury.backend.assets.api;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * 文件上传控制器
 * 用于KYC证件上传等功能
 */
@RestController
@RequestMapping("/api/upload")
@CrossOrigin(origins = "http://localhost:3000")
public class FileUploadController {

    private static final Logger logger = LoggerFactory.getLogger(FileUploadController.class);
    private static final String UPLOAD_DIR = "uploads/";

    static {
        // 确保上传目录存在
        try {
            Path uploadPath = Paths.get(UPLOAD_DIR);
            if (!Files.exists(uploadPath)) {
                Files.createDirectories(uploadPath);
            }
        } catch (IOException e) {
            logger.error("Failed to create upload directory", e);
        }
    }

    /**
     * 上传文件（用于KYC证件等）
     */
    @PostMapping("/kyc-document")
    public ResponseEntity<?> uploadKycDocument(@RequestParam("file") MultipartFile file) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "File is empty"));
        }

        // 验证文件类型
        String contentType = file.getContentType();
        if (contentType == null || 
            (!contentType.startsWith("image/") && !contentType.equals("application/pdf"))) {
            return ResponseEntity.badRequest().body(Map.of("error", "Only images and PDF files are allowed"));
        }

        // 验证文件大小（最大10MB）
        if (file.getSize() > 10 * 1024 * 1024) {
            return ResponseEntity.badRequest().body(Map.of("error", "File size exceeds 10MB"));
        }

        try {
            // 生成唯一文件名
            String originalFilename = file.getOriginalFilename();
            String extension = originalFilename != null && originalFilename.contains(".")
                    ? originalFilename.substring(originalFilename.lastIndexOf("."))
                    : "";
            String filename = UUID.randomUUID().toString() + extension;
            Path filePath = Paths.get(UPLOAD_DIR + filename);

            // 保存文件
            Files.copy(file.getInputStream(), filePath, StandardCopyOption.REPLACE_EXISTING);

            // 返回文件URL（实际部署时应使用CDN或对象存储URL）
            // 注意：这里返回相对路径，前端会拼接完整的API_BASE
            String fileUrl = "/api/upload/files/" + filename;

            logger.info("File uploaded successfully: {}", filename);

            return ResponseEntity.ok(Map.of(
                    "url", fileUrl,
                    "filename", filename,
                    "size", file.getSize(),
                    "contentType", contentType
            ));
        } catch (IOException e) {
            logger.error("Failed to upload file", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to upload file: " + e.getMessage()));
        }
    }

    /**
     * 上传3D模型文件（.glb或.gltf格式）
     */
    @PostMapping("/3d-model")
    public ResponseEntity<?> upload3dModel(@RequestParam("file") MultipartFile file) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "File is empty"));
        }

        // 验证文件类型（3D模型文件）
        String originalFilename = file.getOriginalFilename();
        if (originalFilename == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid filename"));
        }

        String extension = originalFilename.contains(".")
                ? originalFilename.substring(originalFilename.lastIndexOf(".")).toLowerCase()
                : "";
        
        if (!extension.equals(".glb") && !extension.equals(".gltf")) {
            return ResponseEntity.badRequest().body(Map.of("error", "Only .glb and .gltf files are allowed"));
        }

        // 验证文件大小（最大50MB，3D模型可能较大）
        if (file.getSize() > 50 * 1024 * 1024) {
            return ResponseEntity.badRequest().body(Map.of("error", "File size exceeds 50MB"));
        }

        try {
            // 生成唯一文件名
            String filename = UUID.randomUUID().toString() + extension;
            Path filePath = Paths.get(UPLOAD_DIR + filename);

            // 保存文件
            Files.copy(file.getInputStream(), filePath, StandardCopyOption.REPLACE_EXISTING);

            // 返回文件URL
            String fileUrl = "/api/upload/files/" + filename;

            logger.info("3D model uploaded successfully: {}", filename);

            return ResponseEntity.ok(Map.of(
                    "url", fileUrl,
                    "filename", filename,
                    "size", file.getSize(),
                    "format", extension.substring(1) // 去掉点号
            ));
        } catch (IOException e) {
            logger.error("Failed to upload 3D model", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to upload 3D model: " + e.getMessage()));
        }
    }

    /**
     * 获取上传的文件
     */
    @GetMapping("/files/{filename:.+}")
    public ResponseEntity<?> getFile(@PathVariable String filename) {
        try {
            Path filePath = Paths.get(UPLOAD_DIR + filename);
            if (!Files.exists(filePath)) {
                return ResponseEntity.notFound().build();
            }

            byte[] fileContent = Files.readAllBytes(filePath);
            String contentType = Files.probeContentType(filePath);
            if (contentType == null) {
                // 根据文件扩展名设置Content-Type
                if (filename.toLowerCase().endsWith(".glb")) {
                    contentType = "model/gltf-binary";
                } else if (filename.toLowerCase().endsWith(".gltf")) {
                    contentType = "model/gltf+json";
                } else {
                    contentType = "application/octet-stream";
                }
            }

            return ResponseEntity.ok()
                    .header("Content-Type", contentType)
                    .header("Access-Control-Allow-Origin", "*") // 允许跨域访问3D模型文件
                    .body(fileContent);
        } catch (IOException e) {
            logger.error("Failed to read file", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
}


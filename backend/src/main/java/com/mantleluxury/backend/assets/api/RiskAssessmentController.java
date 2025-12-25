package com.mantleluxury.backend.assets.api;

import com.mantleluxury.backend.assets.domain.RiskAssessment;
import com.mantleluxury.backend.assets.service.RiskAssessmentService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/risk-assessment")
@CrossOrigin(origins = "http://localhost:3000")
public class RiskAssessmentController {

    private final RiskAssessmentService riskAssessmentService;

    public RiskAssessmentController(RiskAssessmentService riskAssessmentService) {
        this.riskAssessmentService = riskAssessmentService;
    }

    /**
     * 提交风险测评问卷
     */
    @PostMapping("/submit")
    public ResponseEntity<?> submitAssessment(@RequestBody Map<String, Object> payload) {
        try {
            String walletAddress = ((String) payload.get("walletAddress")).toLowerCase();
            @SuppressWarnings("unchecked")
            Map<String, Object> answers = (Map<String, Object>) payload.get("answers");

            if (walletAddress == null || walletAddress.isEmpty()) {
                return ResponseEntity.badRequest().body("walletAddress is required");
            }

            if (answers == null || answers.isEmpty()) {
                return ResponseEntity.badRequest().body("answers are required");
            }

            RiskAssessment assessment = riskAssessmentService.submitAssessment(walletAddress, answers);

            Map<String, Object> response = new HashMap<>();
            response.put("id", assessment.getId());
            response.put("walletAddress", assessment.getWalletAddress());
            response.put("totalScore", assessment.getTotalScore());
            response.put("riskLevel", assessment.getRiskLevel());
            response.put("assessmentResult", assessment.getAssessmentResult());
            response.put("createdAt", assessment.getCreatedAt());

            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body("Failed to submit risk assessment: " + e.getMessage());
        }
    }

    /**
     * 获取用户的风险测评记录
     */
    @GetMapping("/{walletAddress}")
    public ResponseEntity<?> getAssessment(@PathVariable String walletAddress) {
        try {
            RiskAssessment assessment = riskAssessmentService.getAssessment(walletAddress.toLowerCase());
            
            if (assessment == null) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body("Risk assessment not found for wallet address: " + walletAddress);
            }

            Map<String, Object> response = new HashMap<>();
            response.put("id", assessment.getId());
            response.put("walletAddress", assessment.getWalletAddress());
            response.put("investmentExperienceScore", assessment.getInvestmentExperienceScore());
            response.put("riskToleranceScore", assessment.getRiskToleranceScore());
            response.put("investmentGoalScore", assessment.getInvestmentGoalScore());
            response.put("investmentHorizonScore", assessment.getInvestmentHorizonScore());
            response.put("totalScore", assessment.getTotalScore());
            response.put("riskLevel", assessment.getRiskLevel());
            response.put("assessmentResult", assessment.getAssessmentResult());
            response.put("createdAt", assessment.getCreatedAt());
            response.put("updatedAt", assessment.getUpdatedAt());

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Failed to get risk assessment: " + e.getMessage());
        }
    }
}





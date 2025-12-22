package com.mantleluxury.backend.assets.service;

import com.mantleluxury.backend.assets.domain.RiskAssessment;
import com.mantleluxury.backend.assets.repository.RiskAssessmentRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

@Service
@Transactional
public class RiskAssessmentService {

    private final RiskAssessmentRepository riskAssessmentRepository;

    public RiskAssessmentService(RiskAssessmentRepository riskAssessmentRepository) {
        this.riskAssessmentRepository = riskAssessmentRepository;
    }

    /**
     * 提交风险测评问卷
     */
    public RiskAssessment submitAssessment(String walletAddress, Map<String, Object> answers) {
        // 提取答案
        Integer investmentExperience = getIntegerValue(answers, "investmentExperience");
        Integer riskTolerance = getIntegerValue(answers, "riskTolerance");
        Integer investmentGoal = getIntegerValue(answers, "investmentGoal");
        Integer investmentHorizon = getIntegerValue(answers, "investmentHorizon");

        // 计算总分数
        int totalScore = investmentExperience + riskTolerance + investmentGoal + investmentHorizon;

        // 确定风险等级
        String riskLevel = calculateRiskLevel(totalScore);

        // 生成测评结果描述
        String assessmentResult = generateAssessmentResult(riskLevel, totalScore);

        // 创建或更新测评记录
        RiskAssessment assessment = riskAssessmentRepository
                .findByWalletAddress(walletAddress)
                .orElse(new RiskAssessment());

        assessment.setWalletAddress(walletAddress);
        assessment.setInvestmentExperienceScore(investmentExperience);
        assessment.setRiskToleranceScore(riskTolerance);
        assessment.setInvestmentGoalScore(investmentGoal);
        assessment.setInvestmentHorizonScore(investmentHorizon);
        assessment.setTotalScore(totalScore);
        assessment.setRiskLevel(riskLevel);
        assessment.setAssessmentResult(assessmentResult);

        return riskAssessmentRepository.save(assessment);
    }

    /**
     * 获取用户的风险测评记录
     */
    public RiskAssessment getAssessment(String walletAddress) {
        return riskAssessmentRepository
                .findFirstByWalletAddressOrderByCreatedAtDesc(walletAddress)
                .orElse(null);
    }

    /**
     * 计算风险等级
     * 总分范围: 4-20
     * - 4-8: conservative (保守型)
     * - 9-14: moderate (稳健型)
     * - 15-20: aggressive (积极型)
     */
    private String calculateRiskLevel(int totalScore) {
        if (totalScore <= 8) {
            return "conservative";
        } else if (totalScore <= 14) {
            return "moderate";
        } else {
            return "aggressive";
        }
    }

    /**
     * 生成测评结果描述
     */
    private String generateAssessmentResult(String riskLevel, int totalScore) {
        switch (riskLevel) {
            case "conservative":
                return String.format(
                    "您的风险测评结果为：保守型（总分：%d/20）。" +
                    "您适合投资风险较低、收益稳定的资产。建议关注保值增值为主的投资策略。",
                    totalScore
                );
            case "moderate":
                return String.format(
                    "您的风险测评结果为：稳健型（总分：%d/20）。" +
                    "您适合进行风险与收益平衡的投资。可以适当配置一些中等风险的资产，追求长期稳健收益。",
                    totalScore
                );
            case "aggressive":
                return String.format(
                    "您的风险测评结果为：积极型（总分：%d/20）。" +
                    "您对风险有较高的承受能力，适合投资高风险高收益的资产。可以配置更多成长性资产，追求更高的投资回报。",
                    totalScore
                );
            default:
                return "风险测评完成。";
        }
    }

    /**
     * 从 Map 中安全获取整数值
     */
    private Integer getIntegerValue(Map<String, Object> map, String key) {
        Object value = map.get(key);
        if (value == null) {
            return 1; // 默认值
        }
        if (value instanceof Integer) {
            return (Integer) value;
        }
        if (value instanceof Number) {
            return ((Number) value).intValue();
        }
        try {
            return Integer.parseInt(value.toString());
        } catch (NumberFormatException e) {
            return 1; // 默认值
        }
    }
}




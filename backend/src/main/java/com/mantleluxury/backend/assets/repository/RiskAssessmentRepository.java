package com.mantleluxury.backend.assets.repository;

import com.mantleluxury.backend.assets.domain.RiskAssessment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface RiskAssessmentRepository extends JpaRepository<RiskAssessment, String> {

    Optional<RiskAssessment> findByWalletAddress(String walletAddress);

    Optional<RiskAssessment> findFirstByWalletAddressOrderByCreatedAtDesc(String walletAddress);
}





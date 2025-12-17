package com.mantleluxury.backend.assets.repository;

import com.mantleluxury.backend.assets.domain.Insurance;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface InsuranceRepository extends JpaRepository<Insurance, String> {
    
    Optional<Insurance> findByAssetId(String assetId);
    
    List<Insurance> findAllByAssetId(String assetId);
    
    List<Insurance> findByAssetIdAndIsActive(String assetId, Boolean isActive);
    
    List<Insurance> findByInsuranceCompany(String company);
    
    List<Insurance> findByIsActiveAndPolicyEndDateBefore(Boolean isActive, LocalDate date);
}


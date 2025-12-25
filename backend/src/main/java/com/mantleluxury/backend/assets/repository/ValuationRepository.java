package com.mantleluxury.backend.assets.repository;

import com.mantleluxury.backend.assets.domain.Valuation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface ValuationRepository extends JpaRepository<Valuation, String> {
    
    List<Valuation> findByAssetId(String assetId);
    
    List<Valuation> findByAssetIdOrderByValuationDateDesc(String assetId);
    
    List<Valuation> findByValuationAgency(String agency);
    
    List<Valuation> findByValuationDateAfter(LocalDate date);
}



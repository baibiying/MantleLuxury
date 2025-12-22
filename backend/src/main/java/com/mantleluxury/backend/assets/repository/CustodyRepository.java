package com.mantleluxury.backend.assets.repository;

import com.mantleluxury.backend.assets.domain.Custody;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CustodyRepository extends JpaRepository<Custody, String> {
    
    Optional<Custody> findByAssetId(String assetId);
    
    List<Custody> findByCustodyStatus(String status);
    
    List<Custody> findByCustodyOrganization(String organization);
}





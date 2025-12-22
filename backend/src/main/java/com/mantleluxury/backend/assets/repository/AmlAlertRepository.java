package com.mantleluxury.backend.assets.repository;

import com.mantleluxury.backend.assets.domain.AmlAlert;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AmlAlertRepository extends JpaRepository<AmlAlert, String> {

    List<AmlAlert> findByWalletAddressOrderByCreatedAtDesc(String walletAddress);

    List<AmlAlert> findByStatusOrderByCreatedAtDesc(String status);

    List<AmlAlert> findAllByOrderByCreatedAtDesc();
}





package com.mantleluxury.backend.assets.repository;

import com.mantleluxury.backend.assets.domain.AmlBlacklist;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface AmlBlacklistRepository extends JpaRepository<AmlBlacklist, String> {
    Optional<AmlBlacklist> findByWalletAddress(String walletAddress);
}







package com.mantleluxury.backend.assets.repository;

import com.mantleluxury.backend.assets.domain.UserHolding;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserHoldingRepository extends JpaRepository<UserHolding, String> {

    Optional<UserHolding> findByUserAddressAndTokenAddress(String userAddress, String tokenAddress);

    List<UserHolding> findByUserAddress(String userAddress);
}




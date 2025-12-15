package com.mantleluxury.backend.assets.repository;

import com.mantleluxury.backend.assets.domain.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, String> {

    Optional<User> findByWalletAddress(String walletAddress);
}



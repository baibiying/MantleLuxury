package com.mantleluxury.backend.assets.repository;

import com.mantleluxury.backend.assets.domain.UserInvestment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface UserInvestmentRepository extends JpaRepository<UserInvestment, String> {

    List<UserInvestment> findByUserAddress(String userAddress);
}





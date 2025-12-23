package com.mantleluxury.backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class MantleLuxuryBackendApplication {

    public static void main(String[] args) {
        SpringApplication.run(MantleLuxuryBackendApplication.class, args);
    }
}



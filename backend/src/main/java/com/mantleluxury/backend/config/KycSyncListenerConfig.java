package com.mantleluxury.backend.config;

import com.mantleluxury.backend.assets.listener.UserKycSyncListener;
import org.springframework.context.ApplicationContext;
import org.springframework.context.ApplicationListener;
import org.springframework.context.event.ContextRefreshedEvent;
import org.springframework.stereotype.Component;

/**
 * 配置 UserKycSyncListener，注入 ApplicationContext
 * 
 * 因为 JPA Entity Listener 不能直接注入 Spring Bean，
 * 需要通过静态方式设置 ApplicationContext
 */
@Component
public class KycSyncListenerConfig implements ApplicationListener<ContextRefreshedEvent> {

    @Override
    public void onApplicationEvent(ContextRefreshedEvent event) {
        ApplicationContext context = event.getApplicationContext();
        UserKycSyncListener.setApplicationContext(context);
    }
}


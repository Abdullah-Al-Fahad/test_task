package com.nexusfiber.backend.config;

import com.nexusfiber.backend.websocket.RequestWebSocketHandler;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.reactive.HandlerMapping;
import org.springframework.web.reactive.handler.SimpleUrlHandlerMapping;
import org.springframework.web.reactive.socket.WebSocketHandler;
import org.springframework.web.reactive.socket.server.support.WebSocketHandlerAdapter;

import java.util.HashMap;
import java.util.Map;

@Configuration
public class WebSocketConfig {

    private final RequestWebSocketHandler requestWebSocketHandler;

    public WebSocketConfig(RequestWebSocketHandler requestWebSocketHandler) {
        this.requestWebSocketHandler = requestWebSocketHandler;
    }

    @Bean
    public HandlerMapping webSocketHandlerMapping() {
        Map<String, WebSocketHandler> map = new HashMap<>();
        map.put("/ws/requests/", requestWebSocketHandler);

        org.springframework.web.cors.CorsConfiguration corsConfig = new org.springframework.web.cors.CorsConfiguration();
        corsConfig.addAllowedOriginPattern("*"); // Allow all origins for the websocket
        
        Map<String, org.springframework.web.cors.CorsConfiguration> corsConfigurationMap = new HashMap<>();
        corsConfigurationMap.put("/ws/requests/", corsConfig);

        SimpleUrlHandlerMapping handlerMapping = new SimpleUrlHandlerMapping();
        handlerMapping.setOrder(-1); // Process before other HTTP endpoints
        handlerMapping.setUrlMap(map);
        handlerMapping.setCorsConfigurations(corsConfigurationMap);
        return handlerMapping;
    }

    @Bean
    public WebSocketHandlerAdapter handlerAdapter() {
        return new WebSocketHandlerAdapter();
    }
}

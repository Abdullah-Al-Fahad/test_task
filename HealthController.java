package com.nexusfiber.backend.controller;

import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.ReactiveRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Mono;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

/**
 * Public health check endpoint for infrastructure monitoring.
 * Verifies database and Redis connectivity in a non-blocking reactive chain.
 */
@Slf4j
@RestController
@RequestMapping("/api/health")
public class HealthController {

    private final ReactiveRedisTemplate<String, String> redisTemplate;
    private final org.springframework.r2dbc.core.DatabaseClient databaseClient;

    public HealthController(ReactiveRedisTemplate<String, String> redisTemplate,
                            org.springframework.r2dbc.core.DatabaseClient databaseClient) {
        this.redisTemplate = redisTemplate;
        this.databaseClient = databaseClient;
    }

    @GetMapping("/")
    public Mono<Map<String, Object>> health() {
        Mono<String> dbCheck = databaseClient.sql("SELECT 1")
                .fetch().first()
                .map(r -> "connected")
                .onErrorReturn("error");

        Mono<String> redisCheck = Mono.justOrEmpty(redisTemplate.getConnectionFactory())
                .flatMap(factory -> factory.getReactiveConnection().ping())
                .map(r -> "connected")
                .defaultIfEmpty("not configured")
                .onErrorReturn("error");

        return Mono.zip(dbCheck, redisCheck)
                .map(tuple -> {
                    Map<String, Object> services = new HashMap<>();
                    services.put("database", tuple.getT1());
                    services.put("redis", tuple.getT2());

                    boolean healthy = "connected".equals(tuple.getT1()) && "connected".equals(tuple.getT2());

                    Map<String, Object> response = new HashMap<>();
                    response.put("status", healthy ? "healthy" : "degraded");
                    response.put("timestamp", Instant.now().getEpochSecond());
                    response.put("services", services);

                    if (!healthy) {
                        throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Service degraded");
                    }
                    return response;
                });
    }
}

package com.nexusfiber.backend.service.notification;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexusfiber.backend.domain.ServiceRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.ReactiveRedisTemplate;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

import java.util.Map;

@Slf4j
@Service
public class RedisNotificationService implements NotificationService {

    private static final String CHANNEL = "requests_updates";

    private final ReactiveRedisTemplate<String, String> redisTemplate;
    private final ObjectMapper objectMapper;

    public RedisNotificationService(ReactiveRedisTemplate<String, String> redisTemplate,
                                     ObjectMapper objectMapper) {
        this.redisTemplate = redisTemplate;
        this.objectMapper = objectMapper;
    }

    @Override
    public Mono<Void> broadcastUpdate(ServiceRequest request, String username, String logMessage) {
        try {
            Map<String, Object> data = Map.of(
                    "id", request.getId().toString(),
                    "customer_account", request.getCustomerAccount(),
                    "request_type", request.getRequestType().toString(),
                    "status", request.getStatus().toString(),
                    "progress", request.getProgress(),
                    "operator_username", username,
                    "created_at", request.getCreatedAt() != null ? request.getCreatedAt().toString() : "",
                    "log_message", logMessage
            );

            Map<String, Object> message = Map.of(
                    "type", "update",
                    "data", data
            );

            String json = objectMapper.writeValueAsString(message);
            return redisTemplate.convertAndSend(CHANNEL, json)
                    .doOnSuccess(count -> log.debug("Broadcast sent to {} subscribers on channel '{}'", count, CHANNEL))
                    .then();
        } catch (JsonProcessingException e) {
            log.error("Failed to serialize broadcast message for request '{}': {}", request.getId(), e.getMessage());
            return Mono.empty();
        }
    }

    @Override
    public Mono<Void> broadcastDeleted(java.util.UUID id) {
        try {
            Map<String, Object> message = Map.of(
                    "type", "deleted",
                    "data", Map.of("id", id.toString())
            );
            String json = objectMapper.writeValueAsString(message);
            return redisTemplate.convertAndSend(CHANNEL, json)
                    .doOnSuccess(count -> log.debug("Deleted broadcast sent to {} subscribers on channel '{}'", count, CHANNEL))
                    .then();
        } catch (JsonProcessingException e) {
            log.error("Failed to serialize deleted broadcast message for request '{}': {}", id, e.getMessage());
            return Mono.empty();
        }
    }

    @Override
    public Mono<Void> broadcastBulkDeleted(java.util.List<String> ids) {
        try {
            Map<String, Object> message = Map.of(
                    "type", "deleted",
                    "data", Map.of("ids", ids)
            );
            String json = objectMapper.writeValueAsString(message);
            return redisTemplate.convertAndSend(CHANNEL, json)
                    .doOnSuccess(count -> log.debug("Bulk deleted broadcast sent to {} subscribers on channel '{}'", count, CHANNEL))
                    .then();
        } catch (JsonProcessingException e) {
            log.error("Failed to serialize bulk deleted broadcast message: {}", e.getMessage());
            return Mono.empty();
        }
    }
}


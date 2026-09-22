package com.nexusfiber.backend.repository;

import com.nexusfiber.backend.domain.ServiceRequest;
import org.springframework.r2dbc.core.DatabaseClient;
import reactor.core.publisher.Mono;
import org.springframework.stereotype.Repository;

/**
 * Custom repository implementation for manual UUID primary key insertion.
 * R2DBC's default save() treats non-null IDs as updates; this bypasses
 * that behaviour for entities with application-generated UUIDs.
 */
@Repository
public class ServiceRequestRepositoryImpl implements ServiceRequestRepositoryCustom {

    private final DatabaseClient databaseClient;

    public ServiceRequestRepositoryImpl(DatabaseClient databaseClient) {
        this.databaseClient = databaseClient;
    }

    @Override
    public Mono<ServiceRequest> insertRequest(ServiceRequest request) {
        return databaseClient.sql("""
                INSERT INTO service_requests
                    (id, customer_account, request_type, status, progress, operator_id, created_at, updated_at)
                VALUES
                    (:id, :customerAccount, :requestType, :status, :progress, :operatorId, :createdAt, :updatedAt)
                """)
                .bind("id", request.getId())
                .bind("customerAccount", request.getCustomerAccount())
                .bind("requestType", request.getRequestType())
                .bind("status", request.getStatus())
                .bind("progress", request.getProgress())
                .bind("operatorId", request.getOperatorId())
                .bind("createdAt", request.getCreatedAt().toOffsetDateTime())
                .bind("updatedAt", request.getUpdatedAt().toOffsetDateTime())
                .then()
                .thenReturn(request);
    }
}

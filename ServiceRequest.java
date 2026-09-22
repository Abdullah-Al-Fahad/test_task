package com.nexusfiber.backend.domain;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Table;
import java.time.ZonedDateTime;
import java.util.Set;
import java.util.UUID;

/**
 * Domain entity representing a service request (e.g. line diagnostic, firmware upgrade).
 * Status transitions follow a strict state machine enforced by the service layer.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table("service_requests")
public class ServiceRequest {

    private static final Set<String> TERMINAL_STATUSES = Set.of(
            RequestStatus.COMPLETED.name(),
            RequestStatus.FAILED.name(),
            RequestStatus.CANCELLED.name()
    );

    @Id
    private UUID id;
    private String customerAccount;
    private String requestType;
    private String status;
    private Integer progress;
    private Long operatorId;
    private ZonedDateTime createdAt;
    private ZonedDateTime updatedAt;

    /**
     * Sets the status using a type-safe {@link RequestStatus} enum.
     */
    public void setRequestStatus(RequestStatus requestStatus) {
        this.status = requestStatus.name();
    }

    /**
     * Returns the current status as a type-safe {@link RequestStatus} enum.
     */
    public RequestStatus getRequestStatus() {
        return RequestStatus.valueOf(this.status);
    }

    /**
     * Returns whether the request is in a terminal (final) state.
     */
    public boolean isTerminal() {
        return TERMINAL_STATUSES.contains(this.status);
    }
}

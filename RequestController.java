package com.nexusfiber.backend.controller;

import com.nexusfiber.backend.controller.dto.BulkDeleteRequestDto;
import com.nexusfiber.backend.controller.dto.BulkDeleteResponseDto;
import com.nexusfiber.backend.controller.dto.CreateServiceRequestDto;
import com.nexusfiber.backend.controller.dto.PaginatedResponse;
import com.nexusfiber.backend.controller.dto.ServiceRequestResponseDto;
import com.nexusfiber.backend.domain.UserRole;
import com.nexusfiber.backend.service.RequestService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;
import java.util.UUID;

/**
 * REST controller for service request lifecycle management.
 * <p>
 * Endpoints:
 * <ul>
 *     <li>{@code POST   /api/requests/}              — create + dispatch background task</li>
 *     <li>{@code GET    /api/requests/}              — list (role-filtered)</li>
 *     <li>{@code GET    /api/requests/{id}/}         — retrieve single request</li>
 *     <li>{@code POST   /api/requests/{id}/cancel/}  — cancel in-flight task</li>
 *     <li>{@code DELETE /api/requests/{id}/}         — delete terminal request</li>
 *     <li>{@code POST   /api/requests/bulk-delete/}  — bulk delete terminal requests</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/requests")
public class RequestController {

    private final RequestService requestService;

    public RequestController(RequestService requestService) {
        this.requestService = requestService;
    }

    /**
     * Creates a new service request and dispatches the background diagnostic task.
     */
    @PostMapping("/")
    @ResponseStatus(HttpStatus.CREATED)
    public Mono<ServiceRequestResponseDto> createRequest(
            @Valid @RequestBody Mono<CreateServiceRequestDto> dtoMono,
            Authentication authentication) {
        return dtoMono.flatMap(dto -> requestService.createRequest(dto, authentication.getName()));
    }

    /**
     * Lists service requests filtered by the authenticated user's role.
     * Supervisors see all requests; operators see only their own.
     */
    @GetMapping("/")
    public Mono<PaginatedResponse<ServiceRequestResponseDto>> listRequests(Authentication authentication) {
        return requestService.listRequests(authentication.getName(), extractRole(authentication));
    }

    /**
     * Retrieves a single service request by ID with ownership validation.
     */
    @GetMapping("/{id}/")
    public Mono<ServiceRequestResponseDto> getRequest(@PathVariable UUID id, Authentication authentication) {
        return requestService.getRequest(id, authentication.getName(), extractRole(authentication));
    }

    /**
     * Cancels an in-flight (PENDING or PROCESSING) task. Returns 204 on success.
     */
    @PostMapping("/{id}/cancel/")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public Mono<Void> cancelRequest(@PathVariable UUID id, Authentication authentication) {
        return requestService.cancelRequest(id, authentication.getName(), extractRole(authentication));
    }

    /**
     * Deletes a terminal (COMPLETED, FAILED, CANCELLED) request. Returns 204 on success.
     * Active tasks must be cancelled before they can be deleted.
     */
    @DeleteMapping("/{id}/")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public Mono<Void> deleteRequest(@PathVariable UUID id, Authentication authentication) {
        return requestService.deleteRequest(id, authentication.getName(), extractRole(authentication));
    }

    /**
     * Bulk-deletes terminal requests. Active tasks are skipped and counted in the response.
     */
    @PostMapping("/bulk-delete/")
    public Mono<BulkDeleteResponseDto> bulkDeleteRequests(
            @Valid @RequestBody Mono<BulkDeleteRequestDto> dtoMono,
            Authentication authentication) {
        return dtoMono.flatMap(dto ->
                requestService.bulkDeleteRequests(dto.getIds(), authentication.getName(), extractRole(authentication)));
    }

    /**
     * Extracts the user's role from the Spring Security authentication context.
     */
    private UserRole extractRole(Authentication authentication) {
        String roleName = authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .map(r -> r.replace("ROLE_", ""))
                .findFirst()
                .orElse(UserRole.OPERATOR.name());
        return UserRole.valueOf(roleName);
    }
}

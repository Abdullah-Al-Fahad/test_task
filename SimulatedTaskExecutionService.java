package com.nexusfiber.backend.service.task;

import com.nexusfiber.backend.domain.RequestStatus;
import com.nexusfiber.backend.domain.ServiceRequest;
import com.nexusfiber.backend.domain.User;
import com.nexusfiber.backend.repository.ServiceRequestRepository;
import com.nexusfiber.backend.service.notification.NotificationService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

import java.time.Duration;
import java.time.ZonedDateTime;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Simulates long-running diagnostic tasks using a reactive {@link Flux#interval(Duration)} pipeline.
 * <p>
 * In a production clustered environment, this would be replaced by an external task manager
 * (e.g., a dedicated job queue backed by Redis or a message broker) to allow task state
 * to survive pod restarts and be distributed across instances.
 */
@Slf4j
@Service
public class SimulatedTaskExecutionService implements TaskExecutionService {

    private static final int TOTAL_STEPS = 5;
    private static final Duration STEP_INTERVAL = Duration.ofSeconds(5);

    private final ServiceRequestRepository requestRepository;
    private final NotificationService notificationService;

    /**
     * In-memory map to track active task subscriptions for cancellation.
     * Scoped to a single instance — not suitable for multi-instance deployments.
     */
    private final Map<UUID, reactor.core.Disposable> activeTasks = new ConcurrentHashMap<>();

    public SimulatedTaskExecutionService(ServiceRequestRepository requestRepository,
                                         NotificationService notificationService) {
        this.requestRepository = requestRepository;
        this.notificationService = notificationService;
    }

    @Override
    public Mono<Void> executeTask(ServiceRequest request, User user) {
        return Mono.fromRunnable(() -> {
            log.info("Starting diagnostic task for request '{}'", request.getId());
            reactor.core.Disposable task = simulateDiagnosticAsync(request.getId(), user)
                    .subscribeOn(Schedulers.boundedElastic())
                    .subscribe();
            activeTasks.put(request.getId(), task);
        });
    }

    @Override
    public Mono<Void> cancelTask(UUID requestId, String operatorUsername) {
        // Dispose the in-memory reactive stream first (synchronous, non-blocking)
        reactor.core.Disposable task = activeTasks.remove(requestId);
        if (task != null && !task.isDisposed()) {
            task.dispose();
            log.info("Disposed active diagnostic stream for request '{}'", requestId);
        }

        // Then persist the CANCELLED status and broadcast — returned as a proper reactive chain
        return requestRepository.findById(requestId)
                .flatMap(request -> {
                    request.setRequestStatus(RequestStatus.CANCELLED);
                    request.setUpdatedAt(ZonedDateTime.now());
                    return requestRepository.save(request)
                            .flatMap(saved -> notificationService.broadcastUpdate(
                                    saved, operatorUsername, "[WARNING] Task manually cancelled."));
                })
                .doOnSuccess(v -> log.info("Request '{}' cancelled by '{}'", requestId, operatorUsername))
                .then();
    }

    /**
     * Helper to generate dynamic log messages that exactly match the old Django celery tasks.
     */
    private String getLogMessageForStep(ServiceRequest request, int stepIndex) {
        String type = request.getRequestType() != null ? request.getRequestType() : "";
        if ("LINE_DIAGNOSTIC".equals(type)) {
            return switch (stepIndex) {
                case 0 -> "[INFO] Pinging customer modem (ICMP echo)...";
                case 1 -> "[INFO] Analyzing packet loss and latency metrics...";
                case 2 -> "[INFO] Checking upstream/downstream SNR levels...";
                case 3 -> "[INFO] Running DOCSIS channel bonding verification...";
                case 4 -> "[SUCCESS] Line diagnostic passed. Signal within normal parameters.";
                default -> "[INFO] Diagnostic step " + (stepIndex + 1) + " completed.";
            };
        } else if ("FIRMWARE_UPGRADE".equals(type)) {
            return switch (stepIndex) {
                case 0 -> "[INFO] Connecting to customer modem for " + request.getCustomerAccount() + "...";
                case 1 -> "[INFO] Downloading firmware payload v4.2.1 from vendor server...";
                case 2 -> "[WARN] Connection unstable. Retrying flash sequence...";
                case 3 -> "[INFO] Flash successful. Initiating remote reboot...";
                case 4 -> "[SUCCESS] Modem online. Firmware version verified.";
                default -> "[INFO] Upgrade step " + (stepIndex + 1) + " completed.";
            };
        } else if ("NETWORK_PROVISION".equals(type)) {
            return switch (stepIndex) {
                case 0 -> "[INFO] Validating MAC address format...";
                case 1 -> "[INFO] Allocating dynamic IP from DHCP pool...";
                case 2 -> "[INFO] Pushing configuration to local neighborhood switch...";
                case 3 -> "[INFO] Testing automated radius authentication...";
                case 4 -> "[SUCCESS] Provisioning complete. Account activated on network.";
                default -> "[INFO] Provisioning step " + (stepIndex + 1) + " completed.";
            };
        } else {
            return (stepIndex == TOTAL_STEPS - 1)
                    ? "[SUCCESS] Task completed."
                    : "[INFO] Running generic system background task step " + (stepIndex + 1) + "...";
        }
    }

    /**
     * Simulates a multi-step diagnostic by re-fetching the entity from the database
     * on each step to avoid mutating shared state across threads.
     */
    private Flux<Void> simulateDiagnosticAsync(UUID requestId, User user) {
        // Step 0: Transition to PROCESSING
        return requestRepository.findById(requestId)
                .flatMap(request -> {
                    request.setRequestStatus(RequestStatus.PROCESSING);
                    request.setUpdatedAt(ZonedDateTime.now());
                    
                    String startMsg = "[START] Initializing " + request.getRequestType() + " for " + request.getCustomerAccount() + "...";
                    return requestRepository.save(request)
                            .flatMap(saved -> notificationService.broadcastUpdate(
                                    saved, user.getUsername(), startMsg));
                })
                .thenMany(Flux.interval(STEP_INTERVAL)
                        .take(TOTAL_STEPS)
                        .concatMap(step -> requestRepository.findById(requestId)
                                .flatMap(freshRequest -> {
                                    int progress = (int) ((step + 1) * (100 / TOTAL_STEPS));
                                    freshRequest.setProgress(progress);
                                    freshRequest.setUpdatedAt(ZonedDateTime.now());

                                    final boolean isComplete = progress >= 100;
                                    final String logMessage = getLogMessageForStep(freshRequest, step.intValue());

                                    if (isComplete) {
                                        freshRequest.setRequestStatus(RequestStatus.COMPLETED);
                                    }

                                    log.debug("Request '{}' progress: {}%", requestId, progress);

                                    return requestRepository.save(freshRequest)
                                            .flatMap(saved -> notificationService.broadcastUpdate(
                                                    saved, user.getUsername(), logMessage));
                                })
                        )
                        .doFinally(signalType -> {
                            activeTasks.remove(requestId);
                            log.info("Diagnostic task for request '{}' finished with signal: {}", requestId, signalType);
                        })
                );
    }
}

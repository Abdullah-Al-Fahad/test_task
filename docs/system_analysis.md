# System Analysis Document
## Real-Time Service Request Management System (NexusFiber ISP Diagnostic Portal)

---

## 1. Problem Statement
Growing service organizations, such as Internet Service Providers (ISPs), currently manage customer technical operations and service requests manually (e.g., via phone calls, spreadsheets, or ticketing systems without live execution feedback). This creates severe operational bottlenecks:
- Delayed status updates across dispatch teams and management.
- Zero real-time visibility into the step-by-step progress of long-running operations (line tests, remote modem flashes, fiber provisioning).
- Inability to handle multiple asynchronous diagnostics simultaneously without blocking support staff.
- Supervisors lack a centralized, real-time command dashboard to oversee fleet-wide operations, identify failures, or intervene when jobs stall.

---

## 2. Business Objectives
- **Automate and Streamline Diagnostics**: Enable operators to trigger automated network diagnostics and provisioning routines instantly.
- **Fleet-Wide Real-Time Visibility**: Provide live status updates, completion metrics, and step-by-step execution logs without manual polling or browser refreshes.
- **Role-Based Operational Integrity**: Enforce strict separation between field operators (who initiate and monitor their own diagnostic requests) and operations supervisors (who hold system-wide oversight and administrative cancellation authority).
- **Zero-Block Asynchronous Execution**: Ensure backend API responsiveness remains under 50ms while background execution jobs process concurrently.
- **Auditability and Traceability**: Maintain a persistent, searchable record of all historical operations, outcomes, and execution logs.

---

## 3. Users & Stakeholders
1. **Operators (Field Technicians & Support Specialists)**:
   - Authenticate into the platform.
   - Initiate specific diagnostic requests against customer account IDs (`Line Diagnostic Test`, `Remote Firmware Upgrade`, `Network Provisioning`).
   - Monitor real-time progress percentages and terminal logs for their active jobs.
   - Cancel running jobs if customer context changes or manual intervention is needed.
   - Search and filter their active and completed service requests.

2. **Supervisors (Operations Leads & NOC Managers)**:
   - Elevated access with administrative overview across all operators and all customer requests.
   - Live oversight of all concurrent background jobs running in the system.
   - Global cancellation authority to terminate stalled or faulty worker processes immediately.
   - Advanced search, filtering by status and operation type, and diagnostic log inspection.

---

## 4. Scope
### In Scope:
- User authentication and role-based access control (Operator vs. Supervisor) via JSON Web Tokens (JWT).
- Submission and validation of ISP diagnostic requests (`customer_account`, `request_type`).
- Asynchronous execution engine powered by distributed worker pools (Celery + Redis).
- Live push communication over WebSockets (Django Channels + Redis Channel Layer).
- Dynamic, multi-stage simulated diagnostic workflows with real-time terminal output.
- Instant task cancellation with worker process revocation (`SIGKILL` signal termination).
- Client-side state synchronization, real-time progress indicators, and multi-parameter filtering.
- Full containerization using Docker and Docker Compose.

### Out of Scope:
- Direct physical hardware serial communication with proprietary optical line terminals (OLTs) or DSLAMs (simulated via high-fidelity asynchronous task pipelines).
- Billing and financial invoice integration.
- Public customer self-service access.

---

## 5. Assumptions
1. Long-running diagnostic workflows are inherently asynchronous and I/O-bound, requiring offloading to background worker queues.
2. The network supports persistent duplex TCP connections (WebSockets) between the client and server.
3. The message broker (Redis) is highly available and provides low-latency pub/sub message distribution.
4. Clients securely store JWT tokens in memory/local storage to maintain active sessions.

---

## 6. Functional Requirements (FR)

| ID | Requirement | Description | Actors |
|---|---|---|---|
| **FR-1** | **User Authentication** | System allows users to authenticate using username/password and receives signed JWT access & refresh tokens with embedded role claims. | Operator, Supervisor |
| **FR-2** | **Role-Based Access Control** | Operators only access their own submitted requests; Supervisors view all system-wide operations. | System |
| **FR-3** | **Submit Service Request** | Operators submit a diagnostic request specifying `customer_account` and `request_type`. | Operator |
| **FR-4** | **Instant Queue Feedback** | On submission, the system validates the payload, creates a persistent DB record, and immediately broadcasts a `[QUEUED]` WebSocket event to connected clients. | System |
| **FR-5** | **Concurrent Processing** | Long-running operations execute asynchronously in background worker processes without blocking HTTP requests. | Worker Pool |
| **FR-6** | **Live WebSocket Streaming** | Workers publish execution milestones, percentage progress, and diagnostic log lines in real time to connected users without polling. | System, Clients |
| **FR-7** | **Task Cancellation** | Operators and Supervisors can cancel pending or processing tasks; the backend immediately revokes the Celery task and updates state to `CANCELLED`. | Operator, Supervisor |
| **FR-8** | **Search & Filtering** | Users can search requests by customer account ID, filter by status (Pending, Processing, Completed, Failed, Cancelled), and filter by request type. | Operator, Supervisor |
| **FR-9** | **Live Terminal Log Inspection** | Each request card renders a collapsable/scrollable real-time diagnostic terminal displaying timestamped log events as they occur. | Operator, Supervisor |

---

## 7. Non-Functional Requirements (NFR)

### 7.1 Performance
- **API Response Latency**: HTTP POST request submission must respond within < 100ms by delegating execution to the Celery worker queue immediately.
- **WebSocket Broadcast Latency**: Event distribution from Celery to connected browser clients must occur in < 50ms via Redis pub/sub.
- **Database Query Efficiency**: Database query counts for list views must remain constant (O(1)) regardless of row count, enforced via eager loading (`select_related('operator')`).

### 7.2 Scalability
- **Horizontal Worker Scaling**: Background processing capacity can scale horizontally by adding Celery worker nodes without modifying application code.
- **Stateless Application Servers**: Django ASGI and Next.js frontend instances are stateless and can run behind an ingress load balancer.
- **Separation of Concerns**: Redis isolates Celery task broker queues (DB 0) from Channels pub/sub messaging (DB 1) to prevent resource contention under high volume.

### 7.3 Reliability & Availability
- **Container Health & Auto-Recovery**: Multi-container Docker infrastructure defines health checks (`pg_isready`, `redis-cli ping`) with auto-restarts to guarantee continuous system availability.
- **Task Acknowledgment**: Celery tasks use `acks_late=True` so if a worker crashes midway, tasks can be re-queued or safely handled.
- **Auto-Reconnection**: The client WebSocket hook implements exponential backoff reconnection (`1s, 2s, 4s, ... 30s`) to recover automatically from intermittent network disruptions.
- **Graceful Error Handling**: Unhandled task exceptions transition request status to `FAILED` and stream error logs rather than silently dropping out.

### 7.4 Security
- **Stateless JWT Authentication**: All REST endpoints and WebSocket handshakes require valid cryptographically signed JWT tokens.
- **Role Scoping**: Object-level permissions prevent operators from accessing or canceling jobs belonging to other operators.
- **Input Sanitization**: DRF serializers rigorously validate account strings and enumerated choice fields before database entry.

### 7.5 Maintainability & Code Quality
- **Layered Architecture**: Strict separation of concerns: Views (HTTP serialization) → Services (Business rules) → Tasks (Asynchronous worker execution) → Models (Persistence).
- **Type Safety**: Python type hints in backend and TypeScript interfaces in frontend ensure end-to-end contract consistency.
- **Automated Test Coverage**: 100% passing automated test suite covering models, service rules, permission boundaries, and API endpoints.

### 7.6 Usability & Responsiveness
- **Minimalist Enterprise Aesthetics**: High-contrast, clean UI designed for low cognitive overhead in Network Operations Center (NOC) environments.
- **Fluid Micro-Animations**: Smooth Framer Motion transitions for state badges, progress bars, and log terminals.

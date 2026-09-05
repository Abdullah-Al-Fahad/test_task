# System Design Document
## Real-Time Service Request Management System (NexusFiber Architecture)

---

## 1. High-Level Architecture
The system adopts an event-driven, decoupled client-server architecture composed of five primary tiers:
1. **Presentation Tier**: Next.js (App Router) client with Tailwind CSS, Framer Motion, and Zustand state store.
2. **Gateway / API Tier**: Django REST Framework (DRF) running under Daphne (ASGI) for unified HTTP and WebSocket handling.
3. **Event Broker & Pub/Sub**: Redis in-memory broker orchestrating asynchronous message passing.
4. **Asynchronous Execution Pool**: Celery distributed worker pool executing concurrent long-running diagnostics.
5. **Persistence Tier**: PostgreSQL relational database with index optimization.

```mermaid
graph TD
    subgraph Client [Frontend Tier - Next.js]
        Browser[Operator / Supervisor Browser]
        Store[Zustand Store]
        WSClient[useWebSocket Hook]
        Browser --> Store
        WSClient --> Store
    end

    subgraph Gateway [ASGI Ingress - Daphne :8000]
        Router[Protocol Router]
        HTTPHandler[Django REST Framework]
        WSHandler[Django Channels Consumer]
        Router -- /api/* --> HTTPHandler
        Router -- /ws/* --> WSHandler
    end

    subgraph Broker [Redis :6379]
        CeleryQueue[Celery Broker DB 0]
        ChannelLayer[Channels Pub/Sub DB 1]
    end

    subgraph Workers [Background Worker Pool - Celery]
        W1[Celery Worker Process 1]
        W2[Celery Worker Process 2]
        W3[Celery Worker Process 3]
        W4[Celery Worker Process 4]
    end

    subgraph Storage [Relational Persistence]
        DB[(PostgreSQL :5432)]
    end

    Browser -- REST HTTP (JWT) --> Router
    WSClient -- Persistent WS (JWT) --> Router

    HTTPHandler -- Read / Write --> DB
    HTTPHandler -- Enqueue Task --> CeleryQueue
    HTTPHandler -- Broadcast Queued --> ChannelLayer

    CeleryQueue -- Distribute Job --> Workers
    Workers -- Update Progress --> DB
    Workers -- Publish Event --> ChannelLayer

    ChannelLayer -- Push Stream --> WSHandler
    WSHandler -- Push Frame --> WSClient
```

---

## 2. Component Diagram
```mermaid
graph LR
    subgraph Frontend Components
        LoginForm[Login Modal]
        NewReqForm[Request Dispatcher Form]
        Filters[Search & Filter Bar]
        Card[RequestCard]
        Terminal[Live Terminal Output]
        Card --> Terminal
    end

    subgraph Backend Layered Structure
        Views[API Views]
        Services[RequestService Business Logic]
        Tasks[Celery Background Tasks]
        Consumers[Channels WebSocket Consumer]
        Models[Django Models / ORM]

        Views --> Services
        Services --> Models
        Services --> Tasks
        Tasks --> Models
        Tasks --> Consumers
    end
```

---

## 3. Database Design (Schema & ERD)

### Entity Relationship Diagram
```mermaid
erDiagram
    USER {
        uuid id PK
        string username UK
        string password_hash
        string role "OPERATOR or SUPERVISOR"
        boolean is_staff
        boolean is_active
        datetime date_joined
    }

    SERVICE_REQUEST {
        uuid id PK
        string customer_account "Indexed"
        string request_type "Indexed (LINE_DIAGNOSTIC, FIRMWARE_UPGRADE, NETWORK_PROVISION)"
        string status "Indexed (PENDING, PROCESSING, COMPLETED, FAILED, CANCELLED)"
        smallint progress "0 to 100"
        datetime created_at "Indexed DESC"
        datetime updated_at
        uuid operator_id FK
    }

    USER ||--o{ SERVICE_REQUEST : "dispatches"
```

### Table Specifications
- **`users_app_user`**: Custom user entity extending AbstractUser. Inherits Django authentication while introducing custom `role` enum (`OPERATOR`, `SUPERVISOR`).
- **`requests_app_servicerequest`**:
  - `id`: Primary key, auto-generated UUIDv4 preventing enumeration attacks.
  - `customer_account`: Varchar(50), indexed for fast lookup during text searches.
  - `request_type`: Varchar(30), constrained via `RequestType` enum choices.
  - `status`: Varchar(20), constrained via `Status` enum choices.
  - `progress`: PositiveSmallIntegerField (0-100).
  - `operator_id`: Foreign key to `users_app_user` with `ON DELETE CASCADE`.
  - `created_at`: Datetime with descending B-tree index for rapid chronological sorting.
  - `updated_at`: Datetime tracking state transitions.

---

## 4. API Design

The API adheres to RESTful conventions, supports optional trailing slashes seamlessly, and uses JWT Bearer tokens in the `Authorization` header.

| Method | Endpoint | Description | Auth Required | Permissions |
|---|---|---|---|---|
| `POST` | `/api/token/` | Obtain access & refresh token pair | Public | Anyone with valid credentials |
| `POST` | `/api/token/refresh/` | Refresh expired access token | Public | Valid refresh token |
| `GET` | `/api/requests/` | List service requests (paginated) | Bearer JWT | Operator sees own; Supervisor sees all |
| `POST` | `/api/requests/` | Submit new diagnostic service request | Bearer JWT | Authenticated Operator or Supervisor |
| `GET` | `/api/requests/{id}/` | Retrieve specific request details | Bearer JWT | Owner or Supervisor |
| `POST` | `/api/requests/{id}/cancel/` | Revoke background task & cancel request | Bearer JWT | Owner or Supervisor |

### Sample Payload: Create Request
```json
// POST /api/requests/
{
  "customer_account": "ACC-9482",
  "request_type": "LINE_DIAGNOSTIC"
}
```

### Sample Response: 201 Created
```json
{
  "id": "b98c8a17-fcff-45cf-9639-dfcf2033dfb1",
  "customer_account": "ACC-9482",
  "request_type": "LINE_DIAGNOSTIC",
  "status": "PENDING",
  "progress": 0,
  "operator_username": "operator1",
  "created_at": "2026-09-05T05:07:50.122091Z",
  "updated_at": "2026-09-05T05:07:50.122101Z"
}
```

---

## 5. WebSocket Communication Flow

```mermaid
sequenceDiagram
    autonumber
    actor Client as Next.js Client
    participant ASGI as Daphne / Channels
    participant Redis as Redis Pub/Sub
    participant DB as PostgreSQL
    participant Worker as Celery Worker

    Client->>ASGI: Connect ws://localhost:8000/ws/requests/?token=<JWT>
    ASGI->>ASGI: Validate JWT token & extract User
    ASGI->>Redis: Subscribe socket to 'requests_updates' group
    ASGI-->>Client: 101 Switching Protocols (Accepted)

    Note over Client, Worker: Request Lifecycle Execution
    Client->>ASGI: POST /api/requests/ (Create Request)
    ASGI->>DB: Save ServiceRequest (status=PENDING)
    ASGI->>Redis: Publish [QUEUED] event to 'requests_updates'
    ASGI->>Redis: Enqueue Celery task (apply_async)
    Redis-->>ASGI: Broadcast [QUEUED] event
    ASGI-->>Client: WebSocket push: status=PENDING, progress=0
    
    Worker->>Redis: Pop task from Celery queue
    Worker->>DB: Update status=PROCESSING, progress=5
    Worker->>Redis: Publish [START] log event
    Redis-->>ASGI: Broadcast [START]
    ASGI-->>Client: WebSocket push: status=PROCESSING, log="[START] Initializing..."

    loop Multi-Stage Diagnostics (20%, 40%, 60%, 80%, 100%)
        Worker->>DB: Update progress % & timestamp
        Worker->>Redis: Publish progress & diagnostic log line
        Redis-->>ASGI: Broadcast milestone
        ASGI-->>Client: WebSocket push: updated progress + new terminal log line
    end

    Worker->>DB: Update status=COMPLETED, progress=100
    Worker->>Redis: Publish final COMPLETED state
    Redis-->>ASGI: Broadcast COMPLETED
    ASGI-->>Client: WebSocket push: status=COMPLETED
```

---

## 6. Concurrency Model
1. **Asynchronous Non-Blocking Web Layer**:
   - Daphne runs an ASGI event loop capable of holding thousands of persistent WebSocket connections concurrently with negligible CPU/memory footprint.
2. **Dedicated Background Worker Pool**:
   - Celery operates a prefork worker pool (`--concurrency=4`).
   - Long-running operations simulate real-world physical latency (ICMP ping loss, SNR analysis, firmware flashing) without blocking the incoming API or WebSocket channels.
3. **Fair Dispatching via Prefetch Limitation**:
   - `CELERY_WORKER_PREFETCH_MULTIPLIER = 1` and `CELERY_TASK_ACKS_LATE = True` ensure tasks are distributed evenly across idle workers rather than monopolized by a single worker process.
4. **Immediate Task Revocation**:
   - The cancel flow leverages Celery's remote control broadcast (`app.control.revoke(task_id, terminate=True, signal='SIGKILL')`), abruptly halting the running subprocess and freeing the worker immediately.

---

## 7. Technology Stack Justification

| Layer | Selected Tech | Alternatives Considered | Rationale |
|---|---|---|---|
| **Frontend Framework** | **Next.js 16 (React 19)** | Plain React (Vite), Angular | Next.js App Router provides optimized compilation (Turbopack), server-driven routing, clean build artifacts, and enterprise-grade developer experience. |
| **Styling** | **Tailwind CSS v3** | CSS Modules, Styled Components | Utility-first CSS enables atomic styling for the dark minimalist NOC dashboard, ensuring consistent spacing, typography, and responsive breakpoints. |
| **State Management** | **Zustand** | Redux, Context API | Zustand provides minimal boilerplate, zero re-render overhead for rapid WebSocket updates, and native support for selective partial persistence. |
| **Animations** | **Framer Motion** | CSS Keyframes | Provides spring physics, layout animations, and exit transitions for smoothly reorganizing cards during real-time sorting and filtering. |
| **Backend Framework** | **Django 6 + DRF** | FastAPI, Express.js | Django provides an enterprise-ready ORM, built-in migration management, production admin portal, robust security middlewares, and seamless integration with Channels. |
| **Real-Time Protocol** | **Django Channels 4 (ASGI)** | Socket.io, Server-Sent Events (SSE) | Full duplex WebSocket communication allows bi-directional communication, native Redis channel layering, and unified authentication with Django’s user model. |
| **Task Queue** | **Celery 5.6** | RQ, BackgroundTasks | Industry standard for distributed task execution in Python; provides worker prefork pools, remote task revocation, retries, and comprehensive monitoring. |
| **Broker / In-Memory** | **Redis 7** | RabbitMQ, Kafka | Lightweight, blazing fast in-memory store that simultaneously serves as the Celery task broker and the Django Channels pub/sub distributed channel layer. |
| **Database** | **PostgreSQL 15** | MySQL, SQLite | Robust ACID compliance, native UUID support, advanced indexing, and proven reliability for concurrent read/write workloads. |
| **Containerization** | **Docker Compose** | Bare Metal, Podman | One-command orchestration (`docker-compose up --build`) ensuring 100% reproducible environments across developer machines and evaluation reviewers. |

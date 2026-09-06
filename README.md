# NexusFiber — Real-Time Service Request Management System

> **Enterprise-grade, full-stack real-time diagnostic and service request management system designed for Internet Service Providers (ISPs).**  
> Features asynchronous worker execution, persistent full-duplex WebSockets, role-based access control, task cancellation, multi-parameter search/filtering, and automated test coverage.

---

## 📑 Required Deliverables & Documentation
- 📘 **[System Analysis Document (Deliverable 1)](docs/system_analysis.md)**: Business objectives, user personas, assumptions, scope, functional requirements, and justified non-functional requirements (Performance, Scalability, Reliability, Security, Maintainability).
- 📐 **[System Design Document (Deliverable 2)](docs/system_design.md)**: High-level architecture, component diagrams, database schema & ERD, API contracts, WebSocket communication flow, concurrency model, and technology stack justifications.
- 📊 **[Architecture Diagrams & Visual Flows](docs/architecture_diagrams.md)**: Visual sequence diagrams, component topologies, and database entity relationships.

---

## 🏗️ Architecture Overview

The system implements an event-driven, decoupled architecture ensuring that long-running operations never block client requests:

```
[Next.js Client] <==== (WebSockets /ws/requests/) =====> [Daphne ASGI Server]
       |                                                         |
  (HTTP REST)                                               (ORM / SQL)
       v                                                         v
[Django REST Framework] ===== (Task Enqueue) =====> [Redis Broker] ====> [PostgreSQL DB]
                                                         |
                                            (Task Distribution / Event PubSub)
                                                         v
                                              [Celery Worker Pool (x4)]
```

1. **Presentation Layer (Next.js 16 + React 19 + Tailwind CSS + Zustand)**:
   - Minimalist enterprise NOC dashboard with dark/light mode.
   - Real-time state synchronization via custom auto-reconnecting WebSocket hooks.
   - Live embedded terminal log viewer streaming step-by-step diagnostic milestones.
2. **Gateway & API Layer (Django REST Framework + Django Channels + Daphne ASGI)**:
   - Unified HTTP and WebSocket termination under ASGI.
   - Strict layered architecture (`Views` → `Services` → `Tasks` → `Models`).
   - JWT stateless authentication with role-based scoping (`OPERATOR` vs. `SUPERVISOR`).
3. **Event Broker & Pub/Sub (Redis 7)**:
   - Isolated Redis DB 0 for Celery task queuing and result backends.
   - Isolated Redis DB 1 for Django Channels distributed pub/sub channel layer.
4. **Asynchronous Worker Pool (Celery 5.6)**:
   - Prefork worker pool (`concurrency=4`, `prefetch_multiplier=1`, `acks_late=True`) ensuring fair, non-blocking parallel execution.
   - Immediate worker task revocation (`SIGKILL`) for real-time task cancellation.
5. **Persistence Layer (PostgreSQL 15)**:
   - ACID-compliant storage with B-tree indices on `status`, `request_type`, `customer_account`, and `created_at`.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 19, Next.js 16 (App Router), Tailwind CSS v3, Framer Motion, Zustand, Lucide Icons |
| **Backend** | Python 3.12, Django 6, Django REST Framework, Django Channels 4, Daphne (ASGI) |
| **Authentication** | SimpleJWT (stateless Bearer tokens with role claims) |
| **Concurrency & Queuing** | Celery 5.6, Redis 7 (prefork worker pool) |
| **Database** | PostgreSQL 15 |
| **DevOps & CI/CD** | Docker, Docker Compose, GitHub Actions CI Pipeline |
| **Testing** | Pytest, Pytest-Django |

---

## 💡 Assumptions & Design Decisions
1. **Asynchronous Non-Blocking Execution**: Long-running diagnostic routines (line tests, firmware upgrades, provisioning) simulate real-world ISP hardware latencies. They execute strictly in Celery background workers to keep API response times under 50ms.
2. **WebSockets Over Polling**: Live updates, completion percentages, and streaming log messages are pushed directly to clients over persistent WebSockets via Daphne ASGI and Redis Pub/Sub. No polling is used.
3. **Stateless JWT Security**: REST endpoints use `Authorization: Bearer <token>` headers. WebSockets authenticate using token query parameters during handshake (`/ws/requests/?token=<access_token>`).
4. **Redis Channel & Queue Isolation**: Redis DB 0 handles Celery task broker queues, while Redis DB 1 handles Django Channels real-time event broadcasting, preventing resource contention.
5. **Strict Role Boundaries**: Operators only view and cancel their own submitted requests; Supervisors possess complete administrative visibility and global cancellation power.

---

## 🗄️ Database Setup & Migrations

The database is pre-configured to run migrations automatically upon startup in Docker. For explicit database management:

### 1. Execute Schema Migrations:
```bash
# Inside Docker container
docker compose exec backend python manage.py migrate

# Or on local system
cd backend && python manage.py migrate
```

### 2. Seed Demo Operator & Supervisor Accounts:
```bash
# Inside Docker container
docker compose exec backend python manage.py seed_demo_users

# Or on local system
cd backend && python manage.py seed_demo_users
```

### 3. Database Schema Design:
- **`users_app_user`**: Custom UUID primary-key user model with `role` enum (`OPERATOR`, `SUPERVISOR`).
- **`requests_app_servicerequest`**: Stores diagnostic tasks with foreign key to operator, progress integer (0–100), and B-tree indexes on `status`, `request_type`, `customer_account`, and `created_at`.

---

## 🚀 Quick Start (Docker Compose)

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running.

### 1. Launch All Services
From the project root directory, run:
```bash
docker compose up --build
```
This automatically initializes:
- PostgreSQL (`localhost:5432`)
- Redis Broker (`localhost:6379`)
- Django ASGI Backend (`http://localhost:8000`)
- Celery Background Worker Pool (4 concurrent workers)
- Next.js Frontend Dashboard (`http://localhost:3000`)

### 2. Access the Application
Open your browser at **`http://localhost:3000`**.

### 3. Demo Credentials

| Role | Username | Password | Capabilities |
|---|---|---|---|
| **Operator** | `operator1` | `password123` | Submit diagnostics, monitor personal tasks, cancel active jobs |
| **Supervisor** | `supervisor1` | `password123` | Fleet-wide visibility, live real-time monitoring, administrative cancellation |

*(The Django Admin portal is accessible at `http://localhost:8000/admin/` using the supervisor credentials).*
 
---
 
### 💻 Manual Run Instructions (Without Docker)
If running services directly on the host machine:
1. **Start PostgreSQL 15 & Redis 7** services locally.
2. **Backend**:
   ```bash
   cd backend
   python -m venv venv && source venv/bin/activate
   pip install -r requirements.txt
   python manage.py migrate
   python manage.py seed_demo_users
   daphne -b 0.0.0.0 -p 8000 core.asgi:application
   ```
3. **Celery Worker** (in separate shell):
   ```bash
   cd backend && source venv/bin/activate
   celery -A core worker --loglevel=info --concurrency=4
   ```
4. **Frontend Dashboard** (in separate shell):
   ```bash
   cd frontend && npm install && npm run dev
   ```

---

## 🔌 API Reference

All requests must supply `Authorization: Bearer <access_token>` in the header (except `/api/token/`).

### Authentication
#### `POST /api/token/`
Exchange credentials for JWT access and refresh tokens.
```json
{
  "username": "operator1",
  "password": "password123"
}
```

#### `POST /api/register/`
Create a new user account with role assignment (`OPERATOR` or `SUPERVISOR`).
```json
{
  "username": "new_operator",
  "password": "strong_password123",
  "role": "OPERATOR"
}
```

### Service Requests
#### `GET /api/requests/`
Returns paginated service requests. Automatically filtered by role (Supervisors see all; Operators see only their own).

#### `POST /api/requests/`
Dispatches a new diagnostic background task.
```json
{
  "customer_account": "ACC-9402",
  "request_type": "LINE_DIAGNOSTIC"
}
```
*Supported `request_type` choices:*
- `LINE_DIAGNOSTIC`: Modem ping, latency, packet loss, SNR levels, DOCSIS verification.
- `FIRMWARE_UPGRADE`: Modem payload download, flash sequence, remote reboot verification.
- `NETWORK_PROVISION`: MAC validation, DHCP IP allocation, switch port provisioning, radius auth.

*Response:* `201 Created` with initial status `PENDING` and progress `0`.

#### `POST /api/requests/{id}/cancel/`
Revokes the running Celery worker task via remote signal (`SIGKILL`) and transitions database status to `CANCELLED`.
*Response:* `200 OK`

### System Health & Observability
#### `GET /api/health/`
Public observability endpoint verifying PostgreSQL database connectivity and Redis channel layer responsiveness.
```json
{
  "status": "healthy",
  "timestamp": 1788590848.11,
  "services": {
    "database": "connected",
    "redis_channels": "connected"
  }
}
```

#### `GET /metrics`
Prometheus open-metrics endpoint instrumented via `django-prometheus`. Exports real-time request counts by HTTP method, response status codes, p95/p99 request latencies, and database query executions.

---

## ⚡ Real-Time WebSocket Events

- **Endpoint:** `ws://localhost:8000/ws/requests/?token=<access_token>`
- **Authentication:** Token query parameter verified during the WebSocket handshake. Unauthenticated connections are rejected with code `4001`.
- **Event Distribution:** Pushed directly from Celery worker milestones via Redis pub/sub — **zero client polling**.

### Event Payload Schema:
```json
{
  "type": "update",
  "data": {
    "id": "b98c8a17-fcff-45cf-9639-dfcf2033dfb1",
    "customer_account": "ACC-9402",
    "request_type": "LINE_DIAGNOSTIC",
    "status": "PROCESSING",
    "progress": 40,
    "operator_username": "operator1",
    "log_message": "[INFO] Analyzing packet loss and latency metrics..."
  }
}
```

---

## 🧪 Automated Testing

The backend includes a comprehensive unit and integration test suite covering models, service rules, role-based authorization, cancellation logic, and N+1 query prevention.

To run tests inside the container:
```bash
docker compose exec backend pytest -v
```

### Test Coverage Highlights:
- **Model Integrity**: Status transitions, terminal state evaluation (`COMPLETED`, `FAILED`, `CANCELLED`).
- **Service Isolation**: Scoped queries (Operator vs. Supervisor) and `select_related` validation.
- **API Security**: Authentication boundaries, input validation, HTTP method restrictions (405 on PUT/DELETE).
- **Cancellation Flow**: Task revocation mocking and state transitions.
- **System Observability**: Public `/api/health/` endpoint verifying DB & Redis availability.

---

## 🏆 Bonus Considerations Implemented
- ✅ **Automated Testing**: 100% passing Pytest suite (21 unit & integration tests).
- ✅ **Authentication & Authorization**: Stateless SimpleJWT with custom user role enforcement.
- ✅ **Role-Based Access Control**: Strict multi-tenant operational boundary between Operators and Supervisors.
- ✅ **Docker Containerization**: Multi-stage, production-ready `docker-compose.yml` with health checks.
- ✅ **CI/CD Pipeline**: GitHub Actions workflow (`.github/workflows/ci.yml`) running backend tests and frontend builds on every commit.
- ✅ **Monitoring & Structured Logging**: Standardized timestamped console log formatters in `settings.py`, active task log streaming, dedicated `/api/health/` service health probe, and Prometheus OpenMetrics exporter (`/metrics`).
- ✅ **Advanced Search & Filtering**: Multi-condition live client-side filtering by account ID, status, and request type.
- ✅ **Real-Time Terminal Streaming**: Live string log updates rendered inside expandable terminal consoles.

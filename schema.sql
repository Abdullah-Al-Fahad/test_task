-- ============================================================
-- NexusFiber WebFlux — Database Schema
-- Designed for Spring Data R2DBC with PostgreSQL
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop legacy tables if migrating from a previous schema
DROP TABLE IF EXISTS service_requests CASCADE;
DROP TABLE IF EXISTS users CASCADE;
-- Drop legacy Django tables if they exist
DROP TABLE IF EXISTS requests_app_servicerequest CASCADE;
DROP TABLE IF EXISTS users_app_user CASCADE;

CREATE TABLE users (
    id          BIGSERIAL PRIMARY KEY,
    username    VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(128) NOT NULL,
    role        VARCHAR(20)  NOT NULL DEFAULT 'OPERATOR',
    is_active   BOOLEAN      NOT NULL DEFAULT true,
    date_joined TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE service_requests (
    id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_account VARCHAR(50) NOT NULL,
    request_type     VARCHAR(50) NOT NULL,
    status           VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    progress         SMALLINT    NOT NULL DEFAULT 0,
    operator_id      BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Performance indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_sr_operator   ON service_requests(operator_id);
CREATE INDEX IF NOT EXISTS idx_sr_status     ON service_requests(status);
CREATE INDEX IF NOT EXISTS idx_sr_created_at ON service_requests(created_at DESC);

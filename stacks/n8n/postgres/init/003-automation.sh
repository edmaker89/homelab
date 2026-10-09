#!/usr/bin/env bash
set +x
set -Eeuo pipefail
: "${AUTOMATION_DB_PASSWORD:?AUTOMATION_DB_PASSWORD is required}"
# Fresh PGDATA only. Existing installations use playbooks/postgres-automation.yml.
psql -X -q -v ON_ERROR_STOP=1 -U "${POSTGRES_USER:-postgres}" -d postgres <<'SQL'
SET log_statement = 'none';
SET log_min_duration_statement = -1;
SET log_min_duration_sample = -1;
SET log_transaction_sample_rate = 0;
SET log_min_error_statement = 'panic';
\getenv automation_password AUTOMATION_DB_PASSWORD
SELECT 'CREATE ROLE automation_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS'
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname='automation_app') \gexec
ALTER ROLE automation_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD :'automation_password';
SELECT 'CREATE DATABASE automation OWNER automation_app'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname='automation') \gexec
ALTER DATABASE automation OWNER TO automation_app;
\connect automation
CREATE SCHEMA IF NOT EXISTS specialist AUTHORIZATION automation_app;
ALTER SCHEMA specialist OWNER TO automation_app;
SQL

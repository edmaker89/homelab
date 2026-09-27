#!/usr/bin/env bash
set -Eeuo pipefail

: "${POSTGRES_USER:=postgres}"

: "${N8N_DB_NAME:=n8n}"
: "${N8N_DB_USER:=n8n_app}"
: "${N8N_DB_PASSWORD:?N8N_DB_PASSWORD is required}"

: "${RAG_DB_NAME:=rag}"
: "${RAG_DB_USER:=rag_app}"
: "${RAG_DB_PASSWORD:?RAG_DB_PASSWORD is required}"

PSQL=(
  psql
  -X
  --set=ON_ERROR_STOP=1
  --username "$POSTGRES_USER"
  --dbname postgres
)

role_exists() {
  local role="$1"

  "${PSQL[@]}" \
    --tuples-only \
    --no-align \
    --set="role=$role" <<'SQL' | grep -qx '1'
SELECT 1
FROM pg_roles
WHERE rolname = :'role';
SQL
}

database_exists() {
  local database="$1"

  "${PSQL[@]}" \
    --tuples-only \
    --no-align \
    --set="database=$database" <<'SQL' | grep -qx '1'
SELECT 1
FROM pg_database
WHERE datname = :'database';
SQL
}

ensure_role() {
  local role="$1"
  local password="$2"

  if role_exists "$role"; then
    echo "Role ${role} already exists; reconciling attributes."
  else
    echo "Creating role ${role}."

    BOOTSTRAP_ROLE_PASSWORD="$password" \
    "${PSQL[@]}" \
      --set="role=$role" <<'SQL'
\getenv role_password BOOTSTRAP_ROLE_PASSWORD

CREATE ROLE :"role"
WITH
  LOGIN
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  NOREPLICATION
  NOBYPASSRLS
  PASSWORD :'role_password';
SQL
  fi

  BOOTSTRAP_ROLE_PASSWORD="$password" \
  "${PSQL[@]}" \
    --set="role=$role" <<'SQL'
\getenv role_password BOOTSTRAP_ROLE_PASSWORD

ALTER ROLE :"role"
WITH
  LOGIN
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  NOREPLICATION
  NOBYPASSRLS
  PASSWORD :'role_password';
SQL
}

ensure_database() {
  local database="$1"
  local owner="$2"

  if database_exists "$database"; then
    echo "Database ${database} already exists; reconciling owner."

    "${PSQL[@]}" \
      --set="database=$database" \
      --set="owner=$owner" <<'SQL'
ALTER DATABASE :"database" OWNER TO :"owner";
SQL
  else
    echo "Creating database ${database} owned by ${owner}."

    "${PSQL[@]}" \
      --set="database=$database" \
      --set="owner=$owner" <<'SQL'
CREATE DATABASE :"database" OWNER :"owner";
SQL
  fi
}

ensure_role "$N8N_DB_USER" "$N8N_DB_PASSWORD"
ensure_role "$RAG_DB_USER" "$RAG_DB_PASSWORD"

ensure_database "$N8N_DB_NAME" "$N8N_DB_USER"
ensure_database "$RAG_DB_NAME" "$RAG_DB_USER"

echo "Database bootstrap completed."
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
  --set=ON_ERROR_STOP=1
  --username "$POSTGRES_USER"
  --dbname postgres
)

role_exists() {
  "${PSQL[@]}" \
    --tuples-only \
    --no-align \
    --command "SELECT 1 FROM pg_roles WHERE rolname = :'role'" \
    --set="role=$1" \
    | grep -qx '1'
}

database_exists() {
  "${PSQL[@]}" \
    --tuples-only \
    --no-align \
    --command "SELECT 1 FROM pg_database WHERE datname = :'database'" \
    --set="database=$1" \
    | grep -qx '1'
}

ensure_role() {
  local role="$1"
  local password="$2"

  if role_exists "$role"; then
    echo "Role ${role} already exists; reconciling attributes."
  else
    echo "Creating role ${role}."

    "${PSQL[@]}" \
      --set="role=$role" \
      --set="password=$password" \
      --command '
        CREATE ROLE :"role"
        WITH
          LOGIN
          NOSUPERUSER
          NOCREATEDB
          NOCREATEROLE
          NOREPLICATION
          NOBYPASSRLS
          PASSWORD :'\''password'\'';
      '
  fi

  "${PSQL[@]}" \
    --set="role=$role" \
    --set="password=$password" \
    --command '
      ALTER ROLE :"role"
      WITH
        LOGIN
        NOSUPERUSER
        NOCREATEDB
        NOCREATEROLE
        NOREPLICATION
        NOBYPASSRLS
        PASSWORD :'\''password'\'';
    '
}

ensure_database() {
  local database="$1"
  local owner="$2"

  if database_exists "$database"; then
    echo "Database ${database} already exists; reconciling owner."

    "${PSQL[@]}" \
      --set="database=$database" \
      --set="owner=$owner" \
      --command 'ALTER DATABASE :"database" OWNER TO :"owner";'
  else
    echo "Creating database ${database} owned by ${owner}."

    "${PSQL[@]}" \
      --set="database=$database" \
      --set="owner=$owner" \
      --command 'CREATE DATABASE :"database" OWNER :"owner";'
  fi
}

ensure_role "$N8N_DB_USER" "$N8N_DB_PASSWORD"
ensure_role "$RAG_DB_USER" "$RAG_DB_PASSWORD"

ensure_database "$N8N_DB_NAME" "$N8N_DB_USER"
ensure_database "$RAG_DB_NAME" "$RAG_DB_USER"

echo "Database bootstrap completed."

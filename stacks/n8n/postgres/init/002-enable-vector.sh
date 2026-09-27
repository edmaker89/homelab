#!/usr/bin/env bash
set -Eeuo pipefail

: "${POSTGRES_USER:=postgres}"
: "${RAG_DB_NAME:=rag}"

echo "Enabling pgvector extension in database ${RAG_DB_NAME}."

psql \
  --set=ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" \
  --dbname "$RAG_DB_NAME" \
  --command 'CREATE EXTENSION IF NOT EXISTS vector;'

echo "pgvector extension enabled."

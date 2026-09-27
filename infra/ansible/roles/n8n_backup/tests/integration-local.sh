#!/usr/bin/env bash
# Linux/root only. Synthetic PostgreSQL + LOCAL Restic; never calls production Compose/R2.
set -Eeuo pipefail
umask 077
[[ $EUID -eq 0 ]]
role=$(cd "$(dirname "$0")/.." && pwd)
work=$(mktemp -d /var/tmp/n8n-backup-integration-XXXXXXXX)
fixture="n8n-backup-fixture-${work##*/}"
cleanup() {
    local rc=$?
    trap - EXIT
    docker rm -fv "$fixture" >/dev/null 2>&1 || true
    # Restore-test owns/cleans its own labeled temporary volume and container.
    rm -rf -- "$work"
    exit "$rc"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
mkdir -m 0700 "$work/staging" "$work/app" "$work/cache"
printf 'synthetic app file\n' > "$work/app/data.txt"
# Synthetic fixtures cover config and every previously excluded generic pattern.
mkdir -p "$work/app/.ssh" "$work/app/secrets"
for file in config .env .env.local cert.pem private.key .ssh/fixture secrets/fixture r2.env restic-password; do
    printf 'synthetic app state\n' > "$work/app/$file"
done
python3 - "$work/password" <<'PYPASS'
import pathlib, secrets, sys
pathlib.Path(sys.argv[1]).write_text(secrets.token_urlsafe(32))
PYPASS
export RESTIC_REPOSITORY="$work/repository"
export RESTIC_PASSWORD_FILE="$work/password"
export RESTIC_CACHE_DIR="$work/cache"
export GOMAXPROCS=1 GOMEMLIMIT=256MiB
restic init >/dev/null
docker run -d --name "$fixture" --network none --memory 256m --memory-swap 512m --cpus 0.5 \
    -e POSTGRES_HOST_AUTH_METHOD=trust pgvector/pgvector:0.8.6-pg17-trixie >/dev/null
for ((i=0; i<90; i++)); do
    if docker exec "$fixture" sh -c '[ "$(cat /proc/1/comm)" = postgres ]' 2>/dev/null && \
       docker exec "$fixture" pg_isready -U postgres >/dev/null 2>&1; then break; fi
    sleep 2
done
docker exec -i "$fixture" psql -X -v ON_ERROR_STOP=1 -U postgres <<'SQL' >/dev/null
CREATE ROLE n8n_app LOGIN;
CREATE ROLE rag_app LOGIN;
CREATE DATABASE n8n OWNER n8n_app;
CREATE DATABASE rag OWNER rag_app;
\connect n8n
SET ROLE n8n_app;
CREATE TABLE workflows (id integer PRIMARY KEY, name text);
INSERT INTO workflows VALUES (1, 'synthetic fixture');
\connect rag
CREATE EXTENSION vector;
SET ROLE rag_app;
CREATE TABLE embeddings (id integer PRIMARY KEY, embedding vector(3));
INSERT INTO embeddings VALUES (1, '[1,2,3]');
SQL
# Rewrite ONLY the library import in private copies. Production scripts stay unchanged.
python3 - "$role" "$work" "$fixture" <<'PYSETUP'
import pathlib, shlex, sys
role,work=map(pathlib.Path,sys.argv[1:3]); fixture=sys.argv[3]
common='set -Eeuo pipefail\numask 077\n'
for k,v in dict(BACKUP_ROOT=work/'staging',APP_DIR=work/'app',BACKUP_HOST='lab-docker-01',BACKUP_TAG='homelab-n8n',RESTORE_IMAGE='pgvector/pgvector:0.8.6-pg17-trixie',FIXTURE=fixture).items():
    common+=k+'='+shlex.quote(str(v))+'\n'
common+='exec 9>'+shlex.quote(str(work/'lock'))+'\nflock -w 5 9\n'
common+='''repository_ready() { restic snapshots --json >/dev/null; }
pg() { docker exec -i "$FIXTURE" "$@"; }
compose() {
    if [[ $1 == ps ]]; then printf '%s\\n' "$FIXTURE";
    elif [[ $* == 'exec -T n8n n8n --version' ]]; then echo '2.40.7';
    else echo 'Unexpected fixture compose invocation' >&2; return 1; fi
}
'''
(work/'common.sh').write_text(common)
for f in (role/'files').iterdir():
    (work/f.name).write_text(f.read_text().replace('/usr/local/lib/homelab-n8n-backup/common.sh',str(work/'common.sh')))
PYSETUP
bash "$work/homelab-n8n-backup"
# Source is no longer needed. Avoid simultaneous source and restore PostgreSQL RAM.
docker rm -fv "$fixture" >/dev/null
bash "$work/homelab-n8n-restore-test"
restic ls latest --json > "$work/snapshot-files.jsonl"
python3 - "$work" <<'PYASSERT'
import json, pathlib, sys
p=pathlib.Path(sys.argv[1]); nodes=[json.loads(x) for x in (p/'snapshot-files.jsonl').read_text().splitlines()]
paths=[x['path'] for x in nodes if 'path' in x]
assert str(p/'app/data.txt') in paths, paths
for name in ['config', '.env', '.env.local', 'cert.pem', 'private.key', '.ssh/fixture', 'secrets/fixture', 'r2.env', 'restic-password']:
    assert str(p/'app'/name) in paths, (name, paths)
assert not list((p/'staging').iterdir()), 'staging leak'
PYASSERT
bash "$work/homelab-n8n-backup-maintenance"
echo 'PASS: real logical dumps, local Restic backup/restore, pgvector restore-test, complete app state, cleanup and maintenance'

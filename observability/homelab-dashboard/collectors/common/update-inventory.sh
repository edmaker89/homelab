#!/usr/bin/env bash

set -Eeuo pipefail

COLLECTOR="/usr/local/lib/homelab-monitor/inventory.py"
DATA_DIR="/var/lib/homelab-monitor"
FINAL="${DATA_DIR}/inventory.json"

mkdir -p "${DATA_DIR}"

TMP="$(mktemp "${DATA_DIR}/.inventory.json.tmp.XXXXXX")"

cleanup() {
    rm -f "${TMP}"
}

trap cleanup EXIT

"${COLLECTOR}" > "${TMP}"

python3 -m json.tool "${TMP}" >/dev/null

chown root:root "${TMP}"
chmod 0644 "${TMP}"

mv -f "${TMP}" "${FINAL}"

trap - EXIT

#!/usr/bin/env bash

set -Eeuo pipefail

SOURCE="/var/lib/pve-healthcheck/status.json"
ADAPTER="/usr/local/lib/homelab-monitor/status_adapter.py"
DATA_DIR="/var/lib/homelab-monitor"
FINAL="${DATA_DIR}/status.json"

mkdir -p "${DATA_DIR}"

TMP="$(mktemp "${DATA_DIR}/.status.json.tmp.XXXXXX")"

cleanup() {
    rm -f "${TMP}"
}

trap cleanup EXIT

# O systemd.path pode disparar exatamente no momento em que o arquivo
# de origem está sendo atualizado. Fazemos algumas tentativas curtas
# antes de considerar a atualização como falha.
success=0

for attempt in 1 2 3 4 5; do
    if "${ADAPTER}" --source "${SOURCE}" > "${TMP}"; then
        if python3 -m json.tool "${TMP}" >/dev/null 2>&1; then
            success=1
            break
        fi
    fi

    sleep 0.2
done

if [ "${success}" -ne 1 ]; then
    echo "Failed to generate normalized Homelab status" >&2
    exit 1
fi

chown root:root "${TMP}"
chmod 0644 "${TMP}"

mv -f "${TMP}" "${FINAL}"

trap - EXIT

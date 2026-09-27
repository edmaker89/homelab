read -s "PVE_TOKEN_SECRET?Proxmox token secret: "
echo

export PROXMOX_VE_API_TOKEN='terraform@pve!homelab='"${PVE_TOKEN_SECRET}"
unset PVE_TOKEN_SECRET

export PROXMOX_VE_ENDPOINT="https://192.168.15.200:8006/"
export PROXMOX_VE_INSECURE="true"
export SOPS_AGE_KEY_FILE="$HOME/.config/sops/age/keys.txt"
----
export SOPS_AGE_KEY_FILE="$HOME/.config/sops/age/keys.txt"

echo "$PROXMOX_VE_ENDPOINT"
echo "$PROXMOX_VE_INSECURE"

if [[ -n "${PROXMOX_VE_API_TOKEN:-}" ]]; then
  echo "PROXMOX_VE_API_TOKEN loaded"
else
  echo "PROXMOX_VE_API_TOKEN missing"
fi

---
TMP_FILE="$(mktemp)"

HTTP_CODE="$(
  curl -skS \
    -o "${TMP_FILE}" \
    -w '%{http_code}' \
    -H "Authorization: PVEAPIToken=${PROXMOX_VE_API_TOKEN}" \
    "${PROXMOX_VE_ENDPOINT}api2/json/nodes"
)"

echo "HTTP STATUS: ${HTTP_CODE}"
echo
python3 -m json.tool "${TMP_FILE}"

rm -f "${TMP_FILE}"
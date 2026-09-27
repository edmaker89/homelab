#!/usr/bin/env bash
# Linux Docker host. Only offline ready probes; NEVER runs a tunnel or uses a token.
set -Eeuo pipefail
root=$(cd "$(dirname "$0")/../../../../.." && pwd)
image=cloudflare/cloudflared:2026.9.3
fixture="cloudflared-ready-test-$$"
cleanup() { docker rm -f "$fixture" >/dev/null 2>&1 || true; }
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
# No secret environment resolution or rendered secret output.
docker compose -f "$root/stacks/cloudflared/compose.yaml" config --quiet --no-env-resolution
docker compose -f "$root/stacks/n8n/compose.yaml" config --quiet --no-env-resolution
docker run --rm --network none "$image" --version
for status in 200 503; do
    docker run -d --name "$fixture" --network none --memory 64m --cpus 0.25 \
        --entrypoint node -e STATUS="$status" docker.n8n.io/n8nio/n8n:2.40.7 \
        -e 'require("http").createServer((req,res)=>{res.writeHead(req.url==="/ready"?Number(process.env.STATUS):404);res.end();}).listen(2000,"127.0.0.1")' >/dev/null
    ready=false
    for ((i=0; i<20; i++)); do
        if docker exec "$fixture" node -e 'fetch("http://127.0.0.1:2000/ready").then(()=>process.exit(0)).catch(()=>process.exit(1))'; then ready=true; break; fi
        sleep 1
    done
    [[ "$ready" == true ]]
    result=0
    # Shares loopback with a network-none fixture; no external connectivity.
    docker run --rm --network "container:$fixture" --read-only --cap-drop ALL \
        --security-opt no-new-privileges:true "$image" \
        tunnel --metrics 127.0.0.1:2000 ready >/dev/null 2>&1 || result=$?
    if [[ "$status" == 200 ]]; then [[ "$result" == 0 ]]; else [[ "$result" != 0 ]]; fi
    docker rm -f "$fixture" >/dev/null
    echo "PASS: native /ready probe status=$status exit=$result"
done
echo 'PASS: Compose validation and offline readiness; no tunnel started'

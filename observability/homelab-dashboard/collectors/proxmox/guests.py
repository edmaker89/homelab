#!/usr/bin/env python3

import json
import os
import socket
import subprocess
import sys
from datetime import datetime


SCHEMA_VERSION = 1


def run_json(command):
    env = os.environ.copy()
    env["LANG"] = "C"
    env["LC_ALL"] = "C"

    result = subprocess.run(
        command,
        capture_output=True,
        text=True,
        check=False,
        env=env,
    )

    if result.returncode != 0:
        raise RuntimeError(
            f"command failed: {' '.join(command)}: "
            f"{result.stderr.strip()}"
        )

    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        raise RuntimeError(
            f"invalid JSON returned by {' '.join(command)}: {exc}"
        )


def safe_int(value):
    try:
        return int(value or 0)
    except (TypeError, ValueError):
        return 0


def safe_float(value):
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def normalize_guest(guest, guest_type):
    return {
        "vmid": safe_int(guest.get("vmid")),
        "name": guest.get("name") or f"guest-{guest.get('vmid')}",
        "type": guest_type,
        "status": guest.get("status", "unknown"),
        "template": bool(safe_int(guest.get("template"))),

        "cpu": {
            "allocated": safe_int(
                guest.get("cpus")
            ),
            "usage": safe_float(
                guest.get("cpu")
            ),
        },

        "memory": {
            "used_bytes": safe_int(
                guest.get("mem")
            ),
            "max_bytes": safe_int(
                guest.get("maxmem")
            ),
        },

        "storage": {
            "used_bytes": safe_int(
                guest.get("disk")
            ),
            "max_bytes": safe_int(
                guest.get("maxdisk")
            ),
        },

        "uptime_seconds": safe_int(
            guest.get("uptime")
        ),
    }


def collect_guest_type(node, guest_type):
    command = [
        "pvesh",
        "get",
        f"/nodes/{node}/{guest_type}",
        "--output-format",
        "json",
    ]

    data = run_json(command)

    return [
        normalize_guest(
            guest,
            guest_type,
        )
        for guest in data
    ]


def collect():
    node = socket.gethostname()

    qemu = collect_guest_type(
        node,
        "qemu",
    )

    lxc = collect_guest_type(
        node,
        "lxc",
    )

    guests = qemu + lxc

    guests.sort(
        key=lambda guest: guest["vmid"]
    )

    running = sum(
        1
        for guest in guests
        if guest["status"] == "running"
    )

    stopped = sum(
        1
        for guest in guests
        if guest["status"] == "stopped"
    )

    return {
        "schema_version": SCHEMA_VERSION,

        "generated_at": (
            datetime.now()
            .astimezone()
            .isoformat()
        ),

        "node": node,

        "summary": {
            "total": len(guests),
            "running": running,
            "stopped": stopped,
            "qemu": len(qemu),
            "lxc": len(lxc),
        },

        "guests": guests,
    }


def main():
    try:
        print(
            json.dumps(
                collect(),
                indent=2,
                ensure_ascii=False,
            )
        )

    except Exception as exc:
        print(
            f"guests collector error: {exc}",
            file=sys.stderr,
        )
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
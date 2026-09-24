#!/usr/bin/env python3

import argparse
import json
import sys
from pathlib import Path


SCHEMA_VERSION = 1

DEFAULT_SOURCE = Path("/var/lib/pve-healthcheck/status.json")


def load_json(path: Path):
    try:
        return json.loads(path.read_text())
    except FileNotFoundError:
        raise RuntimeError(f"source file not found: {path}")
    except json.JSONDecodeError as exc:
        raise RuntimeError(
            f"invalid JSON in {path}: {exc}"
        )


def normalize_firewall(value):
    if value is None:
        return None

    prefix = "Status:"

    if isinstance(value, str) and value.startswith(prefix):
        return value[len(prefix):].strip()

    return str(value).strip()


def normalize_status(source):
    host = source.get("host", {})
    health = source.get("health", {})
    chrony = source.get("chrony", {})

    result = {
        "schema_version": SCHEMA_VERSION,
        "generated_at": source.get("generated_at"),

        "host": {
            "hostname": host.get("hostname", "unknown"),
            "fqdn": host.get("fqdn", "unknown"),
            "kernel": host.get("kernel", "unknown"),
            "architecture": host.get(
                "architecture",
                "unknown",
            ),
            "uptime_seconds": int(
                host.get("uptime_seconds") or 0
            ),
        },

        "health": {
            "status": health.get(
                "status",
                "UNKNOWN",
            ),
            "issue_count": int(
                health.get("issue_count") or 0
            ),
            "issues": health.get(
                "issues",
                [],
            ),
            "transitions": health.get(
                "transitions",
                [],
            ),
        },

        "resources": {
            "load": source.get("load", {}),
            "memory": source.get("memory", {}),
            "swap": source.get("swap", {}),
        },

        "storage": {
            "root_filesystem": source.get(
                "filesystem",
                {},
            ),
            "root_inodes": source.get(
                "inodes",
                {},
            ),
        },

        "thermal": source.get(
            "thermal",
            {},
        ),

        "hardware_health": {
            "smart": source.get(
                "smart",
                {},
            ),
        },

        "time_sync": {
            "provider": "chrony",
            "status": chrony.get("leap_status"),
            "reference": chrony.get("reference"),
            "stratum": chrony.get("stratum"),
            "system_time": chrony.get(
                "system_time"
            ),
        },

        "services": source.get(
            "services",
            {},
        ),

        "system": {
            "failed_units": source.get(
                "failed_units",
                [],
            ),
            "journal_usage": source.get(
                "journal_usage"
            ),
        },

        "security": {
            "firewall": {
                "status": normalize_firewall(
                    source.get("firewall")
                ),
            },
        },

        "monitoring": {
            "thresholds": source.get(
                "thresholds",
                {},
            ),
        },

        "platform": {
            "proxmox": {
                "storage": source.get(
                    "pve_storage",
                    {},
                ),
                "mail_queue": source.get(
                    "postfix_queue",
                    {},
                ),
            },

            "docker": None,
        },
    }

    return result


def parse_args():
    parser = argparse.ArgumentParser(
        description=(
            "Convert PVE healthcheck output "
            "to EdMaker Homelab status format."
        )
    )

    parser.add_argument(
        "--source",
        type=Path,
        default=DEFAULT_SOURCE,
        help=(
            "Path to pve-healthcheck status.json"
        ),
    )

    return parser.parse_args()


def main():
    args = parse_args()

    try:
        source = load_json(args.source)
        result = normalize_status(source)

        print(
            json.dumps(
                result,
                indent=2,
                ensure_ascii=False,
            )
        )

    except Exception as exc:
        print(
            f"status adapter error: {exc}",
            file=sys.stderr,
        )
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

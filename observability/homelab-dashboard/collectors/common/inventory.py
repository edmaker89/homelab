#!/usr/bin/env python3

import json
import os
import platform
import shutil
import socket
import subprocess
from datetime import datetime
from pathlib import Path


SCHEMA_VERSION = 1


def run(command):
    try:
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            check=False,
        )
        if result.returncode != 0:
            return None

        return result.stdout.strip()

    except Exception:
        return None


def read_file(path):
    try:
        return Path(path).read_text().strip()
    except Exception:
        return None


def read_os_release():
    data = {}

    try:
        for line in Path("/etc/os-release").read_text().splitlines():
            if "=" not in line:
                continue

            key, value = line.split("=", 1)
            data[key] = value.strip('"')

    except Exception:
        pass

    return data


def detect_role():
    if shutil.which("pveversion"):
        return "proxmox"

    if shutil.which("docker"):
        return "docker-host"

    return "linux"


def collect_cpu():
    raw = run(["lscpu", "-J"])

    result = {
        "model": "unknown",
        "sockets": 0,
        "cores": 0,
        "threads_per_core": 0,
        "logical_cpus": os.cpu_count() or 0,
        "virtualization": None,
    }

    if not raw:
        return result

    try:
        data = json.loads(raw)

        values = {
            item["field"].rstrip(":"): item["data"]
            for item in data["lscpu"]
        }

        result["model"] = values.get("Model name", "unknown")
        result["sockets"] = int(values.get("Socket(s)", 0))
        result["cores"] = int(values.get("Core(s) per socket", 0))
        result["threads_per_core"] = int(
            values.get("Thread(s) per core", 0)
        )
        result["virtualization"] = values.get("Virtualization")

    except Exception:
        pass

    return result


def collect_memory():
    try:
        with open("/proc/meminfo") as file:
            for line in file:
                if line.startswith("MemTotal:"):
                    kb = int(line.split()[1])

                    return {
                        "total_bytes": kb * 1024
                    }

    except Exception:
        pass

    return {
        "total_bytes": 0
    }


def collect_disks():
    raw = run([
        "lsblk",
        "-J",
        "-b",
        "-d",
        "-o",
        "NAME,MODEL,SIZE,TRAN,TYPE",
    ])

    if not raw:
        return []

    try:
        devices = json.loads(raw)["blockdevices"]

        return [
            {
                "name": item["name"],
                "model": item.get("model"),
                "size_bytes": int(item.get("size") or 0),
                "transport": item.get("tran"),
            }
            for item in devices
            if item.get("type") == "disk"
        ]

    except Exception:
        return []


def collect_interfaces():
    raw = run(["ip", "-j", "addr"])

    if not raw:
        return []

    try:
        interfaces = []

        for interface in json.loads(raw):
            ipv4 = []

            for addr in interface.get("addr_info", []):
                if addr.get("family") == "inet":
                    ipv4.append(
                        f"{addr['local']}/{addr['prefixlen']}"
                    )

            interfaces.append({
                "name": interface["ifname"],
                "mac": interface.get("address"),
                "ipv4": ipv4,
            })

        return interfaces

    except Exception:
        return []


def collect_gateway():
    raw = run(["ip", "-j", "route", "show", "default"])

    if not raw:
        return None

    try:
        routes = json.loads(raw)

        if not routes:
            return None

        return routes[0].get("gateway")

    except Exception:
        return None


def collect_dns():
    servers = []

    try:
        for line in Path("/etc/resolv.conf").read_text().splitlines():
            line = line.strip()

            if line.startswith("nameserver "):
                servers.append(line.split()[1])

    except Exception:
        pass

    return servers


def collect_proxmox():
    if not shutil.which("pveversion"):
        return None

    return {
        "version": run(["pveversion"]),
        "full_version": run(["pveversion", "-v"]),
    }


def collect_docker():
    if not shutil.which("docker"):
        return None

    version = run([
        "docker",
        "version",
        "--format",
        "{{.Server.Version}}",
    ])

    compose = run([
        "docker",
        "compose",
        "version",
        "--short",
    ])

    return {
        "engine_version": version,
        "compose_version": compose,
    }


def collect_inventory():
    os_release = read_os_release()

    inventory = {
        "schema_version": SCHEMA_VERSION,
        "generated_at": datetime.now().astimezone().isoformat(),

        "host": {
            "hostname": socket.gethostname(),
            "fqdn": socket.getfqdn(),
            "role": detect_role(),

            "os": {
                "name": os_release.get("PRETTY_NAME", "unknown"),
                "version": os_release.get("VERSION_ID", "unknown"),
                "codename": os_release.get(
                    "VERSION_CODENAME",
                    "unknown",
                ),
            },

            "kernel": platform.release(),
            "architecture": platform.machine(),
        },

        "hardware": {
            "manufacturer": read_file(
                "/sys/class/dmi/id/sys_vendor"
            ),

            "product_name": read_file(
                "/sys/class/dmi/id/product_name"
            ),

            "bios": {
                "vendor": read_file(
                    "/sys/class/dmi/id/bios_vendor"
                ),

                "version": read_file(
                    "/sys/class/dmi/id/bios_version"
                ),

                "release_date": read_file(
                    "/sys/class/dmi/id/bios_date"
                ),
            },

            "cpu": collect_cpu(),
            "memory": collect_memory(),
            "disks": collect_disks(),
        },

        "network": {
            "default_gateway": collect_gateway(),
            "dns_servers": collect_dns(),
            "interfaces": collect_interfaces(),
        },

        "platform": {
            "proxmox": collect_proxmox(),
            "docker": collect_docker(),
        },
    }

    return inventory


def main():
    inventory = collect_inventory()

    print(
        json.dumps(
            inventory,
            indent=2,
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()

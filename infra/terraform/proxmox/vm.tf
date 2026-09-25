resource "proxmox_virtual_environment_vm" "lab_docker_01" {
  vm_id     = var.vm_id
  name      = var.vm_name
  node_name = var.proxmox_node_name

  boot_order = ["scsi0"]

  description = "EdMaker Homelab Docker host - managed by OpenTofu"

  started = true
  on_boot = true

  # Debian cloud images do not include qemu-guest-agent by default.
  # Ansible will install it later.
  agent {
    enabled = false
  }

  # Until qemu-guest-agent is installed and enabled, avoid depending
  # on a graceful guest-agent shutdown during destroy operations.
  stop_on_destroy = true

  cpu {
    cores = 2
    type  = "x86-64-v2-AES"
  }

  memory {
    dedicated = 2048
  }

  operating_system {
    type = "l26"
  }

  scsi_hardware = "virtio-scsi-single"

  disk {
    datastore_id = var.vm_datastore_id
    import_from  = proxmox_download_file.debian_13.id

    interface = "scsi0"
    size      = 30

    iothread = true
    discard  = "on"
  }

  initialization {
    datastore_id = var.vm_datastore_id

    dns {
      domain  = var.vm_dns_domain
      servers = var.vm_dns_servers
    }

    ip_config {
      ipv4 {
        address = var.vm_ipv4_address
        gateway = var.vm_ipv4_gateway
      }
    }

    user_account {
      username = "admin"

      keys = [
        trimspace(
          file(
            pathexpand(var.vm_ssh_public_key_path)
          )
        )
      ]
    }
  }

  network_device {
    bridge = var.vm_bridge
  }

  serial_device {}
}
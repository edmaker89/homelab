output "proxmox_nodes" {
  description = "Proxmox nodes visible to the OpenTofu service account."

  value = {
    names            = data.proxmox_virtual_environment_nodes.all.names
    online           = data.proxmox_virtual_environment_nodes.all.online
    cpu_count        = data.proxmox_virtual_environment_nodes.all.cpu_count
    memory_used      = data.proxmox_virtual_environment_nodes.all.memory_used
    memory_available = data.proxmox_virtual_environment_nodes.all.memory_available
    uptime           = data.proxmox_virtual_environment_nodes.all.uptime
  }
}

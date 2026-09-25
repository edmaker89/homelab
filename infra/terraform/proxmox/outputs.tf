output "proxmox_nodes" {
  description = "Proxmox nodes visible to the OpenTofu service account."

  value = {
    names     = data.proxmox_virtual_environment_nodes.all.names
    cpu_count = data.proxmox_virtual_environment_nodes.all.cpu_count
  }
}

output "debian_13_cloud_image" {
  description = "Debian 13 cloud image managed by OpenTofu."

  value = {
    id   = proxmox_download_file.debian_13.id
    size = proxmox_download_file.debian_13.size
  }
}

output "lab_docker_01" {
  description = "Provisioned configuration for lab-docker-01."

  value = {
    vm_id        = proxmox_virtual_environment_vm.lab_docker_01.vm_id
    name         = proxmox_virtual_environment_vm.lab_docker_01.name
    node         = proxmox_virtual_environment_vm.lab_docker_01.node_name
    ipv4_address = var.vm_ipv4_address
  }
}

output "lab_docker_01_ssh" {
  description = "SSH command for lab-docker-01."
  value       = "ssh admin@${split("/", var.vm_ipv4_address)[0]}"
}
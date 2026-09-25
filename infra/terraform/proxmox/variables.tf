variable "proxmox_node_name" {
  description = "Proxmox node where homelab resources will be created."
  type        = string
  default     = "pve-01"
}

variable "image_datastore_id" {
  description = "Proxmox datastore used to store cloud images."
  type        = string
  default     = "local"
}

variable "vm_id" {
  description = "VMID for lab-docker-01."
  type        = number
  default     = 100
}

variable "vm_name" {
  description = "Name of the Docker lab VM."
  type        = string
  default     = "lab-docker-01"
}

variable "vm_datastore_id" {
  description = "Datastore used for VM disks."
  type        = string
  default     = "local-lvm"
}

variable "vm_bridge" {
  description = "Proxmox bridge used by the VM."
  type        = string
  default     = "vmbr0"
}

variable "vm_ipv4_address" {
  description = "Static IPv4 address for the VM."
  type        = string
  default     = "192.168.15.220/24"
}

variable "vm_ipv4_gateway" {
  description = "Default IPv4 gateway for the VM."
  type        = string
  default     = "192.168.15.1"
}

variable "vm_dns_servers" {
  description = "DNS servers used by the VM."
  type        = list(string)
  default     = ["192.168.15.1"]
}

variable "vm_dns_domain" {
  description = "DNS search domain used by the VM."
  type        = string
  default     = "home.arpa"
}

variable "vm_ssh_public_key_path" {
  description = "Path to the SSH public key injected through cloud-init."
  type        = string
  default     = "~/.ssh/homelab_infra.pub"
}
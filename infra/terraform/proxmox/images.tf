resource "proxmox_download_file" "debian_13" {
  content_type = "import"
  datastore_id = var.image_datastore_id
  node_name    = var.proxmox_node_name

  url = "https://cloud.debian.org/images/cloud/trixie/latest/debian-13-generic-amd64.qcow2"

  file_name = "debian-13-generic-amd64.qcow2"

  overwrite = false
}

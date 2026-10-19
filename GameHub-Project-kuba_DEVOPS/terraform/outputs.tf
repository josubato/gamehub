output "app_engine_url" {
  description = "URL aplikacji GameHub"
  value       = "https://${var.project_id}.appspot.com"
}

output "videos_bucket_name" {
  description = "Nazwa bucketa na wideo"
  value       = google_storage_bucket.videos.name
}

output "terraform_state_bucket" {
  description = "Bucket na Terraform state"
  value       = google_storage_bucket.terraform_state.name
}

output "firestore_database" {
  description = "Nazwa bazy Firestore"
  value       = google_firestore_database.gamehub.name
}

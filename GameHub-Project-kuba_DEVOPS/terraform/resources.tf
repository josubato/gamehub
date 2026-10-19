# ─── Firestore ────────────────────────────────────────────────────────────────

resource "google_firestore_database" "gamehub" {
  project     = var.project_id
  name        = "(default)"
  location_id = var.region
  type        = "FIRESTORE_NATIVE"

  depends_on = [google_project_service.firestore]
}

# ─── Cloud Storage — bucket na wideo i thumbnails ─────────────────────────────

resource "google_storage_bucket" "videos" {
  name          = "${var.project_id}-videos"
  location      = var.region
  project       = var.project_id
  force_destroy = false

  uniform_bucket_level_access = true

cors {
  origin          = [
    "https://gamehub-493009.web.app",
    "http://localhost:5173"
  ]
  method          = ["GET", "HEAD", "PUT"]
  response_header = ["Content-Type"]
  max_age_seconds = 3600
}

  lifecycle_rule {
    condition {
      age = 365
    }
    action {
      type = "Delete"
    }
  }

  depends_on = [google_project_service.storage]
}

resource "google_storage_bucket" "terraform_state" {
  name          = "${var.project_id}-terraform-state"
  location      = var.region
  project       = var.project_id
  force_destroy = false

  uniform_bucket_level_access = true

  versioning {
    enabled = true
  }

  depends_on = [google_project_service.storage]
}

# ─── App Engine ───────────────────────────────────────────────────────────────

resource "google_app_engine_application" "gamehub" {
  project     = var.project_id
  location_id = var.app_engine_location

  depends_on = [google_project_service.appengine]
}

# ─── Secret Manager — przechowywanie SECRET_KEY ───────────────────────────────

resource "google_secret_manager_secret" "flask_secret" {
  project   = var.project_id
  secret_id = "flask-secret-key"

  replication {
    auto {}
  }

  depends_on = [google_project_service.secretmanager]
}

resource "google_secret_manager_secret_version" "flask_secret_value" {
  secret      = google_secret_manager_secret.flask_secret.id
  secret_data = var.flask_secret_key
}

# ─── IAM — App Engine może czytać Storage i Firestore ─────────────────────────

resource "google_storage_bucket_iam_member" "appengine_storage" {
  bucket = google_storage_bucket.videos.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${var.project_id}@appspot.gserviceaccount.com"

  depends_on = [google_app_engine_application.gamehub]
}

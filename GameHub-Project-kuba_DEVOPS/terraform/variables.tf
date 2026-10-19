variable "project_id" {
  description = "Google Cloud Project ID"
  type        = string
  default     = "gamehub-493009"
}

variable "region" {
  description = "GCP Region"
  type        = string
  default     = "europe-central2" # Warszawa
}

variable "credentials_file" {
  description = "Ścieżka do pliku JSON service account"
  type        = string
  default     = "./credentials.json"
}

variable "app_engine_location" {
  description = "Lokalizacja App Engine (musi być ustawiona raz na zawsze)"
  type        = string
  default     = "europe-central2"
}

variable "flask_secret_key" {
  description = "Secret key dla Flask sessions (min. 32 znaki)"
  type        = string
  sensitive   = true
}

variable "iap_user_email" {
  description = "Konto Google z dostępem SSH (IAP) do serwera mailowego"
  type        = string
}

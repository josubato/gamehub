terraform {
  required_version = ">= 1.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }

  # Po utworzeniu bucketa odkomentuj ten blok i zrób terraform init ponownie
   backend "gcs" {
     bucket = "gamehub-493009-terraform-state"
     prefix = "terraform/state"
   }
}

provider "google" {
  credentials = file(var.credentials_file)
  project     = var.project_id
  region      = var.region
}

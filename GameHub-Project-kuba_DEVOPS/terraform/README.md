# GameHub — Terraform (GCP Infrastructure)

Infrastructure as Code for the GameHub platform on Google Cloud.

## Files

| File | Contents |
|---|---|
| `main.tf` | Google provider + GCS remote state backend |
| `variables.tf` | Input variables |
| `apis.tf` | Enables Firestore, App Engine, Storage, Cloud Build, Secret Manager, Video Intelligence |
| `resources.tf` | Firestore DB, video & state buckets, App Engine app, Secret Manager secret, IAM |
| `mail_server.tf` | e2-micro mail-relay VM with static IP, VPC firewall rules, IAP-only SSH |
| `outputs.tf` | App URL, bucket names, DB name |
| `terraform.tfvars.example` | Template for your variables |

## Variables

| Name | Default | Description |
|---|---|---|
| `project_id` | `gamehub-493009` | GCP project ID |
| `region` | `europe-central2` | Region (Warsaw) |
| `app_engine_location` | `europe-central2` | App Engine location (cannot be changed later) |
| `credentials_file` | `./credentials.json` | Service account key (git-ignored) |
| `flask_secret_key` | – | Flask/JWT secret stored in Secret Manager (sensitive) |
| `iap_user_email` | – | Google account granted IAP SSH access to the VM |

## First run

```bash
cp terraform.tfvars.example terraform.tfvars   # fill in values
# put a service-account key at ./credentials.json

# The state bucket doesn't exist yet - comment out the `backend "gcs"` block in main.tf
# and update its bucket name to "<project_id>-terraform-state".
terraform init
terraform apply

# Restore the backend block and move local state into GCS:
terraform init -migrate-state
```

Generate a random secret:

```bash
openssl rand -base64 48
# PowerShell: -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 48 | % {[char]$_})
```

## Day-to-day

```bash
terraform plan      # preview
terraform apply     # apply
terraform destroy   # tear everything down (careful!)
```

SSH to the mail VM (only possible through IAP):

```bash
gcloud compute ssh gamehub-mail-server --zone=europe-central2-a --tunnel-through-iap
```

## Security notes

- `credentials.json`, `terraform.tfvars` and all state files are git-ignored. Never commit them.
- The state contains the Flask secret, so it lives in a private, versioned GCS bucket.
- If a key is ever leaked, revoke it immediately in **IAM → Service Accounts → Keys**.

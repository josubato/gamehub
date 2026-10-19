# ─── Compute Engine API ───────────────────────────────────────────────────────

resource "google_project_service" "compute" {
  project            = var.project_id
  service            = "compute.googleapis.com"
  disable_on_destroy = false
}

# ─── IAP API ──────────────────────────────────────────────────────────────────

resource "google_project_service" "iap" {
  project            = var.project_id
  service            = "iap.googleapis.com"
  disable_on_destroy = false
}

# ─── Static IP dla VM ─────────────────────────────────────────────────────────

resource "google_compute_address" "mail_server_ip" {
  name    = "mail-server-ip"
  project = var.project_id
  region  = var.region

  depends_on = [google_project_service.compute]
}

# ─── Firewall — tylko SMTP z App Engine, SSH tylko przez IAP ──────────────────

# Blokuje cały zewnętrzny SSH — port 22 zamknięty dla świata
resource "google_compute_firewall" "deny_ssh" {
  name    = "deny-ssh-external"
  network = "default"
  project = var.project_id

  deny {
    protocol = "tcp"
    ports    = ["22"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["mail-server"]
  priority      = 1000

  depends_on = [google_project_service.compute]
}

# Zezwala na SSH tylko przez IAP (35.235.240.0/20 to zakresy Google IAP)
resource "google_compute_firewall" "allow_ssh_iap" {
  name    = "allow-ssh-iap"
  network = "default"
  project = var.project_id

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }

  source_ranges = ["35.235.240.0/20"]
  target_tags   = ["mail-server"]
  priority      = 900

  depends_on = [google_project_service.compute]
}

# Zezwala na SMTP submission (port 587) tylko z zakresu App Engine
resource "google_compute_firewall" "allow_smtp" {
  name    = "allow-smtp-submission"
  network = "default"
  project = var.project_id

  allow {
    protocol = "tcp"
    ports    = ["587"]
  }

  # App Engine i GCP wewnętrzne zakresy
  source_ranges = ["10.0.0.0/8", "172.16.0.0/12", "35.191.0.0/16", "130.211.0.0/22"]
  target_tags   = ["mail-server"]
  priority      = 900

  depends_on = [google_project_service.compute]
}

# ─── IAP uprawnienia dla konta administratora ────────────────────────────────

resource "google_iap_tunnel_instance_iam_member" "admin_iap" {
  project  = var.project_id
  zone     = "${var.region}-a"
  instance = google_compute_instance.mail_server.name
  role     = "roles/iap.tunnelResourceAccessor"
  member   = "user:${var.iap_user_email}"

  depends_on = [google_compute_instance.mail_server]
}

# ─── VM — e2-micro (darmowy tier) ─────────────────────────────────────────────

resource "google_compute_instance" "mail_server" {
  name         = "gamehub-mail-server"
  machine_type = "e2-micro"
  zone         = "${var.region}-a"
  project      = var.project_id

  tags = ["mail-server"]

  boot_disk {
    initialize_params {
      image = "debian-cloud/debian-12"
      size  = 10
    }
  }

  network_interface {
    network = "default"
    access_config {
      nat_ip = google_compute_address.mail_server_ip.address
    }
  }

  metadata = {
    startup-script = <<-EOF
      #!/bin/bash
      set -e

      # Aktualizacja systemu
      apt-get update -y
      apt-get upgrade -y

      # Instalacja Postfix, Fail2ban i narzędzi
      DEBIAN_FRONTEND=noninteractive apt-get install -y \
        postfix \
        mailutils \
        libsasl2-modules \
        ca-certificates \
        fail2ban \
        ufw

      # Konfiguracja UFW (firewall na poziomie OS)
      ufw default deny incoming
      ufw default allow outgoing
      ufw allow from 35.235.240.0/20 to any port 22
      ufw allow 587/tcp
      ufw --force enable

      # Konfiguracja Fail2ban
      cat > /etc/fail2ban/jail.local << 'FAIL2BAN'
      [DEFAULT]
      bantime = 3600
      findtime = 600
      maxretry = 3

      [sshd]
      enabled = true
      port = ssh
      logpath = %(sshd_log)s

      [postfix]
      enabled = true
      port = smtp,submission
      logpath = %(postfix_log)s
      FAIL2BAN

      systemctl restart fail2ban
      systemctl enable fail2ban

      # Konfiguracja Postfix
      cat > /etc/postfix/main.cf << 'POSTFIX_CONFIG'
      smtpd_banner = $myhostname ESMTP
      biff = no
      append_dot_mydomain = no

      # TLS
      smtpd_tls_cert_file=/etc/ssl/certs/ssl-cert-snakeoil.pem
      smtpd_tls_key_file=/etc/ssl/private/ssl-cert-snakeoil.key
      smtpd_use_tls=yes
      smtpd_tls_session_cache_database = btree:$${data_directory}/smtpd_scache
      smtp_tls_session_cache_database = btree:$${data_directory}/smtp_scache

      # Hostname
      myhostname = mail.gamehub-493009.web.app
      myorigin = gamehub-493009.web.app
      mydestination = localhost
      relayhost =
      mynetworks = 127.0.0.1/32 [::1]/128 10.0.0.0/8

      # Limity antyspamowe
      smtpd_recipient_limit = 10
      smtpd_message_size_limit = 10240000
      mailbox_size_limit = 0
      recipient_delimiter = +
      inet_interfaces = all
      inet_protocols = all

      # Antyspam
      smtpd_helo_required = yes
      smtpd_recipient_restrictions =
        permit_mynetworks,
        permit_sasl_authenticated,
        reject_unauth_destination
      POSTFIX_CONFIG

      # Włącz port 587 (submission)
      cat >> /etc/postfix/master.cf << 'MASTER_CONFIG'
      submission inet n       -       y       -       -       smtpd
        -o syslog_name=postfix/submission
        -o smtpd_tls_security_level=encrypt
        -o smtpd_sasl_auth_enable=yes
        -o smtpd_client_restrictions=permit_sasl_authenticated,reject
        -o milter_macro_daemon_name=ORIGINATING
      MASTER_CONFIG

      # Restart Postfix
      systemctl restart postfix
      systemctl enable postfix

      echo "Mail server setup complete!" >> /var/log/startup-script.log
    EOF
  }

  service_account {
    scopes = ["cloud-platform"]
  }

  depends_on = [
    google_project_service.compute,
    google_project_service.iap,
    google_compute_firewall.allow_ssh_iap,
    google_compute_firewall.allow_smtp
  ]
}

# ─── Outputy ──────────────────────────────────────────────────────────────────

output "mail_server_ip" {
  description = "Zewnętrzny IP serwera mailowego"
  value       = google_compute_address.mail_server_ip.address
}

output "ssh_command" {
  description = "Komenda do połączenia przez IAP"
  value       = "gcloud compute ssh gamehub-mail-server --zone=${var.region}-a --project=${var.project_id} --tunnel-through-iap"
}

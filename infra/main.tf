# infra/main.tf
terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# --- VPC & Networking ---
resource "google_compute_network" "spidey_vpc" {
  name                    = "spidey-vpc"
  auto_create_subnetworks = false
}

resource "google_compute_subnetwork" "spidey_subnet" {
  name          = "spidey-subnet"
  ip_cidr_range = "10.0.0.0/24"
  region        = var.region
  network       = google_compute_network.spidey_vpc.id
}

# Serverless VPC Access for Cloud Run to reach Redis/SQL
resource "google_vpc_access_connector" "serverless_connector" {
  name          = "spidey-connector"
  region        = var.region
  network       = google_compute_network.spidey_vpc.name
  ip_cidr_range = "10.8.0.0/28"
}

# --- Cloud SQL (PostgreSQL) ---
resource "google_sql_database_instance" "spidey_db" {
  name             = "spidey-postgres-instance"
  database_version = "POSTGRES_15"
  region           = var.region

  settings {
    tier = "db-f1-micro" # Up to custom-2-4 if high load expected, but f1-micro is fine for 1000 fast writes.
    ip_configuration {
      ipv4_enabled    = false # Private IP only
      private_network = google_compute_network.spidey_vpc.id
    }
  }
}

resource "google_sql_database" "database" {
  name     = "spidey_db"
  instance = google_sql_database_instance.spidey_db.name
}

resource "google_sql_user" "users" {
  name     = "spidey"
  instance = google_sql_database_instance.spidey_db.name
  password = var.db_password
}

# --- Memorystore for Redis ---
resource "google_redis_instance" "spidey_redis" {
  name           = "spidey-redis"
  tier           = "BASIC" # Basic is sufficient for simple stateless pub/sub and sets
  memory_size_gb = 1
  region         = var.region
  redis_version  = "REDIS_7_0"
  authorized_network = google_compute_network.spidey_vpc.id
}

# --- Cloud Run Backend ---
resource "google_cloud_run_v2_service" "spidey_backend" {
  name     = "spidey-backend"
  location = var.region

  template {
    scaling {
      min_instance_count = 2 # Required for load balancing + Redis pub/sub validation
      max_instance_count = 10
    }
    
    # Needs to handle 1000 sockets. Set concurrency high to handle many idle sockets per container.
    max_instance_request_concurrency = 500
    
    timeout = "3600s"
    session_affinity = true

    containers {
      image = var.backend_image_url
      
      resources {
        limits = {
          cpu    = "2"
          memory = "4Gi"
        }
      }
      
      env {
        name  = "PORT"
        value = "8080"
      }
      env {
        name  = "REDIS_URL"
        value = "redis://${google_redis_instance.spidey_redis.host}:${google_redis_instance.spidey_redis.port}"
      }
      env {
        name  = "POSTGRES_HOST"
        value = google_sql_database_instance.spidey_db.private_ip_address
      }
      env {
        name  = "POSTGRES_USER"
        value = "spidey"
      }
      env {
        name  = "POSTGRES_PASSWORD"
        value = var.db_password
      }
      env {
        name  = "JWT_SECRET"
        value = var.jwt_secret
      }
    }
    
    vpc_access {
      connector = google_vpc_access_connector.serverless_connector.id
      egress    = "ALL_TRAFFIC"
    }
  }
}

# --- Allow unauthenticated invocations for backend ---
resource "google_cloud_run_v2_service_iam_member" "public_access" {
  project  = google_cloud_run_v2_service.spidey_backend.project
  location = google_cloud_run_v2_service.spidey_backend.location
  name     = google_cloud_run_v2_service.spidey_backend.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# --- Frontend Static Hosting (Cloud Storage) ---
resource "google_storage_bucket" "frontend_bucket" {
  name          = "spidey-frontend-${var.project_id}"
  location      = "US"
  force_destroy = true
  
  website {
    main_page_suffix = "index.html"
    not_found_page   = "index.html" # For SPA routing
  }
}

resource "google_storage_bucket_iam_member" "public_read" {
  bucket = google_storage_bucket.frontend_bucket.name
  role   = "roles/storage.objectViewer"
  member = "allUsers"
}

# --- Variables ---
variable "project_id" {}
variable "region" { default = "us-central1" }
variable "db_password" { sensitive = true }
variable "jwt_secret" { sensitive = true }
variable "backend_image_url" {}

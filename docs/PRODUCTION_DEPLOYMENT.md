# Production Deployment with Docker

This guide covers deploying Costra to production using Docker, including database migration and environment configuration.

## Overview

- **Backend**: Node.js API (port 3002, internal)
- **Frontend**: Nginx serving static build (port 8080, internal)
- **Nginx**: Reverse proxy on port 80 (routes `/api` → backend, `/` → frontend)
- **Redis**: Session/cache (internal)
- **PostgreSQL**: Use a managed database (RDS, Cloud SQL, etc.) — not in Docker

---

## Quick Start

```bash
# 1. Create .env in project root
cp .env.docker.example .env
# Edit .env: set DATABASE_URL, JWT_SECRET, ENCRYPTION_KEY, FRONTEND_URL

# 2. Run migration (one-time)
docker compose run --rm costra-backend node scripts/migrate.js

# 3. Start the stack
docker compose up -d --build

# 4. Verify
curl https://costra.app/api/health
```

---

## 1. Prerequisites

- Docker and Docker Compose
- Managed PostgreSQL instance (AWS RDS, GCP Cloud SQL, Azure Database, etc.)
- Domain or IP for your deployment

---

## 2. Environment Files

### Where to put `.env`

**Place your `.env` file in the project root** — the same directory as `docker-compose.yml`. Docker Compose loads it automatically.

```
costra/                          ← Project root (where you run docker compose)
├── .env                         ← YOUR SECRETS HERE (create this, never commit)
├── .env.docker.example          ← Template (copy to .env)
├── docker-compose.yml
├── Dockerfile.backend
├── Dockerfile.frontend
├── server/
│   ├── .env                     ← Optional: for local dev (npm run dev)
│   └── scripts/
│       └── migrate.js           ← Migration script
└── ...
```

| Location | Purpose |
|----------|---------|
| **Project root `.env`** | Used by Docker Compose. Required for `docker compose up` and `docker compose run`. |
| `server/.env` | Used when running backend locally (`cd server && npm run dev`). Not used by Docker. |
| `.env.docker.example` | Template only. Copy to `.env` and customize. |

**Never commit `.env`** — it is in `.gitignore`.

### Create `.env` from template

```bash
# From project root
cp .env.docker.example .env
# Edit .env with your production values
```

### Required variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string (required) | `postgresql://user:pass@rds-host:5432/costra` |
| `JWT_SECRET` | Min 32 chars for JWT signing | Generate with `openssl rand -base64 32` |
| `ENCRYPTION_KEY` | Min 32 chars for credential encryption | Generate with `openssl rand -base64 32` |

### Optional variables

| Variable | Description | Default |
|----------|-------------|---------|
| `FRONTEND_URL` | CORS origin (URL users see) | `https://costra.app` |
| `VITE_API_URL` | API base URL for frontend | `/api` (use when behind nginx) |
| `REDIS_URL` | Redis connection | `redis://costra-redis:6379` |
| `SENTRY_DSN` | Error tracking | — |
| `STRIPE_SECRET_KEY` | Stripe payments | — |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhooks | — |

### Production `.env` example

```bash
# Required
DATABASE_URL=postgresql://costra_user:SECURE_PASSWORD@your-rds.region.rds.amazonaws.com:5432/costra
JWT_SECRET=your-32-char-minimum-secret-from-openssl-rand
ENCRYPTION_KEY=your-32-char-encryption-key-from-openssl-rand

# CORS and API (adjust for your domain)
FRONTEND_URL=https://costra.app
VITE_API_URL=/api

# Optional
REDIS_URL=redis://costra-redis:6379
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
```

---

## 3. Database Setup

### Create the database

In your cloud console (RDS, Cloud SQL, etc.):

1. Create the PostgreSQL instance
2. Create a database named `costra` (or your choice)
3. Note the host, port, username, and password for `DATABASE_URL`

### Run migration

Run the migration **before** starting the app. The migration script creates all tables and indexes. It is idempotent — safe to run multiple times.

#### Option A: Docker (recommended for production)

```bash
# Ensure .env exists in project root with DATABASE_URL
docker compose run --rm costra-backend node scripts/migrate.js
```

Docker Compose passes variables from your project root `.env` to the container.

#### Option B: Docker with explicit env file

```bash
docker compose build costra-backend
docker run --rm --env-file .env costra-backend:latest node scripts/migrate.js
```

#### Option C: Without Docker (CI/CD, bare metal)

```bash
# From project root
DATABASE_URL="postgresql://user:pass@host:5432/costra" node server/scripts/migrate.js

# Or from server directory
cd server && DATABASE_URL="postgresql://user:pass@host:5432/costra" npm run migrate
```

See `docs/DATABASE_MIGRATION.md` for more details.

#### Success output

```
✓ Database schema is ready.
  You can now start the application.
```

---

## 4. Deploy with Docker Compose

### Build and start

```bash
# From project root
docker compose up -d --build
```

### Verify

```bash
# Check all services are running
docker compose ps

# Check logs
docker compose logs -f costra-backend
```

### Access

- **App**: `https://costra.app` (or `http://localhost` for local dev)
- **Health**: `https://costra.app/health` or `https://costra.app/api/health`

---

## 5. Deployment Checklist

| Step | Action |
|------|--------|
| 1 | Create managed PostgreSQL instance and database |
| 2 | Copy `.env.docker.example` to `.env` in project root |
| 3 | Set `DATABASE_URL`, `JWT_SECRET`, `ENCRYPTION_KEY` in `.env` |
| 4 | Set `FRONTEND_URL` to your production URL |
| 5 | Run migration: `docker compose run --rm costra-backend node scripts/migrate.js` |
| 6 | Start stack: `docker compose up -d --build` |
| 7 | Verify: `curl https://costra.app/api/health` |

---

## 6. Updating the App

```bash
# Pull latest code
git pull

# Rebuild and restart
docker compose up -d --build

# If schema changed, run migration again
docker compose run --rm costra-backend node scripts/migrate.js
```

Migration is idempotent — safe to run multiple times.

---

## 7. File Locations Summary

| Purpose | Location |
|---------|----------|
| **Docker env vars** | `.env` in **project root** (same dir as `docker-compose.yml`) |
| Env template | `.env.docker.example` in project root |
| Migration script | `server/scripts/migrate.js` — run via `docker compose run` or `node server/scripts/migrate.js` |
| Docker config | `docker-compose.yml`, `Dockerfile.backend`, `Dockerfile.frontend` |
| Nginx config | `docker/nginx-reverse-proxy.conf` |

---

## 8. CI/CD and Deployment Pipelines

For automated deployments, inject env vars via your platform:

| Platform | Where to set env vars |
|----------|------------------------|
| **GitHub Actions** | Repository secrets → `env:` in workflow |
| **GitLab CI** | CI/CD variables (masked) |
| **AWS ECS** | Task definition environment / Secrets Manager |
| **Kubernetes** | ConfigMaps + Secrets |
| **Docker Swarm** | `docker secret` |

Typical pipeline order:

1. Build images
2. Run migration: `docker run --rm -e DATABASE_URL=... costra-backend:latest node scripts/migrate.js`
3. Deploy/start containers

---

## 9. Security Notes

- Use strong, unique values for `JWT_SECRET` and `ENCRYPTION_KEY`
- Restrict database access (security groups, VPC) to your app only
- Consider Docker secrets or a secrets manager for production
- See `docs/DOCKER_SECURITY.md` for container hardening details

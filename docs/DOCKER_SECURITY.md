# Docker Security Hardening

Costra containers use maximum security hardening following OWASP and Docker best practices.

## Implemented Measures

### 1. Non-Root User
- **Backend**: Runs as `appuser` (UID 1001)
- **Frontend**: Nginx Alpine runs worker processes as unprivileged user

### 2. Read-Only Filesystem
- Root filesystem is read-only (`read_only: true`)
- Writable directories use `tmpfs` (in-memory, no persistence):
  - Backend: `/app/uploads`, `/app/logs`, `/tmp`
  - Frontend: `/var/cache/nginx`, `/var/run`, `/var/log/nginx`

### 3. Capability Dropping
- All containers: `cap_drop: ALL`
- Node.js and Nginx need no special capabilities for ports > 1024
- PostgreSQL: Minimal caps (CHOWN, DAC_OVERRIDE, SETGID, SETUID)

### 4. No New Privileges
- `security_opt: no-new-privileges:true` prevents privilege escalation via SUID/SGID

### 5. Pinned Base Images
- `node:20.21-alpine3.20` (not `latest`)
- `nginx:1.27-alpine3.20`
- `postgres:15-alpine3.20`
- `redis:7-alpine3.20`

### 6. Multi-Stage Frontend Build
- Build stage: Node.js (full toolchain)
- Runtime: Nginx only (no Node.js in production image)

### 7. Security Headers (Frontend)
- X-Frame-Options: SAMEORIGIN
- X-Content-Type-Options: nosniff
- X-XSS-Protection
- Referrer-Policy
- Content-Security-Policy

### 8. Secrets Handling
- `.env` excluded from images via `.dockerignore`
- Use Docker secrets or env vars at runtime
- Never bake secrets into images

## Architecture

```
                    ┌─────────────────┐
                    │  costra-nginx   │  :80 (reverse proxy)
                    └────────┬────────┘
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
    /api/* → backend    /* → frontend   /health
```

## Usage

```bash
# Copy env template
cp .env.docker.example .env

# Edit .env with production secrets
# Then:
docker compose up -d

# Access at http://localhost
```

## Production Checklist

- [ ] Set strong `JWT_SECRET` (32+ chars)
- [ ] Set strong `POSTGRES_PASSWORD`
- [ ] Set `ENCRYPTION_KEY` for credential storage
- [ ] Set `VITE_API_URL` to your backend URL (as seen by browser)
- [ ] Set `FRONTEND_URL` for CORS
- [ ] Use Docker secrets or vault for production

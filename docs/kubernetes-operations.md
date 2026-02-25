# Costra Kubernetes Operations Guide

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Infrastructure Diagram](#infrastructure-diagram)
- [Request Flow](#request-flow)
- [CI/CD Pipeline](#cicd-pipeline)
- [Namespace Layout](#namespace-layout)
- [Configuration & Secrets](#configuration--secrets)
- [Common Operations](#common-operations)
- [Troubleshooting Guide](#troubleshooting-guide)
- [Resource Limits](#resource-limits)

---

## Architecture Overview

Costra runs on a **single-node k3s** cluster (lightweight Kubernetes) on an OVH VPS (6 CPU, 12GB RAM). Traffic flows through **Cloudflare CDN** → **Traefik ingress** → **Services** → **Pods**.

### Key Components

| Component | Technology | Namespace |
|-----------|-----------|-----------|
| Kubernetes | k3s (lightweight) | — |
| Ingress Controller | Traefik (k3s built-in) | kube-system |
| TLS Certificates | cert-manager + Let's Encrypt | cert-manager |
| Frontend | React/Vite + nginx | costra |
| Backend | Node.js (ESM) | costra |
| Cache | Redis 7 (StatefulSet) | infra |
| Database | PostgreSQL (external managed) | — |
| Container Registry | AWS ECR | — |
| CI/CD | GitHub Actions | — |

---

## Infrastructure Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                         INTERNET                                     │
└──────────────────────────┬───────────────────────────────────────────┘
                           │
                           ▼
                ┌─────────────────────┐
                │   Cloudflare CDN    │
                │   (costra.app)      │
                │                     │
                │  • SSL termination  │
                │  • DDoS protection  │
                │  • Asset caching    │
                └──────────┬──────────┘
                           │ HTTPS
                           ▼
┌──────────────────────────────────────────────────────────────────────┐
│  VPS (OVH) — 57.129.125.66                                          │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  k3s Cluster (single node)                                     │  │
│  │                                                                │  │
│  │  ┌──────────────────────────────────────────────────────────┐  │  │
│  │  │  kube-system namespace                                   │  │  │
│  │  │  ┌─────────────────┐                                     │  │  │
│  │  │  │    Traefik       │ ◄── Ingress Controller             │  │  │
│  │  │  │  (ports 80/443)  │     Routes by Host + Path          │  │  │
│  │  │  └────────┬─────────┘                                    │  │  │
│  │  └───────────┼──────────────────────────────────────────────┘  │  │
│  │              │                                                  │  │
│  │              │  Ingress rules (costra.app):                     │  │
│  │              │    /api/*  → costra-backend:3002                 │  │
│  │              │    /*      → costra-frontend:8080                │  │
│  │              │                                                  │  │
│  │  ┌──────────┼───────────────────────────────────────────────┐  │  │
│  │  │  costra namespace                                        │  │  │
│  │  │          │                                                │  │  │
│  │  │          ├──────────────────┐                             │  │  │
│  │  │          ▼                  ▼                             │  │  │
│  │  │  ┌──────────────┐  ┌──────────────┐                     │  │  │
│  │  │  │   Backend    │  │   Frontend   │                     │  │  │
│  │  │  │   Service    │  │   Service    │                     │  │  │
│  │  │  │  (ClusterIP) │  │  (ClusterIP) │                     │  │  │
│  │  │  │  port: 3002  │  │  port: 8080  │                     │  │  │
│  │  │  └──────┬───────┘  └──────┬───────┘                     │  │  │
│  │  │         │                  │                              │  │  │
│  │  │         ▼                  ▼                              │  │  │
│  │  │  ┌──────────────┐  ┌──────────────┐                     │  │  │
│  │  │  │  Backend Pod │  │ Frontend Pod │                     │  │  │
│  │  │  │  (2-4 reps)  │  │  (2-3 reps)  │                     │  │  │
│  │  │  │              │  │              │                     │  │  │
│  │  │  │  Node.js     │  │  nginx       │                     │  │  │
│  │  │  │  port 3002   │  │  port 8080   │                     │  │  │
│  │  │  └──────┬───────┘  └──────────────┘                     │  │  │
│  │  │         │                                                │  │  │
│  │  │         │  ConfigMap: costra-config (non-secret env)     │  │  │
│  │  │         │  Secret: costra-secrets (from .env)            │  │  │
│  │  └─────────┼────────────────────────────────────────────────┘  │  │
│  │            │                                                    │  │
│  │  ┌─────────┼────────────────────────────────────────────────┐  │  │
│  │  │  infra namespace                                         │  │  │
│  │  │         ▼                                                │  │  │
│  │  │  ┌──────────────┐                                       │  │  │
│  │  │  │    Redis      │                                       │  │  │
│  │  │  │ (StatefulSet) │                                       │  │  │
│  │  │  │  port 6379    │                                       │  │  │
│  │  │  │  2Gi PVC      │                                       │  │  │
│  │  │  └──────────────┘                                       │  │  │
│  │  └──────────────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  External: PostgreSQL (OVH CloudDB)                                  │
│            vz302017-001.ca.clouddb.ovh.net:35857                     │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Request Flow

```
User Browser
     │
     ▼
┌─────────────┐    Cache HIT     ┌────────────────┐
│  Cloudflare  │ ──────────────► │  Return cached  │
│     CDN      │                 │  response       │
└──────┬──────┘                  └────────────────┘
       │ Cache MISS
       ▼
┌─────────────┐
│   Traefik    │
│   Ingress    │
└──────┬──────┘
       │
       ├── /api/*  ──► costra-backend Service ──► Backend Pod (Node.js)
       │                                              │
       │                                              ├── PostgreSQL (external)
       │                                              └── Redis (infra namespace)
       │
       └── /*      ──► costra-frontend Service ──► Frontend Pod (nginx)
                                                       │
                                                       └── Serves React SPA
                                                           (index.html + /assets/*)
```

---

## CI/CD Pipeline

Triggered on every push to `main` or manual dispatch.

```
┌─────────────────────────────────────────────────────────────────────┐
│  GitHub Actions Workflow: build-push-deploy.yml                      │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  Job 1: build-and-push                                       │    │
│  │                                                               │    │
│  │  1. Checkout code                                             │    │
│  │  2. Login to AWS ECR                                          │    │
│  │  3. Build backend image (Dockerfile.backend)                  │    │
│  │  4. Build frontend image (Dockerfile.frontend)                │    │
│  │     └── Bakes in VITE_API_URL + VITE_GOOGLE_CLIENT_ID        │    │
│  │  5. Push both to ECR with tags: latest + <commit-sha>        │    │
│  └──────────────────────────┬──────────────────────────────────┘    │
│                              │ outputs: image_tag                    │
│                              ▼                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  Job 2: deploy                                                │    │
│  │                                                               │    │
│  │  1. Login to ECR                                              │    │
│  │  2. docker pull both images from ECR                          │    │
│  │  3. docker save | gzip → backend.tar.gz, frontend.tar.gz     │    │
│  │  4. SCP tarballs + k8s-deploy.sh to server via SSH            │    │
│  │  5. On server:                                                │    │
│  │     a. gunzip | k3s ctr images import (load into containerd)  │    │
│  │     b. kubectl set image deployment/... (update tag)          │    │
│  │     c. kubectl rollout status (wait for healthy pods)         │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

### Why images are transferred via SCP (not pulled on server)

The server does **not** have AWS CLI installed. Instead of pulling from ECR on the server, the CI runner (which has AWS credentials) pulls the images, saves them as tarballs, and transfers them to the server where they are imported into k3s's containerd runtime.

### Required GitHub Secrets

| Secret | Purpose |
|--------|---------|
| `AWS_ACCESS_KEY_ID` | ECR push/pull |
| `AWS_SECRET_ACCESS_KEY` | ECR push/pull |
| `SSH_PRIVATE_KEY` | Deploy to server |
| `SSH_HOST` | Server IP (comma-separated for multi-node) |
| `VITE_GOOGLE_CLIENT_ID` | Baked into frontend at build time |

---

## Namespace Layout

```
k3s Cluster
│
├── kube-system          (k3s system components)
│   ├── traefik          (ingress controller - built into k3s)
│   ├── coredns          (DNS)
│   └── metrics-server   (for HPA)
│
├── cert-manager         (TLS certificate automation)
│   └── cert-manager pods
│
├── infra                (shared infrastructure)
│   └── redis            (StatefulSet, 1 replica, 2Gi PVC)
│
└── costra               (application)
    ├── costra-secrets   (Secret - generated from .env)
    ├── costra-config    (ConfigMap - non-secret env vars)
    ├── costra-backend   (Deployment: 2-4 replicas)
    ├── costra-frontend  (Deployment: 2-3 replicas)
    ├── costra-backend   (Service: ClusterIP:3002)
    ├── costra-frontend  (Service: ClusterIP:8080)
    ├── costra-backend   (HPA: 70% CPU target)
    ├── costra-frontend  (HPA: 70% CPU target)
    └── costra-ingress   (Ingress: Traefik, TLS via cert-manager)
```

---

## Configuration & Secrets

### How secrets work

Secrets are stored in `.env` (gitignored) and **never committed** to git.

```
.env (on server, gitignored)
  │
  ├──► scripts/gen-k8s-secrets.sh
  │    Generates k8s/costra/secret.yaml (also gitignored)
  │    with base64-encoded values from .env
  │
  └──► scripts/create-secret-from-env.sh
       Creates secret directly via kubectl (alternative)
```

**To update secrets:**
1. Edit `.env` on the server
2. Run `./scripts/gen-k8s-secrets.sh`
3. Run `sudo kubectl apply -f k8s/costra/secret.yaml`
4. Restart backend pods: `sudo kubectl rollout restart deployment/costra-backend -n costra`

### ConfigMap vs Secret

| Resource | File | Contents |
|----------|------|----------|
| `costra-config` (ConfigMap) | `k8s/costra/configmap.yaml` | `NODE_ENV`, `PORT`, `REDIS_URL`, `FRONTEND_URL`, `VITE_API_URL` |
| `costra-secrets` (Secret) | `k8s/costra/secret.yaml` | Everything from `.env` (DATABASE_URL, JWT_SECRET, API keys, etc.) |

Both are mounted into backend pods via `envFrom`.

---

## Common Operations

### View pod status
```bash
sudo kubectl get pods -n costra
```

### View pod logs
```bash
# Backend logs (follow)
sudo kubectl logs -l component=backend -n costra -f --tail=100

# Frontend logs
sudo kubectl logs -l component=frontend -n costra -f --tail=100

# Specific pod
sudo kubectl logs costra-backend-665d77dbf6-6nqqr -n costra
```

### Restart a deployment
```bash
# Rolling restart (zero downtime)
sudo kubectl rollout restart deployment/costra-backend -n costra
```

### Scale manually
```bash
sudo kubectl scale deployment/costra-backend --replicas=3 -n costra
```

### Shell into a pod
```bash
sudo kubectl exec -it deploy/costra-backend -n costra -- sh
```

### Check resource usage
```bash
sudo kubectl top pods -n costra
sudo kubectl top nodes
```

### Update secrets
```bash
# Edit .env, then:
./scripts/gen-k8s-secrets.sh
sudo kubectl apply -f k8s/costra/secret.yaml
sudo kubectl rollout restart deployment/costra-backend -n costra
```

### Manual deploy (without CI/CD)
```bash
# Build locally
docker build -t costra-backend:v1 -f Dockerfile.backend .
docker build -t costra-frontend:v1 -f Dockerfile.frontend \
  --build-arg VITE_GOOGLE_CLIENT_ID=<your-id> .

# Import into k3s
docker save costra-backend:v1 | sudo k3s ctr images import -
docker save costra-frontend:v1 | sudo k3s ctr images import -

# Update deployment
sudo kubectl set image deployment/costra-backend backend=costra-backend:v1 -n costra
sudo kubectl set image deployment/costra-frontend frontend=costra-frontend:v1 -n costra
```

### Check all resources in namespace
```bash
sudo kubectl get all -n costra
```

---

## Troubleshooting Guide

### Decision Tree

```
Site not working?
│
├── Can't reach costra.app at all?
│   ├── Check Cloudflare DNS → A record points to server IP?
│   ├── Check server is reachable: ping <server-ip>
│   └── Check Traefik is running:
│       sudo kubectl get pods -n kube-system | grep traefik
│
├── Getting 404 "page not found"?
│   ├── Check ingress has an ADDRESS:
│   │   sudo kubectl get ingress -n costra
│   │   └── No address? → ingressClassName wrong (must be "traefik")
│   ├── Check ingress rules:
│   │   sudo kubectl describe ingress costra-ingress -n costra
│   └── Check services exist:
│       sudo kubectl get svc -n costra
│
├── Getting 502 Bad Gateway?
│   ├── Pods crashing → check logs:
│   │   sudo kubectl logs -l component=backend -n costra --tail=50
│   ├── Check pod status:
│   │   sudo kubectl get pods -n costra
│   │   └── CrashLoopBackOff? → App error (check logs)
│   │   └── ImagePullBackOff? → Image not imported (see below)
│   └── Check service endpoints:
│       sudo kubectl get endpoints -n costra
│       └── No endpoints? → Labels don't match between Service and Pod
│
├── ImagePullBackOff?
│   ├── Images must be imported via: docker save <img> | sudo k3s ctr images import -
│   ├── Check imported images: sudo k3s ctr images list | grep costra
│   ├── imagePullPolicy MUST be "Never" (we don't pull from ECR on server)
│   └── Re-import:
│       docker save <ecr-url>/costra-backend:<tag> | sudo k3s ctr images import -
│
├── API returns errors?
│   ├── Check backend logs:
│   │   sudo kubectl logs -l component=backend -n costra --tail=100
│   ├── Check secrets are loaded:
│   │   sudo kubectl exec deploy/costra-backend -n costra -- env | grep DATABASE
│   ├── Check DB connectivity:
│   │   sudo kubectl exec deploy/costra-backend -n costra -- \
│   │     node -e "require('./database.js').then(()=>console.log('OK'))"
│   └── Check Redis:
│       sudo kubectl exec -it redis-0 -n infra -- redis-cli ping
│
├── CI/CD deploy failed?
│   ├── Build failed → Check Dockerfile, npm install errors
│   ├── "aws: command not found" → Old deploy script. Images should be
│   │   transferred via SCP from CI, not pulled on server
│   ├── SSH connection refused → Check SSH_HOST, SSH_PRIVATE_KEY secrets
│   ├── "timed out waiting for rollout" → Pods crashing after deploy
│   │   └── Check: sudo kubectl describe pod <pod-name> -n costra
│   └── SCP failed → Disk space? Check: df -h
│
└── Pods running but site slow?
    ├── Check HPA status:
    │   sudo kubectl get hpa -n costra
    ├── Check resource usage:
    │   sudo kubectl top pods -n costra
    ├── Check node resources:
    │   sudo kubectl top nodes
    └── Purge Cloudflare cache:
        Cloudflare Dashboard → Caching → Purge Everything
```

### Pod Status Reference

| Status | Meaning | Fix |
|--------|---------|-----|
| `Running` | Healthy | — |
| `CrashLoopBackOff` | App crashes on startup | Check logs: `kubectl logs <pod>` |
| `ImagePullBackOff` | Can't find image | Import image into k3s containerd |
| `Pending` | No resources available | Check node capacity: `kubectl describe node` |
| `ErrImagePull` | First pull attempt failed | Same as ImagePullBackOff |
| `OOMKilled` | Ran out of memory | Increase memory limits in deployment |
| `ContainerCreating` | Starting up | Wait, or check events: `kubectl describe pod` |

### Check Events (most useful for debugging)

```bash
# Namespace events (sorted by time)
sudo kubectl get events -n costra --sort-by=.lastTimestamp

# Specific pod events
sudo kubectl describe pod <pod-name> -n costra
```

---

## Resource Limits

### Per Component

| Component | Requests (RAM/CPU) | Limits (RAM/CPU) | Min Replicas | Max Replicas |
|-----------|-------------------|------------------|-------------|-------------|
| Backend | 100Mi / 100m | 256Mi / 300m | 2 | 4 |
| Frontend | 16Mi / 50m | 32Mi / 100m | 2 | 3 |
| Redis | 16Mi / 50m | 64Mi / 100m | 1 | 1 |

### Autoscaling (HPA)

- **Target**: 70% average CPU utilization
- **Scale up**: 1 pod every 30s (after 30s stabilization)
- **Scale down**: 1 pod every 60s (after 5min stabilization)

### Total cluster usage at full scale

| | Min (4 backend + 4 frontend + redis) | Max (4+3+1) |
|---|---|---|
| RAM requests | 448Mi | 448Mi |
| RAM limits | 1.12Gi | 1.12Gi |
| CPU requests | 450m | 450m |
| CPU limits | 1.4 cores | 1.4 cores |

Server has 6 CPU / 12GB RAM — plenty of headroom for additional apps.

---

## File Reference

```
k8s/
├── cluster/                         # Shared infrastructure (apply once)
│   ├── clusterissuer.yaml           # Let's Encrypt ACME issuer (Traefik)
│   └── redis/
│       ├── namespace.yaml           # "infra" namespace
│       ├── statefulset.yaml         # Redis 7 with AOF persistence
│       └── service.yaml             # ClusterIP on port 6379
│
├── costra/                          # Application manifests
│   ├── namespace.yaml               # "costra" namespace
│   ├── configmap.yaml               # Non-secret environment variables
│   ├── secret.yaml                  # Generated from .env (GITIGNORED)
│   ├── secret.yaml.example          # Template showing required keys
│   ├── backend-deployment.yaml      # Node.js API (2-4 replicas)
│   ├── backend-service.yaml         # ClusterIP:3002
│   ├── backend-hpa.yaml             # CPU-based autoscaling
│   ├── frontend-deployment.yaml     # nginx serving React SPA (2-3 replicas)
│   ├── frontend-service.yaml        # ClusterIP:8080
│   ├── frontend-hpa.yaml            # CPU-based autoscaling
│   └── ingress.yaml                 # Traefik ingress + TLS
│
└── README.md                        # Quick-start deploy guide

scripts/
├── gen-k8s-secrets.sh               # Generate secret.yaml from .env
├── create-secret-from-env.sh        # Create secret directly via kubectl
└── k8s-deploy.sh                    # Called by CI to update deployments

.github/workflows/
└── build-push-deploy.yml            # CI/CD pipeline
```

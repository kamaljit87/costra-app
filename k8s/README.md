# Kubernetes Deployment

Multi-app Kubernetes setup for Costra and future apps. Shared infrastructure (ingress, cert-manager, Redis) is installed once; each app gets its own namespace.

**Server**: 6 CPU, 12GB RAM — fits 6-8 apps comfortably.

## Prerequisites

### 1. Install k3s (lightweight Kubernetes)

```bash
curl -sfL https://get.k3s.io | sh -
# Verify
kubectl get nodes
```

### 2. Install Helm

```bash
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
```

### 3. Install nginx-ingress-controller

```bash
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update
helm install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx --create-namespace \
  --set controller.resources.requests.memory=128Mi \
  --set controller.resources.requests.cpu=100m \
  --set controller.resources.limits.memory=256Mi \
  --set controller.resources.limits.cpu=200m
```

### 4. Install cert-manager

```bash
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.17.2/cert-manager.yaml
# Wait for pods to be ready
kubectl wait --for=condition=ready pod -l app.kubernetes.io/instance=cert-manager -n cert-manager --timeout=120s
```

## Deploy Shared Infrastructure

```bash
# ClusterIssuer + Redis (namespace, statefulset, service)
kubectl apply -R -f k8s/cluster/
# Verify Redis is running
kubectl get pods -n infra
```

## Deploy Costra

### 1. Configure secrets

Edit `k8s/costra/secret.yaml` and replace placeholder values with base64-encoded secrets:

```bash
# Encode a value
echo -n 'postgresql://user:pass@host:5432/costra' | base64
```

### 2. Build and tag container images

```bash
docker build -t costra-backend:latest -f Dockerfile.backend .
docker build -t costra-frontend:latest \
  --build-arg VITE_API_URL=/api \
  --build-arg VITE_GOOGLE_CLIENT_ID=your-client-id \
  -f Dockerfile.frontend .
```

> **Note**: If using a remote registry, push images and update image references in deployment manifests. For a single-node k3s setup, local images work via `imagePullPolicy: Never` (add to deployment specs).

### 3. Apply manifests

```bash
kubectl apply -R -f k8s/costra/
```

### 4. Verify

```bash
kubectl get pods -n costra                    # All Running
kubectl get svc -n costra                     # Services created
kubectl get ingress -n costra                 # Ingress with IP
kubectl get certificate -n costra             # TLS cert issued
kubectl get hpa -n costra                     # Autoscaler targets
curl -k https://costra.app/api/health         # Health check
```

## Updating an App

```bash
# Rebuild image
docker build -t costra-backend:v1.2 -f Dockerfile.backend .

# Rolling update
kubectl set image deployment/costra-backend backend=costra-backend:v1.2 -n costra

# Watch rollout
kubectl rollout status deployment/costra-backend -n costra
```

## Adding a New App

```bash
# 1. Copy template
cp -r k8s/costra k8s/newapp

# 2. Find/replace
#    - costra → newapp (namespace, resource names)
#    - costra.app → newapp.com (domain in ingress)
#    - Update image names

# 3. Fill in secret.yaml with new app's secrets

# 4. Deploy
kubectl apply -R -f k8s/newapp/
```

## Resource Allocation Per App

| Component | Requests (RAM/CPU) | Limits (RAM/CPU) | Replicas |
|-----------|-------------------|------------------|----------|
| Backend   | 100Mi / 100m      | 256Mi / 300m     | 2-4      |
| Frontend  | 16Mi / 50m        | 32Mi / 100m      | 2-3      |

Max per app at full scale: ~1.2GB RAM, ~1.6 CPU cores.

## Useful Commands

```bash
# Logs
kubectl logs -l component=backend -n costra --tail=100
kubectl logs -l component=frontend -n costra --tail=100

# Shell into a pod
kubectl exec -it deploy/costra-backend -n costra -- sh

# Scale manually
kubectl scale deployment/costra-backend --replicas=3 -n costra

# Check events (troubleshooting)
kubectl get events -n costra --sort-by=.lastTimestamp

# Restart a deployment (triggers rolling restart)
kubectl rollout restart deployment/costra-backend -n costra
```

## Directory Structure

```
k8s/
├── cluster/                    # Shared — apply once
│   ├── clusterissuer.yaml      # Let's Encrypt ACME issuer
│   └── redis/
│       ├── namespace.yaml      # infra namespace
│       ├── statefulset.yaml    # Redis with AOF persistence
│       └── service.yaml        # ClusterIP on port 6379
├── costra/                     # Per-app (template for new apps)
│   ├── namespace.yaml
│   ├── configmap.yaml          # Non-secret env vars
│   ├── secret.yaml             # Secrets (fill before applying)
│   ├── backend-deployment.yaml
│   ├── backend-service.yaml
│   ├── backend-hpa.yaml
│   ├── frontend-deployment.yaml
│   ├── frontend-service.yaml
│   ├── frontend-hpa.yaml
│   └── ingress.yaml            # TLS ingress with cert-manager
└── README.md
```

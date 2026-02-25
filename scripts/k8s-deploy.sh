#!/usr/bin/env bash
#
# Deploy Costra images to k3s.
# Called on the remote server after images are already imported into k3s containerd.
# Usage: bash k8s-deploy.sh REGISTRY NAMESPACE TAG DIR
#
set -e

REGISTRY="$1"
NS="$2"
TAG="$3"
DIR="$4"

echo "Deploying $REGISTRY/costra-{backend,frontend}:$TAG to namespace $NS"

# Pull latest code
cd "$DIR" && [ -d .git ] && git pull --ff-only || true

# Apply k8s manifests (infra + app configs)
sudo kubectl apply -f "$DIR/k8s/cluster/redis/" 2>/dev/null || true
sudo kubectl apply -f "$DIR/k8s/costra/middleware.yaml" 2>/dev/null || true
sudo kubectl apply -f "$DIR/k8s/costra/ingress.yaml" 2>/dev/null || true

# Update deployments
sudo kubectl set image deployment/costra-backend backend="$REGISTRY/costra-backend:$TAG" -n "$NS"
sudo kubectl set image deployment/costra-frontend frontend="$REGISTRY/costra-frontend:$TAG" -n "$NS"

# Wait for rollout
sudo kubectl rollout status deployment/costra-backend -n "$NS" --timeout=5m
sudo kubectl rollout status deployment/costra-frontend -n "$NS" --timeout=5m

echo "Rollout complete on $(hostname)"

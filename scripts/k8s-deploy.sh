#!/usr/bin/env bash
#
# Deploy Costdoq images to k3s.
# Called on the remote server after images are already imported into k3s containerd.
# Usage: bash k8s-deploy.sh REGISTRY NAMESPACE TAG DIR
#
set -e

REGISTRY="$1"
NS="$2"
TAG="$3"
DIR="$4"

echo "Deploying $REGISTRY/costdoq-{backend,frontend}:$TAG to namespace $NS"

# Pull latest k8s manifests (works with both full clone and sparse checkout)
cd "$DIR" && [ -d .git ] && git pull --ff-only || true

# Apply k8s manifests (infra + app configs)
[ -d "$DIR/k8s/cluster/redis" ] && sudo kubectl apply -f "$DIR/k8s/cluster/redis/" 2>/dev/null || true
[ -f "$DIR/k8s/costdoq/middleware.yaml" ] && sudo kubectl apply -f "$DIR/k8s/costdoq/middleware.yaml" 2>/dev/null || true
[ -f "$DIR/k8s/costdoq/ingress.yaml" ] && sudo kubectl apply -f "$DIR/k8s/costdoq/ingress.yaml" 2>/dev/null || true

# Update deployments
sudo kubectl set image deployment/costdoq-backend backend="$REGISTRY/costdoq-backend:$TAG" -n "$NS"
sudo kubectl set image deployment/costdoq-frontend frontend="$REGISTRY/costdoq-frontend:$TAG" -n "$NS"

# Wait for rollout
sudo kubectl rollout status deployment/costdoq-backend -n "$NS" --timeout=5m
sudo kubectl rollout status deployment/costdoq-frontend -n "$NS" --timeout=5m

echo "Rollout complete on $(hostname)"

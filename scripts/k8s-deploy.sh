#!/usr/bin/env bash
#
# Deploy Costra images to k3s.
# Called by GitHub Actions: bash k8s-deploy.sh REGION REGISTRY NAMESPACE TAG DIR
#
set -e

REGION="$1"
REGISTRY="$2"
NS="$3"
TAG="$4"
DIR="$5"

echo "Deploying $REGISTRY/costra-{backend,frontend}:$TAG to namespace $NS"

# Pull latest code
cd "$DIR" && [ -d .git ] && git pull --ff-only || true

# Get ECR credentials
ECR_PASS=$(aws ecr get-login-password --region "$REGION")

# Pull images via docker, import into k3s containerd
echo "$ECR_PASS" | docker login --username AWS --password-stdin "$REGISTRY"
docker pull "$REGISTRY/costra-backend:$TAG"
docker pull "$REGISTRY/costra-frontend:$TAG"
docker save "$REGISTRY/costra-backend:$TAG" | sudo k3s ctr images import -
docker save "$REGISTRY/costra-frontend:$TAG" | sudo k3s ctr images import -

# Update deployments
sudo kubectl set image deployment/costra-backend backend="$REGISTRY/costra-backend:$TAG" -n "$NS"
sudo kubectl set image deployment/costra-frontend frontend="$REGISTRY/costra-frontend:$TAG" -n "$NS"

# Wait for rollout
sudo kubectl rollout status deployment/costra-backend -n "$NS" --timeout=5m
sudo kubectl rollout status deployment/costra-frontend -n "$NS" --timeout=5m

echo "Rollout complete on $(hostname)"

#!/usr/bin/env bash
#
# Create or update a Kubernetes secret from a .env file.
# Usage: ./scripts/create-secret-from-env.sh [OPTIONS] [ENV_FILE]
#
# Options:
#   -n, --namespace NAME   Kubernetes namespace (default: costra)
#   -s, --secret-name NAME Secret name (default: costra-env)
#   -h, --help             Show this help
#
# Example:
#   ./scripts/create-secret-from-env.sh
#   ./scripts/create-secret-from-env.sh -n costra -s costra-env .env
#   ./scripts/create-secret-from-env.sh .env.production
#

set -e

NAMESPACE="${K8S_NAMESPACE:-costra}"
SECRET_NAME="costra-secrets"
ENV_FILE=".env"

usage() {
  sed -n '2,17p' "$0" | sed 's/^# \?//'
  exit 0
}

while [ $# -gt 0 ]; do
  case "$1" in
    -n|--namespace)
      NAMESPACE="$2"
      shift 2
      ;;
    -s|--secret-name)
      SECRET_NAME="$2"
      shift 2
      ;;
    -h|--help)
      usage
      ;;
    -*)
      echo "Unknown option: $1" >&2
      usage
      ;;
    *)
      ENV_FILE="$1"
      shift
      ;;
  esac
done

if [ ! -f "$ENV_FILE" ]; then
  echo "Error: Env file not found: $ENV_FILE" >&2
  exit 1
fi

if ! command -v kubectl &>/dev/null; then
  echo "Error: kubectl is required but not installed or not in PATH." >&2
  exit 1
fi

TMPFILE=$(mktemp)
trap 'rm -f "$TMPFILE"' EXIT
grep -v '^#' "$ENV_FILE" | grep -v '^[[:space:]]*$' | grep '=' > "$TMPFILE" || true

if [ ! -s "$TMPFILE" ]; then
  echo "Error: No KEY=value lines found in $ENV_FILE" >&2
  exit 1
fi

echo "Creating/updating secret '$SECRET_NAME' in namespace '$NAMESPACE' from $ENV_FILE"

kubectl create secret generic "$SECRET_NAME" \
  --from-env-file="$TMPFILE" \
  --namespace="$NAMESPACE" \
  --dry-run=client \
  -o yaml \
  | kubectl apply -f -

echo "Done. Secret '$SECRET_NAME' is ready in namespace '$NAMESPACE'."

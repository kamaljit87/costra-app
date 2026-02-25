#!/usr/bin/env bash
#
# Generate k8s/costra/secret.yaml from .env
# Usage: ./scripts/gen-k8s-secrets.sh [.env]
#
# Reads ALL key=value pairs from the .env file and writes
# k8s/costra/secret.yaml with base64-encoded values.
# The generated file is gitignored — never commit real secrets.
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${1:-$REPO_ROOT/.env}"
OUTPUT="$REPO_ROOT/k8s/costra/secret.yaml"

if [ ! -f "$ENV_FILE" ]; then
  echo "Error: $ENV_FILE not found" >&2
  exit 1
fi

# Build the YAML header
cat > "$OUTPUT" <<'HEADER'
apiVersion: v1
kind: Secret
metadata:
  name: costra-secrets
  namespace: costra
  labels:
    app: costra
type: Opaque
data:
HEADER

count=0
while IFS= read -r line; do
  # Skip comments and blank lines
  [[ "$line" =~ ^[[:space:]]*# ]] && continue
  [[ -z "${line// /}" ]] && continue
  # Must contain =
  [[ "$line" != *=* ]] && continue

  key="${line%%=*}"
  val="${line#*=}"

  # Skip empty values
  [ -z "$val" ] && continue

  encoded=$(printf '%s' "$val" | base64 -w0)
  printf '  %s: %s\n' "$key" "$encoded" >> "$OUTPUT"
  count=$((count + 1))
done < "$ENV_FILE"

echo "Generated $OUTPUT with $count keys from $ENV_FILE"

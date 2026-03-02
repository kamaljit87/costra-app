#!/usr/bin/env bash
#
# One-time setup: configure git sparse checkout on a production server
# so only k8s/ and scripts/ directories are checked out (not the full codebase).
#
# Usage:
#   bash server-setup-sparse.sh [REPO_URL] [TARGET_DIR]
#
# Defaults:
#   REPO_URL  = git@github.com:kamaljit87/costra-app.git
#   TARGET_DIR = /var/servers/costra-app
#
set -euo pipefail

REPO_URL="${1:-git@github.com:kamaljit87/costra-app.git}"
TARGET_DIR="${2:-/var/servers/costra-app}"

echo "=== Costra sparse checkout setup ==="
echo "Repo:   $REPO_URL"
echo "Target: $TARGET_DIR"
echo ""

# Safety check — don't blow away an existing directory without confirmation
if [ -d "$TARGET_DIR" ]; then
    echo "WARNING: $TARGET_DIR already exists."
    echo "Back up any local files (e.g. .env, secret.yaml) before proceeding."
    echo ""
    read -rp "Remove existing directory and re-clone? [y/N] " confirm
    if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
        echo "Aborted."
        exit 1
    fi
    rm -rf "$TARGET_DIR"
fi

# Clone with blob filter (downloads only what's needed) + sparse checkout
git clone --filter=blob:none --sparse "$REPO_URL" "$TARGET_DIR"
cd "$TARGET_DIR"

# Enable cone-mode sparse checkout and select only deploy-relevant directories
git sparse-checkout init --cone
git sparse-checkout set k8s scripts

echo ""
echo "=== Done ==="
echo "Checked out directories:"
ls -d */
echo ""
echo "Server footprint: $(du -sh . --exclude=.git | cut -f1) (plus $(du -sh .git | cut -f1) git metadata)"
echo ""
echo "Next steps:"
echo "  1. Restore .env if needed:  cp /path/to/backup/.env $TARGET_DIR/.env"
echo "  2. Future deploys will auto-update via: git pull --ff-only"

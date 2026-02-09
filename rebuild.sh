#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="/home/vagrant/costra"
cd "$PROJECT_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${CYAN}[rebuild]${NC} $1"; }
ok()   { echo -e "${GREEN}[  ok  ]${NC} $1"; }
warn() { echo -e "${YELLOW}[ warn ]${NC} $1"; }
fail() { echo -e "${RED}[failed]${NC} $1"; exit 1; }

# ------------------------------------------------------------------
# Parse flags
# ------------------------------------------------------------------
SKIP_FRONTEND=false
SKIP_BACKEND=false
PRODUCTION=false

for arg in "$@"; do
  case "$arg" in
    --frontend-only) SKIP_BACKEND=true ;;
    --backend-only)  SKIP_FRONTEND=true ;;
    --production)    PRODUCTION=true ;;
    --help|-h)
      echo "Usage: ./rebuild.sh [options]"
      echo ""
      echo "Options:"
      echo "  --frontend-only   Rebuild frontend and restart Vite only"
      echo "  --backend-only    Restart backend server only"
      echo "  --production      Build frontend for production"
      echo "  -h, --help        Show this help"
      exit 0
      ;;
    *) warn "Unknown flag: $arg (ignored)" ;;
  esac
done

# ------------------------------------------------------------------
# 1. Ensure logs directory
# ------------------------------------------------------------------
log "Ensuring logs directory exists..."
mkdir -p "$PROJECT_DIR/logs"
ok "logs/"

# ------------------------------------------------------------------
# 2. Install / refresh dependencies
# ------------------------------------------------------------------
log "Installing root dependencies..."
npm install --silent 2>&1 | tail -1 || fail "npm install (root) failed"
ok "Root dependencies"

if [ "$SKIP_BACKEND" = false ]; then
  log "Installing server dependencies..."
  (cd server && npm install --silent 2>&1 | tail -1) || fail "npm install (server) failed"
  ok "Server dependencies"
fi

# ------------------------------------------------------------------
# 3. Clear Vite dep cache
# ------------------------------------------------------------------
if [ "$SKIP_FRONTEND" = false ]; then
  log "Clearing Vite dependency cache..."
  rm -rf node_modules/.vite
  ok "Vite cache cleared"
fi

# ------------------------------------------------------------------
# 4. Build frontend (production only)
# ------------------------------------------------------------------
if [ "$PRODUCTION" = true ] && [ "$SKIP_FRONTEND" = false ]; then
  log "Building frontend for production..."
  npx vite build || fail "Vite build failed"
  ok "Frontend built"
fi

# ------------------------------------------------------------------
# 5. Stop existing PM2 processes
# ------------------------------------------------------------------
log "Stopping PM2 processes..."
npx pm2 delete all 2>/dev/null || true
ok "PM2 processes cleared"

# ------------------------------------------------------------------
# 6. Start PM2 processes
# ------------------------------------------------------------------
if [ "$PRODUCTION" = true ]; then
  PM2_ENV="--env production"
else
  PM2_ENV=""
fi

if [ "$SKIP_FRONTEND" = true ]; then
  log "Starting backend only..."
  npx pm2 start ecosystem.config.cjs --only costra-backend $PM2_ENV
  ok "Backend started"
elif [ "$SKIP_BACKEND" = true ]; then
  log "Starting frontend only..."
  npx pm2 start ecosystem.config.cjs --only costra-frontend $PM2_ENV
  ok "Frontend started"
else
  log "Starting all services..."
  npx pm2 start ecosystem.config.cjs $PM2_ENV
  ok "All services started"
fi

# ------------------------------------------------------------------
# 7. Save PM2 process list
# ------------------------------------------------------------------
npx pm2 save --force 2>/dev/null || true

# ------------------------------------------------------------------
# 8. Show status
# ------------------------------------------------------------------
echo ""
npx pm2 status
echo ""
ok "Rebuild complete. Use 'npx pm2 logs' to tail output."

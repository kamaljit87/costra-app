#!/usr/bin/env bash
# One-time setup: obtain Let's Encrypt certificate and switch nginx to HTTPS.
# Prereqs: DNS for your domain must point to this server; ports 80 and 443 open.
#
# Usage:
#   LETSENCRYPT_DOMAIN=costra.app LETSENCRYPT_EMAIL=admin@costra.app ./docker/init-letsencrypt.sh
#   Or: ./docker/init-letsencrypt.sh costra.app admin@costra.app

set -e
cd "$(dirname "$0")/.."

DOMAIN="${LETSENCRYPT_DOMAIN:-$1}"
EMAIL="${LETSENCRYPT_EMAIL:-$2}"
if [[ -z "$DOMAIN" || -z "$EMAIL" ]]; then
  echo "Usage: LETSENCRYPT_DOMAIN=example.com LETSENCRYPT_EMAIL=you@example.com $0"
  echo "   Or: $0 example.com you@example.com"
  exit 1
fi

echo "Using domain=$DOMAIN email=$EMAIL"
echo "Ensure DNS for $DOMAIN points to this server and ports 80/443 are open."
read -p "Continue? [y/N] " -n 1 -r; echo
[[ $REPLY =~ ^[yY] ]] || exit 0

# nginx-reverse-proxy.conf is HTTP-only + ACME; nginx can start without certs
echo "Starting nginx (HTTP only)..."
docker compose up -d costra-nginx
sleep 3

echo "Requesting certificate from Let's Encrypt..."
docker compose run --rm costra-certbot certonly \
  --webroot -w /var/www/certbot \
  -d "$DOMAIN" \
  --email "$EMAIL" \
  --agree-tos \
  --non-interactive \
  --force-renewal

# Switch to full config (HTTP redirect + HTTPS) with this domain's cert path
echo "Enabling HTTPS in nginx..."
sed "s/costra\.app/$DOMAIN/g" docker/nginx-reverse-proxy-full.conf > docker/nginx-reverse-proxy.conf

docker compose exec costra-nginx nginx -t
docker compose exec costra-nginx nginx -s reload
echo "Done. HTTPS is active for https://$DOMAIN"
echo "Start the certbot renewal service: docker compose up -d costra-certbot"

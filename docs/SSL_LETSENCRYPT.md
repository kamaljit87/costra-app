# SSL with Let's Encrypt (Certbot + Docker)

## Prerequisites

- Your domain (e.g. `costra.app`) must point to this server (A/AAAA records).
- Ports **80** and **443** must be open from the internet (for HTTP-01 challenge and HTTPS).

## One-time setup

From the project root:

```bash
# Option 1: environment variables
export LETSENCRYPT_DOMAIN=costra.app
export LETSENCRYPT_EMAIL=admin@costra.app
./docker/init-letsencrypt.sh

# Option 2: arguments
./docker/init-letsencrypt.sh costra.app admin@costra.app
```

The script will:

1. Start nginx with HTTP only (and ACME challenge path).
2. Run Certbot to obtain a certificate for your domain.
3. Switch nginx to the full config (HTTP → redirect to HTTPS, serve HTTPS with the new cert).
4. Reload nginx.

Then start the renewal container so certs are renewed automatically:

```bash
docker compose up -d costra-certbot
```

## Renewal

The `costra-certbot` service runs in the background and renews certificates every 12 hours (only when near expiry). No extra cron needed.

To renew manually:

```bash
docker compose run --rm costra-certbot renew --webroot -w /var/www/certbot
docker compose exec costra-nginx nginx -s reload
```

## First certificate only (no HTTPS yet)

If you only want to obtain the cert and keep serving HTTP for now:

```bash
docker compose up -d costra-nginx
docker compose run --rm costra-certbot certonly \
  --webroot -w /var/www/certbot \
  -d yourdomain.com \
  --email you@example.com \
  --agree-tos --non-interactive
```

Do **not** replace `docker/nginx-reverse-proxy.conf` with the full config until you are ready to enable HTTPS.

## Different domain

- Use your domain in the init script (`LETSENCRYPT_DOMAIN` or first argument).
- The script substitutes it into the nginx SSL config (cert paths and any `server_name`).
- If you edit `docker/nginx-reverse-proxy-full.conf` by hand, replace `costra.app` with your domain in the `ssl_certificate` and `ssl_certificate_key` paths.

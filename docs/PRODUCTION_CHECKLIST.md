# Production Readiness Checklist

## Architecture

- **Modular app**: `server/app.js` factory creates Express app; `server/routes/index.js` aggregates routes
- **Graceful shutdown**: SIGTERM/SIGINT close HTTP server, DB pool, Redis before exit
- **Error handling**: Centralized middleware, React ErrorBoundary, 404 handler for unknown API routes

## Pre-Deploy

| Check | Action |
|-------|--------|
| `NODE_ENV=production` | Set in deployment |
| `JWT_SECRET` | Min 32 chars, not placeholder |
| `DATABASE_URL` | PostgreSQL connection string |
| `ENCRYPTION_KEY` | Min 32 chars (for credential storage) |
| `FRONTEND_URL` | CORS origin for frontend |
| `npm run build` | Frontend builds successfully |
| `npm run lint` | Lint passes (warnings allowed) |
| `npm test -- tests/unit` | Unit tests pass |

## Health Checks

- `GET /api/health` — Liveness
- `GET /api/health/ready` — Readiness (DB connected)
- `GET /metrics` — Prometheus (requires `METRICS_TOKEN` in production)

## Monitoring

- **Sentry**: Set `SENTRY_DSN` for error tracking
- **Redis**: Set `REDIS_URL` for caching (optional)
- **Metrics**: Set `METRICS_TOKEN` for Prometheus scrape

## File Structure

```
server/
├── app.js          # Express app factory (modular)
├── server.js       # Entry point, init, graceful shutdown
├── routes/
│   ├── index.js    # Route aggregator
│   └── *.js        # Route modules
├── middleware/     # Shared middleware
├── services/       # Business logic
└── utils/          # Helpers, config, logger
```

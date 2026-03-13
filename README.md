# Costdoq — Multi-Cloud Cost Management

Costdoq is a FinOps platform that gives engineering and finance teams a single dashboard for all their cloud spending. Connect AWS, Azure, and GCP accounts, track costs in real time, catch anomalies before they hit your bill, and right-size resources — all from one place.

## What it does

- **Unified dashboard** — See month-to-date spend across every cloud provider at a glance, broken down by service, account, and region.
- **Anomaly detection** — ML-powered alerts with AI root cause analysis when spending spikes unexpectedly.
- **Budgets & policies** — Set spending limits and governance rules, get notified when thresholds are breached.
- **Forecasting** — Project future costs using historical trends and model what-if scenarios.
- **Cost allocation** — Split shared costs across teams and projects for accurate chargeback reporting.
- **RI/SP tracking** — Monitor Reserved Instance and Savings Plan utilisation, catch expiring commitments.
- **Kubernetes costs** — Namespace and pod-level cost breakdowns with idle resource detection.
- **Terraform estimation** — Predict the cost impact of infrastructure changes before applying them.
- **SaaS spend** — Track software subscriptions, spot unused licences, and consolidate tools.
- **Custom dashboards** — Build your own views with drag-and-drop widgets.
- **Reports** — Generate on-demand or scheduled reports with CSV/PDF export and email delivery.
- **Notifications** — Email alerts (budget, anomaly, weekly summary) and Slack integration for daily digests and real-time alerts.
- **Multi-currency** — View all costs in your preferred currency with real-time exchange rates.

## Tech stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Backend | Node.js (ESM), Express, PostgreSQL |
| Auth | Email/password, Google OAuth, TOTP 2FA, JWT |
| Payments | Dodo Payments (checkout, webhooks, subscriptions) |
| Infrastructure | Docker Compose (dev), k3s / Kubernetes (prod) |
| CI/CD | GitHub Actions → ECR → k3s deploy via SSH |
| CDN | Cloudflare |
| Monitoring | Sentry, Prometheus metrics, Winston logging |

## Getting started

### Prerequisites

- Docker and Docker Compose

### Development

```bash
# Clone and start everything
cp .env.example .env        # edit with your values
docker compose up -d         # starts frontend, backend, postgres, redis
```

The app will be available at `http://localhost:5173` (frontend) and `http://localhost:3002/api` (backend).

### Environment variables

Copy `.env.example` and fill in at minimum:

```bash
DATABASE_URL=postgresql://postgres:postgres@costdoq-db:5432/costdoq
JWT_SECRET=your-secret-key-min-32-chars
FRONTEND_URL=http://localhost:5173
VITE_API_URL=http://localhost:3002/api
```

See [docs/ENVIRONMENT_VARIABLES.md](docs/ENVIRONMENT_VARIABLES.md) for the full reference.

## Project structure

```
costdoq-app/
├── src/                     # React frontend
│   ├── components/          # Reusable UI components
│   ├── contexts/            # Auth, Theme, Currency contexts
│   ├── pages/               # Route pages
│   ├── services/api.ts      # API client
│   └── data/                # Static content (feature info)
├── server/                  # Express backend
│   ├── routes/              # API route handlers
│   ├── services/            # Business logic (billing, costs, sync)
│   ├── middleware/           # Auth, org, rate limiting
│   └── database.js          # PostgreSQL schema and queries
├── k8s/                     # Kubernetes manifests (production)
├── docker/                  # nginx config
├── docs/                    # Documentation
├── scripts/                 # Deploy and setup scripts
├── docker-compose.yml       # Development environment
├── Dockerfile.frontend      # Frontend build
└── Dockerfile.backend       # Backend build
```

## Subscription plans

| | Trial | Starter | Pro |
|--|-------|---------|-----|
| Duration | 7 days | Monthly / Annual | Monthly / Annual |
| Cloud accounts | Unlimited | 3 | Unlimited |
| History | 12 months | 6 months | 12 months |
| Anomaly detection | Yes | Yes | Yes |
| CSV export | — | Yes | Yes |
| Email alerts | — | — | Yes |
| Unit economics | — | — | Yes |

## Deployment

Production runs on **k3s** (lightweight Kubernetes). The GitHub Actions pipeline builds Docker images, pushes to ECR, transfers them to the server, and deploys via `kubectl`.

```bash
# Manual deploy (from server)
bash scripts/k8s-deploy.sh <registry> <namespace> <tag> <app-dir>
```

See [k8s/README.md](k8s/README.md) for cluster setup and [docs/](docs/) for detailed guides.

## Documentation

- [Dodo Payments Setup](docs/DODO_PAYMENTS_SETUP.md)
- [Environment Variables](docs/ENVIRONMENT_VARIABLES.md)
- [PostgreSQL Setup](docs/POSTGRESQL_SETUP.md)
- [SSL / Let's Encrypt](docs/SSL_LETSENCRYPT.md)
- [Sentry Setup](docs/SENTRY_SETUP_GUIDE.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [Launch Testing Plan](docs/LAUNCH_TESTING_PLAN.md)
- [User Documentation](docs/USER_DOCUMENTATION.md)

## License

MIT

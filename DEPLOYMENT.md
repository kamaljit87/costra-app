# Costra Deployment Guide

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Database Setup](#database-setup)
4. [Application Deployment](#application-deployment)
5. [SSL/TLS Configuration](#ssltls-configuration)
6. [Process Management](#process-management)
7. [Monitoring & Health Checks](#monitoring--health-checks)
8. [Rollback Procedures](#rollback-procedures)
9. [Troubleshooting](#troubleshooting)

## Prerequisites

### System Requirements
- **Node.js**: 18.x or higher
- **PostgreSQL**: 12.x or higher
- **Redis**: 6.x or higher (optional, for caching)
- **Operating System**: Linux (Ubuntu 20.04+ recommended), macOS, or Windows Server

### Software Dependencies
```bash
# Install Node.js (if not already installed)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL
sudo apt-get update
sudo apt-get install -y postgresql postgresql-contrib

# Install Redis (optional)
sudo apt-get install -y redis-server

# Install PM2 (for process management)
sudo npm install -g pm2
```

## Environment Setup

### 1. Clone Repository
```bash
git clone https://github.com/your-org/costra.git
cd costra
```

### 2. Install Dependencies
```bash
# Backend
cd server
npm install --production

# Frontend (if deploying frontend)
cd ../src
npm install --production
npm run build
```

### 3. Configure Environment Variables
```bash
# Copy example environment file
cp server/.env.example server/.env

# Edit environment variables
nano server/.env
```

**Required Variables:**
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: Secret key for JWT tokens (min 32 chars)
- `NODE_ENV`: Set to `production`
- `FRONTEND_URL`: Frontend application URL

**Optional Variables:**
- `REDIS_URL`: Redis connection string (for caching)
- `SENTRY_DSN`: Sentry error tracking DSN
- `SLACK_WEBHOOK_URL`: Slack webhook for alerts
- `ALERT_EMAIL`: Email for alerts

See `server/.env.example` for complete list of variables.

### 4. Generate JWT Secret
```bash
# Generate a strong secret key
openssl rand -base64 32
```

Add the generated secret to `JWT_SECRET` in `.env`.

## Database Setup

### 1. Create Database
```bash
# Connect to PostgreSQL
sudo -u postgres psql

# Create database and user
CREATE DATABASE costra;
CREATE USER costra_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE costra TO costra_user;

# Exit psql
\q
```

### 2. Update DATABASE_URL
Update `DATABASE_URL` in `.env`:
```
DATABASE_URL=postgresql://costra_user:your_secure_password@localhost:5432/costra
```

### 3. Initialize Database Schema
```bash
cd server
npm start
```

The database schema will be automatically created on first run.

### 4. Create Database Backup
```bash
# Create backup script
sudo crontab -e

# Add daily backup (runs at 2 AM)
0 2 * * * pg_dump -U costra_user costra > /backups/costra_$(date +\%Y\%m\%d).sql
```

## Application Deployment

### Option 1: PM2 Process Manager (Recommended)

#### 1. Start Application
```bash
cd server
pm2 start server.js --name costra-backend
```

#### 2. Configure PM2
```bash
# Save PM2 configuration
pm2 save

# Setup PM2 to start on system boot
pm2 startup
# Follow the instructions provided
```

#### 3. Monitor Application
```bash
# View logs
pm2 logs costra-backend

# View status
pm2 status

# Restart application
pm2 restart costra-backend

# Stop application
pm2 stop costra-backend
```

### Option 2: Systemd Service

#### 1. Create Service File
```bash
sudo nano /etc/systemd/system/costra.service
```

```ini
[Unit]
Description=Costra API Server
After=network.target postgresql.service

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/costra/server
Environment=NODE_ENV=production
EnvironmentFile=/path/to/costra/server/.env
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

#### 2. Enable and Start Service
```bash
sudo systemctl daemon-reload
sudo systemctl enable costra
sudo systemctl start costra
sudo systemctl status costra
```

## SSL/TLS Configuration

### Using Nginx as Reverse Proxy

#### 1. Install Nginx
```bash
sudo apt-get install -y nginx
```

#### 2. Configure Nginx
```bash
sudo nano /etc/nginx/sites-available/costra
```

```nginx
server {
    listen 80;
    server_name api.costra.com;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.costra.com;

    ssl_certificate /etc/letsencrypt/live/api.costra.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.costra.com/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

#### 3. Enable Site and Test
```bash
sudo ln -s /etc/nginx/sites-available/costra /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

#### 4. Obtain SSL Certificate (Let's Encrypt)
```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.costra.com
```

## Process Management

### PM2 Commands
```bash
# View all processes
pm2 list

# View logs
pm2 logs

# Restart all processes
pm2 restart all

# Stop all processes
pm2 stop all

# Delete process
pm2 delete costra-backend

# Monitor resources
pm2 monit
```

### Health Checks
```bash
# Check application health
curl http://localhost:3001/api/health

# Check liveness (for Kubernetes)
curl http://localhost:3001/api/health/liveness

# Check readiness
curl http://localhost:3001/api/health/readiness
```

## Monitoring & Health Checks

### Health Check Endpoints
- `GET /api/health`: Comprehensive health check
- `GET /api/health/liveness`: Liveness probe
- `GET /api/health/readiness`: Readiness probe
- `GET /metrics`: Prometheus metrics

### Monitoring Setup
1. **Prometheus**: Scrape metrics from `/metrics` endpoint
2. **Grafana**: Create dashboards using Prometheus data
3. **Alerting**: Configure alerts via Slack/Email (see `server/utils/alerting.js`)

### Log Management
```bash
# View application logs
pm2 logs costra-backend

# View error logs
tail -f server/logs/error-*.log

# View combined logs
tail -f server/logs/combined-*.log
```

## Rollback Procedures

### 1. Application Rollback
```bash
# Stop current version
pm2 stop costra-backend

# Checkout previous version
git checkout <previous-commit-hash>

# Install dependencies (if changed)
npm install --production

# Restart application
pm2 restart costra-backend
```

### 2. Database Rollback
```bash
# Restore from backup
psql -U costra_user costra < /backups/costra_YYYYMMDD.sql
```

### 3. Configuration Rollback
```bash
# Restore previous .env
cp server/.env.backup server/.env
pm2 restart costra-backend
```

## Troubleshooting

### Application Won't Start
1. Check environment variables: `cat server/.env`
2. Check logs: `pm2 logs costra-backend`
3. Verify database connection: `psql $DATABASE_URL`
4. Check port availability: `netstat -tulpn | grep 3001`

### Database Connection Issues
1. Verify PostgreSQL is running: `sudo systemctl status postgresql`
2. Check connection string format
3. Verify user permissions: `psql -U costra_user -d costra`
4. Check firewall rules

### High Memory Usage
1. Check memory: `pm2 monit`
2. Restart application: `pm2 restart costra-backend`
3. Adjust database pool size in `.env`
4. Enable Redis caching to reduce database load

### Slow Response Times
1. Check database query performance
2. Verify Redis is working (if enabled)
3. Check system resources: `htop`
4. Review slow query logs

### SSL Certificate Issues
1. Check certificate expiration: `sudo certbot certificates`
2. Renew certificate: `sudo certbot renew`
3. Verify Nginx configuration: `sudo nginx -t`

## Deployment Checklist

- [ ] All prerequisites installed
- [ ] Environment variables configured
- [ ] Database created and initialized
- [ ] JWT secret generated (32+ characters)
- [ ] Application starts successfully
- [ ] Health checks passing
- [ ] SSL/TLS configured (if using HTTPS)
- [ ] Reverse proxy configured (if using Nginx)
- [ ] Process manager configured (PM2 or systemd)
- [ ] Monitoring and alerting configured
- [ ] Backup strategy in place
- [ ] Log rotation configured
- [ ] Firewall rules configured
- [ ] Documentation updated

## Support

For issues or questions:
- Check logs: `pm2 logs costra-backend`
- Review health endpoint: `curl http://localhost:3001/api/health`
- Check metrics: `curl http://localhost:3001/metrics`
- Review documentation: See `README.md` and `API_DOCUMENTATION.md`

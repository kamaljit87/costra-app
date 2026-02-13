# Database Migration for Production

Run the migration script to create the Costra database schema on your managed PostgreSQL (RDS, Cloud SQL, etc.).

## Prerequisites

1. **Database exists** – Create the database in your cloud console:
   - **AWS RDS**: Create database and run `CREATE DATABASE costra;` as master user
   - **GCP Cloud SQL**: Create instance, then create database `costra`
   - **Azure**: Create PostgreSQL server, create database `costra`

2. **Connection string** – You need:
   ```
   postgresql://USERNAME:PASSWORD@HOST:PORT/DATABASE_NAME
   ```

## Run migration

### Option 1: Direct (from project root)

```bash
DATABASE_URL="postgresql://user:password@your-db-host:5432/costra" node server/scripts/migrate.js
```

### Option 2: Via npm (from server directory)

```bash
cd server
DATABASE_URL="postgresql://user:password@your-db-host:5432/costra" npm run migrate
```

### Option 3: Using .env file

```bash
# In server/.env
DATABASE_URL=postgresql://user:password@your-rds-endpoint:5432/costra

# Then run
cd server && npm run migrate
```

## Docker / CI

```bash
docker run --rm -e DATABASE_URL="postgresql://..." costra-backend:latest node scripts/migrate.js
```

Or add to your deployment pipeline before starting the app.

## Idempotent

The migration is safe to run multiple times. It uses:
- `CREATE TABLE IF NOT EXISTS`
- `ALTER TABLE ... ADD COLUMN` only when column doesn't exist
- `CREATE INDEX IF NOT EXISTS`

## What it creates

- Tables: users, user_preferences, cloud_provider_credentials, cost_data, budgets, reports, etc.
- Indexes for performance
- All schema updates (new columns, constraints) for the current app version

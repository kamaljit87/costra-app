# PostgreSQL Setup Guide

This guide will help you set up PostgreSQL for the Costra application.

## Installation

### macOS
```bash
brew install postgresql
brew services start postgresql
```

### Ubuntu/Debian
```bash
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### Windows
Download and install from [postgresql.org](https://www.postgresql.org/download/windows/)

## Database Setup

1. **Connect to PostgreSQL:**
```bash
# macOS/Linux
psql postgres

# Or with specific user
sudo -u postgres psql
```

2. **Create database:**
```sql
CREATE DATABASE costra;
```

3. **Create user (optional - you can use the default postgres user):**
```sql
CREATE USER costra_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE costra TO costra_user;
```

4. **Exit psql:**
```sql
\q
```

## Configuration

1. **Set up environment variables in `server/.env`:**
```bash
cd server
cp .env.example .env
```

2. **Edit `.env` and set DATABASE_URL:**
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/costra
```

Or if using a custom user:
```
DATABASE_URL=postgresql://costra_user:your_secure_password@localhost:5432/costra
```

## Verify Connection

Test the connection:
```bash
psql postgresql://postgres:postgres@localhost:5432/costra
```

If successful, you should see the PostgreSQL prompt.

## Start the Server

The database schema will be automatically created when you start the server:

```bash
cd server
npm install
npm run dev
```

You should see: "Connected to PostgreSQL database" and "Database schema initialized successfully"

## Troubleshooting

### Connection Refused
- Make sure PostgreSQL is running: `sudo systemctl status postgresql` (Linux) or `brew services list` (macOS)
- Check PostgreSQL is listening on port 5432: `netstat -an | grep 5432`

### Authentication Failed
- Verify username and password in DATABASE_URL
- Check `pg_hba.conf` for authentication settings
- Try connecting with: `psql -U postgres -d costra`

### Database Does Not Exist
- Create it: `createdb costra` or `psql -c "CREATE DATABASE costra;"`

### Permission Denied
```sql
GRANT ALL PRIVILEGES ON DATABASE costra TO your_username;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_username;
```

## Production Considerations

For production deployments:
1. Use strong passwords
2. Enable SSL connections
3. Use connection pooling (PgBouncer)
4. Set up regular backups
5. Monitor database performance
6. Use environment variables for sensitive data

# Costra Backend Server

Backend API server for Costra multi-cloud cost management platform.

## Prerequisites

- Node.js 18+
- PostgreSQL 12+ installed and running

## Database Setup

1. **Install PostgreSQL** (if not already installed):
   - macOS: `brew install postgresql`
   - Ubuntu/Debian: `sudo apt-get install postgresql postgresql-contrib`
   - Windows: Download from [postgresql.org](https://www.postgresql.org/download/)

2. **Create database and user**:
```bash
# Connect to PostgreSQL
sudo -u postgres psql

# Create database
CREATE DATABASE costra;

# Create user (optional, or use existing postgres user)
CREATE USER costra_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE costra TO costra_user;

# Exit psql
\q
```

3. **Set up connection string** in `.env`:
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/costra
```

Or if using a custom user:
```
DATABASE_URL=postgresql://costra_user:your_password@localhost:5432/costra
```

## Setup

1. Install dependencies:
```bash
cd server
npm install
```

2. Create `.env` file (copy from `.env.example`):
```bash
cp .env.example .env
```

3. Update `.env` with your configuration:
```
PORT=3001
JWT_SECRET=your-secret-key-change-this-in-production
NODE_ENV=development
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/costra
```

## Running

Development mode (auto-reload on changes):
```bash
npm run dev
```

Production mode:
```bash
npm start
```

The server will run on `http://localhost:3001`

The database schema will be automatically created on first run.

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Create new user account
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user (requires auth)

### Cost Data
- `GET /api/cost-data` - Get user's cost data (requires auth)
- `POST /api/cost-data` - Save cost data (requires auth)
- `GET /api/cost-data/preferences` - Get user preferences (requires auth)
- `PUT /api/cost-data/preferences/currency` - Update currency preference (requires auth)

### Savings Plans
- `GET /api/savings-plans` - Get user's savings plans (requires auth)
- `POST /api/savings-plans` - Save savings plan (requires auth)

## Database

The application uses PostgreSQL with the following schema:

### Tables

- **users** - User accounts with hashed passwords
- **user_preferences** - User preferences (currency, etc.)
- **cloud_providers** - Cloud provider configurations per user
- **cost_data** - Monthly cost data per provider
- **service_costs** - Individual service costs
- **savings_plans** - Active savings plans and discounts

### Indexes

- Index on `cost_data(user_id, month, year)` for faster queries
- Index on `service_costs(cost_data_id)` for faster joins
- Index on `savings_plans(user_id)` for faster user queries

## Security

- Passwords are hashed using bcryptjs (10 rounds)
- JWT tokens for authentication
- CORS enabled for frontend
- Input validation using express-validator
- Parameterized queries to prevent SQL injection
- Connection pooling for efficient database access

## Troubleshooting

### Connection Issues

If you get connection errors:
1. Verify PostgreSQL is running: `sudo systemctl status postgresql` (Linux) or `brew services list` (macOS)
2. Check your DATABASE_URL format: `postgresql://username:password@host:port/database`
3. Verify database exists: `psql -l` should show `costra` database
4. Check PostgreSQL logs for errors

### Permission Issues

If you get permission errors:
```sql
GRANT ALL PRIVILEGES ON DATABASE costra TO your_username;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_username;
```

## Production Deployment

For production:
1. Use a strong JWT_SECRET
2. Set NODE_ENV=production
3. Use a secure PostgreSQL connection (SSL enabled)
4. Set up proper database backups
5. Use environment variables for all sensitive data
6. Consider using a connection pooler like PgBouncer for high traffic

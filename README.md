# Costra - Multi-Cloud Cost Management Platform

A modern, clean, and professional SaaS web application for multi-cloud cost management (FinOps) with global currency support and secure database storage.

## Features

### 🌍 Global Currency Support
- Switch between multiple currencies (USD, EUR, GBP, INR, JPY, CNY, AUD, CAD, CHF, SGD)
- Real-time exchange rates via API integration
- All cost data displayed in your selected local currency
- User preferences stored in database

### 💰 Credits & Savings
- Highlight active credits and discounts
- Display savings plans and their status
- Track total savings across all cloud providers
- All data stored securely per user

### 🔌 Seamless API Integration
- All data fetched via REST API
- Real-time currency conversion
- Cost data from multiple cloud providers (AWS, Azure, GCP)
- Secure authentication with JWT tokens

### 🗄️ Database Storage
- PostgreSQL database for user data
- Secure password hashing with bcrypt
- User-specific cost data and preferences
- Savings plans and cloud provider configurations

### 🎨 Modern Design System
- Clean, minimal, data-first UI/UX
- Responsive design for all devices
- Enterprise-grade, trustworthy appearance
- Tailored for DevOps engineers, IT managers, and startup founders

## Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development and building
- **Tailwind CSS** for styling
- **React Router** for navigation
- **Lucide React** for icons

### Backend
- **Node.js** with Express
- **PostgreSQL** database with connection pooling
- **JWT** for authentication
- **bcryptjs** for password hashing
- **express-validator** for input validation

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn/pnpm

### Installation

1. **Install frontend dependencies:**
```bash
npm install
```

2. **Install backend dependencies:**
```bash
cd server
npm install
cd ..
```

3. **Set up PostgreSQL database:**
```bash
# Create database
createdb costra
# Or using psql:
# psql -U postgres
# CREATE DATABASE costra;
```

4. **Set up backend environment:**
```bash
cd server
cp .env.example .env
# Edit .env and set:
# - JWT_SECRET (strong random string)
# - DATABASE_URL (postgresql://user:password@localhost:5432/costra)
cd ..
```

5. **Start the backend server with PM2:**
```bash
npm run server:start
# Or manually: pm2 start ecosystem.config.js --only costra-backend
```

The backend will run in the background and automatically restart on crashes.

The backend will run on `http://localhost:3001`

6. **Start the frontend (in a new terminal):**
```bash
npm run dev
```

6. Open your browser and navigate to `http://localhost:5173`

## Project Structure

```
costra/
├── src/                    # Frontend React application
│   ├── components/         # Reusable UI components
│   ├── contexts/           # React contexts (Auth, Currency)
│   ├── pages/              # Page components
│   ├── services/           # API services
│   └── ...
├── server/                 # Backend Express API
│   ├── routes/             # API route handlers
│   ├── middleware/         # Express middleware
│   ├── database.js         # Database schema and operations
│   └── server.js           # Express server setup
├── package.json            # Frontend dependencies
└── server/package.json     # Backend dependencies
```

## Database Schema

The application uses PostgreSQL with the following tables:

- **users** - User accounts with hashed passwords
- **user_preferences** - User preferences (currency, etc.)
- **cloud_providers** - Cloud provider configurations per user
- **cost_data** - Monthly cost data per provider
- **service_costs** - Individual service costs
- **savings_plans** - Active savings plans and discounts

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

## Security

- Passwords are hashed using bcryptjs (10 rounds)
- JWT tokens for stateless authentication
- CORS enabled for frontend
- Input validation using express-validator
- SQL injection protection via parameterized queries

## Building for Production

### Frontend
```bash
npm run build
```

The build output will be in the `dist/` directory.

### Backend
```bash
cd server
npm start
```

## Deployment

### AWS ECS (Recommended)

The application is optimized for deployment to AWS ECS with Fargate. This provides a fully containerized solution with automatic scaling, load balancing, and high availability.

**Quick Start:**
1. Set up infrastructure: `./ecs/setup-infrastructure.sh`
2. Configure secrets in AWS Secrets Manager
3. Deploy: `./ecs/deploy.sh production latest`

**Full Documentation:** See [`ECS_DEPLOYMENT.md`](./ECS_DEPLOYMENT.md) for complete deployment guide including:
- Infrastructure setup (CloudFormation or manual)
- IAM roles and permissions
- Secrets management
- Deployment process
- Monitoring and troubleshooting

### CI/CD Pipeline (GitHub Actions)

Automated CI/CD pipeline for testing, building, and deploying:

**Features:**
- ✅ Automated testing on pull requests
- ✅ Docker image building and pushing to ECR
- ✅ Automatic deployment to ECS on merge to main
- ✅ Security vulnerability scanning
- ✅ Manual rollback capability

**Setup:** See [`GITHUB_ACTIONS_SETUP.md`](./GITHUB_ACTIONS_SETUP.md) for complete setup guide.

**Workflows:**
- `ci.yml` - Runs tests and builds Docker images
- `deploy.yml` - Deploys to ECS
- `security-scan.yml` - Security vulnerability scanning
- `rollback.yml` - Manual rollback workflow

### Docker Compose (Local/Development)

For local testing with Docker:

```bash
docker-compose up -d
```

This will start:
- Costra application (port 3001)
- PostgreSQL database (port 5432)
- Redis cache (port 6379)

### Other Deployment Options

- **AWS Elastic Beanstalk** - Traditional PaaS deployment
- **EC2 Instance** - Manual server setup
- **Kubernetes** - Use the Dockerfile with your K8s cluster

## Environment Variables

### Frontend (.env)
```
VITE_API_URL=http://localhost:3001/api
```

### Backend (server/.env)
```
PORT=3001
JWT_SECRET=your-secret-key-change-this-in-production
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/costra
```

## License

MIT

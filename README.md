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

### AWS Amplify (Frontend)

The frontend is ready for deployment to AWS Amplify. See deployment guides:

- **Quick Start:** [`AMPLIFY_QUICKSTART.md`](./AMPLIFY_QUICKSTART.md) - 5-minute setup guide
- **Full Guide:** [`AWS_AMPLIFY_DEPLOYMENT.md`](./AWS_AMPLIFY_DEPLOYMENT.md) - Complete deployment documentation

**Key Steps:**
1. Connect your Git repository to AWS Amplify
2. Set environment variable: `VITE_API_URL=https://your-backend-api.com/api`
3. Deploy!

The `amplify.yml` build configuration is already included in the repository.

### Backend Deployment

The backend can be deployed to:
- **AWS Elastic Beanstalk** (easiest)
- **AWS ECS with Fargate** (recommended for production)
- **EC2 Instance** (see [`DEPLOYMENT.md`](./DEPLOYMENT.md))

See [`AWS_AMPLIFY_DEPLOYMENT.md`](./AWS_AMPLIFY_DEPLOYMENT.md) for detailed backend deployment options.

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

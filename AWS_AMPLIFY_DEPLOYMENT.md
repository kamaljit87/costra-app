# AWS Amplify Deployment Guide

This guide covers deploying the Costra frontend to AWS Amplify and setting up the backend infrastructure.

## Architecture Overview

```
┌─────────────────┐         ┌──────────────────┐
│  AWS Amplify    │         │  Backend API     │
│  (Frontend)     │────────▶│  (EC2/ECS/EB)    │
│  React + Vite   │         │  Node.js Server  │
└─────────────────┘         └──────────────────┘
                                      │
                                      ▼
                              ┌──────────────────┐
                              │   PostgreSQL     │
                              │   (RDS)         │
                              └──────────────────┘
```

## Prerequisites

1. **AWS Account** with appropriate permissions
2. **GitHub/GitLab/Bitbucket** repository (Amplify connects to your repo)
3. **Backend API** deployed separately (see Backend Deployment section)
4. **Domain name** (optional, for custom domain)

## Frontend Deployment (AWS Amplify)

### Step 1: Connect Repository

1. Go to [AWS Amplify Console](https://console.aws.amazon.com/amplify)
2. Click **"New app"** → **"Host web app"**
3. Choose your Git provider (GitHub, GitLab, Bitbucket, or AWS CodeCommit)
4. Authorize and select your repository
5. Select the branch to deploy (usually `main` or `master`)

### Step 2: Configure Build Settings

Amplify will auto-detect the build settings, but you can customize them:

**Build specification file:** `amplify.yml` (already created in the repo)

The build configuration:
- Installs dependencies with `npm ci`
- Builds the app with `npm run build`
- Serves files from the `dist` directory

### Step 3: Environment Variables

In the Amplify console, go to **App settings** → **Environment variables** and add:

| Variable Name | Value | Description |
|--------------|-------|-------------|
| `VITE_API_URL` | `https://api.yourdomain.com/api` | Backend API URL (required) |

**Important:** Replace `api.yourdomain.com` with your actual backend API URL.

### Step 4: Custom Domain (Optional)

1. In Amplify console, go to **App settings** → **Domain management**
2. Click **"Add domain"**
3. Enter your domain name
4. Follow the DNS configuration instructions
5. Amplify will provide a certificate via AWS Certificate Manager

### Step 5: Deploy

1. Click **"Save and deploy"**
2. Amplify will:
   - Clone your repository
   - Install dependencies
   - Build the application
   - Deploy to a CDN
3. You'll get a URL like: `https://main.xxxxx.amplifyapp.com`

## Backend Deployment Options

Since Amplify only hosts static frontend files, you need to deploy the backend separately. Here are recommended options:

### Option 1: AWS Elastic Beanstalk (Easiest)

**Pros:**
- Easy setup and management
- Automatic scaling
- Built-in load balancing
- Health monitoring

**Steps:**

1. **Install EB CLI:**
   ```bash
   pip install awsebcli
   ```

2. **Initialize EB:**
   ```bash
   cd server
   eb init -p node.js-18 costra-backend
   ```

3. **Create environment:**
   ```bash
   eb create costra-production
   ```

4. **Set environment variables:**
   ```bash
   eb setenv DATABASE_URL=postgresql://... JWT_SECRET=... NODE_ENV=production
   ```

5. **Deploy:**
   ```bash
   eb deploy
   ```

### Option 2: AWS ECS with Fargate (Recommended for Production)

**Pros:**
- Container-based deployment
- Better resource management
- Auto-scaling
- Integration with other AWS services

**Steps:**

1. **Create Dockerfile** (if not exists):
   ```dockerfile
   FROM node:18-alpine
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci --only=production
   COPY . .
   EXPOSE 3001
   CMD ["node", "server.js"]
   ```

2. **Build and push to ECR:**
   ```bash
   aws ecr create-repository --repository-name costra-backend
   docker build -t costra-backend .
   docker tag costra-backend:latest <account-id>.dkr.ecr.<region>.amazonaws.com/costra-backend:latest
   docker push <account-id>.dkr.ecr.<region>.amazonaws.com/costra-backend:latest
   ```

3. **Create ECS Task Definition and Service** (via console or CloudFormation)

### Option 3: EC2 Instance

**Pros:**
- Full control
- Cost-effective for small scale
- Familiar deployment process

**Steps:**

1. Launch EC2 instance (Ubuntu 20.04+)
2. Install Node.js, PostgreSQL client
3. Clone repository
4. Set up environment variables
5. Use PM2 for process management
6. Set up Nginx as reverse proxy
7. Configure SSL with Let's Encrypt

See `DEPLOYMENT.md` for detailed EC2 deployment steps.

## Database Setup (AWS RDS)

### Create PostgreSQL RDS Instance

1. Go to **RDS Console** → **Create database**
2. Choose **PostgreSQL**
3. Select **Free tier** (for development) or appropriate tier
4. Configure:
   - **DB instance identifier:** `costra-db`
   - **Master username:** `costra_admin`
   - **Master password:** (strong password)
   - **Database name:** `costra`
5. **Network settings:**
   - Create new VPC security group
   - Allow inbound from your backend security group (port 5432)
6. Click **Create database**

### Update Backend Environment Variables

Update `DATABASE_URL` in your backend:
```
DATABASE_URL=postgresql://costra_admin:password@costra-db.xxxxx.us-east-1.rds.amazonaws.com:5432/costra
```

## Environment Variables Summary

### Frontend (Amplify)
- `VITE_API_URL` - Backend API URL

### Backend (EC2/ECS/EB)
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - JWT secret (min 32 chars)
- `NODE_ENV` - `production`
- `FRONTEND_URL` - Amplify app URL (for CORS)
- `PORT` - Server port (default: 3001)
- `STRIPE_SECRET_KEY` - Stripe secret key (for billing)
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook secret

## CORS Configuration

Make sure your backend allows requests from your Amplify domain:

```javascript
// In server/server.js
const corsOptions = {
  origin: [
    process.env.FRONTEND_URL,
    'https://main.xxxxx.amplifyapp.com', // Your Amplify URL
    'https://yourdomain.com' // Your custom domain
  ],
  credentials: true
}
```

## CI/CD with Amplify

Amplify automatically:
- Builds on every push to the connected branch
- Runs build commands
- Deploys to a preview environment for pull requests
- Deploys to production on merge to main branch

### Custom Build Commands

You can customize build behavior in `amplify.yml`:

```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - npm ci
        - npm run lint  # Add linting
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: dist
    files:
      - '**/*'
  cache:
    paths:
      - node_modules/**/*
```

## Monitoring & Logs

### Amplify Logs
- View build logs in Amplify console
- View runtime logs for SSR (if applicable)
- Monitor deployment history

### Backend Logs
- **EC2:** Use CloudWatch Logs or PM2 logs
- **ECS:** CloudWatch Logs automatically
- **Elastic Beanstalk:** CloudWatch Logs in EB console

## Cost Estimation

### Amplify (Frontend)
- **Free tier:** 15 GB storage, 5 GB served per month
- **Paid:** $0.15/GB served, $0.023/GB stored

### RDS (Database)
- **Free tier:** db.t2.micro for 12 months
- **Paid:** ~$15-50/month depending on instance size

### Backend Hosting
- **EC2:** ~$10-50/month (t2.small)
- **ECS Fargate:** ~$15-60/month (0.5 vCPU, 1GB RAM)
- **Elastic Beanstalk:** Free (pay for underlying EC2)

## Security Checklist

- [ ] Backend API uses HTTPS
- [ ] Database is in private subnet (RDS)
- [ ] Security groups restrict access
- [ ] Environment variables stored securely
- [ ] JWT_SECRET is strong (32+ chars)
- [ ] CORS configured correctly
- [ ] Stripe webhook secret configured
- [ ] Database credentials rotated regularly

## Troubleshooting

### Build Fails

1. **Check build logs** in Amplify console
2. **Verify Node.js version** (should be 18+)
3. **Check environment variables** are set correctly
4. **Verify `amplify.yml`** syntax

### API Connection Errors

1. **Verify `VITE_API_URL`** is set correctly
2. **Check CORS** configuration on backend
3. **Verify backend is running** and accessible
4. **Check security groups** allow traffic

### Database Connection Issues

1. **Verify RDS security group** allows backend access
2. **Check `DATABASE_URL`** format
3. **Verify database credentials**
4. **Check VPC/subnet configuration**

## Next Steps

1. **Set up monitoring:**
   - CloudWatch alarms for backend
   - Amplify monitoring for frontend
   - Error tracking (Sentry)

2. **Set up backups:**
   - RDS automated backups
   - Database snapshots

3. **Set up staging environment:**
   - Create separate Amplify app for staging
   - Separate RDS instance or database

4. **Optimize performance:**
   - Enable CloudFront caching (Amplify uses CloudFront)
   - Optimize bundle size
   - Enable compression

## Support

For issues:
- Check Amplify build logs
- Review backend logs
- Check CloudWatch metrics
- Review security group rules

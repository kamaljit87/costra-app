# Environment Variables Reference

This document lists all environment variables needed for the Costra ECS deployment.

## Frontend Container

### Required Environment Variables

| Variable | Description | Example | Set In |
|----------|-------------|---------|--------|
| `VITE_API_URL` | Backend API URL (must include `/api` path) | `http://costra-backend-alb-005878674861.us-east-1.elb.amazonaws.com/api` | Task Definition (Environment) |

**Note**: Vite requires the `VITE_` prefix for environment variables to be accessible in the frontend code.

### How It's Set

The `VITE_API_URL` is automatically set by the GitHub Actions workflow during deployment. It:
1. Discovers the Backend ALB DNS name
2. Constructs the URL: `http://{backend-alb-dns}/api`
3. Updates the Frontend task definition with this value

## Backend Container

### Required Environment Variables

| Variable | Description | Example | Set In |
|----------|-------------|---------|--------|
| `NODE_ENV` | Node.js environment | `production` | Task Definition (Environment) |
| `PORT` | Server port | `3002` | Task Definition (Environment) |

### Required Secrets (AWS Secrets Manager)

These must be stored in AWS Secrets Manager and referenced in the task definition:

| Secret Name | Description | Example ARN | Required |
|-------------|-------------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | `arn:aws:secretsmanager:us-east-1:005878674861:secret:costra/database-url` | ✅ Yes |
| `JWT_SECRET` | Secret key for JWT token signing (min 32 chars) | `arn:aws:secretsmanager:us-east-1:005878674861:secret:costra/jwt-secret` | ✅ Yes |
| `STRIPE_SECRET_KEY` | Stripe API secret key | `arn:aws:secretsmanager:us-east-1:005878674861:secret:costra/stripe-secret-key` | ✅ Yes (for billing) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | `arn:aws:secretsmanager:us-east-1:005878674861:secret:costra/stripe-webhook-secret` | ✅ Yes (for billing) |
| `FRONTEND_URL` | Frontend ALB URL for CORS | `arn:aws:secretsmanager:us-east-1:005878674861:secret:costra/frontend-url` | ✅ Yes |

### Optional Environment Variables

These can be set as environment variables or secrets if needed:

| Variable | Description | Default | Set In |
|----------|-------------|---------|--------|
| `REDIS_URL` | Redis connection URL (for caching) | Not set | Task Definition (Environment) |
| `SENTRY_DSN` | Sentry error tracking DSN | Not set | Task Definition (Secrets) |
| `AWS_ACCESS_KEY_ID` | AWS credentials for assuming customer roles | Not set | Task Definition (Secrets) |
| `AWS_SECRET_ACCESS_KEY` | AWS credentials for assuming customer roles | Not set | Task Definition (Secrets) |
| `AWS_REGION` | AWS region | `us-east-1` | Task Definition (Environment) |

## Setting Up Secrets in AWS Secrets Manager

### 1. Create Secrets

```bash
# Database URL
aws secretsmanager create-secret \
  --name costra/database-url \
  --secret-string "postgresql://username:password@host:5432/costra" \
  --region us-east-1

# JWT Secret (generate a strong secret)
aws secretsmanager create-secret \
  --name costra/jwt-secret \
  --secret-string "$(openssl rand -base64 32)" \
  --region us-east-1

# Stripe Secret Key
aws secretsmanager create-secret \
  --name costra/stripe-secret-key \
  --secret-string "sk_live_..." \
  --region us-east-1

# Stripe Webhook Secret
aws secretsmanager create-secret \
  --name costra/stripe-webhook-secret \
  --secret-string "whsec_..." \
  --region us-east-1

# Frontend URL (get from CloudFormation output)
FRONTEND_ALB_DNS=$(aws cloudformation describe-stacks \
  --stack-name costra-infrastructure \
  --query "Stacks[0].Outputs[?OutputKey=='FrontendApplicationLoadBalancerDNS'].OutputValue" \
  --output text)

aws secretsmanager create-secret \
  --name costra/frontend-url \
  --secret-string "http://$FRONTEND_ALB_DNS" \
  --region us-east-1
```

### 2. Update Secret ARNs in Task Definition

The task definition uses placeholders that need to be replaced:
- `YOUR_ACCOUNT_ID` → Your AWS Account ID (e.g., `005878674861`)
- `YOUR_REGION` → Your AWS Region (e.g., `us-east-1`)

The GitHub Actions workflow automatically replaces these during deployment.

### 3. Grant ECS Task Execution Role Access

The ECS task execution role needs permission to read secrets:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret"
      ],
      "Resource": [
        "arn:aws:secretsmanager:us-east-1:005878674861:secret:costra/*"
      ]
    }
  ]
}
```

## Environment Variable Summary

### Frontend
- **1 environment variable**: `VITE_API_URL`
- **0 secrets** (all config via environment variables)

### Backend
- **2 environment variables**: `NODE_ENV`, `PORT`
- **5 required secrets**: `DATABASE_URL`, `JWT_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `FRONTEND_URL`
- **Optional secrets**: `SENTRY_DSN`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`

## Quick Reference

### For Local Development

Create `server/.env`:
```bash
NODE_ENV=development
PORT=3002
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/costra
JWT_SECRET=your-secret-key-change-this-min-32-chars-long
FRONTEND_URL=http://localhost:5173
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

Create `.env` in project root:
```bash
VITE_API_URL=http://localhost:3002/api
```

### For Production (ECS)

All secrets are managed via AWS Secrets Manager. Environment variables are set in the task definitions and automatically updated by GitHub Actions during deployment.

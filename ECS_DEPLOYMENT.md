# AWS ECS Deployment Guide for Costra

This guide covers deploying Costra to AWS ECS (Elastic Container Service) using Fargate.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Architecture Overview](#architecture-overview)
3. [Infrastructure Setup](#infrastructure-setup)
4. [Application Configuration](#application-configuration)
5. [Deployment Process](#deployment-process)
6. [Monitoring and Maintenance](#monitoring-and-maintenance)
7. [Troubleshooting](#troubleshooting)

## Prerequisites

- AWS Account with appropriate permissions
- AWS CLI installed and configured
- Docker installed locally
- Node.js 18+ installed
- PostgreSQL database (RDS or external)
- Redis instance (ElastiCache or external)
- Stripe account for payment processing

## Architecture Overview

```
Internet
   │
   ▼
Application Load Balancer (ALB)
   │
   ▼
ECS Fargate Tasks (2+ instances)
   │
   ├──► RDS PostgreSQL (or external DB)
   ├──► ElastiCache Redis (or external Redis)
   └──► AWS Secrets Manager (for secrets)
```

### Components

- **VPC**: Isolated network environment
- **ALB**: Distributes traffic across ECS tasks
- **ECS Cluster**: Manages containerized application
- **Fargate**: Serverless compute for containers
- **ECR**: Container image registry
- **CloudWatch**: Logging and monitoring
- **Secrets Manager**: Secure secret storage

## Infrastructure Setup

### Option 1: CloudFormation (Recommended)

Deploy the complete infrastructure stack:

```bash
aws cloudformation create-stack \
  --stack-name costra-infrastructure \
  --template-body file://ecs/cloudformation-template.yaml \
  --parameters ParameterKey=Environment,ParameterValue=production \
  --capabilities CAPABILITY_NAMED_IAM \
  --region us-east-1
```

Wait for stack creation to complete:

```bash
aws cloudformation wait stack-create-complete \
  --stack-name costra-infrastructure \
  --region us-east-1
```

Get stack outputs:

```bash
aws cloudformation describe-stacks \
  --stack-name costra-infrastructure \
  --query 'Stacks[0].Outputs' \
  --region us-east-1
```

### Option 2: Manual Setup

Run the setup script:

```bash
chmod +x ecs/setup-infrastructure.sh
./ecs/setup-infrastructure.sh
```

Then manually create:
- VPC, subnets, and security groups
- Application Load Balancer
- Target Group
- IAM roles (see below)

### IAM Roles Setup

Create two IAM roles for ECS:

1. **Task Execution Role** (`ecsTaskExecutionRole`):
   - Attach managed policy: `AmazonECSTaskExecutionRolePolicy`
   - Add custom policy from `ecs/iam-policies.json` (TaskExecutionRolePolicy)

2. **Task Role** (`ecsTaskRole`):
   - Add custom policy from `ecs/iam-policies.json` (TaskRolePolicy)

### Secrets Manager Setup

Create the following secrets in AWS Secrets Manager:

```bash
# Database URL
aws secretsmanager create-secret \
  --name costra/database-url \
  --secret-string "postgresql://user:password@host:5432/costra" \
  --region us-east-1

# JWT Secret (generate a secure random string)
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

# Frontend URL
aws secretsmanager create-secret \
  --name costra/frontend-url \
  --secret-string "https://your-domain.com" \
  --region us-east-1
```

## Application Configuration

### Update Task Definition

Edit `ecs/task-definition.json`:

1. Replace `YOUR_ACCOUNT_ID` with your AWS account ID
2. Replace `YOUR_REGION` with your AWS region
3. Update secret ARNs if using different secret names
4. Adjust CPU/memory if needed (default: 512 CPU, 1024 MB memory)

### Update Service Definition

Edit `ecs/service-definition.json`:

1. Replace subnet IDs with your VPC subnet IDs
2. Replace security group ID with your ECS security group ID
3. Replace target group ARN with your ALB target group ARN
4. Adjust `desiredCount` for number of tasks (recommended: 2+)

### Environment Variables

The following environment variables are configured via Secrets Manager:
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: JWT signing secret
- `STRIPE_SECRET_KEY`: Stripe API secret key
- `STRIPE_WEBHOOK_SECRET`: Stripe webhook signing secret
- `FRONTEND_URL`: Frontend application URL

Additional environment variables can be added to the task definition:
- `NODE_ENV`: Set to `production`
- `PORT`: Set to `3001`
- `REDIS_URL`: Redis connection string (if not using Secrets Manager)
- `SENTRY_DSN`: Sentry error tracking DSN (optional)

## Deployment Process

### Initial Deployment

1. **Build and push Docker image**:

```bash
# Set environment variables
export AWS_REGION=us-east-1
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Run deployment script
chmod +x ecs/deploy.sh
./ecs/deploy.sh production latest
```

2. **Create ECS Service** (first time only):

```bash
aws ecs create-service \
  --cluster costra-cluster \
  --service-name costra-service \
  --task-definition costra-app \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx,subnet-yyy],securityGroups=[sg-xxx],assignPublicIp=ENABLED}" \
  --load-balancers "targetGroupArn=arn:aws:elasticloadbalancing:us-east-1:ACCOUNT:targetgroup/costra-tg/xxx,containerName=costra-app,containerPort=3001" \
  --region us-east-1
```

### Subsequent Deployments

Simply run the deployment script:

```bash
./ecs/deploy.sh production v1.0.1
```

The script will:
1. Build the Docker image
2. Push to ECR
3. Register new task definition
4. Update the ECS service
5. Wait for deployment to complete

### Blue/Green Deployments

ECS supports blue/green deployments through CodeDeploy. For manual deployments, the service uses rolling updates with:
- Maximum percent: 200% (allows 2x desired count during deployment)
- Minimum healthy percent: 100% (maintains at least desired count)

## Monitoring and Maintenance

### View Logs

```bash
# Stream logs from CloudWatch
aws logs tail /ecs/costra-app --follow --region us-east-1

# Or view in AWS Console
# CloudWatch > Log groups > /ecs/costra-app
```

### Check Service Status

```bash
aws ecs describe-services \
  --cluster costra-cluster \
  --services costra-service \
  --region us-east-1
```

### Scale Service

```bash
# Scale to 4 tasks
aws ecs update-service \
  --cluster costra-cluster \
  --service costra-service \
  --desired-count 4 \
  --region us-east-1
```

### Update Task Definition

Edit `ecs/task-definition.json` and run:

```bash
aws ecs register-task-definition \
  --cli-input-json file://ecs/task-definition.json \
  --region us-east-1
```

Then update the service:

```bash
aws ecs update-service \
  --cluster costra-cluster \
  --service costra-service \
  --task-definition costra-app:NEW_REVISION \
  --region us-east-1
```

## Troubleshooting

### Container Won't Start

1. Check CloudWatch logs:
```bash
aws logs tail /ecs/costra-app --follow
```

2. Check task status:
```bash
aws ecs describe-tasks \
  --cluster costra-cluster \
  --tasks TASK_ID \
  --region us-east-1
```

3. Common issues:
   - Missing or incorrect secrets
   - Database connection issues
   - Insufficient memory/CPU
   - Health check failures

### Health Check Failures

1. Verify health endpoint is accessible:
```bash
curl http://ALB_DNS/api/health
```

2. Check security group rules allow traffic from ALB to ECS tasks
3. Verify task is listening on port 3001
4. Check application logs for errors

### High Memory Usage

1. Monitor CloudWatch metrics for memory utilization
2. Increase task memory in task definition:
   - Edit `ecs/task-definition.json`
   - Update `memory` field (e.g., `2048` for 2GB)
   - Redeploy

### Database Connection Issues

1. Verify security group allows traffic from ECS security group
2. Check database URL in Secrets Manager
3. Ensure database is accessible from VPC
4. Check RDS endpoint and port

### Cost Optimization

1. Use Fargate Spot for non-critical workloads (50-70% savings)
2. Right-size CPU/memory based on actual usage
3. Use CloudWatch Container Insights to monitor resource usage
4. Enable auto-scaling based on CPU/memory metrics
5. Use reserved capacity for predictable workloads

## Security Best Practices

1. **Secrets Management**: Always use AWS Secrets Manager, never hardcode secrets
2. **Network Security**: Use private subnets for ECS tasks when possible
3. **IAM Roles**: Follow principle of least privilege
4. **Image Scanning**: Enable ECR image scanning
5. **HTTPS**: Use ALB with SSL certificate (ACM)
6. **Security Groups**: Restrict access to minimum required ports
7. **Logging**: Enable CloudWatch Container Insights
8. **Updates**: Regularly update base images and dependencies

## Next Steps

- Set up CI/CD pipeline (GitHub Actions, GitLab CI, or AWS CodePipeline)
- Configure auto-scaling based on metrics
- Set up SSL certificate in ACM and configure HTTPS listener
- Configure custom domain with Route 53
- Set up backup and disaster recovery procedures
- Configure monitoring alerts in CloudWatch

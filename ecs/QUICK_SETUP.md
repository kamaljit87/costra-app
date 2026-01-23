# Quick Setup Guide

Since you've already created the ECR repos, ECS cluster, and VPC, follow these steps to complete the setup.

## Prerequisites Checklist

- ✅ ECR repositories created (`costra-frontend`, `costra-backend`)
- ✅ ECS cluster created (`costra-cluster`)
- ✅ VPC and networking configured
- ✅ Load balancers and target groups created
- ✅ Security groups configured

## Step 1: Get Your Infrastructure Details

You'll need these values for the setup script:

```bash
# Get your VPC ID
aws ec2 describe-vpcs --filters "Name=tag:Name,Values=*costra*" --query "Vpcs[0].VpcId" --output text

# Get your subnet IDs (public subnets for ECS tasks)
aws ec2 describe-subnets --filters "Name=vpc-id,Values=<YOUR_VPC_ID>" --query "Subnets[?MapPublicIpOnLaunch==\`true\`].SubnetId" --output text

# Get security group IDs
aws ec2 describe-security-groups --filters "Name=tag:Name,Values=*costra-frontend-ecs-sg*" --query "SecurityGroups[0].GroupId" --output text
aws ec2 describe-security-groups --filters "Name=tag:Name,Values=*costra-backend-ecs-sg*" --query "SecurityGroups[0].GroupId" --output text

# Get target group ARNs
aws elbv2 describe-target-groups --query "TargetGroups[?contains(TargetGroupName, 'costra-frontend-tg')].TargetGroupArn" --output text
aws elbv2 describe-target-groups --query "TargetGroups[?contains(TargetGroupName, 'costra-backend-tg')].TargetGroupArn" --output text
```

## Step 2: Run the Setup Script

The setup script will:
1. Create/update AWS Secrets Manager secrets
2. Register task definitions
3. Create ECS services

```bash
cd /home/vagrant/costra
./ecs/setup-services.sh
```

The script will prompt you for:
- Subnet IDs (comma-separated)
- Security Group IDs
- Target Group ARNs
- Secrets (DATABASE_URL, JWT_SECRET, STRIPE keys, etc.)

## Step 3: Manual Setup (Alternative)

If you prefer to set things up manually:

### 3.1 Create Secrets

```bash
# Database URL
aws secretsmanager create-secret \
  --name costra/database-url \
  --secret-string "postgresql://username:password@host:5432/costra" \
  --region us-east-1

# JWT Secret (generate a strong one)
aws secretsmanager create-secret \
  --name costra/jwt-secret \
  --secret-string "$(openssl rand -base64 32)" \
  --region us-east-1

# Stripe keys (if you have them)
aws secretsmanager create-secret \
  --name costra/stripe-secret-key \
  --secret-string "sk_live_..." \
  --region us-east-1

aws secretsmanager create-secret \
  --name costra/stripe-webhook-secret \
  --secret-string "whsec_..." \
  --region us-east-1

# Frontend URL (get from your Frontend ALB)
FRONTEND_ALB_DNS=$(aws elbv2 describe-load-balancers \
  --query "LoadBalancers[?contains(LoadBalancerName, 'costra-frontend-alb')].DNSName" \
  --output text)

aws secretsmanager create-secret \
  --name costra/frontend-url \
  --secret-string "http://$FRONTEND_ALB_DNS" \
  --region us-east-1
```

### 3.2 Get Backend ALB DNS

```bash
BACKEND_ALB_DNS=$(aws elbv2 describe-load-balancers \
  --region us-east-1 \
  --query "LoadBalancers[?contains(LoadBalancerName, 'costra-backend-alb')].DNSName" \
  --output text | head -n 1)

echo "Backend ALB: $BACKEND_ALB_DNS"
echo "VITE_API_URL: http://$BACKEND_ALB_DNS/api"
```

### 3.3 Update Task Definitions

```bash
# Replace placeholders in task definitions
cd ecs
sed -i "s|YOUR_ACCOUNT_ID|005878674861|g" task-definition-frontend.json
sed -i "s|YOUR_REGION|us-east-1|g" task-definition-frontend.json
sed -i "s|YOUR_ACCOUNT_ID|005878674861|g" task-definition-backend.json
sed -i "s|YOUR_REGION|us-east-1|g" task-definition-backend.json

# Update VITE_API_URL in frontend task definition
VITE_API_URL="http://$BACKEND_ALB_DNS/api"
jq ".containerDefinitions[0].environment = (.containerDefinitions[0].environment | map(if .name == \"VITE_API_URL\" then .value = \"$VITE_API_URL\" else . end))" \
  task-definition-frontend.json > task-definition-frontend-updated.json
mv task-definition-frontend-updated.json task-definition-frontend.json
```

### 3.4 Register Task Definitions

```bash
aws ecs register-task-definition \
  --cli-input-json file://task-definition-frontend.json \
  --region us-east-1

aws ecs register-task-definition \
  --cli-input-json file://task-definition-backend.json \
  --region us-east-1
```

### 3.5 Create ECS Services

```bash
# Set your values
CLUSTER_NAME="costra-cluster"
SUBNET_IDS="subnet-xxx,subnet-yyy"  # Your public subnet IDs
FRONTEND_SG="sg-xxx"  # Frontend security group
BACKEND_SG="sg-yyy"   # Backend security group
FRONTEND_TG_ARN="arn:aws:elasticloadbalancing:..."  # Frontend target group ARN
BACKEND_TG_ARN="arn:aws:elasticloadbalancing:..."   # Backend target group ARN

# Create Frontend service
aws ecs create-service \
  --cluster $CLUSTER_NAME \
  --service-name costra-frontend-service \
  --task-definition costra-frontend \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNET_IDS],securityGroups=[$FRONTEND_SG],assignPublicIp=ENABLED}" \
  --load-balancers targetGroupArn=$FRONTEND_TG_ARN,containerName=costra-frontend,containerPort=3001 \
  --region us-east-1

# Create Backend service
aws ecs create-service \
  --cluster $CLUSTER_NAME \
  --service-name costra-backend-service \
  --task-definition costra-backend \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNET_IDS],securityGroups=[$BACKEND_SG],assignPublicIp=ENABLED}" \
  --load-balancers targetGroupArn=$BACKEND_TG_ARN,containerName=costra-backend,containerPort=3002 \
  --region us-east-1
```

## Step 4: Verify Services

```bash
# Check service status
aws ecs describe-services \
  --cluster costra-cluster \
  --services costra-frontend-service costra-backend-service \
  --region us-east-1

# Check running tasks
aws ecs list-tasks \
  --cluster costra-cluster \
  --service-name costra-frontend-service \
  --region us-east-1

aws ecs list-tasks \
  --cluster costra-cluster \
  --service-name costra-backend-service \
  --region us-east-1
```

## Step 5: Build and Push Docker Images

Before services can run, you need to build and push images:

```bash
# Login to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 005878674861.dkr.ecr.us-east-1.amazonaws.com

# Build and push frontend
docker build -f Dockerfile.frontend -t costra-frontend:latest .
docker tag costra-frontend:latest 005878674861.dkr.ecr.us-east-1.amazonaws.com/costra-frontend:latest
docker push 005878674861.dkr.ecr.us-east-1.amazonaws.com/costra-frontend:latest

# Build and push backend
docker build -f Dockerfile.backend -t costra-backend:latest .
docker tag costra-backend:latest 005878674861.dkr.ecr.us-east-1.amazonaws.com/costra-backend:latest
docker push 005878674861.dkr.ecr.us-east-1.amazonaws.com/costra-backend:latest
```

Or use GitHub Actions to deploy automatically on push to main branch.

## Troubleshooting

### Services not starting
- Check CloudWatch logs: `/ecs/costra-frontend` and `/ecs/costra-backend`
- Verify task definitions are registered correctly
- Check security groups allow traffic
- Verify secrets exist in Secrets Manager

### Tasks failing to start
- Check ECS task logs in CloudWatch
- Verify ECR images exist and are accessible
- Check task execution role has permissions to pull images and read secrets

### Health checks failing
- Frontend: Should respond on port 3001 at `/`
- Backend: Should respond on port 3002 at `/api/health`
- Check security groups allow health check traffic

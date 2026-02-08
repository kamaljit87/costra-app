#!/bin/bash

# Setup script for Costra ECS Services
# This script creates secrets, registers task definitions, and creates ECS services
# Prerequisites: ECR repos, ECS cluster, and VPC must already exist

set -e

# Configuration
ENVIRONMENT=${1:-production}
AWS_REGION=${AWS_REGION:-us-east-1}
AWS_ACCOUNT_ID=${AWS_ACCOUNT_ID:-$(aws sts get-caller-identity --query Account --output text)}
CLUSTER_NAME="costra-cluster"
FRONTEND_SERVICE="costra-frontend-service"
BACKEND_SERVICE="costra-backend-service"
FRONTEND_TASK_FAMILY="costra-frontend"
BACKEND_TASK_FAMILY="costra-backend"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Costra ECS Services Setup${NC}"
echo -e "Environment: ${YELLOW}$ENVIRONMENT${NC}"
echo -e "Region: ${YELLOW}$AWS_REGION${NC}"
echo -e "Account ID: ${YELLOW}$AWS_ACCOUNT_ID${NC}"
echo ""

# Step 1: Get infrastructure details
echo -e "${YELLOW}📋 Step 1: Getting infrastructure details...${NC}"

# Get VPC and subnet IDs (you'll need to provide these or get from CloudFormation)
read -p "Enter VPC ID (or press Enter to skip and set manually): " VPC_ID
if [ -z "$VPC_ID" ]; then
  echo -e "${YELLOW}⚠️  VPC ID not provided. You'll need to set subnet and security group IDs manually.${NC}"
fi

# Get subnets
read -p "Enter Public Subnet 1 ID (comma-separated for multiple): " SUBNET_IDS
if [ -z "$SUBNET_IDS" ]; then
  echo -e "${RED}❌ Subnet IDs are required. Exiting.${NC}"
  exit 1
fi

# Get security groups
read -p "Enter Frontend Security Group ID: " FRONTEND_SG
read -p "Enter Backend Security Group ID: " BACKEND_SG

if [ -z "$FRONTEND_SG" ] || [ -z "$BACKEND_SG" ]; then
  echo -e "${RED}❌ Security Group IDs are required. Exiting.${NC}"
  exit 1
fi

# Get target group ARNs
read -p "Enter Frontend Target Group ARN: " FRONTEND_TG_ARN
read -p "Enter Backend Target Group ARN: " BACKEND_TG_ARN

if [ -z "$FRONTEND_TG_ARN" ] || [ -z "$BACKEND_TG_ARN" ]; then
  echo -e "${RED}❌ Target Group ARNs are required. Exiting.${NC}"
  exit 1
fi

# Get Backend ALB DNS
echo -e "${YELLOW}🔍 Discovering Backend ALB DNS...${NC}"
BACKEND_ALB_DNS=$(aws elbv2 describe-load-balancers \
  --region $AWS_REGION \
  --query "LoadBalancers[?contains(LoadBalancerName, 'costra-backend-alb')].DNSName" \
  --output text | head -n 1)

if [ -z "$BACKEND_ALB_DNS" ]; then
  echo -e "${YELLOW}⚠️  Backend ALB not found. Please enter manually:${NC}"
  read -p "Enter Backend ALB DNS: " BACKEND_ALB_DNS
fi

if [ -z "$BACKEND_ALB_DNS" ]; then
  echo -e "${RED}❌ Backend ALB DNS is required. Exiting.${NC}"
  exit 1
fi

VITE_API_URL="http://$BACKEND_ALB_DNS/api"
echo -e "${GREEN}✅ Backend ALB DNS: $BACKEND_ALB_DNS${NC}"
echo -e "${GREEN}✅ VITE_API_URL: $VITE_API_URL${NC}"
echo ""

# Step 2: Create secrets (interactive)
echo -e "${YELLOW}📝 Step 2: Setting up AWS Secrets Manager secrets...${NC}"
echo -e "${BLUE}You'll be prompted to create secrets. Press Enter to skip if they already exist.${NC}"
echo ""

# Database URL
read -p "Enter DATABASE_URL (postgresql://user:pass@host:port/db) or press Enter to skip: " DATABASE_URL
if [ ! -z "$DATABASE_URL" ]; then
  echo -e "${YELLOW}Creating/updating DATABASE_URL secret...${NC}"
  aws secretsmanager create-secret \
    --name costra/database-url \
    --secret-string "$DATABASE_URL" \
    --region $AWS_REGION 2>/dev/null || \
  aws secretsmanager update-secret \
    --secret-id costra/database-url \
    --secret-string "$DATABASE_URL" \
    --region $AWS_REGION
  echo -e "${GREEN}✅ DATABASE_URL secret created/updated${NC}"
fi

# JWT Secret
read -p "Enter JWT_SECRET (min 32 chars) or press Enter to generate: " JWT_SECRET
if [ -z "$JWT_SECRET" ]; then
  JWT_SECRET=$(openssl rand -base64 32)
  echo -e "${YELLOW}Generated JWT_SECRET: ${JWT_SECRET:0:20}...${NC}"
fi
echo -e "${YELLOW}Creating/updating JWT_SECRET secret...${NC}"
aws secretsmanager create-secret \
  --name costra/jwt-secret \
  --secret-string "$JWT_SECRET" \
  --region $AWS_REGION 2>/dev/null || \
aws secretsmanager update-secret \
  --secret-id costra/jwt-secret \
  --secret-string "$JWT_SECRET" \
  --region $AWS_REGION
echo -e "${GREEN}✅ JWT_SECRET secret created/updated${NC}"

# Stripe Secret Key
read -p "Enter STRIPE_SECRET_KEY (or press Enter to skip): " STRIPE_SECRET_KEY
if [ ! -z "$STRIPE_SECRET_KEY" ]; then
  echo -e "${YELLOW}Creating/updating STRIPE_SECRET_KEY secret...${NC}"
  aws secretsmanager create-secret \
    --name costra/stripe-secret-key \
    --secret-string "$STRIPE_SECRET_KEY" \
    --region $AWS_REGION 2>/dev/null || \
  aws secretsmanager update-secret \
    --secret-id costra/stripe-secret-key \
    --secret-string "$STRIPE_SECRET_KEY" \
    --region $AWS_REGION
  echo -e "${GREEN}✅ STRIPE_SECRET_KEY secret created/updated${NC}"
fi

# Stripe Webhook Secret
read -p "Enter STRIPE_WEBHOOK_SECRET (or press Enter to skip): " STRIPE_WEBHOOK_SECRET
if [ ! -z "$STRIPE_WEBHOOK_SECRET" ]; then
  echo -e "${YELLOW}Creating/updating STRIPE_WEBHOOK_SECRET secret...${NC}"
  aws secretsmanager create-secret \
    --name costra/stripe-webhook-secret \
    --secret-string "$STRIPE_WEBHOOK_SECRET" \
    --region $AWS_REGION 2>/dev/null || \
  aws secretsmanager update-secret \
    --secret-id costra/stripe-webhook-secret \
    --secret-string "$STRIPE_WEBHOOK_SECRET" \
    --region $AWS_REGION
  echo -e "${GREEN}✅ STRIPE_WEBHOOK_SECRET secret created/updated${NC}"
fi

# Frontend URL
read -p "Enter FRONTEND_URL (Frontend ALB DNS) or press Enter to discover: " FRONTEND_URL
if [ -z "$FRONTEND_URL" ]; then
  FRONTEND_ALB_DNS=$(aws elbv2 describe-load-balancers \
    --region $AWS_REGION \
    --query "LoadBalancers[?contains(LoadBalancerName, 'costra-frontend-alb')].DNSName" \
    --output text | head -n 1)
  if [ ! -z "$FRONTEND_ALB_DNS" ]; then
    FRONTEND_URL="http://$FRONTEND_ALB_DNS"
    echo -e "${GREEN}✅ Discovered Frontend ALB: $FRONTEND_URL${NC}"
  fi
fi

if [ ! -z "$FRONTEND_URL" ]; then
  echo -e "${YELLOW}Creating/updating FRONTEND_URL secret...${NC}"
  aws secretsmanager create-secret \
    --name costra/frontend-url \
    --secret-string "$FRONTEND_URL" \
    --region $AWS_REGION 2>/dev/null || \
  aws secretsmanager update-secret \
    --secret-id costra/frontend-url \
    --secret-string "$FRONTEND_URL" \
    --region $AWS_REGION
  echo -e "${GREEN}✅ FRONTEND_URL secret created/updated${NC}"
fi

echo ""

# Step 3: Prepare task definitions
echo -e "${YELLOW}📋 Step 3: Preparing task definitions...${NC}"

# Frontend task definition
FRONTEND_TASK_DEF="ecs/task-definition-frontend.json"
if [ ! -f "$FRONTEND_TASK_DEF" ]; then
  echo -e "${RED}❌ Frontend task definition not found: $FRONTEND_TASK_DEF${NC}"
  exit 1
fi

# Replace placeholders in frontend task definition
cp "$FRONTEND_TASK_DEF" "${FRONTEND_TASK_DEF}.tmp"
sed -i "s|YOUR_ACCOUNT_ID|$AWS_ACCOUNT_ID|g" "${FRONTEND_TASK_DEF}.tmp"
sed -i "s|YOUR_REGION|$AWS_REGION|g" "${FRONTEND_TASK_DEF}.tmp"

# Update VITE_API_URL
jq ".containerDefinitions[0].environment = (.containerDefinitions[0].environment | map(if .name == \"VITE_API_URL\" then .value = \"$VITE_API_URL\" else . end))" \
  "${FRONTEND_TASK_DEF}.tmp" > "${FRONTEND_TASK_DEF}.final"
mv "${FRONTEND_TASK_DEF}.final" "${FRONTEND_TASK_DEF}.tmp"

echo -e "${GREEN}✅ Frontend task definition prepared${NC}"

# Backend task definition
BACKEND_TASK_DEF="ecs/task-definition-backend.json"
if [ ! -f "$BACKEND_TASK_DEF" ]; then
  echo -e "${RED}❌ Backend task definition not found: $BACKEND_TASK_DEF${NC}"
  exit 1
fi

# Replace placeholders in backend task definition
cp "$BACKEND_TASK_DEF" "${BACKEND_TASK_DEF}.tmp"
sed -i "s|YOUR_ACCOUNT_ID|$AWS_ACCOUNT_ID|g" "${BACKEND_TASK_DEF}.tmp"
sed -i "s|YOUR_REGION|$AWS_REGION|g" "${BACKEND_TASK_DEF}.tmp"

echo -e "${GREEN}✅ Backend task definition prepared${NC}"
echo ""

# Step 4: Register task definitions
echo -e "${YELLOW}📝 Step 4: Registering task definitions...${NC}"

FRONTEND_TASK_ARN=$(aws ecs register-task-definition \
  --cli-input-json file://"${FRONTEND_TASK_DEF}.tmp" \
  --region $AWS_REGION \
  --query 'taskDefinition.taskDefinitionArn' \
  --output text)
echo -e "${GREEN}✅ Frontend task definition registered: $FRONTEND_TASK_ARN${NC}"

BACKEND_TASK_ARN=$(aws ecs register-task-definition \
  --cli-input-json file://"${BACKEND_TASK_DEF}.tmp" \
  --region $AWS_REGION \
  --query 'taskDefinition.taskDefinitionArn' \
  --output text)
echo -e "${GREEN}✅ Backend task definition registered: $BACKEND_TASK_ARN${NC}"

# Cleanup temp files
rm -f "${FRONTEND_TASK_DEF}.tmp" "${BACKEND_TASK_DEF}.tmp"
echo ""

# Step 5: Create ECS services
echo -e "${YELLOW}🚀 Step 5: Creating ECS services...${NC}"

# Subnet IDs are already in the correct format

# Create Frontend service
echo -e "${YELLOW}Creating Frontend service...${NC}"
aws ecs create-service \
  --cluster $CLUSTER_NAME \
  --service-name $FRONTEND_SERVICE \
  --task-definition $FRONTEND_TASK_FAMILY \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNET_IDS],securityGroups=[$FRONTEND_SG],assignPublicIp=ENABLED}" \
  --load-balancers targetGroupArn=$FRONTEND_TG_ARN,containerName=costra-frontend,containerPort=3001 \
  --region $AWS_REGION \
  --deployment-configuration "maximumPercent=200,minimumHealthyPercent=100" \
  --deployment-circuit-breaker "enable=true,rollback=true" \
  > /dev/null
echo -e "${GREEN}✅ Frontend service created${NC}"

# Create Backend service
echo -e "${YELLOW}Creating Backend service...${NC}"
aws ecs create-service \
  --cluster $CLUSTER_NAME \
  --service-name $BACKEND_SERVICE \
  --task-definition $BACKEND_TASK_FAMILY \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNET_IDS],securityGroups=[$BACKEND_SG],assignPublicIp=ENABLED}" \
  --load-balancers targetGroupArn=$BACKEND_TG_ARN,containerName=costra-backend,containerPort=3002 \
  --region $AWS_REGION \
  --deployment-configuration "maximumPercent=200,minimumHealthyPercent=100" \
  --deployment-circuit-breaker "enable=true,rollback=true" \
  > /dev/null
echo -e "${GREEN}✅ Backend service created${NC}"
echo ""

# Step 6: Summary
echo -e "${GREEN}🎉 Setup Complete!${NC}"
echo ""
echo -e "${BLUE}Summary:${NC}"
echo -e "  Frontend Service: ${GREEN}$FRONTEND_SERVICE${NC}"
echo -e "  Backend Service: ${GREEN}$BACKEND_SERVICE${NC}"
echo -e "  Cluster: ${GREEN}$CLUSTER_NAME${NC}"
echo -e "  Frontend ALB: ${GREEN}$FRONTEND_URL${NC}"
echo -e "  Backend ALB: ${GREEN}$BACKEND_ALB_DNS${NC}"
echo ""
echo -e "${YELLOW}⏳ Services are starting up. Check status with:${NC}"
echo -e "  aws ecs describe-services --cluster $CLUSTER_NAME --services $FRONTEND_SERVICE $BACKEND_SERVICE --region $AWS_REGION"
echo ""

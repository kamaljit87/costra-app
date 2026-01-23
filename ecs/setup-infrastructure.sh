#!/bin/bash

# Infrastructure Setup Script for Costra on ECS
# This script helps set up the necessary AWS infrastructure

set -e

AWS_REGION=${AWS_REGION:-us-east-1}
AWS_ACCOUNT_ID=${AWS_ACCOUNT_ID:-$(aws sts get-caller-identity --query Account --output text)}
CLUSTER_NAME="costra-cluster"
VPC_NAME="costra-vpc"

echo "🏗️  Setting up AWS infrastructure for Costra"
echo "Region: $AWS_REGION"
echo "Account: $AWS_ACCOUNT_ID"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Step 1: Create ECR Repository
echo -e "${YELLOW}📦 Creating ECR repository...${NC}"
if ! aws ecr describe-repositories --repository-names costra --region $AWS_REGION 2>/dev/null; then
  aws ecr create-repository \
    --repository-name costra \
    --region $AWS_REGION \
    --image-scanning-configuration scanOnPush=true \
    --encryption-configuration encryptionType=AES256
  echo -e "${GREEN}✅ ECR repository created${NC}"
else
  echo -e "${YELLOW}⚠️  ECR repository already exists${NC}"
fi

# Step 2: Create CloudWatch Log Group
echo -e "${YELLOW}📊 Creating CloudWatch log group...${NC}"
if ! aws logs describe-log-groups --log-group-name-prefix /ecs/costra-app --region $AWS_REGION 2>/dev/null | grep -q "/ecs/costra-app"; then
  aws logs create-log-group \
    --log-group-name /ecs/costra-app \
    --region $AWS_REGION
  echo -e "${GREEN}✅ CloudWatch log group created${NC}"
else
  echo -e "${YELLOW}⚠️  CloudWatch log group already exists${NC}"
fi

# Step 3: Create Secrets Manager secrets (if they don't exist)
echo -e "${YELLOW}🔐 Setting up Secrets Manager...${NC}"
echo -e "${YELLOW}⚠️  Please create the following secrets manually in AWS Secrets Manager:${NC}"
echo "   - costra/database-url"
echo "   - costra/jwt-secret"
echo "   - costra/stripe-secret-key"
echo "   - costra/stripe-webhook-secret"
echo "   - costra/frontend-url"
echo ""
echo "Example command to create a secret:"
echo 'aws secretsmanager create-secret --name costra/jwt-secret --secret-string "your-secret-key-here" --region '$AWS_REGION

# Step 4: Create IAM roles (if needed)
echo -e "${YELLOW}👤 Checking IAM roles...${NC}"
echo -e "${YELLOW}⚠️  Please ensure the following IAM roles exist:${NC}"
echo "   - ecsTaskExecutionRole (for ECS task execution)"
echo "   - ecsTaskRole (for ECS task runtime permissions)"
echo ""
echo "These roles need permissions for:"
echo "   - ECR image pull"
echo "   - CloudWatch logs"
echo "   - Secrets Manager access"
echo "   - RDS/PostgreSQL access (if using RDS)"

# Step 5: Create ECS Cluster
echo -e "${YELLOW}🚀 Creating ECS cluster...${NC}"
if ! aws ecs describe-clusters --clusters $CLUSTER_NAME --region $AWS_REGION 2>/dev/null | grep -q "ACTIVE"; then
  aws ecs create-cluster \
    --cluster-name $CLUSTER_NAME \
    --region $AWS_REGION \
    --capacity-providers FARGATE FARGATE_SPOT \
    --default-capacity-provider-strategy \
      capacityProvider=FARGATE,weight=1 \
      capacityProvider=FARGATE_SPOT,weight=1
  echo -e "${GREEN}✅ ECS cluster created${NC}"
else
  echo -e "${YELLOW}⚠️  ECS cluster already exists${NC}"
fi

echo ""
echo -e "${GREEN}✅ Infrastructure setup complete!${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Create Secrets Manager secrets (see above)"
echo "2. Set up IAM roles with proper permissions"
echo "3. Create VPC, subnets, and security groups (or use existing)"
echo "4. Create Application Load Balancer and target group"
echo "5. Update ecs/task-definition.json and ecs/service-definition.json with your values"
echo "6. Run ./ecs/deploy.sh to deploy the application"

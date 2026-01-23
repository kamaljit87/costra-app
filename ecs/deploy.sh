#!/bin/bash

# ECS Deployment Script for Costra
# Usage: ./ecs/deploy.sh [environment] [version]

set -e

ENVIRONMENT=${1:-production}
VERSION=${2:-latest}
AWS_REGION=${AWS_REGION:-us-east-1}
AWS_ACCOUNT_ID=${AWS_ACCOUNT_ID:-$(aws sts get-caller-identity --query Account --output text)}
ECR_REPOSITORY="costra"
CLUSTER_NAME="costra-cluster"
SERVICE_NAME="costra-service"
TASK_FAMILY="costra-app"

echo "🚀 Deploying Costra to ECS"
echo "Environment: $ENVIRONMENT"
echo "Version: $VERSION"
echo "Region: $AWS_REGION"
echo "Account: $AWS_ACCOUNT_ID"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Login to ECR
echo -e "${YELLOW}📦 Logging into ECR...${NC}"
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

# Step 2: Build Docker image
echo -e "${YELLOW}🔨 Building Docker image...${NC}"
docker build -t $ECR_REPOSITORY:$VERSION .
docker tag $ECR_REPOSITORY:$VERSION $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY:$VERSION

# Step 3: Create ECR repository if it doesn't exist
echo -e "${YELLOW}📝 Checking ECR repository...${NC}"
if ! aws ecr describe-repositories --repository-names $ECR_REPOSITORY --region $AWS_REGION 2>/dev/null; then
  echo -e "${YELLOW}Creating ECR repository...${NC}"
  aws ecr create-repository --repository-name $ECR_REPOSITORY --region $AWS_REGION
fi

# Step 4: Push image to ECR
echo -e "${YELLOW}⬆️  Pushing image to ECR...${NC}"
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY:$VERSION

# Step 5: Update task definition
echo -e "${YELLOW}📋 Updating task definition...${NC}"
TASK_DEF_FILE="ecs/task-definition.json"
TASK_DEF=$(cat $TASK_DEF_FILE | \
  sed "s|YOUR_ACCOUNT_ID|$AWS_ACCOUNT_ID|g" | \
  sed "s|YOUR_REGION|$AWS_REGION|g" | \
  sed "s|costra:latest|$ECR_REPOSITORY:$VERSION|g")

# Register new task definition
TASK_DEF_ARN=$(echo "$TASK_DEF" | aws ecs register-task-definition --cli-input-json file:///dev/stdin --region $AWS_REGION --query 'taskDefinition.taskDefinitionArn' --output text)
echo -e "${GREEN}✅ Task definition registered: $TASK_DEF_ARN${NC}"

# Step 6: Update service
echo -e "${YELLOW}🔄 Updating ECS service...${NC}"
aws ecs update-service \
  --cluster $CLUSTER_NAME \
  --service $SERVICE_NAME \
  --task-definition $TASK_DEF_ARN \
  --region $AWS_REGION \
  --force-new-deployment \
  > /dev/null

echo -e "${GREEN}✅ Deployment initiated!${NC}"
echo -e "${YELLOW}⏳ Waiting for service to stabilize...${NC}"

# Wait for service to stabilize
aws ecs wait services-stable \
  --cluster $CLUSTER_NAME \
  --services $SERVICE_NAME \
  --region $AWS_REGION

echo -e "${GREEN}🎉 Deployment complete!${NC}"

# Get service URL
if [ -n "$LOAD_BALANCER_DNS" ]; then
  echo -e "${GREEN}🌐 Service URL: http://$LOAD_BALANCER_DNS${NC}"
fi

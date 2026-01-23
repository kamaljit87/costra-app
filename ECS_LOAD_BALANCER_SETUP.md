# ECS Load Balancer Architecture Setup

This document describes the load balancer → frontend → backend architecture for Costra.

## Architecture Overview

```
Internet
   ↓
Frontend ALB (Port 80, Internet-facing)
   ↓
Frontend Service (Vite Preview, Port 3001)
   ↓ (API calls via VITE_API_URL)
Backend ALB (Port 80, Internal)
   ↓
Backend Service (Node.js, Port 3002)
```

## Components

### 1. Frontend ALB
- **Type**: Application Load Balancer (Internet-facing)
- **Port**: 80
- **Target Group**: Frontend Target Group (Port 3001)
- **Health Check**: `/` (root path)

### 2. Backend ALB
- **Type**: Application Load Balancer (Internal)
- **Port**: 80
- **Target Group**: Backend Target Group (Port 3002)
- **Health Check**: `/api/health`

### 3. Frontend Service
- **Container**: Vite Preview serving React app
- **Port**: 3001
- **Environment Variable**: `VITE_API_URL` (set to Backend ALB URL + `/api`)

### 4. Backend Service
- **Container**: Node.js API
- **Port**: 3002
- **Routes**: All `/api/*` endpoints

## Files Created

### Dockerfiles
- `Dockerfile.frontend` - Builds React app and serves with Vite Preview on port 3001
- `Dockerfile.backend` - Node.js API container on port 3002

### ECS Task Definitions
- `ecs/task-definition-frontend.json` - Frontend task definition (port 3001)
- `ecs/task-definition-backend.json` - Backend task definition (port 3002)

### ECS Service Definitions
- `ecs/service-definition-frontend.json` - Frontend service configuration
- `ecs/service-definition-backend.json` - Backend service configuration

### CloudFormation
- `ecs/cloudformation-template.yaml` - Updated with:
  - Frontend ALB and Target Group (port 3001)
  - Backend ALB and Target Group (port 3002)
  - Separate security groups for frontend and backend
  - CloudWatch log groups for both services

### GitHub Actions
- `.github/workflows/deploy.yml` - Builds and deploys both services:
  1. Builds frontend Docker image
  2. Builds backend Docker image
  3. Pushes both to ECR
  4. Gets Backend ALB DNS name
  5. Updates Frontend task definition with Backend ALB URL
  6. Updates Backend task definition
  7. Deploys both services to ECS

## Deployment Steps

### 1. Deploy Infrastructure (First Time)
```bash
aws cloudformation create-stack \
  --stack-name costra-infrastructure \
  --template-body file://ecs/cloudformation-template.yaml \
  --parameters ParameterKey=Environment,ParameterValue=production \
  --capabilities CAPABILITY_IAM
```

### 2. Create ECR Repositories
```bash
aws ecr create-repository --repository-name costra-frontend --region us-east-1
aws ecr create-repository --repository-name costra-backend --region us-east-1
```

### 3. Register Task Definitions (First Time)
```bash
# Replace placeholders in task definitions
sed -i "s|YOUR_ACCOUNT_ID|005878674861|g" ecs/task-definition-frontend.json
sed -i "s|YOUR_REGION|us-east-1|g" ecs/task-definition-frontend.json
sed -i "s|YOUR_ACCOUNT_ID|005878674861|g" ecs/task-definition-backend.json
sed -i "s|YOUR_REGION|us-east-1|g" ecs/task-definition-backend.json

# Get Backend ALB DNS and update Frontend task definition
BACKEND_ALB_DNS=$(aws elbv2 describe-load-balancers \
  --region us-east-1 \
  --query "LoadBalancers[?contains(LoadBalancerName, 'costra-backend-alb')].DNSName" \
  --output text | head -n 1)

VITE_API_URL="http://$BACKEND_ALB_DNS/api"
jq ".containerDefinitions[0].environment = (.containerDefinitions[0].environment | map(if .name == \"VITE_API_URL\" then .value = \"$VITE_API_URL\" else . end))" \
  ecs/task-definition-frontend.json > ecs/task-definition-frontend-updated.json
mv ecs/task-definition-frontend-updated.json ecs/task-definition-frontend.json

# Register task definitions
aws ecs register-task-definition \
  --cli-input-json file://ecs/task-definition-frontend.json \
  --region us-east-1

aws ecs register-task-definition \
  --cli-input-json file://ecs/task-definition-backend.json \
  --region us-east-1
```

### 4. Create ECS Services (First Time)
```bash
# Get outputs from CloudFormation
FRONTEND_TG_ARN=$(aws cloudformation describe-stacks \
  --stack-name costra-infrastructure \
  --query "Stacks[0].Outputs[?OutputKey=='FrontendTargetGroupArn'].OutputValue" \
  --output text)

BACKEND_TG_ARN=$(aws cloudformation describe-stacks \
  --stack-name costra-infrastructure \
  --query "Stacks[0].Outputs[?OutputKey=='BackendTargetGroupArn'].OutputValue" \
  --output text)

SUBNETS=$(aws cloudformation describe-stacks \
  --stack-name costra-infrastructure \
  --query "Stacks[0].Outputs[?OutputKey=='PublicSubnet1Id' || OutputKey=='PublicSubnet2Id'].OutputValue" \
  --output text | tr '\t' ',')

FRONTEND_SG=$(aws cloudformation describe-stacks \
  --stack-name costra-infrastructure \
  --query "Stacks[0].Outputs[?OutputKey=='FrontendECSSecurityGroupId'].OutputValue" \
  --output text)

BACKEND_SG=$(aws cloudformation describe-stacks \
  --stack-name costra-infrastructure \
  --query "Stacks[0].Outputs[?OutputKey=='BackendECSSecurityGroupId'].OutputValue" \
  --output text)

# Create Frontend service
aws ecs create-service \
  --cluster costra-cluster \
  --service-name costra-frontend-service \
  --task-definition costra-frontend \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNETS],securityGroups=[$FRONTEND_SG],assignPublicIp=ENABLED}" \
  --load-balancers targetGroupArn=$FRONTEND_TG_ARN,containerName=costra-frontend,containerPort=3001 \
  --region us-east-1

# Create Backend service
aws ecs create-service \
  --cluster costra-cluster \
  --service-name costra-backend-service \
  --task-definition costra-backend \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNETS],securityGroups=[$BACKEND_SG],assignPublicIp=ENABLED}" \
  --load-balancers targetGroupArn=$BACKEND_TG_ARN,containerName=costra-backend,containerPort=3002 \
  --region us-east-1
```

### 5. Automated Deployments
After initial setup, deployments are automated via GitHub Actions when code is pushed to `main` branch.

## Environment Variables

### Frontend Container
- `VITE_API_URL` - Backend ALB URL with `/api` path (e.g., `http://costra-backend-alb-005878674861.us-east-1.elb.amazonaws.com/api`)

### Backend Container
- `NODE_ENV` - Set to `production`
- `PORT` - Set to `3002`
- Secrets from AWS Secrets Manager:
  - `DATABASE_URL`
  - `JWT_SECRET`
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`
  - `FRONTEND_URL`

## Security Groups

### Frontend ECS Security Group
- Allows inbound traffic on port 3001 from Frontend ALB Security Group

### Backend ECS Security Group
- Allows inbound traffic on port 3002 from Backend ALB Security Group

### Backend ALB Security Group
- Allows inbound traffic on port 80 from Frontend ECS Security Group

## Health Checks

### Frontend
- **Path**: `/` (root)
- **Expected Response**: `200 OK` (Vite Preview serves the React app)

### Backend
- **Path**: `/api/health`
- **Expected Response**: `200 OK` with JSON `{"status":"ok","message":"Costra API is running"}`

## Port Configuration

- **Frontend**: Port 3001 (Vite Preview)
- **Backend**: Port 3002 (Node.js API)
- **Frontend ALB**: Port 80 (Internet-facing)
- **Backend ALB**: Port 80 (Internal, routes to backend on port 3002)

## Troubleshooting

### Frontend can't reach Backend
1. Verify `VITE_API_URL` is correct in Frontend task definition
2. Check security groups allow traffic from Frontend to Backend ALB
3. Verify Backend ALB is in the same VPC as Frontend service
4. Check Backend service is running and healthy

### Backend ALB not found in GitHub Actions
- The workflow will fall back to a default DNS pattern
- Verify the ALB exists and has the correct name pattern
- Check AWS region and account ID are correct

### Vite Preview not starting
- Check that the build completed successfully
- Verify port 3001 is exposed in the Dockerfile
- Check container logs for Vite errors

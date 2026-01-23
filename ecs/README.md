# ECS Deployment Files

This directory contains all files necessary for deploying Costra to AWS ECS.

## Files

- **`task-definition.json`** - ECS task definition template
  - Update with your AWS account ID and region
  - Configure secrets ARNs
  - Adjust CPU/memory as needed

- **`service-definition.json`** - ECS service configuration template
  - Update with your subnet IDs
  - Update with your security group ID
  - Update with your target group ARN
  - Adjust desired count for scaling

- **`deploy.sh`** - Automated deployment script
  - Builds Docker image
  - Pushes to ECR
  - Registers new task definition
  - Updates ECS service
  - Waits for deployment completion

- **`setup-infrastructure.sh`** - Infrastructure setup script
  - Creates ECR repository
  - Creates CloudWatch log group
  - Creates ECS cluster
  - Provides instructions for manual setup steps

- **`cloudformation-template.yaml`** - Complete infrastructure as code
  - VPC with public/private subnets
  - Application Load Balancer
  - ECS cluster
  - Security groups
  - CloudWatch log group

- **`iam-policies.json`** - IAM policy templates
  - Task execution role policy
  - Task role policy

- **`.env.example`** - Environment variable template
  - Copy to `.env` and fill in your values

## Quick Start

1. **Set up infrastructure:**
   ```bash
   # Option 1: CloudFormation (recommended)
   aws cloudformation create-stack \
     --stack-name costra-infrastructure \
     --template-body file://ecs/cloudformation-template.yaml \
     --parameters ParameterKey=Environment,ParameterValue=production \
     --capabilities CAPABILITY_NAMED_IAM \
     --region us-east-1

   # Option 2: Manual setup
   ./ecs/setup-infrastructure.sh
   ```

2. **Create secrets in AWS Secrets Manager:**
   ```bash
   aws secretsmanager create-secret \
     --name costra/database-url \
     --secret-string "postgresql://user:pass@host:5432/costra" \
     --region us-east-1
   # Repeat for: jwt-secret, stripe-secret-key, stripe-webhook-secret, frontend-url
   ```

3. **Update configuration files:**
   - Edit `task-definition.json` with your account ID and region
   - Edit `service-definition.json` with your infrastructure IDs
   - Copy `.env.example` to `.env` and fill in values

4. **Deploy:**
   ```bash
   ./ecs/deploy.sh production latest
   ```

## See Also

- [`../ECS_DEPLOYMENT.md`](../ECS_DEPLOYMENT.md) - Complete deployment guide
- [`../README.md`](../README.md) - Project overview

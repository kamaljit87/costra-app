# ECS Deployment Files

This directory contains all files necessary for deploying Costra to AWS ECS with a load balancer architecture.

## Architecture

- **Frontend**: Vite Preview on port 3001
- **Backend**: Node.js API on port 3002
- **Load Balancers**: Frontend ALB (internet-facing) and Backend ALB (internal)

## Files

### Task Definitions
- **`task-definition-frontend.json`** - Frontend task definition
- **`task-definition-backend.json`** - Backend task definition

### Service Definitions
- **`service-definition-frontend.json`** - Frontend service configuration
- **`service-definition-backend.json`** - Backend service configuration

### Infrastructure
- **`cloudformation-template.yaml`** - Complete infrastructure as code
  - VPC with public/private subnets
  - Frontend and Backend Application Load Balancers
  - ECS cluster
  - Security groups
  - CloudWatch log groups

### Setup Scripts
- **`setup-services.sh`** - Interactive script to create secrets and ECS services
- **`iam-policies.json`** - IAM policy templates

### Documentation
- **`QUICK_SETUP.md`** - Quick setup guide for completing deployment

## Quick Start

Since you've already created ECR repos, cluster, and VPC:

1. **Run the setup script:**
   ```bash
   ./ecs/setup-services.sh
   ```

2. **Or follow the manual setup in `QUICK_SETUP.md`**

3. **Deploy via GitHub Actions** (automatic on push to main) or manually build and push images

## See Also

- [`../ECS_LOAD_BALANCER_SETUP.md`](../ECS_LOAD_BALANCER_SETUP.md) - Complete architecture documentation
- [`../ENVIRONMENT_VARIABLES.md`](../ENVIRONMENT_VARIABLES.md) - Environment variables reference
- [`../README.md`](../README.md) - Project overview

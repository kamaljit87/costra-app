# ECS Deployment Quick Start

Get Costra running on AWS ECS in 15 minutes.

## Prerequisites

- AWS CLI configured with appropriate permissions
- Docker installed
- PostgreSQL database (RDS or external)
- Redis instance (ElastiCache or external)

## Step 1: Set Up Infrastructure (5 minutes)

### Option A: CloudFormation (Recommended)

```bash
aws cloudformation create-stack \
  --stack-name costra-infrastructure \
  --template-body file://ecs/cloudformation-template.yaml \
  --parameters ParameterKey=Environment,ParameterValue=production \
  --capabilities CAPABILITY_NAMED_IAM \
  --region us-east-1
```

Wait for completion:
```bash
aws cloudformation wait stack-create-complete \
  --stack-name costra-infrastructure \
  --region us-east-1
```

### Option B: Manual Setup

```bash
./ecs/setup-infrastructure.sh
```

## Step 2: Create Secrets (3 minutes)

```bash
# Get your AWS account ID and region
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export AWS_REGION=us-east-1

# Create secrets
aws secretsmanager create-secret \
  --name costra/database-url \
  --secret-string "postgresql://user:password@host:5432/costra" \
  --region $AWS_REGION

aws secretsmanager create-secret \
  --name costra/jwt-secret \
  --secret-string "$(openssl rand -base64 32)" \
  --region $AWS_REGION

aws secretsmanager create-secret \
  --name costra/stripe-secret-key \
  --secret-string "sk_live_..." \
  --region $AWS_REGION

aws secretsmanager create-secret \
  --name costra/stripe-webhook-secret \
  --secret-string "whsec_..." \
  --region $AWS_REGION

aws secretsmanager create-secret \
  --name costra/frontend-url \
  --secret-string "https://your-domain.com" \
  --region $AWS_REGION
```

## Step 3: Update Configuration (2 minutes)

1. **Update `ecs/task-definition.json`**:
   - Replace `YOUR_ACCOUNT_ID` with your AWS account ID
   - Replace `YOUR_REGION` with your AWS region

2. **Get infrastructure IDs from CloudFormation outputs**:
   ```bash
   aws cloudformation describe-stacks \
     --stack-name costra-infrastructure \
     --query 'Stacks[0].Outputs' \
     --region us-east-1
   ```

3. **Update `ecs/service-definition.json`**:
   - Replace subnet IDs
   - Replace security group ID
   - Replace target group ARN

## Step 4: Create IAM Roles (3 minutes)

### Task Execution Role

```bash
# Create role
aws iam create-role \
  --role-name ecsTaskExecutionRole \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "ecs-tasks.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }'

# Attach managed policy
aws iam attach-role-policy \
  --role-name ecsTaskExecutionRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy

# Attach custom policy (from ecs/iam-policies.json)
aws iam put-role-policy \
  --role-name ecsTaskExecutionRole \
  --policy-name TaskExecutionRolePolicy \
  --policy-document file://ecs/iam-policies.json
```

### Task Role

```bash
# Create role
aws iam create-role \
  --role-name ecsTaskRole \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "ecs-tasks.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }'

# Attach custom policy
aws iam put-role-policy \
  --role-name ecsTaskRole \
  --policy-name TaskRolePolicy \
  --policy-document file://ecs/iam-policies.json
```

## Step 5: Deploy (2 minutes)

```bash
# Set environment variables
export AWS_REGION=us-east-1
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Deploy
./ecs/deploy.sh production latest
```

## Step 6: Create ECS Service (First Time Only)

```bash
# Get values from CloudFormation outputs
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

## Verify Deployment

1. **Check service status**:
   ```bash
   aws ecs describe-services \
     --cluster costra-cluster \
     --services costra-service \
     --region us-east-1
   ```

2. **Get ALB DNS name**:
   ```bash
   aws cloudformation describe-stacks \
     --stack-name costra-infrastructure \
     --query 'Stacks[0].Outputs[?OutputKey==`ApplicationLoadBalancerDNS`].OutputValue' \
     --output text \
     --region us-east-1
   ```

3. **Test health endpoint**:
   ```bash
   curl http://ALB_DNS_NAME/api/health
   ```

## Next Steps

- Set up SSL certificate in ACM
- Configure custom domain with Route 53
- Set up CloudWatch alarms
- Configure auto-scaling
- Set up CI/CD pipeline

## Troubleshooting

### Container won't start
- Check CloudWatch logs: `aws logs tail /ecs/costra-app --follow`
- Verify secrets are accessible
- Check IAM role permissions

### Health check failures
- Verify security group allows traffic from ALB
- Check application logs for errors
- Verify health endpoint is accessible

### High costs
- Use Fargate Spot for non-critical workloads
- Right-size CPU/memory based on usage
- Enable auto-scaling to scale down during low traffic

## Full Documentation

- **Complete Guide**: [`ECS_DEPLOYMENT.md`](./ECS_DEPLOYMENT.md)
- **Production Optimization**: [`PRODUCTION_OPTIMIZATION.md`](./PRODUCTION_OPTIMIZATION.md)
- **ECS Files**: [`ecs/README.md`](./ecs/README.md)

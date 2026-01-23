# GitHub Actions Workflow

This directory contains a single simplified CI/CD workflow for deploying Costra to AWS ECS.

## Workflow: Deploy (`deploy.yml`)

A single workflow that builds, pushes, and deploys the application to ECS.

**Triggers:**
- Push to `main` branch
- Manual workflow dispatch

**Steps:**
1. Checkout code
2. Configure AWS credentials
3. Login to Amazon ECR
4. Build Docker image
5. Push image to ECR (`costra-backend` repository)
6. Download current ECS task definition
7. Update task definition with new image
8. Register new task definition
9. Deploy to ECS service
10. Wait for deployment to stabilize

## Configuration

The workflow uses these environment variables:

- `AWS_REGION`: `us-east-1`
- `AWS_ACCOUNT_ID`: `005878674861`
- `ECR_REPOSITORY`: `costra-backend`
- `ECS_CLUSTER`: `costra-stack`
- `ECS_SERVICE`: `costra-service`
- `ECS_TASK_FAMILY`: `costra-app`

## Required GitHub Secrets

Configure these secrets in your GitHub repository settings:

- `AWS_ACCESS_KEY_ID` - AWS access key with ECS/ECR permissions
- `AWS_SECRET_ACCESS_KEY` - AWS secret access key

## IAM Permissions Required

The AWS user/role needs the following permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage",
        "ecr:PutImage",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload",
        "ecr:DescribeRepositories",
        "ecr:DescribeImages",
        "ecs:DescribeTaskDefinition",
        "ecs:RegisterTaskDefinition",
        "ecs:DescribeServices",
        "ecs:UpdateService",
        "ecs:ListTasks",
        "ecs:DescribeTasks"
      ],
      "Resource": "*"
    }
  ]
}
```

## Deployment Flow

1. **Push to Main**: Code is pushed to `main` branch
   - Workflow automatically triggers
   - Builds Docker image
   - Pushes to ECR with tags: `latest-<sha>` and `latest`
   - Deploys to ECS cluster `costra-stack`

2. **Manual Deployment**: Trigger manually via GitHub Actions UI
   - Go to Actions > Deploy to ECS
   - Click "Run workflow"
   - Select branch
   - Click "Run workflow"

## Image Tags

- `latest-<commit-sha>` - Tagged with first 8 characters of commit SHA
- `latest` - Always points to the latest deployment

## Troubleshooting

### Build fails
- Check AWS credentials are correct
- Verify ECR repository `costra-backend` exists
- Check IAM permissions

### Deployment fails
- Verify ECS cluster `costra-stack` exists
- Verify ECS service `costra-service` exists
- Check task definition `costra-app` is valid
- Verify image exists in ECR with correct tag

### Service not updating
- Check ECS service events in AWS Console
- Verify task definition was registered successfully
- Check CloudWatch logs for container errors

## Best Practices

1. **Never commit secrets** - Use GitHub Secrets
2. **Review before merging** - Require PR approval before merging to main
3. **Monitor deployments** - Check ECS service status after deployment
4. **Test locally** - Build and test Docker image locally before pushing
5. **Check logs** - Monitor CloudWatch logs for application errors

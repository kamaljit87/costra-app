# GitHub Actions Workflows

This directory contains CI/CD workflows for the Costra application.

## Workflows

### 1. CI (`ci.yml`)
Runs on every pull request and push to `main`/`develop` branches.

**Jobs:**
- **Test**: Runs frontend linting, builds frontend, runs backend tests
- **Build**: Builds and pushes Docker image to ECR (only on push to main/develop)

**Triggers:**
- Pull requests to `main` or `develop`
- Pushes to `main` or `develop`

### 2. Deploy (`deploy.yml`)
Deploys the application to ECS.

**Triggers:**
- Push to `main` branch
- Tag push (e.g., `v1.0.0`)
- Manual workflow dispatch

**Steps:**
1. Verifies Docker image exists in ECR
2. Downloads current task definition
3. Updates task definition with new image
4. Registers new task definition
5. Updates ECS service
6. Waits for deployment to stabilize

### 3. Security Scan (`security-scan.yml`)
Scans for security vulnerabilities.

**Triggers:**
- Pull requests
- Pushes to `main`
- Weekly schedule (Mondays at 9 AM UTC)

**Scans:**
- npm audit for frontend and backend
- Trivy vulnerability scanner
- Dockerfile security scan

### 4. Rollback (`rollback.yml`)
Manually rollback to a previous task definition.

**Usage:**
1. Go to Actions > Rollback Deployment
2. Click "Run workflow"
3. Select environment
4. Enter task definition ARN to rollback to

## Required GitHub Secrets

Configure these secrets in your GitHub repository settings:

### AWS Credentials
- `AWS_ACCESS_KEY_ID` - AWS access key with ECS/ECR permissions
- `AWS_SECRET_ACCESS_KEY` - AWS secret access key
- `AWS_REGION` (optional) - AWS region (defaults to us-east-1)

### IAM Permissions Required

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

## Environment Variables

Workflows use these environment variables (can be overridden):

- `AWS_REGION`: `us-east-1`
- `ECR_REPOSITORY`: `costra`
- `CLUSTER_NAME`: `costra-cluster`
- `SERVICE_NAME`: `costra-service`
- `TASK_FAMILY`: `costra-app`

## Deployment Flow

1. **Development**: Developer creates PR
   - CI workflow runs tests
   - Security scan runs
   - If tests pass, PR can be merged

2. **Merge to Main**: PR is merged
   - CI workflow runs tests
   - Build job creates Docker image
   - Image is pushed to ECR with tags: `main-<sha>`, `latest`

3. **Deployment**: Deploy workflow triggers
   - Downloads task definition
   - Updates with new image
   - Deploys to ECS
   - Waits for service to stabilize

4. **Tagged Release**: Tag is pushed (e.g., `v1.0.0`)
   - Deploy workflow triggers
   - Uses tag as image tag
   - Deploys to production

## Manual Deployment

To manually trigger a deployment:

1. Go to Actions > Deploy to ECS
2. Click "Run workflow"
3. Select environment (production/staging)
4. Click "Run workflow"

## Rollback

To rollback to a previous version:

1. Get the task definition ARN from ECS console or:
   ```bash
   aws ecs list-task-definitions --family-prefix costra-app
   ```

2. Go to Actions > Rollback Deployment
3. Enter the task definition ARN
4. Select environment
5. Run workflow

## Troubleshooting

### Build fails
- Check AWS credentials are correct
- Verify ECR repository exists
- Check IAM permissions

### Deployment fails
- Verify ECS cluster and service exist
- Check task definition is valid
- Verify image exists in ECR with correct tag

### Tests fail
- Check database and Redis services are running
- Verify test environment variables
- Check for dependency issues

## Best Practices

1. **Never commit secrets** - Use GitHub Secrets
2. **Review PRs** - Require approval before merging
3. **Tag releases** - Use semantic versioning (v1.0.0)
4. **Monitor deployments** - Check ECS service status after deployment
5. **Test locally** - Run tests before pushing
6. **Use environments** - Separate production and staging

## Customization

To customize workflows:

1. Update environment variables in workflow files
2. Adjust test commands if needed
3. Modify deployment steps for your setup
4. Add additional jobs/steps as needed

# GitHub Actions CI/CD Setup Guide

This guide explains how to set up and use the GitHub Actions CI/CD pipeline for Costra.

## Overview

The CI/CD pipeline automates:
- ✅ Running tests on pull requests
- ✅ Building Docker images
- ✅ Pushing to Amazon ECR
- ✅ Deploying to AWS ECS
- ✅ Security vulnerability scanning
- ✅ Manual rollback capability

## Prerequisites

1. **GitHub Repository**: Your code must be in a GitHub repository
2. **AWS Account**: With ECS cluster and ECR repository set up
3. **AWS IAM User**: With appropriate permissions (see below)

## Step 1: Create AWS IAM User

Create an IAM user specifically for GitHub Actions:

```bash
# Create IAM user
aws iam create-user --user-name github-actions-costra

# Create access key
aws iam create-access-key --user-name github-actions-costra
```

Save the access key ID and secret access key - you'll need them for GitHub Secrets.

## Step 2: Attach IAM Policy

Create and attach a policy with the necessary permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ECRAccess",
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
        "ecr:DescribeImages"
      ],
      "Resource": "*"
    },
    {
      "Sid": "ECSAccess",
      "Effect": "Allow",
      "Action": [
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

Attach the policy:

```bash
aws iam put-user-policy \
  --user-name github-actions-costra \
  --policy-name CostraCICDPolicy \
  --policy-document file://policy.json
```

## Step 3: Configure GitHub Secrets

1. Go to your GitHub repository
2. Navigate to **Settings** > **Secrets and variables** > **Actions**
3. Click **New repository secret**
4. Add the following secrets:

### Required Secrets

| Secret Name | Description | Example |
|------------|-------------|---------|
| `AWS_ACCESS_KEY_ID` | AWS IAM user access key ID | `AKIAIOSFODNN7EXAMPLE` |
| `AWS_SECRET_ACCESS_KEY` | AWS IAM user secret access key | `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` |
| `AWS_REGION` | AWS region (optional, defaults to us-east-1) | `us-east-1` |

### Optional Secrets

If you want to customize the deployment:

| Secret Name | Description | Default |
|------------|-------------|---------|
| `ECR_REPOSITORY` | ECR repository name | `costra` |
| `CLUSTER_NAME` | ECS cluster name | `costra-cluster` |
| `SERVICE_NAME` | ECS service name | `costra-service` |
| `TASK_FAMILY` | ECS task family | `costra-app` |

## Step 4: Set Up GitHub Environments (Optional)

For better control over deployments, set up environments:

1. Go to **Settings** > **Environments**
2. Create environments: `production` and `staging`
3. Add protection rules if needed:
   - Required reviewers
   - Deployment branches (only `main` for production)
   - Wait timer

## Step 5: Verify Workflows

1. Push code to your repository
2. Go to **Actions** tab
3. You should see workflows running

## Workflow Details

### CI Workflow

**Triggers:**
- Pull requests to `main` or `develop`
- Pushes to `main` or `develop`

**What it does:**
1. Runs frontend linter
2. Builds frontend
3. Runs backend tests
4. Builds Docker image (on push)
5. Pushes to ECR (on push)

### Deploy Workflow

**Triggers:**
- Push to `main` branch
- Tag push (e.g., `v1.0.0`)
- Manual workflow dispatch

**What it does:**
1. Verifies image exists in ECR
2. Downloads current task definition
3. Updates with new image
4. Registers new task definition
5. Updates ECS service
6. Waits for deployment to stabilize

### Security Scan Workflow

**Triggers:**
- Pull requests
- Pushes to `main`
- Weekly schedule (Mondays 9 AM UTC)

**What it does:**
1. Runs npm audit
2. Scans with Trivy
3. Uploads results to GitHub Security

### Rollback Workflow

**Triggers:**
- Manual workflow dispatch

**What it does:**
1. Updates ECS service with previous task definition
2. Waits for rollback to complete

## Usage Examples

### Automatic Deployment

1. **Create a feature branch:**
   ```bash
   git checkout -b feature/new-feature
   ```

2. **Make changes and commit:**
   ```bash
   git add .
   git commit -m "Add new feature"
   git push origin feature/new-feature
   ```

3. **Create pull request:**
   - CI workflow runs automatically
   - Review and merge when ready

4. **Merge to main:**
   - CI workflow runs
   - Build workflow creates Docker image
   - Deploy workflow deploys to ECS

### Manual Deployment

1. Go to **Actions** > **Deploy to ECS**
2. Click **Run workflow**
3. Select environment
4. Click **Run workflow**

### Tagged Release

1. **Create and push a tag:**
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

2. **Deploy workflow runs automatically**
   - Uses tag as image tag
   - Deploys to production

### Rollback

1. **Get task definition ARN:**
   ```bash
   aws ecs list-task-definitions \
     --family-prefix costra-app \
     --region us-east-1
   ```

2. **Go to Actions** > **Rollback Deployment**
3. **Enter task definition ARN**
4. **Select environment**
5. **Run workflow**

## Troubleshooting

### Workflow fails with "Access Denied"

**Problem:** AWS credentials don't have sufficient permissions.

**Solution:**
- Verify IAM policy is attached correctly
- Check that all required permissions are included
- Verify access key is correct in GitHub Secrets

### Build fails with "Image not found"

**Problem:** Docker image doesn't exist in ECR.

**Solution:**
- Ensure CI workflow completed successfully
- Check ECR repository exists
- Verify image was pushed with correct tag

### Deployment fails with "Service not found"

**Problem:** ECS service doesn't exist.

**Solution:**
- Create ECS service first (see ECS_DEPLOYMENT.md)
- Verify service name matches workflow configuration
- Check cluster name is correct

### Tests fail

**Problem:** Tests are failing in CI.

**Solution:**
- Run tests locally first
- Check test database connection
- Verify all dependencies are installed
- Check for environment-specific issues

## Best Practices

1. **Use branch protection rules:**
   - Require PR reviews
   - Require status checks to pass
   - Prevent force pushes to main

2. **Monitor deployments:**
   - Check ECS service status after deployment
   - Monitor CloudWatch logs
   - Set up alerts for failed deployments

3. **Use semantic versioning:**
   - Tag releases with `v1.0.0` format
   - Use tags for production deployments

4. **Test before deploying:**
   - Run tests locally
   - Test in staging before production
   - Use feature flags for gradual rollouts

5. **Keep secrets secure:**
   - Never commit secrets
   - Rotate access keys regularly
   - Use least privilege IAM policies

## Advanced Configuration

### Custom Image Tags

To use custom image tags, modify the `Get image tag` step in `deploy.yml`:

```yaml
- name: Get image tag
  id: image-tag
  run: |
    IMAGE_TAG="custom-tag-${GITHUB_SHA::8}"
    echo "tag=$IMAGE_TAG" >> $GITHUB_OUTPUT
```

### Multiple Environments

To deploy to multiple environments:

1. Create separate ECS clusters/services
2. Add environment-specific secrets
3. Use GitHub Environments
4. Modify workflow to use environment-specific values

### Notifications

Add Slack/Discord notifications:

```yaml
- name: Notify Slack
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    text: 'Deployment completed!'
  env:
    SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

## See Also

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [AWS ECS Deployment Guide](./ECS_DEPLOYMENT.md)
- [ECS Quick Start](./ECS_QUICKSTART.md)

# CI/CD Pipeline Summary

Complete GitHub Actions CI/CD pipeline for Costra has been set up and configured.

## Workflows Created

### 1. CI Pipeline (`.github/workflows/ci.yml`)
**Purpose:** Continuous Integration - Testing and Building

**Triggers:**
- Pull requests to `main` or `develop`
- Pushes to `main` or `develop`

**Jobs:**
- **Test Job:**
  - Runs frontend linter
  - Builds frontend
  - Runs backend tests with PostgreSQL and Redis services
  - Checks for security vulnerabilities

- **Build Job** (on push only):
  - Builds Docker image
  - Pushes to Amazon ECR with multiple tags
  - Uses Docker layer caching for faster builds

### 2. Deploy Pipeline (`.github/workflows/deploy.yml`)
**Purpose:** Continuous Deployment - Deploy to ECS

**Triggers:**
- Push to `main` branch
- Tag push (e.g., `v1.0.0`)
- Manual workflow dispatch

**Steps:**
1. Verifies Docker image exists in ECR
2. Downloads current ECS task definition
3. Updates task definition with new image
4. Registers new task definition
5. Updates ECS service with new task definition
6. Waits for service to stabilize
7. Provides deployment summary

### 3. Security Scan (`.github/workflows/security-scan.yml`)
**Purpose:** Security Vulnerability Scanning

**Triggers:**
- Pull requests
- Pushes to `main`
- Weekly schedule (Mondays at 9 AM UTC)

**Scans:**
- npm audit for frontend and backend dependencies
- Trivy vulnerability scanner for code and Dockerfile
- Uploads results to GitHub Security tab

### 4. Rollback (`.github/workflows/rollback.yml`)
**Purpose:** Manual Rollback to Previous Version

**Triggers:**
- Manual workflow dispatch only

**Usage:**
- Select environment (production/staging)
- Enter task definition ARN to rollback to
- Executes rollback and waits for completion

## Additional Files

### Dependabot Configuration (`.github/dependabot.yml`)
Automatically creates pull requests for dependency updates:
- Frontend npm packages (weekly)
- Backend npm packages (weekly)
- Docker base images (weekly)
- GitHub Actions (weekly)

### Documentation
- `.github/workflows/README.md` - Workflow documentation
- `GITHUB_ACTIONS_SETUP.md` - Complete setup guide

## Required GitHub Secrets

Configure these in GitHub repository settings:

| Secret | Description | Required |
|--------|-------------|----------|
| `AWS_ACCESS_KEY_ID` | AWS IAM user access key | ✅ Yes |
| `AWS_SECRET_ACCESS_KEY` | AWS IAM user secret key | ✅ Yes |
| `AWS_REGION` | AWS region (optional) | ❌ No (defaults to us-east-1) |

## Workflow Features

### ✅ Automated Testing
- Runs on every PR
- Tests frontend and backend
- Uses PostgreSQL and Redis services
- Fails fast on errors

### ✅ Docker Image Building
- Multi-stage builds
- Layer caching for performance
- Multiple tags (branch, SHA, latest)
- Pushes to ECR automatically

### ✅ Automated Deployment
- Deploys on merge to main
- Zero-downtime deployments
- Waits for service stabilization
- Provides deployment summary

### ✅ Security Scanning
- npm audit checks
- Trivy vulnerability scanning
- Dockerfile security scan
- Results in GitHub Security tab

### ✅ Manual Controls
- Manual deployment trigger
- Manual rollback capability
- Environment selection
- Deployment summaries

## Deployment Flow

```
Developer creates PR
    ↓
CI workflow runs tests
    ↓
PR reviewed and merged
    ↓
CI workflow builds Docker image
    ↓
Image pushed to ECR
    ↓
Deploy workflow triggers
    ↓
ECS service updated
    ↓
Deployment complete
```

## Quick Start

1. **Set up AWS IAM user:**
   ```bash
   aws iam create-user --user-name github-actions-costra
   aws iam create-access-key --user-name github-actions-costra
   ```

2. **Configure GitHub Secrets:**
   - Go to Settings > Secrets and variables > Actions
   - Add `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`

3. **Push code:**
   ```bash
   git push origin main
   ```

4. **Watch deployment:**
   - Go to Actions tab
   - Watch workflows run automatically

## Customization

### Change Environment Variables

Edit workflow files to change:
- `AWS_REGION`
- `ECR_REPOSITORY`
- `CLUSTER_NAME`
- `SERVICE_NAME`
- `TASK_FAMILY`

### Add Notifications

Add Slack/Discord notifications to workflows:

```yaml
- name: Notify Slack
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    text: 'Deployment completed!'
  env:
    SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

### Multiple Environments

1. Create GitHub Environments (Settings > Environments)
2. Add environment-specific secrets
3. Modify workflows to use environment values

## Best Practices

1. ✅ **Branch Protection**: Require PR reviews and status checks
2. ✅ **Semantic Versioning**: Use tags for releases (v1.0.0)
3. ✅ **Test Coverage**: Maintain good test coverage
4. ✅ **Security**: Regularly update dependencies
5. ✅ **Monitoring**: Monitor deployments and set up alerts
6. ✅ **Documentation**: Keep workflows documented

## Troubleshooting

### Workflow fails with "Access Denied"
- Check IAM permissions
- Verify AWS credentials in GitHub Secrets

### Build fails
- Check ECR repository exists
- Verify Docker build works locally
- Check for dependency issues

### Deployment fails
- Verify ECS cluster and service exist
- Check task definition is valid
- Verify image exists in ECR

### Tests fail
- Run tests locally first
- Check database/Redis services
- Verify environment variables

## Next Steps

1. ✅ CI/CD pipeline created
2. ✅ Workflows configured
3. ✅ Documentation complete
4. ⏭️ Set up GitHub Secrets
5. ⏭️ Configure branch protection rules
6. ⏭️ Test workflows with a PR
7. ⏭️ Set up monitoring and alerts

## Resources

- **Setup Guide**: [`GITHUB_ACTIONS_SETUP.md`](./GITHUB_ACTIONS_SETUP.md)
- **Workflow Docs**: [`.github/workflows/README.md`](./.github/workflows/README.md)
- **ECS Deployment**: [`ECS_DEPLOYMENT.md`](./ECS_DEPLOYMENT.md)
- **Quick Start**: [`ECS_QUICKSTART.md`](./ECS_QUICKSTART.md)

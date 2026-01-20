# AWS Server Credentials Configuration

## Overview

For **automated AWS connections** (CloudFormation-based), the Costra server needs AWS credentials to assume the IAM role in your AWS account. These credentials are for **Costra's AWS account**, not your account.

## Why Server Credentials Are Needed

When you create an automated AWS connection:
1. A CloudFormation stack creates an IAM role in **your AWS account**
2. This role allows **Costra's AWS account** to assume it
3. The Costra server needs credentials for **Costra's AWS account** to assume the role
4. Once assumed, the server gets temporary credentials to access your billing data

## Configuration Options

### Option 1: Environment Variables (Recommended for Development)

Add to `server/.env`:

```bash
# Costra's AWS Account Credentials (for assuming roles in customer accounts)
AWS_ACCESS_KEY_ID=your-costra-aws-access-key-id
AWS_SECRET_ACCESS_KEY=your-costra-aws-secret-access-key
AWS_REGION=us-east-1
```

**Note**: These are credentials for Costra's AWS account, not customer accounts.

### Option 2: IAM Instance Profile (AWS EC2 Only)

If running on AWS EC2, use an IAM instance profile:

1. **Create an IAM role** for the EC2 instance with permissions to assume roles
2. **Attach the role** to your EC2 instance
3. The AWS SDK will automatically use the instance profile credentials

The IAM role should have a policy like:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "sts:AssumeRole",
      "Resource": "arn:aws:iam::*:role/CostraAccessRole-*"
    }
  ]
}
```

**Note**: For non-AWS hosting (Linode, DigitalOcean, etc.), use Option 1 (Environment Variables).

### Option 3: AWS Credentials File

Create `~/.aws/credentials`:

```ini
[default]
aws_access_key_id = your-costra-aws-access-key-id
aws_secret_access_key = your-costra-aws-secret-access-key
region = us-east-1
```

## Verification

After configuring credentials, test by running a sync. The server will:
1. Use Costra's AWS credentials to assume the role in your account
2. Get temporary credentials
3. Use those credentials to fetch cost data

## Troubleshooting

### Error: "Could not load credentials from any providers"

**Cause**: Server doesn't have AWS credentials configured.

**Solution**: 
- Add `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` to `server/.env`
- Or configure IAM instance profile if on EC2
- Restart the backend server after adding credentials

### Error: "Access denied when assuming role"

**Cause**: Costra's AWS account doesn't have permission to assume the role.

**Solution**:
- Verify the CloudFormation stack was created successfully
- Check that the role ARN in the database matches the role created by CloudFormation
- Verify the external ID matches
- Ensure Costra's AWS account ID is correctly set in the CloudFormation template

### Error: "Invalid AWS credentials"

**Cause**: The server's AWS credentials are invalid or expired.

**Solution**:
- Verify the credentials are correct
- Check that the credentials haven't been rotated
- Ensure the credentials have permission to assume roles

## Security Notes

- **Never commit** AWS credentials to version control
- Use environment variables or IAM roles in production
- Rotate credentials regularly
- Use least-privilege IAM policies
- Consider using AWS Secrets Manager for credential storage

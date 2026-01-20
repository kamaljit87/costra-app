# Production Deployment Guide for Linode

## Overview

This guide covers deploying Costra to production on Linode with automated AWS connection support. Since Linode is not AWS, you'll need to configure AWS credentials manually.

## Prerequisites

1. **Linode server** with Node.js 18+ installed
2. **PostgreSQL database** (can be on Linode or managed database)
3. **AWS Account** for Costra (to assume roles in customer accounts)
4. **Domain name** (optional, for HTTPS)

## Step 1: Host CloudFormation Template

The CloudFormation template must be publicly accessible via HTTPS. Choose one option:

### Option A: AWS S3 (Recommended)

1. **Create S3 bucket** (in your Costra AWS account):
   ```bash
   aws s3 mb s3://costra-cloudformation-templates-prod
   ```

2. **Upload template**:
   ```bash
   aws s3 cp cloudformation/aws-billing-connection.yml \
     s3://costra-cloudformation-templates-prod/aws-billing-connection.yml
   ```

3. **Make publicly readable**:
   ```bash
   aws s3api put-object-acl \
     --bucket costra-cloudformation-templates-prod \
     --key aws-billing-connection.yml \
     --acl public-read
   ```

4. **Get URL**:
   ```
   https://costra-cloudformation-templates-prod.s3.amazonaws.com/aws-billing-connection.yml
   ```

### Option B: GitHub (If repository is public)

1. Push template to your repository
2. Use raw GitHub URL:
   ```
   https://raw.githubusercontent.com/your-org/costra/main/cloudformation/aws-billing-connection.yml
   ```

### Option C: Your Own Server

1. Upload template to your web server (e.g., via nginx)
2. Ensure HTTPS is enabled
3. Make it publicly accessible
4. Use URL like: `https://yourdomain.com/cloudformation/aws-billing-connection.yml`

## Step 2: Configure Environment Variables

On your Linode server, create/update `server/.env`:

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/costra

# Server
PORT=3001
NODE_ENV=production
JWT_SECRET=your-super-secret-jwt-key-change-this

# CloudFormation Template URL (from Step 1)
CLOUDFORMATION_TEMPLATE_URL=https://costra-cloudformation-templates-prod.s3.amazonaws.com/aws-billing-connection.yml

# Costra's AWS Account ID (the account that will assume roles in customer accounts)
COSTRA_AWS_ACCOUNT_ID=123456789012

# Costra's AWS Credentials (for assuming roles in customer accounts)
# These are credentials for YOUR Costra AWS account, not customer accounts
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
AWS_REGION=us-east-1
```

**Security Notes:**
- Never commit `.env` to version control
- Use strong, unique values for `JWT_SECRET`
- Rotate AWS credentials regularly
- Consider using Linode's environment variable management or secrets manager

## Step 3: Set Up AWS IAM User for Costra

In your Costra AWS account, create an IAM user with minimal permissions:

1. **Create IAM User**:
   - Go to AWS IAM Console
   - Create user: `costra-server`
   - Access type: Programmatic access

2. **Attach Policy** (create custom policy):
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

3. **Save Credentials**:
   - Copy Access Key ID and Secret Access Key
   - Add to `server/.env` as `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`

## Step 4: Update CloudFormation Template

Update `cloudformation/aws-billing-connection.yml` with your Costra AWS Account ID:

```yaml
Parameters:
  CostraAccountId:
    Type: String
    Description: 'Costra AWS Account ID (provided by Costra)'
    Default: '123456789012'  # Replace with your actual Costra AWS account ID
```

Or set it via environment variable (already handled in code).

## Step 5: Deploy Application

1. **Clone repository** on Linode:
   ```bash
   git clone https://github.com/your-org/costra.git
   cd costra
   ```

2. **Install dependencies**:
   ```bash
   npm install
   cd server
   npm install
   ```

3. **Build frontend**:
   ```bash
   cd ..
   npm run build
   ```

4. **Set up PM2** (or your process manager):
   ```bash
   pm2 start ecosystem.config.cjs
   pm2 save
   ```

5. **Set up reverse proxy** (nginx example):
   ```nginx
   server {
       listen 80;
       server_name yourdomain.com;
       
       # Redirect to HTTPS
       return 301 https://$server_name$request_uri;
   }
   
   server {
       listen 443 ssl http2;
       server_name yourdomain.com;
       
       ssl_certificate /path/to/cert.pem;
       ssl_certificate_key /path/to/key.pem;
       
       # Frontend
       location / {
           root /path/to/costra/dist;
           try_files $uri $uri/ /index.html;
       }
       
       # Backend API
       location /api {
           proxy_pass http://localhost:3001;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

## Step 6: Verify Setup

1. **Test CloudFormation URL**:
   ```bash
   curl -I https://your-template-url.com/aws-billing-connection.yml
   ```
   Should return `200 OK`

2. **Test AWS Credentials**:
   ```bash
   cd server
   AWS_ACCESS_KEY_ID=your-key AWS_SECRET_ACCESS_KEY=your-secret \
     node -e "const {STSClient} = require('@aws-sdk/client-sts'); \
     const client = new STSClient({region: 'us-east-1'}); \
     client.send({GetCallerIdentity: {}}).then(console.log)"
   ```

3. **Test Application**:
   - Visit your domain
   - Try creating an automated AWS connection
   - Verify the CloudFormation URL opens correctly
   - Complete the stack creation
   - Verify connection works

## How Automated Connection Works in Production

### User Flow:

1. **User clicks "Add Provider" → "Automated (CloudFormation)"**
   - User enters connection name and AWS Account ID
   - Backend generates External ID and creates pending connection

2. **Backend generates CloudFormation URL**:
   - Uses `CLOUDFORMATION_TEMPLATE_URL` from environment
   - Pre-fills: Costra Account ID, External ID, Connection Name
   - Returns URL to frontend

3. **User opens CloudFormation Console**:
   - Clicks "Open AWS Console" button
   - CloudFormation opens with pre-filled parameters
   - User reviews and clicks "Create stack"

4. **CloudFormation creates IAM role**:
   - Role allows Costra's AWS account to assume it
   - Uses External ID for security
   - Grants read-only access to billing data

5. **User clicks "Verify Connection"**:
   - Backend validates role ARN format
   - Marks connection as "pending" (can't test without server credentials)

6. **User clicks "Sync Data"**:
   - Backend uses Costra's AWS credentials (from `.env`)
   - Assumes the IAM role in user's account
   - Gets temporary credentials
   - Fetches cost data using temporary credentials

### Security Flow:

```
User's AWS Account                    Costra Server (Linode)          Costra AWS Account
     │                                        │                              │
     │  1. Create CloudFormation Stack       │                              │
     │──────────────────────────────────────>│                              │
     │     (creates IAM role)                │                              │
     │                                        │                              │
     │  2. Verify Connection                 │                              │
     │──────────────────────────────────────>│                              │
     │     (validates format)                │                              │
     │                                        │                              │
     │  3. Sync Data                          │                              │
     │──────────────────────────────────────>│  3a. Assume Role              │
     │                                        │──────────────────────────────>│
     │                                        │  3b. Get Temp Credentials    │
     │                                        │<──────────────────────────────│
     │                                        │                              │
     │  3c. Fetch Cost Data                  │                              │
     │<───────────────────────────────────────│                              │
     │     (using temp credentials)           │                              │
```

## Troubleshooting

### Error: "CloudFormation template URL not configured"
- **Fix**: Set `CLOUDFORMATION_TEMPLATE_URL` in `server/.env`
- **Verify**: URL is publicly accessible and returns template YAML

### Error: "Could not load credentials from any providers"
- **Fix**: Set `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` in `server/.env`
- **Verify**: Credentials are for Costra's AWS account, not customer accounts
- **Test**: Use AWS CLI or SDK to verify credentials work

### Error: "Access denied when assuming role"
- **Fix**: Verify CloudFormation stack was created successfully
- **Check**: Role ARN matches what's in database
- **Verify**: External ID matches
- **Ensure**: Costra's AWS account ID is correct in template

### Error: "Invalid role ARN format"
- **Fix**: Connection name is automatically sanitized now
- **Check**: Role ARN in database doesn't have spaces

## Production Checklist

- [ ] CloudFormation template hosted publicly (S3/GitHub/server)
- [ ] `CLOUDFORMATION_TEMPLATE_URL` set in `server/.env`
- [ ] `COSTRA_AWS_ACCOUNT_ID` set in `server/.env`
- [ ] `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` set in `server/.env`
- [ ] AWS IAM user created with `sts:AssumeRole` permission
- [ ] Database configured and accessible
- [ ] HTTPS enabled (SSL certificate)
- [ ] Reverse proxy configured (nginx/Apache)
- [ ] Process manager running (PM2/systemd)
- [ ] Environment variables secured (not in git)
- [ ] Logs configured and monitored
- [ ] Backup strategy in place

## Security Best Practices

1. **Use environment variables** for all secrets (never hardcode)
2. **Rotate AWS credentials** regularly (every 90 days)
3. **Use least-privilege IAM policies** (only `sts:AssumeRole` needed)
4. **Enable HTTPS** for all traffic
5. **Monitor logs** for suspicious activity
6. **Keep dependencies updated** (run `npm audit` regularly)
7. **Use database connection pooling** for performance
8. **Set up monitoring** (UptimeRobot, Pingdom, etc.)
9. **Backup database** regularly
10. **Use firewall** to restrict access to necessary ports only

## Alternative: Manual Connection Methods

If automated setup is too complex, users can use:
- **Simple (API Keys)**: User provides AWS access keys directly
- **Advanced (CUR + IAM Role)**: User sets up Cost & Usage Reports and IAM role manually

These don't require CloudFormation template hosting or server-side AWS credentials.

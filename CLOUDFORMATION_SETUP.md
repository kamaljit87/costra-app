# CloudFormation Template Setup Guide

## Overview

The automated AWS connection feature requires the CloudFormation template to be hosted at a publicly accessible HTTPS URL. This guide explains how to set this up.

**Note**: Our CloudFormation template follows CloudZero's pattern but is simplified for Costra's needs. It creates a single IAM role with read-only access to billing and cost data.

## Quick Setup Options

### Option 1: Host on S3 (Recommended for Production)

1. **Create an S3 bucket** (or use an existing one)
   ```bash
   aws s3 mb s3://costra-cloudformation-templates
   ```

2. **Upload the template**
   ```bash
   aws s3 cp cloudformation/aws-billing-connection.yml s3://costra-cloudformation-templates/
   ```

3. **Make the template publicly readable**
   ```bash
   aws s3api put-object-acl \
     --bucket costra-cloudformation-templates \
     --key aws-billing-connection.yml \
     --acl public-read
   ```

4. **Get the public URL**
   ```
   https://costra-cloudformation-templates.s3.amazonaws.com/aws-billing-connection.yml
   ```

5. **Set environment variable**
   ```bash
   # In server/.env
   CLOUDFORMATION_TEMPLATE_URL=https://costra-cloudformation-templates.s3.amazonaws.com/aws-billing-connection.yml
   ```

### Option 2: Host on GitHub (Good for Development)

1. **Push the template to a public GitHub repository**

2. **Get the raw content URL**
   ```
   https://raw.githubusercontent.com/your-org/costra/main/cloudformation/aws-billing-connection.yml
   ```

3. **Set environment variable**
   ```bash
   # In server/.env
   CLOUDFORMATION_TEMPLATE_URL=https://raw.githubusercontent.com/your-org/costra/main/cloudformation/aws-billing-connection.yml
   ```

### Option 3: Host on Your Own Web Server

1. **Upload the template to your web server** with HTTPS enabled

2. **Ensure it's publicly accessible**

3. **Set environment variable**
   ```bash
   # In server/.env
   CLOUDFORMATION_TEMPLATE_URL=https://your-domain.com/cloudformation/aws-billing-connection.yml
   ```

## Requirements

- **HTTPS required**: CloudFormation only accepts HTTPS URLs
- **Public access**: The URL must be accessible without authentication
- **Direct content**: The URL must return the template YAML directly (not a redirect or HTML page)
- **Content-Type**: Should be `text/plain` or `application/x-yaml` (S3 and GitHub handle this automatically)

## Testing the URL

You can test if your URL is valid by:

```bash
curl -I https://your-template-url.com/aws-billing-connection.yml
```

You should see:
- Status code: `200 OK`
- Content-Type: `text/plain` or `application/x-yaml`

## Security Considerations

- The template is read-only and only creates IAM roles with minimal permissions
- The template uses External ID for secure cross-account access
- Users must provide their AWS Account ID to use the template
- No sensitive data is stored in the template

## Troubleshooting

### Error: "TemplateURL must be a supported URL"

This means:
1. The URL is not publicly accessible
2. The URL is not HTTPS
3. The URL returns an error or redirect
4. The URL is not set in environment variables

**Solution**: Verify the URL is accessible and set `CLOUDFORMATION_TEMPLATE_URL` in `server/.env`

### Error: "CloudFormation template URL not configured"

This means the `CLOUDFORMATION_TEMPLATE_URL` environment variable is not set.

**Solution**: Set the environment variable as described above.

## Alternative: Manual Setup

If you prefer not to host the template publicly, users can:
1. Download the template from `cloudformation/aws-billing-connection.yml`
2. Manually create the CloudFormation stack in AWS Console
3. Use the "Simple" or "Advanced" connection methods instead

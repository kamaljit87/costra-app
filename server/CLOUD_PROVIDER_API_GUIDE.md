# Cloud Provider API Integration Guide

This guide explains how to fetch cost data from cloud providers (AWS, Azure, GCP) using their APIs.

## Overview

The application includes integration services for fetching cost data from major cloud providers. The data is fetched, transformed to a common format, and stored in the database.

## API Endpoints

### Sync All Providers
```
POST /api/sync
Authorization: Bearer <token>
```

Syncs cost data from all active cloud providers for the authenticated user.

**Response:**
```json
{
  "message": "Sync completed",
  "results": [
    {
      "providerId": "aws",
      "status": "success",
      "costData": {
        "currentMonth": 12450.75,
        "lastMonth": 11800.50
      }
    }
  ],
  "errors": [] // Only present if there are errors
}
```

### Sync Specific Provider
```
POST /api/sync/:providerId
Authorization: Bearer <token>
```

Syncs cost data for a specific provider.

**Example:**
```bash
POST /api/sync/aws
```

## Provider-Specific Setup

### AWS (Amazon Web Services)

**Required Credentials:**
- `accessKeyId`: AWS Access Key ID
- `secretAccessKey`: AWS Secret Access Key
- `region`: AWS Region (optional, defaults to `us-east-1`)

**Setup Steps:**
1. Log in to AWS Console
2. Go to IAM → Users → Your User → Security Credentials
3. Create a new Access Key
4. Grant the following IAM permissions:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "ce:GetCostAndUsage",
           "ce:GetDimensionValues",
           "ce:GetReservationCoverage",
           "ce:GetReservationPurchaseRecommendation",
           "ce:GetReservationUtilization",
           "ce:GetRightsizingRecommendation",
           "ce:GetSavingsPlansUtilization",
           "ce:ListCostCategoryDefinitions"
         ],
         "Resource": "*"
       }
     ]
   }
   ```

**Adding AWS Provider:**
```bash
POST /api/cloud-providers
{
  "providerId": "aws",
  "providerName": "Amazon Web Services",
  "credentials": {
    "accessKeyId": "AKIAIOSFODNN7EXAMPLE",
    "secretAccessKey": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    "region": "us-east-1"
  }
}
```

### Azure (Microsoft Azure)

**Required Credentials:**
- `tenantId`: Azure Active Directory Tenant ID
- `clientId`: Application (Client) ID
- `clientSecret`: Client Secret Value
- `subscriptionId`: Azure Subscription ID

**Setup Steps:**
1. Log in to Azure Portal
2. Go to Azure Active Directory → App registrations
3. Create a new registration or use existing
4. Note the Application (client) ID and Directory (tenant) ID
5. Go to Certificates & secrets → Create a new client secret
6. Grant the following API permissions:
   - `CostManagement.Read` (Microsoft Cost Management API)
7. Grant "Cost Management Reader" role to the service principal on your subscription

**Adding Azure Provider:**
```bash
POST /api/cloud-providers
{
  "providerId": "azure",
  "providerName": "Microsoft Azure",
  "credentials": {
    "tenantId": "12345678-1234-1234-1234-123456789012",
    "clientId": "87654321-4321-4321-4321-210987654321",
    "clientSecret": "your-client-secret",
    "subscriptionId": "11111111-2222-3333-4444-555555555555"
  }
}
```

### GCP (Google Cloud Platform)

**Required Credentials:**
- `projectId`: GCP Project ID
- `serviceAccountKey`: Service Account JSON key (full JSON object)

**Setup Steps:**
1. Log in to Google Cloud Console
2. Go to IAM & Admin → Service Accounts
3. Create a new service account or use existing
4. Grant the following roles:
   - `Billing Account Costs Viewer`
   - `Billing Account Viewer`
5. Create a JSON key for the service account
6. Download the JSON key file

**Adding GCP Provider:**
```bash
POST /api/cloud-providers
{
  "providerId": "gcp",
  "providerName": "Google Cloud Platform",
  "credentials": {
    "projectId": "my-gcp-project",
    "serviceAccountKey": {
      "type": "service_account",
      "project_id": "my-gcp-project",
      "private_key_id": "...",
      "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
      "client_email": "...",
      "client_id": "...",
      "auth_uri": "https://accounts.google.com/o/oauth2/auth",
      "token_uri": "https://oauth2.googleapis.com/token",
      "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
      "client_x509_cert_url": "..."
    }
  }
}
```

**Note:** For GCP, you'll need to install the Google Cloud Billing SDK:
```bash
cd server
npm install @google-cloud/billing
```

Then update `server/services/cloudProviderIntegrations.js` to use the SDK instead of the placeholder.

## Usage Examples

### Manual Sync via API

```bash
# Sync all providers
curl -X POST http://localhost:3001/api/sync \
  -H "Authorization: Bearer YOUR_TOKEN"

# Sync specific provider
curl -X POST http://localhost:3001/api/sync/aws \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Automated Sync (Cron Job)

You can set up a cron job to automatically sync cost data:

```bash
# Add to crontab (runs daily at 2 AM)
0 2 * * * curl -X POST http://localhost:3001/api/sync \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Or create a Node.js script:

```javascript
// scripts/sync-costs.js
import fetch from 'node-fetch'

const API_URL = 'http://localhost:3001/api/sync'
const TOKEN = process.env.API_TOKEN

async function syncCosts() {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
    })
    
    const result = await response.json()
    console.log('Sync completed:', result)
  } catch (error) {
    console.error('Sync failed:', error)
  }
}

syncCosts()
```

## Data Flow

1. **User adds provider** → Credentials stored (encrypted) in database
2. **Sync triggered** → API fetches cost data from cloud provider
3. **Data transformed** → Converted to common format
4. **Data saved** → Stored in `cost_data` table
5. **Frontend displays** → Data retrieved from database and shown in dashboard

## Security Notes

- All credentials are encrypted using AES-256-GCM before storage
- Credentials are never returned in API responses
- Each user can only access their own provider data (tenant isolation)
- API tokens expire after 7 days

## Troubleshooting

### AWS: "Access Denied"
- Check IAM permissions for Cost Explorer API
- Ensure the access key has the required permissions
- Verify the region is correct

### Azure: "Invalid Authentication"
- Verify tenant ID, client ID, and client secret
- Check that the service principal has the correct role assignments
- Ensure API permissions are granted and consented

### GCP: "Permission Denied"
- Verify the service account has billing viewer permissions
- Check that the project ID is correct
- Ensure the JSON key is valid and not expired

## Next Steps

1. Add more providers (DigitalOcean, Linode, Vultr, etc.)
2. Implement caching to reduce API calls
3. Add webhook support for real-time updates
4. Implement rate limiting for API calls
5. Add retry logic for failed syncs

# Costra — Cost Data Architecture & Fetching Documentation

> A comprehensive technical document explaining how Costra fetches, calculates, stores, and displays cost data for all supported cloud providers.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [End-to-End Data Flow](#2-end-to-end-data-flow)
3. [Cloud Provider Integrations](#3-cloud-provider-integrations)
   - [3.1 AWS (Amazon Web Services)](#31-aws-amazon-web-services)
   - [3.2 Microsoft Azure](#32-microsoft-azure)
   - [3.3 Google Cloud Platform (GCP)](#33-google-cloud-platform-gcp)
   - [3.4 DigitalOcean](#34-digitalocean)
   - [3.5 IBM Cloud](#35-ibm-cloud)
   - [3.6 Linode / Akamai](#36-linode--akamai)
   - [3.7 Vultr](#37-vultr)
4. [Credential Management & Security](#4-credential-management--security)
5. [The Sync Process (Backend)](#5-the-sync-process-backend)
6. [Cost Calculations & Forecasting](#6-cost-calculations--forecasting)
7. [Database Schema & Storage](#7-database-schema--storage)
8. [Backend API Endpoints](#8-backend-api-endpoints)
9. [Caching Strategy](#9-caching-strategy)
10. [Frontend Data Fetching & Display](#10-frontend-data-fetching--display)
11. [Currency Conversion](#11-currency-conversion)
12. [Demo Mode (No Credentials Required)](#12-demo-mode-no-credentials-required)
13. [Scheduled Syncing](#13-scheduled-syncing)
14. [Tax & Fee Filtering](#14-tax--fee-filtering)
15. [Error Handling](#15-error-handling)
16. [Anomaly Detection](#16-anomaly-detection)

---

## 1. System Overview

Costra is a multi-cloud FinOps (Financial Operations) platform that aggregates cost data from **7 cloud providers** into a single dashboard. The system:

- Fetches real cost data using each provider's official billing APIs
- Stores daily granular data (365 days of history) in PostgreSQL
- Provides monthly aggregates, service-level breakdowns, and forecasts
- Encrypts all cloud credentials with AES-256-GCM
- Supports multi-account per provider (e.g., 3 AWS accounts, 2 Azure subscriptions)
- Displays everything with real-time currency conversion (10 currencies)

### Supported Providers

| Provider | API Used | Credential Type |
|----------|----------|-----------------|
| AWS | Cost Explorer SDK | Access Key + Secret (or IAM Role) |
| Azure | Cost Management REST API | Service Principal (OAuth) |
| GCP | BigQuery Billing Export | Service Account Key (JWT) |
| DigitalOcean | API v2 (Invoices) | API Token |
| IBM Cloud | Usage Reports API | API Key + Account ID |
| Linode/Akamai | API v4 (Invoices) | Personal Access Token |
| Vultr | API v2 (Billing) | API Key |

### Tech Stack

- **Backend**: Node.js / Express, PostgreSQL, Redis
- **Frontend**: React / TypeScript, Vite, Recharts
- **Encryption**: AES-256-GCM for credentials at rest
- **Auth**: JWT (7-day expiry), bcryptjs, Google OAuth

---

## 2. End-to-End Data Flow

```
┌──────────────────────────────────────────────────────────────┐
│  STEP 1: USER INITIATES SYNC                                │
│  POST /api/sync (manual button click)                        │
│  or cron job at 2 AM UTC (scheduled auto-sync)               │
└───────────────────────┬──────────────────────────────────────┘
                        ▼
┌──────────────────────────────────────────────────────────────┐
│  STEP 2: SYNC ROUTE (server/routes/sync.js)                  │
│  1. Clear all cached data for the user                       │
│  2. Get all active cloud provider accounts from DB            │
│  3. For each account:                                        │
│     a. Decrypt stored credentials (AES-256-GCM)              │
│     b. For AWS automated: STS AssumeRole → temp credentials  │
│     c. Check if data is in 60-min cache                      │
└───────────────────────┬──────────────────────────────────────┘
                        ▼
┌──────────────────────────────────────────────────────────────┐
│  STEP 3: FETCH FROM PROVIDER API                             │
│  (server/services/cloudProviderIntegrations.js)              │
│  fetchProviderCostData(providerId, credentials, start, end)  │
│  Dispatches to: fetchAWSCostData, fetchAzureCostData, etc.   │
│  Date range: last 365 days                                   │
└───────────────────────┬──────────────────────────────────────┘
                        ▼
┌──────────────────────────────────────────────────────────────┐
│  STEP 4: TRANSFORM & ENHANCE                                │
│  - transformAWSCostData() / transformAzureCostData() / etc.  │
│  - Filter out Tax/Support/Refund/Credit entries              │
│  - Calculate currentMonth (month-to-date sum)                │
│  - enhanceCostData():                                        │
│    • Fetch last month's data if missing                      │
│    • Calculate forecast via exponential weighted regression   │
│  - sanitizeCostData(): validate & clean numbers              │
└───────────────────────┬──────────────────────────────────────┘
                        ▼
┌──────────────────────────────────────────────────────────────┐
│  STEP 5: SAVE TO DATABASE (PostgreSQL)                       │
│  - saveCostData(): Monthly aggregate → cost_data table       │
│  - saveBulkDailyCostData(): 365 daily rows → daily_cost_data │
│  - Service breakdown → service_costs table                   │
│  - Cache result for 60 minutes → cost_data_cache table       │
│  - Calculate anomaly baselines (async, non-blocking)         │
│  - Create sync notification for the user                     │
└───────────────────────┬──────────────────────────────────────┘
                        ▼
┌──────────────────────────────────────────────────────────────┐
│  STEP 6: FRONTEND RETRIEVAL                                  │
│  Dashboard.tsx loads data via:                                │
│  - GET /api/cost-data → monthly summary per provider         │
│  - GET /api/cost-data/{id}/daily → 365 days of daily data    │
│  - costService.ts slices into 30/60/90/120/180/365 day views │
│  - CurrencyContext converts all amounts to selected currency  │
│  - Charts render via Recharts (AreaChart, BarChart, PieChart) │
└──────────────────────────────────────────────────────────────┘
```

---

## 3. Cloud Provider Integrations

**Source file**: `server/services/cloudProviderIntegrations.js` (2,437 lines)

All provider integrations follow the same pattern:
1. Validate credentials
2. Authenticate with the provider's API
3. Fetch cost data (usually two queries: totals + service breakdown)
4. Transform into a normalized format
5. Return: `{ currentMonth, lastMonth, forecast, credits, savings, services[], dailyData[] }`

### 3.1 AWS (Amazon Web Services)

**Function**: `fetchAWSCostData(credentials, startDate, endDate)` — Line 43
**SDK**: `@aws-sdk/client-cost-explorer`

#### Credentials Required
```javascript
{
  accessKeyId: string,        // IAM access key
  secretAccessKey: string,    // IAM secret key
  sessionToken?: string,      // For role-based (temporary) credentials
  region?: string             // Defaults to 'us-east-1'
}
```

#### How It Works

AWS uses a **two-query approach** for accurate data:

**Query 1 — Daily Totals (without grouping)**
```javascript
const totalCommand = new GetCostAndUsageCommand({
  TimePeriod: { Start: startDate, End: endDate },
  Granularity: 'DAILY',
  Metrics: ['UnblendedCost'],
  Filter: {
    Not: {
      Dimensions: {
        Key: 'RECORD_TYPE',
        Values: ['Tax', 'Support', 'Refund', 'Credit']  // Excluded
      }
    }
  }
})
```
This returns one row per day with the total cost (excluding tax/support/refund/credit). This matches what AWS Console shows in the "Month-to-date" view.

**Query 2 — Service Breakdown (grouped by SERVICE)**
```javascript
const command = new GetCostAndUsageCommand({
  TimePeriod: { Start: startDate, End: endDate },
  Granularity: 'DAILY',
  Metrics: ['UnblendedCost'],
  GroupBy: [{ Type: 'DIMENSION', Key: 'SERVICE' }],
  Filter: { Not: { Dimensions: { Key: 'RECORD_TYPE', Values: ['Tax', 'Support', 'Refund', 'Credit'] } } }
})
```
This returns daily costs grouped by AWS service name (e.g., "Amazon Elastic Compute Cloud - Compute", "Amazon Simple Storage Service").

#### Transformation (`transformAWSCostData`)

1. **Daily data**: Extracted from Query 1's `Total.UnblendedCost.Amount` per day
2. **Service aggregation**: From Query 2, accumulates each service's cost across all days into a `serviceMap`
3. **Current month**: Recalculated by summing only days from the 1st of the current month to today (month-to-date)
4. **Last month**: Sum of all costs from days before the current month
5. **Forecast**: `currentMonth * 1.1` (10% increase, later overridden by exponential regression in `enhanceCostData`)
6. **Tax filtering**: Applied after aggregation via `filterOutTaxServices()`

#### Sub-Service Details (`fetchAWSServiceDetails`)

When a user drills into a service (e.g., "EC2"):
- Groups by `USAGE_TYPE` dimension
- Returns items like "USW2-BoxUsage:t3.medium", "USW2-EBS:VolumeUsage.gp3"
- Categorizes into: Compute, Storage, Data Transfer, Load Balancing, Networking, Requests, IP Addresses

#### AWS Role-Based Access (Automated Connections)

For users who don't want to share long-lived credentials, Costra supports **IAM Role Assumption**:

```
User's AWS Account                    Costra's AWS Account
┌────────────────────┐               ┌────────────────────┐
│  IAM Role:         │  AssumeRole   │  Costra Server     │
│  CostraAccessRole  │ ◄──────────── │  (ECS Task)        │
│                    │               │                    │
│  Trust Policy:     │               │  Uses default      │
│  - Costra account  │               │  credential chain  │
│  - ExternalId req  │               │  (instance profile)│
│                    │               │                    │
│  Permissions:      │               │  Gets temporary:   │
│  - ce:GetCostAnd.. │               │  AccessKeyId       │
│  - billing:View..  │  ──────────►  │  SecretAccessKey   │
│  (read-only)       │  temp creds   │  SessionToken      │
└────────────────────┘               └────────────────────┘
```

The flow in `sync.js` (lines 113-148):
```javascript
const stsClient = new STSClient({ region: 'us-east-1' })
const assumeRoleCommand = new AssumeRoleCommand({
  RoleArn: accountData.roleArn,
  RoleSessionName: `costra-sync-${accountId}-${Date.now()}`,
  ExternalId: accountData.externalId,  // Random UUID generated at setup
  DurationSeconds: 3600,               // 1 hour
})
const response = await stsClient.send(assumeRoleCommand)
// Use response.Credentials.{AccessKeyId, SecretAccessKey, SessionToken}
```

---

### 3.2 Microsoft Azure

**Function**: `fetchAzureCostData(credentials, startDate, endDate)` — Line 1181
**API**: Azure Cost Management REST API (v2021-10-01)

#### Credentials Required
```javascript
{
  tenantId: string,         // Azure AD Tenant ID
  clientId: string,         // App Registration Client ID
  clientSecret: string,     // App Registration Client Secret
  subscriptionId: string    // Azure Subscription ID
}
```

#### How It Works

**Step 1 — OAuth Authentication**
```
POST https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token
Body: grant_type=client_credentials&client_id=...&client_secret=...&scope=https://management.azure.com/.default
```
Returns a Bearer token used for all subsequent API calls.

**Step 2 — Two Queries** (same pattern as AWS):

**Query 1 — Total daily costs (no grouping)**
```javascript
POST /subscriptions/{subscriptionId}/providers/Microsoft.CostManagement/query
{
  type: 'ActualCost',
  timeframe: 'Custom',
  timePeriod: { from: startDate, to: endDate },
  dataset: {
    granularity: 'Daily',
    aggregation: { totalCost: { name: 'Cost', function: 'Sum' } }
  }
}
```

**Query 2 — Service breakdown (grouped by ServiceName)**
Same payload but with `grouping: [{ type: 'Dimension', name: 'ServiceName' }]`

#### Transformation (`transformAzureCostData`)

Azure returns data as row arrays: `properties.rows = [[cost, date, currency], ...]`
- Each row is mapped to `{ date, cost }` for daily data
- Service costs accumulated from the grouped query
- Current month / last month split by checking the date's month

#### Sub-Service Details (`fetchAzureServiceDetails`)

- Groups by `MeterSubCategory` dimension
- Returns items like "Standard Storage - Block Blob", "Premium SSD Managed Disks"
- Categories: Compute, Storage, Data Transfer, Networking, Requests

---

### 3.3 Google Cloud Platform (GCP)

**Function**: `fetchGCPCostData(credentials, startDate, endDate)` — Line 1452
**API**: BigQuery Billing Export (preferred) or Cloud Billing API (fallback)

#### Credentials Required
```javascript
{
  projectId: string,                   // GCP Project ID
  serviceAccountKey: string | object,  // Service Account Key JSON
  billingAccountId?: string,           // Billing Account ID
  bigQueryDataset: string              // e.g., "billing_export"
}
```

#### How It Works

**Authentication**: JWT-based using the service account private key:
1. Creates a JWT with `iss` (service account email), `scope` (BigQuery + Billing), `aud` (token URL)
2. Signs with RS256 using the service account's private key
3. Exchanges JWT for an access token at `https://oauth2.googleapis.com/token`

**Two Paths**:

**Path A — BigQuery Billing Export (when `bigQueryDataset` is configured)**
```sql
SELECT
  DATE(usage_start_time) as date,
  service.description as service_name,
  SUM(cost + IFNULL((SELECT SUM(c.amount) FROM UNNEST(credits) c), 0)) as cost
FROM `{projectId}.{dataset}.gcp_billing_export_v1_*`
WHERE DATE(usage_start_time) BETWEEN @startDate AND @endDate
GROUP BY date, service_name
ORDER BY date ASC
```
This gives granular daily data with full service breakdown.

**Path B — Cloud Billing API (fallback)**
- Only retrieves basic billing account info (display name, open status)
- **Cannot provide detailed cost breakdown** without BigQuery export
- Returns zeros and empty arrays — logs a warning to configure BigQuery export

**Important**: GCP detailed cost data **requires** the user to set up billing export to BigQuery in their GCP Console. Without it, Costra cannot get granular costs.

---

### 3.4 DigitalOcean

**Function**: `fetchDigitalOceanCostData(credentials, startDate, endDate)` — Line 1733
**API**: DigitalOcean API v2

#### Credentials Required
```javascript
{ apiToken: string }  // Personal Access Token with billing scope
```

#### How It Works

**Two API calls**:

1. **Invoices**: `GET /v2/customers/my/invoices`
   - Returns monthly invoices with amounts
   - Each invoice may contain `invoice_items` for service breakdown

2. **Billing History**: `GET /v2/customers/my/billing_history`
   - Returns individual transaction entries
   - Used for more granular breakdown

#### Transformation (`transformDigitalOceanCostData`)

- Iterates invoices within the date range
- Each invoice date becomes a daily data point with the invoice amount
- Current month: invoices from this month; Last month: invoices from previous months
- Service breakdown from `invoice_items[].description` (e.g., "Droplet", "Spaces", "Load Balancer")
- If no items, defaults to "DigitalOcean Services"
- Forecast: `currentMonth * 1.1` (simple 10% increase estimate)

**Note**: DigitalOcean's API provides monthly invoice granularity, not true daily cost data. Daily data points correspond to invoice dates, not individual daily costs.

---

### 3.5 IBM Cloud

**Function**: `fetchIBMCloudCostData(credentials, startDate, endDate)` — Line 1893
**API**: IBM Cloud Billing/Usage Reports API

#### Credentials Required
```javascript
{
  apiKey: string,      // IBM Cloud API Key
  accountId: string    // IBM Cloud Account ID
}
```

#### How It Works

**Step 1 — IAM Authentication**
```
POST https://iam.cloud.ibm.com/identity/token
Body: grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey=...
```

**Step 2 — Account Summary**
```
GET https://billing.cloud.ibm.com/v4/accounts/{accountId}/summary/{YYYY-MM}
```
Returns billable cost total and resource-level breakdown.

**Step 3 — Usage Data**
```
GET https://billing.cloud.ibm.com/v4/accounts/{accountId}/usage/{YYYY-MM}
```
Returns detailed resource usage metrics.

#### Transformation (`transformIBMCloudCostData`)

- `currentMonth` from `accountSummary.billable_cost`
- Service breakdown from `accountSummary.resources[]` — each resource's `resource_name` and `billable_cost`
- Usage data fills gaps in service breakdown
- Forecast: `currentMonth * 1.1`

**Note**: IBM provides monthly-level data only. The `dailyData` array gets a single point per month.

---

### 3.6 Linode / Akamai

**Function**: `fetchLinodeCostData(credentials, startDate, endDate)` — Line 2065
**API**: Linode API v4

#### Credentials Required
```javascript
{ apiToken: string }  // Personal Access Token
```

#### How It Works

**Three API calls**:

1. **Account Info**: `GET /v4/account`
   - Returns `uninvoiced_balance` (current month's unbilled charges)

2. **Historical Invoices**: `GET /v4/account/invoices?page_size=100`
   - Monthly invoices with totals

3. **Current Invoice Items**: `GET /v4/account/invoices/current/items?page_size=500`
   - Individual line items for the current billing period (services in use now)

#### Transformation (`transformLinodeCostData`)

- `currentMonth`: Sum of current invoice items, or `account.uninvoiced_balance` if no items
- Service breakdown from current invoice items: `item.label` or `item.type` (e.g., "Linode 4GB - my-server", "NodeBalancer")
- Historical invoices become daily data points (one per invoice date)
- `lastMonth`: Sum of invoices outside current month within date range
- Forecast: `currentMonth * 1.1`

---

### 3.7 Vultr

**Function**: `fetchVultrCostData(credentials, startDate, endDate)` — Line 2220
**API**: Vultr API v2

#### Credentials Required
```javascript
{ apiKey: string }  // Vultr API Key
```

#### How It Works

**Three API calls**:

1. **Account Info**: `GET /v2/account`
   - Returns `pending_charges` (current month's accrued charges) and `balance`

2. **Billing History**: `GET /v2/billing/history`
   - Individual billing transactions with dates, amounts, and descriptions

3. **Invoices**: `GET /v2/billing/invoices`
   - Monthly invoice summaries

#### Transformation (`transformVultrCostData`)

- `currentMonth`: From `account.pending_charges` (real-time accrued charges)
- Service breakdown from billing history `entry.description` (e.g., "Cloud Compute", "Block Storage")
- Daily data from billing history entries (positive amounts only, charges not payments)
- Deduplication: invoices only added if no billing history entry exists for that date
- `lastMonth`: Sum of non-current-month billing history
- Forecast: `currentMonth * 1.1`

---

## 4. Credential Management & Security

**Source file**: `server/services/encryption.js`

All cloud provider credentials are encrypted at rest using **AES-256-GCM**:

```
User provides credentials (e.g., AWS Access Key)
    ↓
JSON.stringify(credentials)
    ↓
encrypt(credentialsJson)
    → Generate random 16-byte IV
    → Create cipher with AES-256-GCM using ENCRYPTION_KEY
    → Encrypt data → get ciphertext + authTag (16 bytes)
    → Return: IV + authTag + ciphertext (concatenated, base64-encoded)
    ↓
Stored in: cloud_provider_credentials.credentials_encrypted
```

**Decryption** (during sync):
```
getCloudProviderCredentialsByAccountId(userId, accountId)
    ↓
Read credentials_encrypted from database
    ↓
decrypt(encryptedData)
    → Split: IV (16 bytes) + authTag (16 bytes) + ciphertext
    → Create decipher with AES-256-GCM
    → Set auth tag for integrity verification
    → Decrypt → JSON.parse → return credentials object
```

**Key Management**:
- Encryption key from `process.env.ENCRYPTION_KEY`
- **Fails in production** if not set (no fallback — enforced security)
- GCM mode provides both confidentiality and integrity verification

---

## 5. The Sync Process (Backend)

**Source file**: `server/routes/sync.js`

### POST /api/sync — Main Sync Flow

```javascript
router.post('/', async (req, res) => {
  // 1. Clear all cached data for the user
  await clearUserCache(userId)
  await clearCostExplanationsCache(userId)

  // 2. Get all active cloud provider accounts
  let accounts = await getUserCloudProviders(userId)

  // 3. Calculate date range: last 365 days
  const { startDate, endDate } = getDateRange(365)

  // 4. For each active account:
  for (const account of accounts) {
    // a. Get decrypted credentials
    const accountData = await getCloudProviderCredentialsByAccountId(userId, account.id)

    // b. For automated AWS: assume the IAM role
    if (account.provider_id === 'aws' && accountData.connectionType?.startsWith('automated')) {
      credentialsToUse = await assumeRole(accountData.roleArn, accountData.externalId)
    }

    // c. Check 60-minute cache
    const cacheKey = `account-${account.id}-${startDate}-${endDate}`
    let costData = await getCachedCostData(userId, providerId, cacheKey)

    // d. If not cached: fetch from provider API
    if (!costData) {
      costData = await fetchProviderCostData(providerId, credentials, startDate, endDate)
      await setCachedCostData(userId, providerId, cacheKey, costData, 60)  // 60-min TTL
    }

    // e. Validate response structure
    const validation = validateCostDataResponse(costData)

    // f. Enhance: fill in lastMonth + forecast if missing
    const enhanced = await enhanceCostData(costData, providerId, credentials, year, month, dailyData)

    // g. Sanitize: clean numbers, remove NaN/Infinity
    const sanitized = sanitizeCostData(enhanced)

    // h. Save monthly aggregate
    await saveCostData(userId, providerId, month, year, sanitized)

    // i. Save daily data (365 data points)
    await saveBulkDailyCostData(userId, providerId, costData.dailyData, account.id)

    // j. Calculate anomaly baselines (async, non-blocking)
    calculateBaselinesForServices(userId, providerId, account.id, costData)

    // k. Update sync timestamp
    await updateCloudProviderSyncTime(userId, account.id)

    // l. Create notification
    await createNotification(userId, { type: 'sync', title: `Sync Completed: ${label}` })
  }

  // 5. Return results
  res.json({ message: 'Sync completed', results, errors })
})
```

### What Gets Saved

| Table | Data | Granularity |
|-------|------|-------------|
| `cost_data` | Monthly aggregate (currentMonth, lastMonth, forecast, credits, savings) | 1 row per provider per account per month |
| `service_costs` | Service breakdown (name, cost, change %) | N rows per cost_data record |
| `daily_cost_data` | Daily cost amounts | 1 row per day per provider per account |
| `cost_data_cache` | Raw API response (JSONB) | 60-minute TTL |

---

## 6. Cost Calculations & Forecasting

**Source file**: `server/utils/costCalculations.js`

### 6.1 Current Month (Month-to-Date)

For **AWS and Azure**: Summed from daily data points where the date falls in the current month:
```javascript
dailyData.forEach((day) => {
  const dayDate = new Date(day.date)
  if (dayDate.getFullYear() === currentYear && dayDate.getMonth() === now.getMonth()) {
    monthToDate += day.cost
  }
})
```

For **other providers**: Extracted directly from their billing APIs (e.g., Vultr's `pending_charges`, Linode's `uninvoiced_balance`).

### 6.2 Last Month

**Primary method**: The 365-day fetch includes last month's data. During `transformXxxCostData()`, costs from days before the current month are summed into `lastMonth`.

**Fallback** (via `enhanceCostData`): If `lastMonth` is null/undefined after the main fetch, `fetchLastMonthData()` makes a separate API call to the provider for the previous month's date range only.

### 6.3 Forecast — Exponential Weighted Linear Regression

**Function**: `calculateForecastFromTrend(dailyData, currentMonth)` — Line 9

The forecasting algorithm works as follows:

```
Input: dailyData[] (up to 365 days), currentMonth (month-to-date total)
Output: { forecast: number, confidence: 0-100 }

Step 1: Calculate remaining days in the month
  - If 0 days remaining → forecast = currentMonth, confidence = 100

Step 2: If insufficient data (<3 points):
  - Use simple daily average: (currentMonth / daysElapsed) * daysInMonth
  - Confidence: 15

Step 3: Get last 30 days of data for trend analysis

Step 4: Exponentially weighted linear regression
  - Decay factor: 0.95 (more recent data weighted higher)
  - Weight for day i: 0.95^(n-1-i) where n = total data points

  - Calculate weighted sums:
    sumW, sumWX, sumWY, sumWXY, sumWX²

  - Solve weighted least squares:
    slope = (sumW × sumWXY - sumWX × sumWY) / (sumW × sumWX² - sumWX²)
    intercept = (sumWY - slope × sumWX) / sumW

Step 5: Project remaining days
  for each remaining day i:
    predictedCost = slope × (lastIndex + i) + intercept
    projectedRemaining += max(0, predictedCost)

  forecast = currentMonth + projectedRemaining

Step 6: Calculate confidence score (0-100)
  Components:
  - dataScore (0-30): min(1, dataPoints/20) × 30
  - fitScore (0-40): R² × 40  (R-squared goodness of fit)
  - stabilityScore (0-30): max(0, 1 - CV) × 30  (CV = coefficient of variation)

  confidence = dataScore + fitScore + stabilityScore

Step 7: Sanity bounds
  - If forecast < 0 → forecast = currentMonth
  - If forecast > 5× currentMonth → logarithmic dampening applied
```

**By provider:**

| Provider | Forecast Method |
|----------|----------------|
| AWS | Exponential weighted regression (from `enhanceCostData`) |
| Azure | Exponential weighted regression (from `enhanceCostData`) |
| GCP | Initial: `currentMonth * 1.1`, then overridden by regression if daily data available |
| DigitalOcean | Initial: `currentMonth * 1.1`, then overridden by regression |
| IBM Cloud | Initial: `currentMonth * 1.1`, then overridden by regression |
| Linode | Initial: `currentMonth * 1.1`, then overridden by regression |
| Vultr | Initial: `currentMonth * 1.1`, then overridden by regression |

### 6.4 Service Cost Breakdown for Date Ranges

**Function**: `getServiceCostsForDateRange()` in `database.js` — Line 1044

When the frontend requests service breakdown for a specific date range (not just the current month), the system uses **proportional scaling**:

```
1. Sum all daily_cost_data for the date range → totalPeriodCost
2. Get the most recent month's cost_data record
3. Get that month's service_costs breakdown
4. Calculate each service's percentage: servicePercent = serviceCost / totalServicesForMonth
5. Scale to period: periodServiceCost = totalPeriodCost × servicePercent
```

**Why proportional scaling?** Costra doesn't store service-level daily data (only total daily costs). Service breakdown is stored monthly. To estimate service costs for arbitrary date ranges, it applies the latest month's service proportions to the period's total.

---

## 7. Database Schema & Storage

**Source file**: `server/database.js`

### Core Tables

#### `cost_data` (Line 179)
Stores monthly cost aggregates per provider per account:
```sql
CREATE TABLE cost_data (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider_id TEXT NOT NULL,           -- 'aws', 'azure', 'gcp', etc.
  account_id INTEGER REFERENCES cloud_provider_credentials(id) ON DELETE CASCADE,
  month INTEGER NOT NULL,              -- 1-12
  year INTEGER NOT NULL,               -- 2024, 2025, etc.
  current_month_cost DECIMAL(15, 2),   -- Month-to-date cost in USD
  last_month_cost DECIMAL(15, 2),      -- Previous month's total
  forecast_cost DECIMAL(15, 2),        -- Predicted end-of-month cost
  forecast_confidence INTEGER,         -- 0-100 confidence score
  credits DECIMAL(15, 2) DEFAULT 0,    -- Active credits
  savings DECIMAL(15, 2) DEFAULT 0,    -- Savings from reserved plans
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, provider_id, account_id, month, year)
)
```

#### `service_costs` (Line 199)
Service-level breakdown linked to a `cost_data` record:
```sql
CREATE TABLE service_costs (
  id SERIAL PRIMARY KEY,
  cost_data_id INTEGER NOT NULL REFERENCES cost_data(id) ON DELETE CASCADE,
  service_name TEXT NOT NULL,           -- 'EC2 Instances', 'S3 Storage', etc.
  cost DECIMAL(15, 2) NOT NULL,
  change_percent DECIMAL(10, 2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
)
```

#### `daily_cost_data` (Line 212)
Daily granular cost data for charts and trend analysis:
```sql
CREATE TABLE daily_cost_data (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider_id TEXT NOT NULL,
  account_id INTEGER REFERENCES cloud_provider_credentials(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  cost DECIMAL(15, 2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, provider_id, account_id, date)
)
```

#### `cloud_provider_credentials` (Line 493)
Encrypted credential storage:
```sql
CREATE TABLE cloud_provider_credentials (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider_id TEXT NOT NULL,            -- 'aws', 'azure', etc.
  provider_name TEXT NOT NULL,          -- 'Amazon Web Services'
  account_alias TEXT,                   -- User-friendly name
  credentials_encrypted TEXT NOT NULL,  -- AES-256-GCM encrypted JSON
  is_active BOOLEAN DEFAULT true,
  role_arn TEXT,                        -- For AWS automated connections
  external_id TEXT,                     -- For AWS role assumption security
  connection_type TEXT DEFAULT 'manual', -- 'manual' or 'automated'
  connection_status TEXT DEFAULT 'connected',
  last_sync_at TIMESTAMP,
  auto_sync_enabled BOOLEAN DEFAULT false,
  auto_sync_time TEXT,                  -- Hour (UTC) for auto-sync
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
)
```

#### `cost_data_cache` (Line 227)
API response cache with TTL:
```sql
CREATE TABLE cost_data_cache (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  provider_id TEXT,
  cache_key TEXT,           -- 'account-{id}-{startDate}-{endDate}'
  cache_data JSONB,         -- Full API response
  expires_at TIMESTAMP,     -- NOW() + 60 minutes
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, provider_id, cache_key)
)
```

### Key Database Operations

**`saveCostData()`** — Line 1160
- Uses PostgreSQL transaction (BEGIN/COMMIT/ROLLBACK)
- UPSERT pattern: checks if record exists first, then UPDATE or INSERT
- Deletes old `service_costs` entries and re-inserts fresh ones

**`saveBulkDailyCostData()`** — Line 1869
- Bulk inserts all 365 daily data points
- Uses `ON CONFLICT ... DO UPDATE` to handle re-syncs on the same day

**`getCostDataForUser()`** — Line 1115
- INNER JOIN with `cloud_provider_credentials` to validate the provider account still exists
- Loads `service_costs` for each `cost_data` record
- Supports both multi-account (with `account_id`) and legacy single-account (NULL `account_id`) queries

**`getDailyCostData()`** — Line 1929
- Simple SELECT with date range filter and optional `account_id`
- Returns sorted by date ascending

### Performance Indexes (Lines 667-724)
```sql
CREATE INDEX idx_cost_data_user_month_year ON cost_data(user_id, month, year);
CREATE INDEX idx_cost_data_user_provider_month_year ON cost_data(user_id, provider_id, month, year);
CREATE INDEX idx_service_costs_cost_data_id ON service_costs(cost_data_id);
CREATE INDEX idx_daily_cost_data_user_provider_date ON daily_cost_data(user_id, provider_id, date);
```

---

## 8. Backend API Endpoints

**Source file**: `server/routes/costData.js`

### Cost Data Endpoints

| Method | Endpoint | Purpose | Cache |
|--------|----------|---------|-------|
| GET | `/api/cost-data` | Monthly cost summary for all providers | 5 min |
| POST | `/api/cost-data` | Manually save cost data | Clears cache |
| GET | `/api/cost-data/services/{providerId}` | Service breakdown for date range | No |
| GET | `/api/cost-data/services/{providerId}/{service}/details` | Sub-service drill-down | No |
| GET | `/api/cost-data/preferences` | User's currency preference | No |
| PUT | `/api/cost-data/preferences/currency` | Update currency preference | No |
| PUT | `/api/cost-data/{providerId}/credits` | Update cloud credits | No |
| GET | `/api/cost-data/{providerId}/credits` | Get credit details | No |
| GET | `/api/cost-data/{providerId}/daily` | Daily cost data for charts | No |
| POST | `/api/cost-data/{providerId}/report` | Generate JSON/PDF report | No |

### Sync Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/sync` | Sync ALL active accounts (365 days) |
| POST | `/api/sync/account/{accountId}` | Sync a specific account |
| POST | `/api/sync/{providerId}` | Legacy: sync all accounts of one provider type |

### Response Format — GET /api/cost-data

```json
{
  "costData": [
    {
      "provider": {
        "id": "aws",
        "name": "Amazon Web Services",
        "icon": "☁️"
      },
      "currentMonth": 12450.75,
      "lastMonth": 11800.50,
      "forecast": 13200.00,
      "forecastConfidence": 78,
      "credits": 500.00,
      "savings": 1250.00,
      "services": [
        { "name": "EC2 Instances", "cost": 5200.00, "change": 5.2 },
        { "name": "S3 Storage", "cost": 3200.50, "change": -2.1 },
        { "name": "RDS Databases", "cost": 2100.25, "change": 8.5 }
      ]
    }
  ]
}
```

### Response Format — GET /api/cost-data/{providerId}/daily

```json
{
  "dailyData": [
    { "date": "2025-01-15", "cost": 412.50 },
    { "date": "2025-01-16", "cost": 425.75 },
    { "date": "2025-01-17", "cost": 398.20 }
  ]
}
```

---

## 9. Caching Strategy

Costra uses a **three-layer caching** approach:

### Layer 1: API Response Cache (Database)

**Table**: `cost_data_cache`
**TTL**: 60 minutes
**Key**: `account-{accountId}-{startDate}-{endDate}`

When a sync runs, the raw provider API response is cached. If the user syncs again within 60 minutes, the cached response is used instead of hitting the provider API again (unless `?force=true` is passed).

### Layer 2: Redis / In-Memory Cache (Application)

**Module**: `server/utils/cache.js`
**TTL**: 5 minutes (for GET /api/cost-data)

```javascript
const cacheKey = `cost_data:${userId}:${month}:${year}`
const costData = await cached(cacheKey, fetchFunction, 300)  // 300 seconds
```

The formatted API response is cached so repeated page loads within 5 minutes don't hit the database.

### Layer 3: Frontend Cache Busting

Service detail API calls include a timestamp to ensure fresh data:
```typescript
costDataAPI.getServicesForDateRange(providerId, startDate, endDate)
// → GET /api/cost-data/services/{id}?startDate=...&endDate=...&_t=1706789123456
```

### Cache Invalidation

Caches are cleared in these scenarios:
- User triggers a sync → `clearUserCache(userId)` + `clearCostExplanationsCache(userId)`
- User saves new cost data → `clearUserCache(userId)`
- Cost data saved after sync → invalidates the `cost_data_cache` entry

---

## 10. Frontend Data Fetching & Display

### 10.1 API Service Layer

**Source file**: `src/services/api.ts`

The frontend API client is organized into namespaced objects:

```typescript
costDataAPI = {
  getCostData(month?, year?)               // GET /api/cost-data
  getDailyCostData(providerId, start, end) // GET /api/cost-data/{id}/daily
  getServicesForDateRange(id, start, end)  // GET /api/cost-data/services/{id}
  getServiceDetails(id, service, s, e)     // GET /api/cost-data/services/{id}/{service}/details
  getPreferences()                         // GET /api/cost-data/preferences
  updateCurrency(currency)                 // PUT /api/cost-data/preferences/currency
  getCredits(id, start, end, accountId?)   // GET /api/cost-data/{id}/credits
}

syncAPI = {
  syncAll()                                // POST /api/sync
  syncProvider(providerId)                 // POST /api/sync/{id}
}
```

All API calls include:
- `Authorization: Bearer {token}` header
- Cache-busting `_t` timestamps where needed
- URL-encoded service names for special characters

### 10.2 Cost Service Layer

**Source file**: `src/services/costService.ts`

This is the **data orchestration layer** between raw API calls and React components.

#### `getCostData(isDemoMode: boolean): Promise<CostData[]>`

**Real mode flow**:
1. `GET /api/cost-data` → get monthly summaries for all providers
2. For each provider in parallel: `GET /api/cost-data/{id}/daily?start=365daysAgo&end=today`
3. Sort daily data by date
4. Slice into 6 pre-computed views:
   ```typescript
   chartData1Month:   last 30 days
   chartData2Months:  last 60 days
   chartData3Months:  last 90 days
   chartData4Months:  last 120 days
   chartData6Months:  last 180 days
   chartData12Months: last 365 days
   allHistoricalData: all data
   ```
5. If daily data fetch fails for a provider → generate mock data based on `currentMonth` cost

**Demo mode**: Returns hardcoded mock data immediately (500ms simulated delay).

#### `fetchDailyCostDataForRange(providerId, startDate, endDate, isDemoMode)`

Used by ProviderDetailPage when the user selects a custom date range:
- Calls `GET /api/cost-data/{id}/daily?startDate=...&endDate=...`
- Returns sorted daily data points
- Demo mode: generates random data with 15% variance

#### `aggregateToMonthly(dailyData[]): CostDataPoint[]`

Groups daily data into monthly buckets:
```typescript
// Input:  [{date: "2025-01-15", cost: 100}, {date: "2025-01-16", cost: 150}, {date: "2025-02-01", cost: 200}]
// Output: [{date: "2025-01-01", cost: 250}, {date: "2025-02-01", cost: 200}]
```
Used when displaying the "Monthly" view in charts.

#### `getDateRangeForPeriod(period, customStart?, customEnd?)`

Maps period selections to date ranges:
```typescript
'1month'   → 30 days back
'2months'  → 60 days back
'3months'  → 90 days back
'4months'  → 120 days back
'6months'  → 180 days back
'12months' → 365 days back
'custom'   → user-specified dates (validated: 1970 ≤ year ≤ 2100)
```

### 10.3 Dashboard Page

**Source file**: `src/pages/Dashboard.tsx`

On mount, loads four things in parallel:
```typescript
const [costData, savingsPlans, providers, budgets] = await Promise.all([
  getCostData(isDemoMode),
  getSavingsPlans(isDemoMode),
  cloudProvidersAPI.getCloudProviders(),
  budgetsAPI.getBudgets()
])
```

**Total calculations** (across all providers):
```typescript
const totalCurrent = costData.reduce((sum, d) => sum + convertAmount(d.currentMonth), 0)
const totalLastMonth = costData.reduce((sum, d) => sum + convertAmount(d.lastMonth), 0)
const totalForecast = costData.reduce((sum, d) => sum + convertAmount(d.forecast), 0)
const totalSavings = costData.reduce((sum, d) => sum + Math.abs(convertAmount(d.savings || 0)), 0)
```

**Merging logic**: Dashboard merges cost data with configured providers, so a provider with credentials but no cost data (pre-first-sync) shows an "empty state" card.

### 10.4 Provider Detail Page

**Source file**: `src/pages/ProviderDetailPage.tsx`

1. Loads via `getProviderCostDetails(providerId, isDemoMode)` — always fetches 365 days
2. Pre-slices into period views
3. When user changes period selection:
   - `fetchDailyCostDataForRange()` for the new date range
   - `costDataAPI.getServicesForDateRange()` for the service breakdown
4. Service drill-down: `costDataAPI.getServiceDetails()` for sub-service items

### 10.5 Chart Components

**ProviderCostChart** (`src/components/ProviderCostChart.tsx`):
- Takes `data: CostDataPoint[]` (already sliced for the selected period)
- Applies currency conversion: `cost: convertAmount(point.cost)`
- **Area Chart** for daily views (smooth trend line with gradient)
- **Bar Chart** for monthly aggregate views
- Tooltip shows formatted currency amount and date

**TotalBillSummary** (`src/components/TotalBillSummary.tsx`):
- Displays total spend across all providers
- Shows change % (red for increase, green for decrease)
- Forecast with confidence label:
  - ≥70%: "High confidence" (green)
  - 40-70%: "Medium confidence" (amber)
  - <40%: "Low confidence" (red)

---

## 11. Currency Conversion

### Architecture

```
exchangerate-api.com          Frontend                    Backend
(free tier, no API key)
         │
         │ GET /v4/latest/USD
         ▼
┌─────────────────┐    ┌──────────────────────┐    ┌─────────────────┐
│ Exchange Rates   │───►│ CurrencyContext.tsx    │    │ user_preferences│
│ {EUR: 0.92, ...} │    │                      │◄───│ currency: 'INR' │
│                  │    │ convertAmount(100)    │    │                 │
│ Refreshed hourly │    │ → 100 × 83.0 = ₹8300 │    │ GET /preferences│
│                  │    │                      │    │ PUT /currency   │
│ Fallback rates   │    │ formatCurrency(8300)  │    │                 │
│ if API fails     │    │ → "₹8,300.00"        │    │                 │
└─────────────────┘    └──────────────────────┘    └─────────────────┘
```

### Supported Currencies

| Currency | Symbol | Fallback Rate (from USD) |
|----------|--------|--------------------------|
| USD | $ | 1.00 |
| EUR | € | 0.92 |
| GBP | £ | 0.79 |
| INR | ₹ | 83.0 |
| JPY | ¥ | 149.0 |
| CNY | ¥ | 7.2 |
| AUD | A$ | 1.52 |
| CAD | C$ | 1.36 |
| CHF | CHF | 0.88 |
| SGD | S$ | 1.34 |

### How Conversion Works

**Source file**: `src/contexts/CurrencyContext.tsx`

```typescript
const convertAmount = (amount: number, fromCurrency: Currency = 'USD'): number => {
  if (!exchangeRates || fromCurrency === selectedCurrency) return amount

  // Step 1: Convert to USD (if not already)
  const usdAmount = fromCurrency === 'USD' ? amount : amount / exchangeRates[fromCurrency]

  // Step 2: Convert USD to target currency
  return selectedCurrency === 'USD' ? usdAmount : usdAmount * exchangeRates[selectedCurrency]
}
```

**All costs are stored in USD** in the database. Currency conversion happens entirely on the frontend at display time.

**Exchange rate source**: `https://api.exchangerate-api.com/v4/latest/USD` (free tier, no API key needed)
**Refresh**: Every 60 minutes via `setInterval`
**Fallback**: Hardcoded approximate rates if API fails

**Persistence**: User's selected currency is saved to the backend:
- On load: `GET /api/cost-data/preferences` → set `selectedCurrency`
- On change: `PUT /api/cost-data/preferences/currency` → saved to `user_preferences.currency`

---

## 12. Demo Mode (No Credentials Required)

Demo mode allows users to explore Costra's features without connecting real cloud accounts.

### How It's Activated

```typescript
// In AuthContext
const isDemoMode = !localStorage.getItem('authToken') || localStorage.getItem('demoMode') === 'true'
```

### What Happens in Demo Mode

| Component | Behavior |
|-----------|----------|
| **getCostData()** | Returns hardcoded mock data for 3 providers (AWS, Azure, GCP) |
| **getSavingsPlans()** | Returns 4 mock savings plans |
| **cloudProvidersAPI** | Skipped entirely |
| **budgetsAPI** | Skipped entirely |
| **Sync button** | Disabled with warning message |
| **Daily data** | Generated with random variance (15%) around base cost |
| **Currency conversion** | Works normally (exchange rates still fetched) |
| **Charts** | Render with generated mock data |
| **Provider Detail** | Works with mock data, all period views functional |

### Mock Data Values

```typescript
AWS:   currentMonth: $12,450.75  lastMonth: $11,800.50  forecast: $13,500.00
Azure: currentMonth: $8,950.25   lastMonth: $9,200.00   forecast: $9,800.00
GCP:   currentMonth: $6,750.50   lastMonth: $7,100.00   forecast: $7,200.00
```

Each provider comes with 5 mock services and 365 days of generated daily data.

### Mock Daily Data Generation

```typescript
const generateHistoricalData = (baseCost, days, variance = 0.1) => {
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(); date.setDate(date.getDate() - i)
    const randomFactor = 1 + (Math.random() - 0.5) * variance * 2
    const cost = baseCost * randomFactor
    data.push({ date: date.toISOString().split('T')[0], cost: Math.max(0, cost) })
  }
}
```

This generates realistic-looking daily cost data centered around the base cost with random fluctuation.

### Graceful Degradation

Even in real mode, if API calls fail, the system falls back to mock data:
```typescript
try {
  const dailyResponse = await costDataAPI.getDailyCostData(...)
  // Use real data
} catch (dailyError) {
  // Fallback: generate mock data using currentMonth as base
  const allHistoricalData = generateHistoricalData(data.currentMonth || 100, 365, 0.15)
}
```

---

## 13. Scheduled Syncing

**Source file**: `server/services/syncScheduler.js`

### Cron Schedule

```javascript
cron.schedule('0 2 * * *', async () => {  // Daily at 2:00 AM UTC
  await runScheduledSyncs()
})
```

### Eligibility

Not all users get scheduled syncing:
- **Required**: Account with `auto_sync_enabled = true`
- **Required**: Provider account must be `is_active = true`
- **Required**: Subscription plan must be 'starter' or 'pro' (`canAccessFeature(userId, 'scheduled_sync')`)
- **Optional**: `auto_sync_time` can specify a preferred hour (UTC)

### Flow

```javascript
runScheduledSyncs():
  1. Query all users with auto_sync_enabled accounts
  2. Filter by subscription tier (starter/pro only)
  3. For each eligible user:
     a. Check if current hour matches auto_sync_time
     b. Call triggerUserSync(userId) — same as manual sync
  4. Log results
```

---

## 14. Tax & Fee Filtering

Taxes and fees are filtered at **three levels** to ensure they don't appear as services:

### Level 1: Provider API Query (Pre-fetch)

**AWS** (most robust):
```javascript
Filter: {
  Not: {
    Dimensions: {
      Key: 'RECORD_TYPE',
      Values: ['Tax', 'Support', 'Refund', 'Credit']
    }
  }
}
```

**Azure**: Uses `ActualCost` type which excludes amortized costs. No explicit tax filter at query level.

**Other providers**: No query-level filtering (their APIs don't support it).

### Level 2: Transformation (Post-fetch)

```javascript
const isTaxOrFee = (serviceName) => {
  const name = serviceName.toLowerCase()
  return (
    name === 'tax' ||
    name === 'vat' ||
    name.startsWith('tax -') ||
    name.includes(' tax') ||
    name === 'sales tax' ||
    name === 'gst' ||
    name === 'hst' ||
    name === 'pst' ||
    name === 'withholding tax'
  )
}

const filterOutTaxServices = (services) =>
  services.filter(service => !isTaxOrFee(service.name))
```

Applied after every provider's data transformation.

### Level 3: API Response (Delivery to Frontend)

```javascript
// In GET /api/cost-data response formatting
services: cost.services
  .filter(service => {
    const name = (service.service_name || '').toLowerCase()
    return name !== 'tax' && !name.includes('tax -') && name !== 'vat'
  })
```

This ensures taxes never appear in the frontend, even if they somehow passed through earlier layers.

---

## 15. Error Handling

### Provider-Specific Error Mapping

Each provider maps API errors to user-friendly messages:

**AWS**:
| Error | Message |
|-------|---------|
| `UnauthorizedOperation` / `AccessDenied` | "AWS credentials lack Cost Explorer permissions" |
| `InvalidParameterException` | "Invalid date range" |
| Timeout | "AWS API request timed out" |
| HTTP 429 | "AWS API rate limit exceeded" |

**Azure**:
| Error | Message |
|-------|---------|
| 401 / Unauthorized | "Azure credentials invalid or expired" |
| 403 / Forbidden | "Azure credentials lack Cost Management permissions" |
| 404 | "Azure subscription not found" |

**GCP**:
| Error | Message |
|-------|---------|
| 401 | "Service account credentials invalid" |
| 403 | "Service account lacks Cloud Billing permissions" |
| 404 | "Billing account not found" |

### Retry Strategy

All provider API calls use `retryWithBackoff()`:
```javascript
retryWithBackoff(fetchFunction, {
  maxAttempts: 3,
  timeout: 30000  // 30 seconds
}, providerName, metadata)
```

### Sync Error Handling

If one account fails during sync, the error is recorded but sync continues for other accounts:
```javascript
// Per-account error handling
try {
  costData = await fetchProviderCostData(...)
} catch (error) {
  errors.push({ accountId, providerId, error: error.message })
  await createNotification(userId, { type: 'warning', title: 'Sync Failed: ...' })
  continue  // Move to next account
}

// Response includes both successes and failures
res.json({ results, errors: errors.length > 0 ? errors : undefined })
```

### Frontend Fallback Chain

```
Real API data
  ↓ (fails)
Generated mock data from currentMonth base cost
  ↓ (getCostData entirely fails)
Hardcoded demo data (getMockCostData)
```

---

## 16. Anomaly Detection

**Functions**: `calculateAnomalyBaseline()` in `database.js` — Line 2612

### How It Works

After each sync, anomaly baselines are calculated asynchronously:

```javascript
calculateBaselinesForServices(userId, providerId, accountId, costData)
  .catch(err => logger.error(...))  // Non-blocking: doesn't fail the sync
```

For each service in the cost data and for the last 7 days:
1. Calculate a rolling baseline (average cost for that service over recent days)
2. Store in `anomaly_baselines` table
3. Compare current cost against baseline
4. If variance exceeds 50% → create a notification alerting the user

### Database Table

```sql
CREATE TABLE anomaly_baselines (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  provider_id TEXT NOT NULL,
  account_id INTEGER,
  service_name TEXT NOT NULL,
  baseline_date DATE NOT NULL,
  baseline_cost DECIMAL(15, 2),
  actual_cost DECIMAL(15, 2),
  variance_percent DECIMAL(10, 2),
  created_at TIMESTAMP DEFAULT NOW()
)
```

---

## Summary: How Values Are Fetched Without Credits

The term "credits" in Costra refers to cloud provider credits/discounts (like AWS promotional credits), NOT to Costra subscription credits.

**How cost data works without entering cloud credentials (demo mode)**:
1. No API calls are made to any cloud provider
2. The frontend's `costService.ts` returns pre-defined mock data
3. Three mock providers (AWS, Azure, GCP) with realistic costs
4. 365 days of randomly generated daily data (15% variance around base cost)
5. All charts, calculations, and currency conversions work on this mock data
6. The sync button is disabled in demo mode

**How cost data works with real credentials but no credits balance**:
- "Credits" is just a field in the database (`cost_data.credits`)
- It gets populated from the provider API if the account has active credits
- If no credits exist, the field is simply $0.00
- Cost data fetching works identically regardless of credits — credits are informational only

The cost data fetching system is entirely independent of any credit or billing system. It works by:
1. Authenticating with the cloud provider's API using stored credentials
2. Querying their billing/cost management API endpoints
3. Receiving the raw cost data that the provider reports
4. Transforming, calculating, and storing it in Costra's database

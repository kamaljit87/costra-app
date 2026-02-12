# GCP Billing Setup for Costra

## Important: BigQuery Required for Cost Data

**Without BigQuery billing export, Costra will show $0 for GCP costs.**

GCP's Cloud Billing API does not provide detailed cost breakdown. The only way to get programmatic access to cost data is via:

1. **BigQuery Billing Export** (recommended for Costra)
2. Budget API (for alerts only, not actual costs)

## Setup Steps

1. **Enable Billing Export to BigQuery**
   - Go to [Google Cloud Console → Billing → Billing export](https://console.cloud.google.com/billing/export)
   - Create a BigQuery dataset for billing data
   - Enable "Detailed usage cost" export

2. **Add credentials in Costra**
   - Include `bigQueryDataset` in your GCP credentials (e.g. `my-project.billing_export`)
   - Include `billingAccountId` for the billing account

3. **Service account permissions**
   - Grant `BigQuery Data Viewer` role for the billing dataset
   - Grant `Billing Account Costs Viewer` and `Billing Account Viewer`

## Credential Format

```json
{
  "projectId": "my-gcp-project",
  "billingAccountId": "012345-6789AB-CDEF01",
  "bigQueryDataset": "my-project.billing_export",
  "serviceAccountKey": { ... }
}
```

Without `bigQueryDataset`, the sync will succeed but return $0 for all cost fields.

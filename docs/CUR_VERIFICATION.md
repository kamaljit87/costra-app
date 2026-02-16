# Verifying CUR (Cost and Usage Reports) Integration

This doc describes how to check whether AWS CUR integration was successful for an account.

## Success criteria

- **Setup succeeded** if the CUR export and S3 bucket exist in the customer’s AWS account and Costra has a config row.
- **Integration is “active”** when Costra has ingested at least one billing period from the CUR (status moves from `provisioning` to `active`).

## 1. In the UI (Settings → Cloud Providers)

For each **automated AWS** connection:

- **CUR Active** (blue badge): CUR is working; data has been ingested. Hover for last ingestion date and number of periods.
- **CUR Pending** (yellow): Export was created; AWS is backfilling. Data usually appears within 24h; the background job (every 6h) will pick it up.
- **CUR Error** (red): Hover to see the error message (e.g. access denied, bucket missing). Fix permissions or re-run “Set up CUR” after fixing.

If you don’t see a CUR badge for an automated AWS account, CUR may not be set up yet; use “Set up CUR” if available.

## 2. Via API

**GET** `/api/cloud-providers/aws/:accountId/cur-status` (authenticated)

Response:

- `curEnabled: false` → No CUR config; integration not set up or was disabled.
- `curEnabled: true`:
  - `curStatus: 'active'` → Integration successful; data has been ingested.
  - `curStatus: 'provisioning'` → Export created; waiting for AWS to deliver data (or next poll).
  - `curStatus: 'error'` → Check `statusMessage` for the failure reason.
- `lastIngestion`: When we last successfully ingested CUR data.
- `billingPeriods`: List of ingested periods (and optional total cost / completed_at).

Example (replace `ACCOUNT_ID` with the DB `cloud_provider_credentials.id` and use a valid Bearer token):

```bash
curl -s -H "Authorization: Bearer YOUR_JWT" \
  "https://your-api/api/cloud-providers/aws/ACCOUNT_ID/cur-status" | jq
```

## 3. In the database

- **Config exists and status**
  - `cur_export_config` has a row for `(user_id, account_id)`.
  - `cur_status` = `'active'` (ingestion succeeded) or `'provisioning'` (waiting for data) or `'error'` (see `status_message`).
- **Ingestion proof**
  - `cur_ingestion_log` has rows with `ingestion_status = 'completed'` for that config’s `cur_config_id`.
  - `cur_export_config.last_successful_ingestion` is set when we’ve ingested at least one period.

```sql
-- CUR config and status for an account (replace USER_ID and ACCOUNT_ID)
SELECT cec.cur_status, cec.status_message, cec.last_successful_ingestion, cec.s3_bucket
FROM cur_export_config cec
WHERE cec.user_id = USER_ID AND cec.account_id = ACCOUNT_ID;

-- Ingested billing periods
SELECT cil.billing_period, cil.total_cost, cil.completed_at
FROM cur_ingestion_log cil
JOIN cur_export_config cec ON cec.id = cil.cur_config_id
WHERE cec.user_id = USER_ID AND cec.account_id = ACCOUNT_ID
  AND cil.ingestion_status = 'completed'
ORDER BY cil.billing_period DESC;
```

## 4. Common causes of “not successful”

- **Billing data exports not successful / "Insufficient permission" (unhealthy export)**: The S3 bucket policy must allow the Data Exports service (`bcm-data-exports.amazonaws.com`) to deliver reports. AWS requires both **`aws:SourceAccount`** and **`aws:SourceArn`** condition keys; see [Setting up an S3 bucket for data exports](https://docs.aws.amazon.com/cur/latest/userguide/dataexports-s3-bucket.html). Re-run "Set up CUR" so the app applies the correct policy. The IAM role must include `cur:PutReportDefinition` and `bcm-data-exports:CreateExport`; see [IAM for Data Exports](https://docs.aws.amazon.com/cur/latest/userguide/bcm-data-exports-access.html).
- **Stays `provisioning`**: AWS BCM hasn’t delivered data yet (can take up to 24h); or S3 prefix/format doesn’t match what we expect. Check that the CUR 2.0 export in the customer account is enabled and writing to the expected bucket/prefix.
- **`error`**: Often S3 access (bucket policy or role permissions). Check `status_message`; ensure Costra’s role can read the CUR bucket and that `COSTRA_AWS_ACCOUNT_ID` is set if we read from our side.
- **No CUR badge / `curEnabled: false`**: CUR was never set up or was disabled after an access error. Use “Set up CUR” from Settings (or POST `/api/cloud-providers/aws/:accountId/cur-setup`) for automated (IAM role) connections.

## 5. Background polling

CUR data is polled every 6 hours (see `server/services/syncScheduler.js` → `initCURPolling`). New data is ingested and `cur_status` is updated from `provisioning` to `active` (or to `error` on failure). No user action is required once the export exists and permissions are correct.

## 6. S3 path structure (CUR 2.0)

Data Exports delivers to: `s3://bucket/prefix/export-name/data/BILLING_PERIOD=YYYY-MM/` (see [Understanding export delivery](https://docs.aws.amazon.com/cur/latest/userguide/dataexports-export-delivery.html)). Costra uses prefix `costra-cur` and export name `costra-export-<connectionName>`. The first delivery can take up to **24 hours** after the export is created; if the bucket is empty, confirm the export is **Healthy** in AWS Console (Billing → Data Exports) and that the bucket policy includes both `aws:SourceAccount` and `aws:SourceArn` for `bcm-data-exports.amazonaws.com`.

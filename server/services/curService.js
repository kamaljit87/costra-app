/**
 * CUR (Cost and Usage Reports) Service
 * Handles CUR 2.0 Data Export setup, S3 Parquet ingestion, and data storage.
 * Uses the hybrid approach: CUR for finalized months, Cost Explorer for current month.
 */

import {
  S3Client,
  ListObjectsV2Command, GetObjectCommand, HeadObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand, PutBucketPolicyCommand, PutBucketTaggingCommand, GetBucketTaggingCommand,
  PutBucketEncryptionCommand, PutBucketLifecycleConfigurationCommand,
  PutPublicAccessBlockCommand,
} from '@aws-sdk/client-s3'
import { BCMDataExportsClient, CreateExportCommand, ListExportsCommand, DeleteExportCommand, GetExportCommand } from '@aws-sdk/client-bcm-data-exports'
import { getAssumedRoleCredentials } from './awsAuth.js'
import { pool } from '../database.js'
import { clearUserCache, clearCostExplanationsCache, createNotification, saveServiceUsageMetrics } from '../database.js'
import logger from '../utils/logger.js'

const MAX_PARQUET_FILE_SIZE = 200 * 1024 * 1024 // 200MB
const CUR_S3_PREFIX = 'costra-cur'

// ─── Database helpers ────────────────────────────────────────────────

const getCurConfig = async (userId, accountId) => {
  const result = await pool.query(
    'SELECT * FROM cur_export_config WHERE user_id = $1 AND account_id = $2',
    [userId, accountId]
  )
  return result.rows[0] || null
}

const upsertCurConfig = async (userId, accountId, exportName, exportArn, s3Bucket, status, statusMessage = null, s3Prefix = 'costra-cur') => {
  await pool.query(
    `INSERT INTO cur_export_config (user_id, account_id, export_name, export_arn, s3_bucket, s3_prefix, cur_status, status_message, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
     ON CONFLICT (user_id, account_id)
     DO UPDATE SET export_name = $3, export_arn = COALESCE($4, cur_export_config.export_arn),
       s3_bucket = $5, s3_prefix = $6, cur_status = $7, status_message = $8, updated_at = CURRENT_TIMESTAMP`,
    [userId, accountId, exportName, exportArn, s3Bucket, s3Prefix, status, statusMessage]
  )
}

const getAccountData = async (userId, accountId) => {
  const result = await pool.query(
    `SELECT id, provider_id, role_arn, external_id, aws_account_id, account_alias, connection_type
     FROM cloud_provider_credentials
     WHERE id = $1 AND user_id = $2 AND is_active = true`,
    [accountId, userId]
  )
  return result.rows[0] || null
}

const createIngestionLog = async (curConfigId, billingPeriod, manifestKey, filesCount) => {
  const result = await pool.query(
    `INSERT INTO cur_ingestion_log (cur_config_id, billing_period, manifest_key, data_files_count, ingestion_status, started_at)
     VALUES ($1, $2, $3, $4, 'processing', CURRENT_TIMESTAMP)
     ON CONFLICT (cur_config_id, billing_period, manifest_key)
     DO UPDATE SET ingestion_status = 'processing', data_files_count = $4, started_at = CURRENT_TIMESTAMP, error_message = NULL
     RETURNING id`,
    [curConfigId, billingPeriod, manifestKey, filesCount]
  )
  return result.rows[0].id
}

const completeIngestionLog = async (logId, rowsIngested, totalCost) => {
  await pool.query(
    `UPDATE cur_ingestion_log SET ingestion_status = 'completed', rows_ingested = $2, total_cost = $3, completed_at = CURRENT_TIMESTAMP WHERE id = $1`,
    [logId, rowsIngested, totalCost]
  )
}

const failIngestionLog = async (logId, errorMessage) => {
  await pool.query(
    `UPDATE cur_ingestion_log SET ingestion_status = 'error', error_message = $2, completed_at = CURRENT_TIMESTAMP WHERE id = $1`,
    [logId, errorMessage?.substring(0, 1000)]
  )
}

const checkIfPeriodIngested = async (curConfigId, billingPeriod) => {
  const result = await pool.query(
    `SELECT id FROM cur_ingestion_log WHERE cur_config_id = $1 AND billing_period = $2 AND ingestion_status = 'completed'`,
    [curConfigId, billingPeriod]
  )
  return result.rows.length > 0
}

// ─── CUR Export Registration (from CloudFormation) ──────────────────

/**
 * Register a CUR export that was already created by CloudFormation.
 * Just records the export details in our database — no AWS API calls needed.
 */
export const registerCURExport = async (userId, accountId, exportName, exportArn, s3Bucket) => {
  await upsertCurConfig(userId, accountId, exportName, exportArn, s3Bucket, 'provisioning', null, CUR_S3_PREFIX)
  await pool.query(
    `UPDATE cloud_provider_credentials SET cur_enabled = true, cur_bucket_name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND user_id = $3`,
    [s3Bucket, accountId, userId]
  )
  return { exportArn, s3Bucket, status: 'provisioning' }
}

// ─── CUR Export Setup (API fallback) ─────────────────────────────────

/**
 * Create a CUR 2.0 Data Export in the customer's AWS account via API.
 * Used as fallback for stacks that don't include the BCM export resource.
 */
export const setupCURExport = async (userId, accountId, roleArn, externalId, awsAccountId, connectionName) => {
  const creds = await getAssumedRoleCredentials(roleArn, externalId, `costra-cur-setup-${accountId}-${Date.now()}`)

  const s3Bucket = `costra-cur-${awsAccountId}-${connectionName}`
  const exportName = `costra-export-${connectionName}`
  const costraAccountId = process.env.COSTRA_AWS_ACCOUNT_ID

  const credentialConfig = {
    accessKeyId: creds.accessKeyId,
    secretAccessKey: creds.secretAccessKey,
    sessionToken: creds.sessionToken,
  }

  const s3Client = new S3Client({ region: 'us-east-1', credentials: credentialConfig })

  // 1. Ensure S3 bucket exists (create if not, reuse if already there)
  let bucketCreated = false
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: s3Bucket }))
    logger.info('CUR bucket already exists, reusing', { s3Bucket })
  } catch (headErr) {
    if (headErr.name === 'NotFound' || headErr.$metadata?.httpStatusCode === 404 || headErr.name === 'NoSuchBucket') {
      logger.info('CUR bucket does not exist, creating', { s3Bucket })
      await s3Client.send(new CreateBucketCommand({ Bucket: s3Bucket }))
      bucketCreated = true
    } else {
      throw headErr
    }
  }

  // 2. Apply bucket settings (idempotent — safe to run on existing bucket)
  // Block public access
  await s3Client.send(new PutPublicAccessBlockCommand({
    Bucket: s3Bucket,
    PublicAccessBlockConfiguration: {
      BlockPublicAcls: true,
      BlockPublicPolicy: true,
      IgnorePublicAcls: true,
      RestrictPublicBuckets: true,
    },
  }))

  // Enable AES256 encryption
  await s3Client.send(new PutBucketEncryptionCommand({
    Bucket: s3Bucket,
    ServerSideEncryptionConfiguration: {
      Rules: [{ ApplyServerSideEncryptionByDefault: { SSEAlgorithm: 'AES256' } }],
    },
  }))

  // Lifecycle rule: expire old reports after 400 days
  await s3Client.send(new PutBucketLifecycleConfigurationCommand({
    Bucket: s3Bucket,
    LifecycleConfiguration: {
      Rules: [{
        ID: 'ExpireOldReports',
        Status: 'Enabled',
        Expiration: { Days: 400 },
        Filter: { Prefix: '' },
      }],
    },
  }))

  // Tags — merge with existing tags so we don't remove CloudFormation system tags
  const desiredTags = [
    { Key: 'ManagedBy', Value: 'Costra' },
    { Key: 'Purpose', Value: 'CostAndUsageReports' },
  ]
  try {
    let existingTags = []
    try {
      const tagResp = await s3Client.send(new GetBucketTaggingCommand({ Bucket: s3Bucket }))
      existingTags = tagResp.TagSet || []
    } catch (tagErr) {
      // NoSuchTagSet means no tags exist yet — that's fine
      if (tagErr.name !== 'NoSuchTagSet') throw tagErr
    }
    // Merge: keep existing tags, override only the ones we manage
    const desiredKeys = new Set(desiredTags.map(t => t.Key))
    const mergedTags = existingTags.filter(t => !desiredKeys.has(t.Key)).concat(desiredTags)
    await s3Client.send(new PutBucketTaggingCommand({
      Bucket: s3Bucket,
      Tagging: { TagSet: mergedTags },
    }))
  } catch (tagErr) {
    // Tagging is non-critical — log and continue
    logger.warn('Could not update bucket tags, continuing', { s3Bucket, error: tagErr.message })
  }

  // 3. Set bucket policy: allow BCM Data Exports to write + Costra cross-account read
  // Per https://docs.aws.amazon.com/cur/latest/userguide/dataexports-s3-bucket.html both
  // aws:SourceAccount and aws:SourceArn are required for Data Exports to deliver successfully.
  const bucketPolicy = {
    Version: '2012-10-17',
    Statement: [
      {
        Sid: 'AllowBCMDataExportsWrite',
        Effect: 'Allow',
        Principal: { Service: 'bcm-data-exports.amazonaws.com' },
        Action: ['s3:PutObject', 's3:GetBucketPolicy'],
        Resource: [`arn:aws:s3:::${s3Bucket}`, `arn:aws:s3:::${s3Bucket}/*`],
        Condition: {
          StringEquals: { 'aws:SourceAccount': awsAccountId },
          ArnLike: { 'aws:SourceArn': `arn:aws:bcm-data-exports:us-east-1:${awsAccountId}:export/*` },
        },
      },
      ...(costraAccountId ? [{
        Sid: 'AllowCostraCrossAccountRead',
        Effect: 'Allow',
        Principal: { AWS: `arn:aws:iam::${costraAccountId}:root` },
        Action: ['s3:GetObject', 's3:ListBucket', 's3:GetBucketLocation'],
        Resource: [`arn:aws:s3:::${s3Bucket}`, `arn:aws:s3:::${s3Bucket}/*`],
      }] : []),
    ],
  }
  await s3Client.send(new PutBucketPolicyCommand({
    Bucket: s3Bucket,
    Policy: JSON.stringify(bucketPolicy),
  }))

  logger.info('CUR bucket configured', { s3Bucket, bucketCreated })

  // 4. Check if BCM export already exists (idempotent)
  const bcmClient = new BCMDataExportsClient({ region: 'us-east-1', credentials: credentialConfig })

  let existingArn = null
  try {
    const listResp = await bcmClient.send(new ListExportsCommand({}))
    const existing = (listResp.Exports || []).find(e => e.ExportName === exportName)
    if (existing) {
      existingArn = existing.ExportArn
      logger.info('CUR export already exists', { userId, accountId, exportName, exportArn: existingArn })
    }
  } catch (listErr) {
    logger.warn('Could not list existing exports, proceeding with create', { error: listErr.message })
  }

  if (existingArn) {
    // Check export health — an existing export may be UNHEALTHY (e.g. bucket policy removed)
    let exportStatus = 'active'
    try {
      const resp = await bcmClient.send(new GetExportCommand({ ExportArn: existingArn }))
      const statusCode = resp.ExportStatus?.StatusCode
      const statusReason = resp.ExportStatus?.StatusReason
      if (statusCode === 'UNHEALTHY') {
        exportStatus = 'provisioning'
        logger.warn('CUR export exists but is UNHEALTHY — bucket policy re-applied, waiting for next delivery', {
          userId, accountId, exportName, statusReason,
        })
      } else {
        logger.info('CUR export health check', { userId, accountId, exportName, statusCode, statusReason })
      }
    } catch (healthErr) {
      logger.warn('Could not check export health', { error: healthErr.message })
    }
    await upsertCurConfig(userId, accountId, exportName, existingArn, s3Bucket, exportStatus, null, CUR_S3_PREFIX)
    await pool.query(
      `UPDATE cloud_provider_credentials SET cur_enabled = true, cur_bucket_name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND user_id = $3`,
      [s3Bucket, accountId, userId]
    )
    return { exportArn: existingArn, s3Bucket, status: exportStatus }
  }

  // 5. Create the Data Export
  // Use only columns confirmed valid in CUR 2.0 (verified against AWS docs)
  const CUR_COLUMNS = [
    'identity_line_item_id',
    'identity_time_interval',
    'line_item_line_item_type',
    'line_item_product_code',
    'line_item_usage_start_date',
    'line_item_usage_type',
    'line_item_usage_amount',
    'line_item_unblended_cost',
    'line_item_currency_code',
    'line_item_operation',
    'line_item_tax_type',
    'pricing_term',
    'pricing_unit',
  ]
  const CUR_QUERY = `SELECT ${CUR_COLUMNS.join(', ')} FROM COST_AND_USAGE_REPORT`

  logger.info('Creating CUR export', { userId, accountId, exportName, query: CUR_QUERY })

  let createResp
  try {
    createResp = await bcmClient.send(new CreateExportCommand({
      Export: {
        Name: exportName,
        DataQuery: {
          QueryStatement: CUR_QUERY,
          TableConfigurations: {
            COST_AND_USAGE_REPORT: {
              TIME_GRANULARITY: 'DAILY',
              INCLUDE_RESOURCES: 'FALSE',
              INCLUDE_MANUAL_DISCOUNT_COMPATIBILITY: 'FALSE',
              INCLUDE_SPLIT_COST_ALLOCATION_DATA: 'FALSE',
            },
          },
        },
        DestinationConfigurations: {
          S3Destination: {
            S3Bucket: s3Bucket,
            S3Prefix: CUR_S3_PREFIX,
            S3Region: 'us-east-1',
            S3OutputConfigurations: {
              OutputType: 'CUSTOM',
              Format: 'PARQUET',
              Compression: 'PARQUET',
              Overwrite: 'OVERWRITE_REPORT',
            },
          },
        },
        RefreshCadence: {
          Frequency: 'SYNCHRONOUS',
        },
      },
    }))
  } catch (createErr) {
    logger.error('CreateExport FAILED', {
      userId, accountId, exportName,
      errorName: createErr.name,
      errorMessage: createErr.message,
      query: CUR_QUERY,
    })
    throw createErr
  }

  const exportArn = createResp.ExportArn
  logger.info('CUR export created', { userId, accountId, exportName, exportArn })

  await upsertCurConfig(userId, accountId, exportName, exportArn, s3Bucket, 'provisioning', null, CUR_S3_PREFIX)
  await pool.query(
    `UPDATE cloud_provider_credentials SET cur_enabled = true, cur_bucket_name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND user_id = $3`,
    [s3Bucket, accountId, userId]
  )

  return { exportArn, s3Bucket, status: 'provisioning' }
}

/**
 * Re-apply the S3 bucket policy for an existing CUR export so Data Exports can deliver again.
 * Use when export is UNHEALTHY with INSUFFICIENT_PERMISSION (e.g. policy was edited or removed).
 */
export const applyCURBucketPolicy = async (userId, accountId) => {
  const config = await getCurConfig(userId, accountId)
  if (!config) throw new Error('CUR not configured for this account')

  const account = await getAccountData(userId, accountId)
  if (!account?.role_arn || !account.external_id || !account.aws_account_id) {
    throw new Error('Account credentials missing')
  }

  const creds = await getAssumedRoleCredentials(account.role_arn, account.external_id, `costra-cur-fix-policy-${accountId}-${Date.now()}`)
  const s3Bucket = config.s3_bucket
  const awsAccountId = account.aws_account_id
  const costraAccountId = process.env.COSTRA_AWS_ACCOUNT_ID

  const s3Client = new S3Client({
    region: 'us-east-1',
    credentials: {
      accessKeyId: creds.accessKeyId,
      secretAccessKey: creds.secretAccessKey,
      sessionToken: creds.sessionToken,
    },
  })

  const bucketPolicy = {
    Version: '2012-10-17',
    Statement: [
      {
        Sid: 'AllowBCMDataExportsWrite',
        Effect: 'Allow',
        Principal: { Service: 'bcm-data-exports.amazonaws.com' },
        Action: ['s3:PutObject', 's3:GetBucketPolicy'],
        Resource: [`arn:aws:s3:::${s3Bucket}`, `arn:aws:s3:::${s3Bucket}/*`],
        Condition: {
          StringEquals: { 'aws:SourceAccount': awsAccountId },
          ArnLike: { 'aws:SourceArn': `arn:aws:bcm-data-exports:us-east-1:${awsAccountId}:export/*` },
        },
      },
      ...(costraAccountId ? [{
        Sid: 'AllowCostraCrossAccountRead',
        Effect: 'Allow',
        Principal: { AWS: `arn:aws:iam::${costraAccountId}:root` },
        Action: ['s3:GetObject', 's3:ListBucket', 's3:GetBucketLocation'],
        Resource: [`arn:aws:s3:::${s3Bucket}`, `arn:aws:s3:::${s3Bucket}/*`],
      }] : []),
    ],
  }

  await s3Client.send(new PutBucketPolicyCommand({
    Bucket: s3Bucket,
    Policy: JSON.stringify(bucketPolicy),
  }))

  logger.info('CUR bucket policy re-applied', { userId, accountId, s3Bucket })
  return { success: true, message: 'Bucket policy updated. Data Exports should be able to deliver on the next refresh.' }
}

// ─── AWS Export Health (GetExport) ───────────────────────────────────

const EXPORT_STATUS_MESSAGES = {
  INSUFFICIENT_PERMISSION: 'Data Exports cannot write to your S3 bucket. Re-apply the bucket policy (e.g. use "Fix CUR" in settings) so the export can deliver.',
  BILL_OWNER_CHANGED: 'Your AWS account moved organizations or billing groups. Create a new CUR export and remove the old one.',
  INTERNAL_FAILURE: 'AWS Data Exports reported an internal error. Check the AWS Service Health Dashboard or try again later.',
}

/**
 * Fetch export health from AWS GetExport. Returns { statusCode, statusReason, statusMessage } or null.
 */
async function getExportStatusFromAWS(userId, accountId) {
  const config = await getCurConfig(userId, accountId)
  if (!config?.export_arn) return null

  const account = await getAccountData(userId, accountId)
  if (!account?.role_arn || !account.external_id) return null

  try {
    const creds = await getAssumedRoleCredentials(account.role_arn, account.external_id, `costra-cur-status-${accountId}-${Date.now()}`)
    const bcmClient = new BCMDataExportsClient({
      region: 'us-east-1',
      credentials: {
        accessKeyId: creds.accessKeyId,
        secretAccessKey: creds.secretAccessKey,
        sessionToken: creds.sessionToken,
      },
    })
    const resp = await bcmClient.send(new GetExportCommand({ ExportArn: config.export_arn }))
    const st = resp.ExportStatus
    if (!st) return null
    const statusReason = st.StatusReason || null
    const statusMessage = statusReason ? (EXPORT_STATUS_MESSAGES[statusReason] || `Export status: ${statusReason}`) : null
    return {
      statusCode: st.StatusCode,
      statusReason,
      statusMessage,
      lastRefreshedAt: st.LastRefreshedAt,
    }
  } catch (err) {
    logger.warn('GetExport failed (non-fatal)', { userId, accountId, error: err.message })
    return null
  }
}

// ─── CUR Data Availability Check ────────────────────────────────────

/**
 * Check if CUR Parquet files exist in the customer's S3 bucket.
 */
export const checkCURDataAvailability = async (userId, accountId) => {
  const config = await getCurConfig(userId, accountId)
  if (!config) return { available: false, billingPeriods: [] }

  const account = await getAccountData(userId, accountId)
  if (!account || !account.role_arn || !account.external_id) {
    return { available: false, billingPeriods: [] }
  }

  const creds = await getAssumedRoleCredentials(account.role_arn, account.external_id, `costra-cur-check-${accountId}-${Date.now()}`)
  const s3Client = new S3Client({
    region: 'us-east-1',
    credentials: {
      accessKeyId: creds.accessKeyId,
      secretAccessKey: creds.secretAccessKey,
      sessionToken: creds.sessionToken,
    },
  })

  // CUR 2.0 delivery path per AWS docs: {prefix}/{export-name}/data/BILLING_PERIOD=YYYY-MM/...parquet
  const s3Prefix = config.s3_prefix || CUR_S3_PREFIX
  const dataPrefix = `${s3Prefix}/${config.export_name}/data/`

  logger.debug('CUR availability check: listing S3 objects', {
    userId, accountId, bucket: config.s3_bucket, prefix: dataPrefix,
  })

  const resp = await s3Client.send(new ListObjectsV2Command({
    Bucket: config.s3_bucket,
    Prefix: dataPrefix,
    MaxKeys: 1000,
  }))

  const allKeys = (resp.Contents || []).map(obj => obj.Key)
  const parquetFiles = allKeys.filter(key => key.endsWith('.parquet'))

  if (allKeys.length === 0) {
    logger.info('CUR availability: no objects found under prefix', {
      userId, accountId, bucket: config.s3_bucket, prefix: dataPrefix,
    })
  } else if (parquetFiles.length === 0) {
    logger.info('CUR availability: objects found but no .parquet files', {
      userId, accountId, objectCount: allKeys.length, sampleKey: allKeys[0],
    })
  }

  const billingPeriods = [...new Set(parquetFiles.map(key => {
    const match = key.match(/\/data\/BILLING_PERIOD=(\d{4}-\d{2})\//)
    return match ? match[1] : null
  }).filter(Boolean))].sort()

  return { available: billingPeriods.length > 0, billingPeriods }
}

// ─── CUR Data Ingestion ─────────────────────────────────────────────

/**
 * Ingest CUR data for a specific billing period.
 * Downloads Parquet from S3, parses, aggregates, and saves to DB.
 */
export const ingestCURData = async (userId, accountId, billingPeriod) => {
  const config = await getCurConfig(userId, accountId)
  if (!config) throw new Error('CUR not configured for this account')

  const account = await getAccountData(userId, accountId)
  if (!account || !account.role_arn || !account.external_id) {
    throw new Error('Account credentials missing for CUR ingestion')
  }

  const creds = await getAssumedRoleCredentials(account.role_arn, account.external_id, `costra-cur-ingest-${accountId}-${Date.now()}`)
  const s3Client = new S3Client({
    region: 'us-east-1',
    credentials: {
      accessKeyId: creds.accessKeyId,
      secretAccessKey: creds.secretAccessKey,
      sessionToken: creds.sessionToken,
    },
  })

  // List Parquet files for this billing period (CUR 2.0 uses partition BILLING_PERIOD=YYYY-MM)
  const s3Prefix = config.s3_prefix || CUR_S3_PREFIX
  const prefix = `${s3Prefix}/${config.export_name}/data/BILLING_PERIOD=${billingPeriod}/`
  const listResp = await s3Client.send(new ListObjectsV2Command({
    Bucket: config.s3_bucket,
    Prefix: prefix,
  }))

  const parquetKeys = (listResp.Contents || [])
    .filter(obj => obj.Key.endsWith('.parquet'))
    .map(obj => obj.Key)

  if (parquetKeys.length === 0) {
    logger.debug('No Parquet files found for billing period', { userId, accountId, billingPeriod, prefix })
    return { totalCost: 0, dailyData: [], services: [], noData: true }
  }

  const manifestKey = parquetKeys[0]
  const logId = await createIngestionLog(config.id, billingPeriod, manifestKey, parquetKeys.length)

  try {
    // Aggregation accumulators
    const dailyTotals = new Map()
    const serviceTotals = new Map()
    const resourceAccumulator = new Map() // keyed by resource_id for resource-level data
    // service_usage_metrics: key = "service|date|usageType" -> { cost, usageQuantity, usageUnit }
    const serviceDailyUsage = new Map()
    let totalCost = 0
    let totalTax = 0
    let rowCount = 0

    // Lazy-load hyparquet
    const { parquetRead } = await import('hyparquet')

    for (const key of parquetKeys) {
      // Check file size before downloading
      try {
        const headResp = await s3Client.send(new HeadObjectCommand({
          Bucket: config.s3_bucket,
          Key: key,
        }))
        if (headResp.ContentLength > MAX_PARQUET_FILE_SIZE) {
          logger.warn('CUR Parquet file too large, skipping', { key, size: headResp.ContentLength })
          continue
        }
      } catch (headErr) {
        logger.warn('Could not check file size, proceeding anyway', { key, error: headErr.message })
      }

      const getResp = await s3Client.send(new GetObjectCommand({
        Bucket: config.s3_bucket,
        Key: key,
      }))

      // Read stream into buffer
      const chunks = []
      for await (const chunk of getResp.Body) {
        chunks.push(chunk)
      }
      const buffer = Buffer.concat(chunks)
      const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)

      await parquetRead({
        file: { arrayBuffer },
        onComplete: (rows) => {
          for (const row of rows) {
            rowCount++

            const lineItemType = row.line_item_line_item_type || ''
            const cost = parseFloat(row.line_item_unblended_cost || 0)
            const date = (row.line_item_usage_start_date || '').substring(0, 10)
            const service = row.product_product_name || row.line_item_product_code || 'Other'

            // Separate tax
            if (lineItemType === 'Tax') {
              totalTax += cost
              continue
            }

            // Only count usage types (matches Cost Explorer RECORD_TYPE filter)
            const usageTypes = ['Usage', 'DiscountedUsage', 'SavingsPlanCoveredUsage']
            if (!usageTypes.includes(lineItemType)) continue

            totalCost += cost

            if (date) {
              dailyTotals.set(date, (dailyTotals.get(date) || 0) + cost)
            }
            if (service) {
              serviceTotals.set(service, (serviceTotals.get(service) || 0) + cost)
            }

            // Accumulate per-service per-day usage for Cost vs Usage analytics
            const usageType = (row.line_item_usage_type || 'Usage').toString().trim() || 'Usage'
            const usageAmount = parseFloat(row.line_item_usage_amount || 0)
            const usageUnit = (row.pricing_unit || '').toString().trim() || null
            if (date && (cost > 0 || usageAmount > 0)) {
              const key = `${service}|${date}|${usageType}`
              const existing = serviceDailyUsage.get(key) || { cost: 0, usageQuantity: 0, usageUnit }
              existing.cost += cost
              existing.usageQuantity += usageAmount
              if (usageUnit) existing.usageUnit = usageUnit
              serviceDailyUsage.set(key, existing)
            }

            // Accumulate resource-level data for optimization engine
            const resourceId = row.line_item_resource_id
            if (resourceId) {
              const usageType = row.line_item_usage_type || ''
              const usageAmount = parseFloat(row.line_item_usage_amount || 0)
              const pricingTerm = row.pricing_term || 'OnDemand'
              const instanceType = row.product_instance_type || ''
              const productRegion = row.product_region || ''

              if (!resourceAccumulator.has(resourceId)) {
                resourceAccumulator.set(resourceId, {
                  resource_id: resourceId,
                  resource_type: instanceType || usageType.split(':').pop() || 'unknown',
                  service_name: service,
                  region: productRegion || null,
                  cost: 0,
                  usage_quantity: 0,
                  usage_unit: usageType,
                  usage_type: pricingTerm,
                  first_seen_date: date,
                  last_seen_date: date,
                })
              }
              const res = resourceAccumulator.get(resourceId)
              res.cost += cost
              res.usage_quantity += usageAmount
              if (date && date < res.first_seen_date) res.first_seen_date = date
              if (date && date > res.last_seen_date) res.last_seen_date = date
            }
          }
        },
      })
    }

    const dailyData = [...dailyTotals.entries()]
      .map(([date, cost]) => ({ date, cost: Math.round(cost * 100) / 100 }))
      .sort((a, b) => a.date.localeCompare(b.date))

    const services = [...serviceTotals.entries()]
      .map(([name, cost]) => ({ name, cost: Math.round(cost * 100) / 100, change: 0 }))
      .sort((a, b) => b.cost - a.cost)

    totalCost = Math.round(totalCost * 100) / 100
    totalTax = Math.round(totalTax * 100) / 100

    // Parse billing period to month/year
    const [yearStr, monthStr] = billingPeriod.split('-')
    const month = parseInt(monthStr, 10)
    const year = parseInt(yearStr, 10)

    // Save to database
    await saveCostDataFromCUR(userId, accountId, account.provider_id, month, year, {
      totalCost,
      dailyData,
      services,
      tax: totalTax,
    })

    // Save service-level cost + usage for Cost vs Usage analytics
    if (serviceDailyUsage.size > 0) {
      const usageMetrics = []
      for (const [key, val] of serviceDailyUsage.entries()) {
        const parts = key.split('|')
        const serviceName = parts[0] || 'Other'
        const date = parts[1] || ''
        const usageType = parts.slice(2).join('|') || 'Usage'
        usageMetrics.push({
          serviceName,
          date,
          cost: Math.round(val.cost * 100) / 100,
          usageQuantity: val.usageQuantity > 0 ? val.usageQuantity : null,
          usageUnit: val.usageUnit || null,
          usageType: usageType || 'Usage',
        })
      }
      try {
        await saveServiceUsageMetrics(userId, accountId, account.provider_id, usageMetrics)
        logger.info('Service usage metrics saved for Cost vs Usage', { userId, accountId, count: usageMetrics.length })
      } catch (metricsErr) {
        logger.warn('Failed to save service usage metrics (non-fatal)', { userId, accountId, error: metricsErr.message })
      }
    }

    // Save resource-level data from CUR for optimization engine
    if (resourceAccumulator.size > 0) {
      try {
        await saveResourcesFromCUR(userId, accountId, account.provider_id, resourceAccumulator)
        logger.info('CUR resources saved', { userId, accountId, resourceCount: resourceAccumulator.size })
      } catch (resErr) {
        logger.warn('Failed to save CUR resources (non-fatal)', { userId, accountId, error: resErr.message })
      }
    }

    await completeIngestionLog(logId, rowCount, totalCost)

    // Update cur_export_config
    await pool.query(
      `UPDATE cur_export_config
       SET cur_status = 'active', last_manifest_key = $1, last_successful_ingestion = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [manifestKey, config.id]
    )

    // Clear caches so next request gets fresh data
    try {
      await clearUserCache(userId)
      await clearCostExplanationsCache(userId)
    } catch (cacheErr) {
      logger.warn('Failed to clear caches after CUR ingestion', { error: cacheErr.message })
    }

    logger.info('CUR data ingested successfully', { userId, accountId, billingPeriod, totalCost, totalTax, rowCount, services: services.length })

    // Trigger optimization analysis with fresh CUR data (async, non-blocking)
    import('./optimizationEngine.js').then(({ runOptimizationForUser }) => {
      runOptimizationForUser(userId)
        .catch(err => logger.error('Optimization analysis failed after CUR ingestion', { userId, error: err.message }))
    }).catch(() => {}) // ignore import errors

    return { totalCost, dailyData, services, tax: totalTax, rowCount }
  } catch (error) {
    await failIngestionLog(logId, error.message)
    throw error
  }
}

// ─── Save CUR Data to Database ──────────────────────────────────────

/**
 * Save CUR-sourced cost data to cost_data, service_costs, and daily_cost_data tables.
 * Skips current month (Cost Explorer is more real-time).
 */
const saveCostDataFromCUR = async (userId, accountId, providerId, month, year, data) => {
  const now = new Date()
  const isCurrentMonth = (month === now.getMonth() + 1 && year === now.getFullYear())
  if (isCurrentMonth) {
    logger.info('CUR data for current month — skipping (Cost Explorer is more current)', { userId, accountId, month, year })
    return
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Check existing record
    const existing = await client.query(
      `SELECT id FROM cost_data
       WHERE user_id = $1 AND provider_id = $2 AND month = $3 AND year = $4
         AND (account_id = $5 OR (account_id IS NULL AND $5 IS NULL))`,
      [userId, providerId, month, year, accountId]
    )

    let costDataId
    if (existing.rows.length > 0) {
      costDataId = existing.rows[0].id
      await client.query(
        `UPDATE cost_data SET
           current_month_cost = $1, tax_current_month = $2,
           data_source = 'cur', updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [data.totalCost, data.tax, costDataId]
      )
    } else {
      const insertResult = await client.query(
        `INSERT INTO cost_data
         (user_id, provider_id, account_id, month, year, current_month_cost, last_month_cost, forecast_cost, credits, savings, tax_current_month, tax_last_month, data_source, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, 0, 0, 0, 0, $7, 0, 'cur', CURRENT_TIMESTAMP)
         RETURNING id`,
        [userId, providerId, accountId, month, year, data.totalCost, data.tax]
      )
      costDataId = insertResult.rows[0].id
    }

    // Replace service costs
    await client.query('DELETE FROM service_costs WHERE cost_data_id = $1', [costDataId])
    for (const service of data.services) {
      await client.query(
        'INSERT INTO service_costs (cost_data_id, service_name, cost, change_percent) VALUES ($1, $2, $3, $4)',
        [costDataId, service.name, service.cost, service.change]
      )
    }

    // Upsert daily cost data with data_source = 'cur'
    const BATCH_SIZE = 200
    for (let i = 0; i < data.dailyData.length; i += BATCH_SIZE) {
      const batch = data.dailyData.slice(i, i + BATCH_SIZE)
      const values = []
      const params = []

      batch.forEach(({ date, cost }, idx) => {
        const offset = idx * 6
        values.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}::date, $${offset + 5}, $${offset + 6}, CURRENT_TIMESTAMP)`)
        params.push(userId, providerId, accountId, date, cost, 'cur')
      })

      await client.query(
        `INSERT INTO daily_cost_data (user_id, provider_id, account_id, date, cost, data_source, updated_at)
         VALUES ${values.join(', ')}
         ON CONFLICT (user_id, provider_id, date)
         DO UPDATE SET cost = EXCLUDED.cost, data_source = 'cur', account_id = EXCLUDED.account_id, updated_at = CURRENT_TIMESTAMP`,
        params
      )
    }

    await client.query('COMMIT')
    logger.info('CUR data saved to database', { userId, accountId, month, year, totalCost: data.totalCost })
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

// ─── Save CUR Resources to Database ─────────────────────────────────

/**
 * Batch-upsert resource-level data from CUR into the resources table.
 */
const saveResourcesFromCUR = async (userId, accountId, providerId, resourceAccumulator) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const resources = [...resourceAccumulator.values()]
    const BATCH_SIZE = 100

    for (let i = 0; i < resources.length; i += BATCH_SIZE) {
      const batch = resources.slice(i, i + BATCH_SIZE)
      const values = []
      const params = []

      batch.forEach((res, idx) => {
        const offset = idx * 14
        values.push(`($${offset+1},$${offset+2},$${offset+3},$${offset+4},$${offset+5},$${offset+6},$${offset+7},$${offset+8},$${offset+9},$${offset+10},$${offset+11},$${offset+12}::date,$${offset+13}::date,CURRENT_TIMESTAMP)`)
        params.push(
          userId, accountId, providerId, res.resource_id,
          res.resource_id.split('/').pop() || res.resource_id, // resource_name from ARN
          res.resource_type, res.service_name, res.region,
          Math.round(res.cost * 100) / 100, res.usage_quantity, res.usage_unit,
          res.first_seen_date, res.last_seen_date
        )
      })

      // usage_type stores pricing_term from CUR for the optimization engine
      await client.query(
        `INSERT INTO resources (user_id, account_id, provider_id, resource_id, resource_name, resource_type, service_name, region, cost, usage_quantity, usage_unit, first_seen_date, last_seen_date, updated_at)
         VALUES ${values.join(', ')}
         ON CONFLICT (user_id, provider_id, resource_id, last_seen_date)
         DO UPDATE SET
           cost = EXCLUDED.cost,
           usage_quantity = EXCLUDED.usage_quantity,
           usage_unit = EXCLUDED.usage_unit,
           resource_type = EXCLUDED.resource_type,
           resource_name = EXCLUDED.resource_name,
           updated_at = CURRENT_TIMESTAMP`,
        params
      )
    }

    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

// ─── Background Polling ─────────────────────────────────────────────

/**
 * Background job: poll all CUR-enabled accounts for new data.
 * Called by cron every 6 hours.
 */
export const pollCURDataForAllAccounts = async () => {
  logger.info('Starting CUR data polling for all accounts')

  const result = await pool.query(
    `SELECT cec.*, cpc.role_arn, cpc.external_id, cpc.aws_account_id, cpc.user_id, cpc.provider_id,
       cpc.account_alias, cpc.provider_name
     FROM cur_export_config cec
     JOIN cloud_provider_credentials cpc ON cec.account_id = cpc.id
     WHERE cec.cur_status IN ('active', 'provisioning', 'error')
       AND cpc.is_active = true
       AND cpc.cur_enabled = true`
  )

  let processed = 0
  let errors = 0

  for (const config of result.rows) {
    try {
      const availability = await checkCURDataAvailability(config.user_id, config.account_id)

      if (!availability.available) {
        // When bucket is empty, check export health to surface actionable errors
        if (config.cur_status === 'provisioning' || config.cur_status === 'active') {
          try {
            const awsStatus = await getExportStatusFromAWS(config.user_id, config.account_id)
            if (awsStatus?.statusCode === 'UNHEALTHY') {
              logger.warn('CUR export is UNHEALTHY — data will not be delivered until fixed', {
                userId: config.user_id, accountId: config.account_id,
                statusReason: awsStatus.statusReason, statusMessage: awsStatus.statusMessage,
              })
              await pool.query(
                `UPDATE cur_export_config SET cur_status = 'error', status_message = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
                [awsStatus.statusMessage || `Export unhealthy: ${awsStatus.statusReason}`, config.id]
              )
            }
          } catch (healthErr) {
            logger.debug('Export health check failed during poll', { error: healthErr.message })
          }
        }
        logger.debug('No CUR data available yet', { userId: config.user_id, accountId: config.account_id, curStatus: config.cur_status })
        continue
      }

      for (const period of availability.billingPeriods) {
        const alreadyIngested = await checkIfPeriodIngested(config.id, period)
        if (!alreadyIngested) {
          logger.info('Ingesting CUR data for new billing period', {
            userId: config.user_id, accountId: config.account_id, period,
          })
          await ingestCURData(config.user_id, config.account_id, period)
          processed++
        }
      }

      // Transition provisioning/error → active when data arrives; notify user
      if (config.cur_status === 'provisioning' || config.cur_status === 'error') {
        await pool.query(
          `UPDATE cur_export_config SET cur_status = 'active', status_message = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [config.id]
        )
        try {
          const accountLabel = config.account_alias || config.provider_name || 'AWS account'
          const isRecovery = config.cur_status === 'error'
          await createNotification(config.user_id, {
            type: 'success',
            title: isRecovery ? 'CUR recovered' : 'CUR integration successful',
            message: isRecovery
              ? `Cost and Usage Report (CUR 2.0) for ${accountLabel} has recovered and is now active again.`
              : `Cost and Usage Report (CUR 2.0) is now active for ${accountLabel}. Cost data will appear on your Dashboard.`,
            link: '/dashboard',
            linkText: 'View Dashboard',
          })
        } catch (notifErr) {
          logger.error('Failed to create CUR success notification', { error: notifErr.message })
        }
      }
    } catch (error) {
      errors++
      logger.error('Error polling CUR data for account', {
        userId: config.user_id, accountId: config.account_id, error: error.message,
      })

      const statusMessage = error.message?.substring(0, 500) || 'Unknown error'
      const isAccessError = error.name === 'AccessDenied' || error.name === 'NoSuchBucket' ||
        error.message?.includes('AccessDenied') || error.message?.includes('NoSuchBucket')

      await pool.query(
        `UPDATE cur_export_config SET cur_status = 'error', status_message = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [statusMessage, config.id]
      )

      if (isAccessError) {
        // Keep cur_enabled = true so the poller retries on next cycle.
        // The cur_status = 'error' above is sufficient to surface the issue in the UI.
        // If the access issue is resolved (e.g. stack redeployed), the poller will
        // transition back to 'active' automatically when data is found (line ~974).
        try {
          await createNotification(config.user_id, {
            type: 'warning',
            title: 'CUR Access Error',
            message: 'Unable to read CUR data from S3. Please verify your AWS CloudFormation stack is intact and the S3 bucket policy is correct.',
            link: '/settings?tab=providers',
            linkText: 'Check Cloud Providers',
          })
        } catch (notifErr) {
          logger.error('Failed to create CUR error notification', { error: notifErr.message })
        }
      }
    }
  }

  logger.info('CUR polling completed', { totalAccounts: result.rows.length, processed, errors })
}

// ─── Status API helpers ─────────────────────────────────────────────

export const getCURStatus = async (userId, accountId) => {
  const config = await getCurConfig(userId, accountId)
  if (!config) {
    return { curEnabled: false, curStatus: null, lastIngestion: null, billingPeriods: [], bucketEmpty: false }
  }

  // Self-heal: if cur_export_config exists but cur_enabled was set to false (e.g. by a past
  // transient error), re-enable it so the poller picks it up again on the next cycle.
  try {
    await pool.query(
      `UPDATE cloud_provider_credentials SET cur_enabled = true, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND user_id = $2 AND cur_enabled = false`,
      [accountId, userId]
    )
  } catch (healErr) {
    logger.debug('CUR self-heal update failed (non-fatal)', { userId, accountId, error: healErr.message })
  }

  // Get ingested billing periods
  const logResult = await pool.query(
    `SELECT billing_period, total_cost, completed_at FROM cur_ingestion_log
     WHERE cur_config_id = $1 AND ingestion_status = 'completed'
     ORDER BY billing_period DESC`,
    [config.id]
  )

  const billingPeriods = logResult.rows.map(r => ({
    period: r.billing_period,
    totalCost: parseFloat(r.total_cost),
    ingestedAt: r.completed_at,
  }))

  let bucketEmpty = false
  let bucketEmptyMessage = null
  let exportStatusCode = null
  let exportStatusReason = null
  let exportStatusMessage = null

  try {
    const awsStatus = await getExportStatusFromAWS(userId, accountId)
    if (awsStatus) {
      exportStatusCode = awsStatus.statusCode
      exportStatusReason = awsStatus.statusReason
      exportStatusMessage = awsStatus.statusMessage
    }
  } catch (e) {
    logger.debug('Export status fetch failed (non-fatal)', { userId, accountId, error: e.message })
  }

  try {
    const availability = await checkCURDataAvailability(userId, accountId)
    if (!availability.available && billingPeriods.length === 0) {
      bucketEmpty = true
      if (exportStatusCode === 'UNHEALTHY' && exportStatusMessage) {
        bucketEmptyMessage = exportStatusMessage
      } else {
        bucketEmptyMessage = 'S3 bucket is empty. AWS typically delivers the first CUR report within 24–72 hours. Cost Explorer is used in the meantime.'
      }
    }
  } catch (availErr) {
    logger.debug('CUR availability check failed (non-fatal)', { userId, accountId, error: availErr.message })
  }

  return {
    curEnabled: true,
    curStatus: config.cur_status,
    statusMessage: config.status_message,
    lastIngestion: config.last_successful_ingestion,
    s3Bucket: config.s3_bucket,
    billingPeriods,
    bucketEmpty,
    bucketEmptyMessage,
    exportStatusCode,
    exportStatusReason,
    exportStatusMessage,
  }
}

// ─── AWS Resource Cleanup ────────────────────────────────────────────

/**
 * Clean up AWS resources created by Costra for a connection.
 * Deletes: BCM Data Export and CloudFormation stack (which includes the IAM role).
 * Preserves the S3 bucket and its data — it may contain valuable CUR data
 * and will be reused if the customer reconnects.
 *
 * @param {string} roleArn - IAM role ARN to assume
 * @param {string} externalId - External ID for role assumption
 * @param {string} awsAccountId - 12-digit AWS account ID
 * @param {string} connectionName - Sanitized connection name
 * @returns {Promise<{results: object[], errors: object[]}>}
 */
export const cleanupAWSResources = async (roleArn, externalId, awsAccountId, connectionName) => {
  const results = []
  const errors = []

  let creds
  try {
    creds = await getAssumedRoleCredentials(roleArn, externalId, `costra-cleanup-${Date.now()}`)
  } catch (err) {
    logger.error('Cleanup: Failed to assume role', { roleArn, error: err.message })
    return {
      results,
      errors: [{ step: 'assumeRole', error: err.message || String(err) }],
    }
  }

  const credentialConfig = {
    accessKeyId: creds.accessKeyId,
    secretAccessKey: creds.secretAccessKey,
    sessionToken: creds.sessionToken,
  }

  // 1. Delete BCM Data Export
  const exportName = `costra-export-${connectionName}`
  try {
    const bcmClient = new BCMDataExportsClient({ region: 'us-east-1', credentials: credentialConfig })
    const listResp = await bcmClient.send(new ListExportsCommand({}))
    const existing = (listResp.Exports || []).find(e => e.ExportName === exportName)
    if (existing) {
      await bcmClient.send(new DeleteExportCommand({ ExportArn: existing.ExportArn }))
      results.push({ step: 'deleteExport', exportName, status: 'deleted' })
      logger.info('Cleanup: Deleted BCM export', { exportName, exportArn: existing.ExportArn })
    } else {
      results.push({ step: 'deleteExport', exportName, status: 'not_found' })
    }
  } catch (err) {
    logger.error('Cleanup: Failed to delete BCM export', { exportName, error: err.message || String(err) })
    errors.push({ step: 'deleteExport', error: err.message || String(err) })
  }

  // 2. S3 bucket is preserved (may contain valuable CUR data, will be reused on reconnect)
  const bucketName = `costra-cur-${awsAccountId}-${connectionName}`
  results.push({ step: 'preserveBucket', bucketName, status: 'preserved' })
  logger.info('Cleanup: S3 bucket preserved', { bucketName })

  // 3. Delete CloudFormation stack (this also deletes the IAM role)
  try {
    const { CloudFormationClient, DeleteStackCommand } = await import('@aws-sdk/client-cloudformation')
    const cfnClient = new CloudFormationClient({ region: 'us-east-1', credentials: credentialConfig })
    await cfnClient.send(new DeleteStackCommand({ StackName: connectionName }))
    results.push({ step: 'deleteStack', stackName: connectionName, status: 'deleting' })
    logger.info('Cleanup: Initiated CloudFormation stack deletion', { stackName: connectionName })
  } catch (err) {
    logger.error('Cleanup: Failed to delete CloudFormation stack', { stackName: connectionName, error: err.message || String(err) })
    errors.push({ step: 'deleteStack', error: err.message || String(err) })
  }

  return { results, errors }
}

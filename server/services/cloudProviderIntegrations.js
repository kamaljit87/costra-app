/**
 * Cloud Provider API Integration Service
 * Uses official Node.js SDKs to fetch cost data from various cloud providers
 */

import { CostExplorerClient, GetCostAndUsageCommand } from '@aws-sdk/client-cost-explorer'

// Cache for provider clients to avoid recreating them
const clientCache = new Map()

/**
 * AWS Cost Explorer API Integration using official SDK
 */
export const fetchAWSCostData = async (credentials, startDate, endDate) => {
  const { accessKeyId, secretAccessKey, region = 'us-east-1' } = credentials

  console.log(`[AWS Fetch] Starting fetch for date range: ${startDate} to ${endDate}`)
  console.log(`[AWS Fetch] Using region: ${region}`)
  console.log(`[AWS Fetch] Access Key ID (last 4): ...${accessKeyId?.slice(-4) || 'MISSING'}`)

  try {
    // Create or reuse Cost Explorer client
    const cacheKey = `aws-${accessKeyId}-${region}`
    let client = clientCache.get(cacheKey)
    
    if (!client) {
      console.log(`[AWS Fetch] Creating new Cost Explorer client`)
      client = new CostExplorerClient({
        region,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      })
      clientCache.set(cacheKey, client)
    }

    // First, fetch total costs without GroupBy to include support, taxes, etc.
    // This query returns ALL costs including Support plans, taxes, and credits
    const totalCommand = new GetCostAndUsageCommand({
      TimePeriod: {
        Start: startDate,
        End: endDate,
      },
      Granularity: 'DAILY',
      Metrics: ['UnblendedCost', 'BlendedCost', 'AmortizedCost'],
    })

    console.log(`[AWS Fetch] Sending GetCostAndUsage command for totals...`)
    const totalResponse = await client.send(totalCommand)
    
    console.log(`[AWS Fetch] Total response received:`)
    console.log(`  - ResultsByTime count: ${totalResponse.ResultsByTime?.length || 0}`)
    if (totalResponse.ResultsByTime?.length > 0) {
      const firstResult = totalResponse.ResultsByTime[0]
      console.log(`  - Sample Total: ${JSON.stringify(firstResult.Total)}`)
    }

    // Fetch credits used in the period
    const creditsCommand = new GetCostAndUsageCommand({
      TimePeriod: {
        Start: startDate,
        End: endDate,
      },
      Granularity: 'MONTHLY',
      Metrics: ['UnblendedCost'],
      Filter: {
        Dimensions: {
          Key: 'RECORD_TYPE',
          Values: ['Credit'],
        },
      },
    })

    console.log(`[AWS Fetch] Sending GetCostAndUsage command for credits...`)
    let creditsUsed = 0
    try {
      const creditsResponse = await client.send(creditsCommand)
      console.log(`[AWS Fetch] Credits response received:`)
      console.log(`  - ResultsByTime count: ${creditsResponse.ResultsByTime?.length || 0}`)
      
      // Credits are returned as negative values, sum them up
      creditsResponse.ResultsByTime?.forEach((result) => {
        const amount = parseFloat(result.Total?.UnblendedCost?.Amount || 0)
        creditsUsed += Math.abs(amount) // Convert negative to positive
        console.log(`  - Credit amount: ${amount}`)
      })
      console.log(`[AWS Fetch] Total credits used in period: $${creditsUsed.toFixed(2)}`)
    } catch (creditsError) {
      console.warn('[AWS Fetch] Could not fetch credits:', creditsError.message)
    }

    // Then fetch with GroupBy to get service breakdown
    const command = new GetCostAndUsageCommand({
      TimePeriod: {
        Start: startDate,
        End: endDate,
      },
      Granularity: 'DAILY',
      Metrics: ['UnblendedCost', 'BlendedCost'],
      GroupBy: [
        {
          Type: 'DIMENSION',
          Key: 'SERVICE',
        },
      ],
    })

    console.log(`[AWS Fetch] Sending GetCostAndUsage command with GroupBy...`)
    const response = await client.send(command)
    
    console.log(`[AWS Fetch] Grouped response received:`)
    console.log(`  - ResultsByTime count: ${response.ResultsByTime?.length || 0}`)
    
    // Log sample data for debugging
    if (response.ResultsByTime?.length > 0) {
      const firstResult = response.ResultsByTime[0]
      console.log(`  - First result date: ${firstResult.TimePeriod?.Start}`)
      console.log(`  - First result Groups count: ${firstResult.Groups?.length || 0}`)
      if (firstResult.Groups?.length > 0) {
        console.log(`  - Sample group: ${JSON.stringify(firstResult.Groups[0])}`)
      }
    }

    return transformAWSCostData(totalResponse, response, startDate, endDate, creditsUsed)
  } catch (error) {
    console.error('[AWS Fetch] AWS Cost Explorer error:', error)
    console.error('[AWS Fetch] Error code:', error.code)
    console.error('[AWS Fetch] Error name:', error.name)
    throw new Error(`AWS API Error: ${error.message}`)
  }
}

/**
 * Transform AWS Cost Explorer response to our format
 * @param totalData - Response from query without GroupBy (accurate totals including support, taxes)
 * @param groupedData - Response from query with GroupBy by SERVICE (for service breakdown)
 * @param creditsUsed - Total credits used in the period
 */
const transformAWSCostData = (totalData, groupedData, startDate, endDate, creditsUsed = 0) => {
  const totalResultsByTime = totalData.ResultsByTime || []
  const groupedResultsByTime = groupedData.ResultsByTime || []
  
  const dailyData = []
  const serviceMap = new Map()
  let currentMonth = 0
  let lastMonth = 0

  console.log(`[AWS Transform] Processing ${totalResultsByTime.length} total time periods, ${groupedResultsByTime.length} grouped periods`)

  // Log first few totals to debug what AWS is returning
  let totalSum = 0
  totalResultsByTime.slice(0, 10).forEach((result, idx) => {
    const date = result.TimePeriod?.Start
    const unblended = result.Total?.UnblendedCost?.Amount
    const blended = result.Total?.BlendedCost?.Amount
    const amortized = result.Total?.AmortizedCost?.Amount
    console.log(`[AWS Transform] Day ${idx}: ${date} - Unblended: $${unblended}, Blended: $${blended}, Amortized: $${amortized}`)
    totalSum += parseFloat(unblended || 0)
  })
  console.log(`[AWS Transform] First 10 days total (Unblended): $${totalSum.toFixed(2)}`)

  // Create a map of grouped data by date for service breakdown
  const groupedByDate = new Map()
  groupedResultsByTime.forEach((result) => {
    const date = result.TimePeriod?.Start
    if (date) {
      groupedByDate.set(date, result.Groups || [])
    }
  })

  // Process daily data using totals (more accurate, includes support/taxes)
  totalResultsByTime.forEach((result) => {
    const date = result.TimePeriod?.Start
    
    // Use UnblendedCost which most closely matches actual invoice
    const dailyTotal = parseFloat(
      result.Total?.UnblendedCost?.Amount || 
      result.Total?.BlendedCost?.Amount || 
      result.Total?.AmortizedCost?.Amount ||
      0
    )
    
    // Get service breakdown for this date
    const groups = groupedByDate.get(date) || []
    groups.forEach((group) => {
      const serviceName = group.Keys?.[0] || 'Other'
      const cost = parseFloat(group.Metrics?.UnblendedCost?.Amount || group.Metrics?.BlendedCost?.Amount || 0)
      if (cost > 0) {
        const existing = serviceMap.get(serviceName) || 0
        serviceMap.set(serviceName, existing + cost)
      }
    })
    
    // Add daily data point if we have a date
    if (date) {
      dailyData.push({
        date,
        cost: dailyTotal,
      })

      // Calculate monthly totals
      const resultDate = new Date(date)
      const now = new Date()
      if (resultDate.getMonth() === now.getMonth() && resultDate.getFullYear() === now.getFullYear()) {
        currentMonth += dailyTotal
      } else {
        lastMonth += dailyTotal
      }
    }
  })

  console.log(`[AWS Transform] Processed data:`)
  console.log(`  - Daily data points: ${dailyData.length}`)
  console.log(`  - Current month total: $${currentMonth.toFixed(2)}`)
  console.log(`  - Last month total: $${lastMonth.toFixed(2)}`)
  console.log(`  - Services found: ${serviceMap.size}`)

  // Convert service map to array
  const services = Array.from(serviceMap.entries())
    .map(([name, cost]) => ({
      name,
      cost,
      change: 0, // Calculate change from previous period if needed
    }))
    .sort((a, b) => b.cost - a.cost)

  return {
    currentMonth,
    lastMonth,
    forecast: currentMonth * 1.1,
    credits: creditsUsed,
    savings: 0,
    services,
    dailyData,
  }
}

/**
 * Azure Cost Management API Integration using REST API
 * Note: Azure SDK for Cost Management requires more complex setup
 */
export const fetchAzureCostData = async (credentials, startDate, endDate) => {
  const { tenantId, clientId, clientSecret, subscriptionId } = credentials

  console.log(`[Azure Fetch] Starting fetch for date range: ${startDate} to ${endDate}`)
  console.log(`[Azure Fetch] Subscription ID: ${subscriptionId?.slice(0, 8)}...`)

  try {
    // Get OAuth token
    const token = await getAzureAccessToken(tenantId, clientId, clientSecret)
    console.log(`[Azure Fetch] Successfully obtained access token`)

    const baseUrl = `https://management.azure.com/subscriptions/${subscriptionId}/providers/Microsoft.CostManagement/query?api-version=2021-10-01`
    
    // First, fetch total costs (ActualCost) without grouping for accurate totals
    const totalPayload = {
      type: 'ActualCost',
      timeframe: 'Custom',
      timePeriod: {
        from: startDate,
        to: endDate,
      },
      dataset: {
        granularity: 'Daily',
        aggregation: {
          totalCost: {
            name: 'Cost',
            function: 'Sum',
          },
        },
      },
    }

    console.log(`[Azure Fetch] Fetching total costs...`)
    const totalResponse = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(totalPayload),
    })

    if (!totalResponse.ok) {
      const error = await totalResponse.json()
      throw new Error(`Azure API Error: ${error.error?.message || totalResponse.statusText}`)
    }

    const totalResult = await totalResponse.json()
    console.log(`[Azure Fetch] Total cost rows: ${totalResult.properties?.rows?.length || 0}`)

    // Fetch credits (type: Credit or look for negative costs)
    let creditsUsed = 0
    try {
      const creditsPayload = {
        type: 'ActualCost',
        timeframe: 'Custom',
        timePeriod: {
          from: startDate,
          to: endDate,
        },
        dataset: {
          granularity: 'Monthly',
          aggregation: {
            totalCost: {
              name: 'Cost',
              function: 'Sum',
            },
          },
          filter: {
            dimensions: {
              name: 'ChargeType',
              operator: 'In',
              values: ['Credit', 'Refund'],
            },
          },
        },
      }

      const creditsResponse = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(creditsPayload),
      })

      if (creditsResponse.ok) {
        const creditsResult = await creditsResponse.json()
        creditsResult.properties?.rows?.forEach((row) => {
          const amount = parseFloat(row[0] || 0)
          creditsUsed += Math.abs(amount)
        })
        console.log(`[Azure Fetch] Total credits used: $${creditsUsed.toFixed(2)}`)
      }
    } catch (creditsError) {
      console.warn(`[Azure Fetch] Could not fetch credits: ${creditsError.message}`)
    }

    // Fetch with grouping for service breakdown
    const groupedPayload = {
      type: 'ActualCost',
      timeframe: 'Custom',
      timePeriod: {
        from: startDate,
        to: endDate,
      },
      dataset: {
        granularity: 'Daily',
        aggregation: {
          totalCost: {
            name: 'Cost',
            function: 'Sum',
          },
        },
        grouping: [
          {
            type: 'Dimension',
            name: 'ServiceName',
          },
        ],
      },
    }

    console.log(`[Azure Fetch] Fetching service breakdown...`)
    const groupedResponse = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(groupedPayload),
    })

    if (!groupedResponse.ok) {
      const error = await groupedResponse.json()
      throw new Error(`Azure API Error: ${error.error?.message || groupedResponse.statusText}`)
    }

    const groupedResult = await groupedResponse.json()
    console.log(`[Azure Fetch] Grouped rows: ${groupedResult.properties?.rows?.length || 0}`)

    return transformAzureCostData(totalResult, groupedResult, startDate, endDate, creditsUsed)
  } catch (error) {
    console.error('[Azure Fetch] Azure Cost Management error:', error)
    throw new Error(`Azure API Error: ${error.message}`)
  }
}

/**
 * Get Azure OAuth access token
 */
const getAzureAccessToken = async (tenantId, clientId, clientSecret) => {
  const url = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`
  
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://management.azure.com/.default',
    grant_type: 'client_credentials',
  })

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Azure auth failed: ${error.error_description || 'Unknown error'}`)
  }

  const result = await response.json()
  return result.access_token
}

/**
 * Transform Azure Cost Management response to our format
 * @param totalData - Response from query without grouping (accurate totals)
 * @param groupedData - Response from query with ServiceName grouping
 * @param creditsUsed - Total credits used in the period
 */
const transformAzureCostData = (totalData, groupedData, startDate, endDate, creditsUsed = 0) => {
  const totalRows = totalData.properties?.rows || []
  const totalColumns = totalData.properties?.columns || []
  const groupedRows = groupedData.properties?.rows || []
  const groupedColumns = groupedData.properties?.columns || []

  const dailyData = []
  const dailyMap = new Map() // To aggregate by date
  const serviceMap = new Map()
  let currentMonth = 0
  let lastMonth = 0

  // Find column indices for total data
  const totalCostIndex = totalColumns.findIndex((col) => col.name === 'Cost' || col.name === 'PreTaxCost')
  const totalDateIndex = totalColumns.findIndex((col) => col.name === 'UsageDate' || col.type === 'datetime')

  // Process total data for accurate daily costs
  const now = new Date()

  totalRows.forEach((row) => {
    const cost = parseFloat(row[totalCostIndex] || row[0] || 0)
    const date = row[totalDateIndex] || row[1]

    if (date) {
      const dateStr = typeof date === 'number' 
        ? new Date(date).toISOString().split('T')[0]
        : (date instanceof Date ? date.toISOString().split('T')[0] : String(date).split('T')[0])
      
      const existing = dailyMap.get(dateStr) || 0
      dailyMap.set(dateStr, existing + cost)

      // Determine if current or last month
      const rowDate = new Date(dateStr)
      if (rowDate.getMonth() === now.getMonth() && rowDate.getFullYear() === now.getFullYear()) {
        currentMonth += cost
      } else {
        lastMonth += cost
      }
    }
  })

  // Convert daily map to array
  dailyMap.forEach((cost, date) => {
    dailyData.push({ date, cost })
  })
  dailyData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  // Process grouped data for service breakdown
  const groupedCostIndex = groupedColumns.findIndex((col) => col.name === 'Cost' || col.name === 'PreTaxCost')
  const serviceIndex = groupedColumns.findIndex((col) => col.name === 'ServiceName')

  groupedRows.forEach((row) => {
    const cost = parseFloat(row[groupedCostIndex] || row[0] || 0)
    const serviceName = row[serviceIndex] || row[1] || 'Other'

    if (cost > 0) {
      const existing = serviceMap.get(serviceName) || 0
      serviceMap.set(serviceName, existing + cost)
    }
  })

  // Convert service map to array
  const services = Array.from(serviceMap.entries())
    .map(([name, cost]) => ({
      name,
      cost,
      change: 0,
    }))
    .sort((a, b) => b.cost - a.cost)

  console.log(`[Azure Transform] Processed data:`)
  console.log(`  - Daily data points: ${dailyData.length}`)
  console.log(`  - Current month total: $${currentMonth.toFixed(2)}`)
  console.log(`  - Last month total: $${lastMonth.toFixed(2)}`)
  console.log(`  - Services found: ${services.length}`)
  console.log(`  - Credits: $${creditsUsed.toFixed(2)}`)

  return {
    currentMonth,
    lastMonth,
    forecast: currentMonth * 1.1,
    credits: creditsUsed,
    savings: 0,
    services,
    dailyData,
  }
}

/**
 * Google Cloud Platform Billing API Integration
 * Uses BigQuery export for detailed billing data
 * Note: Requires billing export to BigQuery to be set up in GCP Console
 */
export const fetchGCPCostData = async (credentials, startDate, endDate) => {
  const { projectId, serviceAccountKey, billingAccountId, bigQueryDataset } = credentials

  console.log(`[GCP Fetch] Starting fetch for date range: ${startDate} to ${endDate}`)
  console.log(`[GCP Fetch] Project ID: ${projectId}`)

  try {
    if (!serviceAccountKey) {
      throw new Error('GCP requires service account key JSON')
    }

    // Parse service account key
    const keyData = typeof serviceAccountKey === 'string' 
      ? JSON.parse(serviceAccountKey) 
      : serviceAccountKey

    // Get access token using service account
    const token = await getGCPAccessToken(keyData)
    console.log(`[GCP Fetch] Successfully obtained access token`)

    // If BigQuery dataset is configured, query billing data from there
    if (bigQueryDataset) {
      return await fetchGCPBigQueryBilling(token, projectId, bigQueryDataset, startDate, endDate)
    }

    // Otherwise, use Cloud Billing API for basic billing info
    const billingUrl = `https://cloudbilling.googleapis.com/v1/billingAccounts/${billingAccountId || '-'}`
    
    console.log(`[GCP Fetch] Fetching billing account info...`)
    const response = await fetch(billingUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const error = await response.json()
      console.warn(`[GCP Fetch] Billing API error: ${error.error?.message}`)
      // Return empty data if billing API not accessible
      return {
        currentMonth: 0,
        lastMonth: 0,
        forecast: 0,
        credits: 0,
        savings: 0,
        services: [],
        dailyData: [],
      }
    }

    const billingData = await response.json()
    console.log(`[GCP Fetch] Billing account: ${billingData.displayName || billingData.name}`)

    // GCP Cloud Billing API doesn't provide detailed cost breakdown without BigQuery export
    // Return structure with note about BigQuery requirement
    console.log(`[GCP Fetch] Note: For detailed cost data, set up BigQuery billing export`)
    
    return {
      currentMonth: 0,
      lastMonth: 0,
      forecast: 0,
      credits: 0,
      savings: 0,
      services: [],
      dailyData: [],
    }
  } catch (error) {
    console.error('[GCP Fetch] GCP Billing error:', error)
    throw new Error(`GCP API Error: ${error.message}`)
  }
}

/**
 * Get GCP access token using service account
 */
const getGCPAccessToken = async (keyData) => {
  const now = Math.floor(Date.now() / 1000)
  const expiry = now + 3600

  // Create JWT header and claims
  const header = {
    alg: 'RS256',
    typ: 'JWT',
  }

  const claims = {
    iss: keyData.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-billing.readonly https://www.googleapis.com/auth/bigquery.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: expiry,
  }

  // For simplicity, we'll use a direct token request approach
  // In production, use proper JWT signing with the private key
  const tokenUrl = 'https://oauth2.googleapis.com/token'
  
  // Create assertion (simplified - in production use proper JWT library)
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: createGCPJWT(header, claims, keyData.private_key),
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`GCP auth failed: ${error.error_description || error.error || 'Unknown error'}`)
  }

  const result = await response.json()
  return result.access_token
}

/**
 * Create JWT for GCP authentication (simplified)
 */
const createGCPJWT = (header, claims, privateKey) => {
  // Note: This is a placeholder. In production, use a proper JWT library like jsonwebtoken
  // For now, throw an error indicating the need for proper implementation
  throw new Error('GCP JWT signing requires jsonwebtoken library. Install with: npm install jsonwebtoken')
}

/**
 * Fetch GCP billing data from BigQuery export
 */
const fetchGCPBigQueryBilling = async (token, projectId, dataset, startDate, endDate) => {
  console.log(`[GCP Fetch] Fetching from BigQuery dataset: ${dataset}`)
  
  const query = `
    SELECT
      DATE(usage_start_time) as date,
      service.description as service_name,
      SUM(cost) as cost,
      SUM(IFNULL((SELECT SUM(c.amount) FROM UNNEST(credits) c), 0)) as credits
    FROM \`${projectId}.${dataset}.gcp_billing_export_v1_*\`
    WHERE DATE(usage_start_time) >= '${startDate}'
      AND DATE(usage_start_time) <= '${endDate}'
    GROUP BY date, service_name
    ORDER BY date, cost DESC
  `

  const bigQueryUrl = `https://bigquery.googleapis.com/bigquery/v2/projects/${projectId}/queries`
  
  const response = await fetch(bigQueryUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      useLegacySql: false,
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`BigQuery error: ${error.error?.message || 'Query failed'}`)
  }

  const result = await response.json()
  return transformGCPBigQueryData(result, startDate, endDate)
}

/**
 * Transform GCP BigQuery billing data to our format
 */
const transformGCPBigQueryData = (bqData, startDate, endDate) => {
  const rows = bqData.rows || []
  const dailyMap = new Map()
  const serviceMap = new Map()
  let currentMonth = 0
  let lastMonth = 0
  let totalCredits = 0

  const now = new Date()

  rows.forEach((row) => {
    const date = row.f[0]?.v
    const serviceName = row.f[1]?.v || 'Other'
    const cost = parseFloat(row.f[2]?.v || 0)
    const credits = parseFloat(row.f[3]?.v || 0)

    if (date) {
      // Aggregate daily costs
      const existing = dailyMap.get(date) || 0
      dailyMap.set(date, existing + cost)

      // Aggregate by service
      const serviceExisting = serviceMap.get(serviceName) || 0
      serviceMap.set(serviceName, serviceExisting + cost)

      // Monthly totals
      const rowDate = new Date(date)
      if (rowDate.getMonth() === now.getMonth() && rowDate.getFullYear() === now.getFullYear()) {
        currentMonth += cost
      } else {
        lastMonth += cost
      }

      totalCredits += Math.abs(credits)
    }
  })

  const dailyData = Array.from(dailyMap.entries())
    .map(([date, cost]) => ({ date, cost }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  const services = Array.from(serviceMap.entries())
    .map(([name, cost]) => ({ name, cost, change: 0 }))
    .sort((a, b) => b.cost - a.cost)

  console.log(`[GCP Transform] Processed data:`)
  console.log(`  - Daily data points: ${dailyData.length}`)
  console.log(`  - Current month: $${currentMonth.toFixed(2)}`)
  console.log(`  - Last month: $${lastMonth.toFixed(2)}`)
  console.log(`  - Credits: $${totalCredits.toFixed(2)}`)

  return {
    currentMonth,
    lastMonth,
    forecast: currentMonth * 1.1,
    credits: totalCredits,
    savings: 0,
    services,
    dailyData,
  }
}

/**
 * DigitalOcean API Integration
 */
export const fetchDigitalOceanCostData = async (credentials, startDate, endDate) => {
  const { apiToken } = credentials

  console.log(`[DO Fetch] Starting fetch for date range: ${startDate} to ${endDate}`)

  try {
    // Fetch invoices
    console.log(`[DO Fetch] Fetching invoices...`)
    const invoicesResponse = await fetch('https://api.digitalocean.com/v2/customers/my/invoices', {
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
    })

    if (!invoicesResponse.ok) {
      throw new Error(`DigitalOcean API error: ${invoicesResponse.statusText}`)
    }

    const invoicesData = await invoicesResponse.json()
    console.log(`[DO Fetch] Found ${invoicesData.invoices?.length || 0} invoices`)

    // Fetch balance (includes credits)
    let credits = 0
    try {
      console.log(`[DO Fetch] Fetching balance...`)
      const balanceResponse = await fetch('https://api.digitalocean.com/v2/customers/my/balance', {
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
      })

      if (balanceResponse.ok) {
        const balanceData = await balanceResponse.json()
        // DigitalOcean balance includes account_balance (credits) and month_to_date_usage
        credits = Math.abs(parseFloat(balanceData.account_balance || 0))
        console.log(`[DO Fetch] Account balance (credits): $${credits.toFixed(2)}`)
        console.log(`[DO Fetch] Month-to-date usage: $${balanceData.month_to_date_usage || 0}`)
      }
    } catch (balanceError) {
      console.warn(`[DO Fetch] Could not fetch balance: ${balanceError.message}`)
    }

    // Fetch billing history for more detailed breakdown
    let billingHistory = []
    try {
      console.log(`[DO Fetch] Fetching billing history...`)
      const historyResponse = await fetch('https://api.digitalocean.com/v2/customers/my/billing_history', {
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
      })

      if (historyResponse.ok) {
        const historyData = await historyResponse.json()
        billingHistory = historyData.billing_history || []
        console.log(`[DO Fetch] Found ${billingHistory.length} billing history entries`)
      }
    } catch (historyError) {
      console.warn(`[DO Fetch] Could not fetch billing history: ${historyError.message}`)
    }

    return transformDigitalOceanCostData(invoicesData, billingHistory, credits, startDate, endDate)
  } catch (error) {
    console.error('[DO Fetch] DigitalOcean API error:', error)
    throw new Error(`DigitalOcean API Error: ${error.message}`)
  }
}

/**
 * Transform DigitalOcean response to our format
 */
const transformDigitalOceanCostData = (invoicesData, billingHistory, creditsBalance, startDate, endDate) => {
  const invoices = invoicesData.invoices || []
  const dailyData = []
  const serviceMap = new Map()
  let currentMonth = 0
  let lastMonth = 0
  let creditsUsed = 0

  const now = new Date()
  const start = new Date(startDate)
  const end = new Date(endDate)

  // Process invoices
  invoices.forEach((invoice) => {
    const invoiceDate = new Date(invoice.invoice_period || invoice.invoice_date)
    if (invoiceDate >= start && invoiceDate <= end) {
      const cost = parseFloat(invoice.amount || 0)
      
      dailyData.push({
        date: invoiceDate.toISOString().split('T')[0],
        cost,
      })

      if (invoiceDate.getMonth() === now.getMonth() && invoiceDate.getFullYear() === now.getFullYear()) {
        currentMonth += cost
      } else {
        lastMonth += cost
      }

      // Track invoice items for service breakdown
      if (invoice.invoice_items) {
        invoice.invoice_items.forEach((item) => {
          const serviceName = item.description || 'DigitalOcean Services'
          const itemCost = parseFloat(item.amount || 0)
          const existing = serviceMap.get(serviceName) || 0
          serviceMap.set(serviceName, existing + itemCost)
        })
      }
    }
  })

  // Process billing history for credits used
  billingHistory.forEach((entry) => {
    if (entry.type === 'Credit' || entry.type === 'credit') {
      creditsUsed += Math.abs(parseFloat(entry.amount || 0))
    }
  })

  // If no service breakdown, create a default one
  if (serviceMap.size === 0 && (currentMonth > 0 || lastMonth > 0)) {
    serviceMap.set('DigitalOcean Services', currentMonth + lastMonth)
  }

  const services = Array.from(serviceMap.entries())
    .map(([name, cost]) => ({ name, cost, change: 0 }))
    .sort((a, b) => b.cost - a.cost)

  console.log(`[DO Transform] Processed data:`)
  console.log(`  - Daily data points: ${dailyData.length}`)
  console.log(`  - Current month: $${currentMonth.toFixed(2)}`)
  console.log(`  - Last month: $${lastMonth.toFixed(2)}`)
  console.log(`  - Credits used: $${creditsUsed.toFixed(2)}`)
  console.log(`  - Credits balance: $${creditsBalance.toFixed(2)}`)

  return {
    currentMonth,
    lastMonth,
    forecast: currentMonth * 1.1,
    credits: creditsUsed > 0 ? creditsUsed : creditsBalance,
    savings: 0,
    services,
    dailyData,
  }
}

/**
 * IBM Cloud Cost Management API Integration
 * Uses IBM Cloud Usage Reports API
 */
export const fetchIBMCloudCostData = async (credentials, startDate, endDate) => {
  const { apiKey, accountId } = credentials

  console.log(`[IBM Fetch] Starting fetch for date range: ${startDate} to ${endDate}`)

  try {
    if (!apiKey) {
      throw new Error('IBM Cloud requires an API key')
    }

    // Get IAM access token
    console.log(`[IBM Fetch] Getting IAM access token...`)
    const tokenResponse = await fetch('https://iam.cloud.ibm.com/identity/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'urn:ibm:params:oauth:grant-type:apikey',
        apikey: apiKey,
      }),
    })

    if (!tokenResponse.ok) {
      const error = await tokenResponse.json()
      throw new Error(`IBM IAM auth failed: ${error.errorMessage || tokenResponse.statusText}`)
    }

    const tokenData = await tokenResponse.json()
    const accessToken = tokenData.access_token
    console.log(`[IBM Fetch] Successfully obtained access token`)

    // Get account summary for the billing month
    const startMonth = startDate.substring(0, 7) // YYYY-MM format
    const endMonth = endDate.substring(0, 7)
    
    // Fetch account summary
    console.log(`[IBM Fetch] Fetching account summary for ${startMonth}...`)
    const summaryUrl = `https://billing.cloud.ibm.com/v4/accounts/${accountId}/summary/${startMonth}`
    
    const summaryResponse = await fetch(summaryUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    let accountSummary = null
    if (summaryResponse.ok) {
      accountSummary = await summaryResponse.json()
      console.log(`[IBM Fetch] Account summary retrieved`)
    } else {
      console.warn(`[IBM Fetch] Could not fetch account summary: ${summaryResponse.statusText}`)
    }

    // Fetch usage reports
    console.log(`[IBM Fetch] Fetching usage reports...`)
    const usageUrl = `https://billing.cloud.ibm.com/v4/accounts/${accountId}/usage/${startMonth}`
    
    const usageResponse = await fetch(usageUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    let usageData = null
    if (usageResponse.ok) {
      usageData = await usageResponse.json()
      console.log(`[IBM Fetch] Usage data retrieved`)
    } else {
      console.warn(`[IBM Fetch] Could not fetch usage data: ${usageResponse.statusText}`)
    }

    return transformIBMCloudCostData(accountSummary, usageData, startDate, endDate)
  } catch (error) {
    console.error('[IBM Fetch] IBM Cloud error:', error)
    throw new Error(`IBM Cloud API Error: ${error.message}`)
  }
}

/**
 * Transform IBM Cloud response to our format
 */
const transformIBMCloudCostData = (accountSummary, usageData, startDate, endDate) => {
  const dailyData = []
  const serviceMap = new Map()
  let currentMonth = 0
  let lastMonth = 0
  let credits = 0

  const now = new Date()

  // Process account summary
  if (accountSummary) {
    // Extract billing totals
    currentMonth = parseFloat(accountSummary.billable_cost || 0)
    credits = parseFloat(accountSummary.credits?.total || 0)

    // Add as a single monthly data point
    const summaryDate = new Date(accountSummary.month || startDate)
    dailyData.push({
      date: summaryDate.toISOString().split('T')[0],
      cost: currentMonth,
    })

    // Process resources for service breakdown
    if (accountSummary.resources) {
      accountSummary.resources.forEach((resource) => {
        const serviceName = resource.resource_name || 'IBM Cloud Services'
        const cost = parseFloat(resource.billable_cost || 0)
        if (cost > 0) {
          const existing = serviceMap.get(serviceName) || 0
          serviceMap.set(serviceName, existing + cost)
        }
      })
    }
  }

  // Process usage data for more detailed breakdown
  if (usageData && usageData.resources) {
    usageData.resources.forEach((resource) => {
      const serviceName = resource.resource_name || resource.resource_id || 'IBM Cloud Services'
      const cost = parseFloat(resource.billable_cost || 0)
      if (cost > 0 && !serviceMap.has(serviceName)) {
        serviceMap.set(serviceName, cost)
      }
    })
  }

  // If no service breakdown, create a default one
  if (serviceMap.size === 0 && currentMonth > 0) {
    serviceMap.set('IBM Cloud Services', currentMonth)
  }

  const services = Array.from(serviceMap.entries())
    .map(([name, cost]) => ({ name, cost, change: 0 }))
    .sort((a, b) => b.cost - a.cost)

  console.log(`[IBM Transform] Processed data:`)
  console.log(`  - Current month: $${currentMonth.toFixed(2)}`)
  console.log(`  - Credits: $${credits.toFixed(2)}`)
  console.log(`  - Services: ${services.length}`)

  return {
    currentMonth,
    lastMonth,
    forecast: currentMonth * 1.1,
    credits,
    savings: 0,
    services,
    dailyData,
  }
}

/**
 * Linode (Akamai) Cloud Cost API Integration
 * Uses Linode API v4 for billing and account data
 */
export const fetchLinodeCostData = async (credentials, startDate, endDate) => {
  const { apiToken } = credentials

  console.log(`[Linode Fetch] Starting fetch for date range: ${startDate} to ${endDate}`)

  try {
    if (!apiToken) {
      throw new Error('Linode requires a Personal Access Token')
    }

    const headers = {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    }

    // Fetch account info
    console.log(`[Linode Fetch] Fetching account info...`)
    const accountResponse = await fetch('https://api.linode.com/v4/account', { headers })
    
    if (!accountResponse.ok) {
      throw new Error(`Linode API error: ${accountResponse.statusText}`)
    }
    
    const accountData = await accountResponse.json()
    console.log(`[Linode Fetch] Account: ${accountData.email}`)
    console.log(`[Linode Fetch] Balance: $${accountData.balance || 0}`)

    // Fetch invoices for historical data
    console.log(`[Linode Fetch] Fetching invoices...`)
    const invoicesResponse = await fetch('https://api.linode.com/v4/account/invoices?page_size=100', { headers })
    
    let invoices = []
    if (invoicesResponse.ok) {
      const invoicesData = await invoicesResponse.json()
      invoices = invoicesData.data || []
      console.log(`[Linode Fetch] Found ${invoices.length} invoices`)
    }

    // Fetch current month's invoice items (unbilled usage)
    console.log(`[Linode Fetch] Fetching current invoice items...`)
    let currentInvoiceItems = []
    try {
      const invoiceItemsResponse = await fetch('https://api.linode.com/v4/account/invoices/current/items?page_size=500', { headers })
      if (invoiceItemsResponse.ok) {
        const itemsData = await invoiceItemsResponse.json()
        currentInvoiceItems = itemsData.data || []
        console.log(`[Linode Fetch] Found ${currentInvoiceItems.length} current invoice items`)
      }
    } catch (itemsError) {
      console.warn(`[Linode Fetch] Could not fetch current invoice items: ${itemsError.message}`)
    }

    // Fetch payments for credits info
    console.log(`[Linode Fetch] Fetching payments...`)
    let payments = []
    let credits = 0
    try {
      const paymentsResponse = await fetch('https://api.linode.com/v4/account/payments?page_size=100', { headers })
      if (paymentsResponse.ok) {
        const paymentsData = await paymentsResponse.json()
        payments = paymentsData.data || []
        console.log(`[Linode Fetch] Found ${payments.length} payments`)
      }
    } catch (paymentsError) {
      console.warn(`[Linode Fetch] Could not fetch payments: ${paymentsError.message}`)
    }

    // Check for promotional credits in account
    if (accountData.active_promotions) {
      accountData.active_promotions.forEach((promo) => {
        credits += parseFloat(promo.credit_remaining || 0)
      })
      console.log(`[Linode Fetch] Promotional credits: $${credits.toFixed(2)}`)
    }

    // Account balance can be negative (credits)
    if (accountData.balance < 0) {
      credits += Math.abs(accountData.balance)
    }

    return transformLinodeCostData(accountData, invoices, currentInvoiceItems, credits, startDate, endDate)
  } catch (error) {
    console.error('[Linode Fetch] Linode API error:', error)
    throw new Error(`Linode API Error: ${error.message}`)
  }
}

/**
 * Transform Linode response to our format
 */
const transformLinodeCostData = (accountData, invoices, currentInvoiceItems, creditsBalance, startDate, endDate) => {
  const dailyData = []
  const serviceMap = new Map()
  let currentMonth = 0
  let lastMonth = 0

  const now = new Date()
  const start = new Date(startDate)
  const end = new Date(endDate)

  // Process current invoice items for this month's breakdown
  currentInvoiceItems.forEach((item) => {
    const serviceName = item.label || item.type || 'Linode Services'
    const cost = parseFloat(item.total || item.amount || 0)
    
    if (cost > 0) {
      const existing = serviceMap.get(serviceName) || 0
      serviceMap.set(serviceName, existing + cost)
      currentMonth += cost
    }
  })

  // Process historical invoices
  invoices.forEach((invoice) => {
    const invoiceDate = new Date(invoice.date)
    
    if (invoiceDate >= start && invoiceDate <= end) {
      const cost = parseFloat(invoice.total || 0)
      
      dailyData.push({
        date: invoiceDate.toISOString().split('T')[0],
        cost,
      })

      // If this month
      if (invoiceDate.getMonth() === now.getMonth() && invoiceDate.getFullYear() === now.getFullYear()) {
        // Current month is calculated from invoice items above
      } else {
        lastMonth += cost
      }
    }
  })

  // If no current invoice items, use account's uninvoiced balance
  if (currentMonth === 0 && accountData.uninvoiced_balance) {
    currentMonth = parseFloat(accountData.uninvoiced_balance)
    serviceMap.set('Linode Services', currentMonth)
  }

  // Sort daily data
  dailyData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  // If no service breakdown, create a default one
  if (serviceMap.size === 0 && (currentMonth > 0 || lastMonth > 0)) {
    serviceMap.set('Linode Services', currentMonth + lastMonth)
  }

  const services = Array.from(serviceMap.entries())
    .map(([name, cost]) => ({ name, cost, change: 0 }))
    .sort((a, b) => b.cost - a.cost)

  console.log(`[Linode Transform] Processed data:`)
  console.log(`  - Daily data points: ${dailyData.length}`)
  console.log(`  - Current month: $${currentMonth.toFixed(2)}`)
  console.log(`  - Last month: $${lastMonth.toFixed(2)}`)
  console.log(`  - Credits: $${creditsBalance.toFixed(2)}`)
  console.log(`  - Services: ${services.length}`)

  return {
    currentMonth,
    lastMonth,
    forecast: currentMonth * 1.1,
    credits: creditsBalance,
    savings: 0,
    services,
    dailyData,
  }
}

/**
 * Vultr Cloud Cost API Integration
 * Uses Vultr API v2 for billing and account data
 */
export const fetchVultrCostData = async (credentials, startDate, endDate) => {
  const { apiKey } = credentials

  console.log(`[Vultr Fetch] Starting fetch for date range: ${startDate} to ${endDate}`)

  try {
    if (!apiKey) {
      throw new Error('Vultr requires an API key')
    }

    const headers = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    }

    // Fetch account info
    console.log(`[Vultr Fetch] Fetching account info...`)
    const accountResponse = await fetch('https://api.vultr.com/v2/account', { headers })
    
    if (!accountResponse.ok) {
      throw new Error(`Vultr API error: ${accountResponse.statusText}`)
    }
    
    const accountData = await accountResponse.json()
    const account = accountData.account || {}
    console.log(`[Vultr Fetch] Account email: ${account.email}`)
    console.log(`[Vultr Fetch] Balance: $${account.balance || 0}`)
    console.log(`[Vultr Fetch] Pending charges: $${account.pending_charges || 0}`)

    // Fetch billing history
    console.log(`[Vultr Fetch] Fetching billing history...`)
    const billingResponse = await fetch('https://api.vultr.com/v2/billing/history', { headers })
    
    let billingHistory = []
    if (billingResponse.ok) {
      const billingData = await billingResponse.json()
      billingHistory = billingData.billing_history || []
      console.log(`[Vultr Fetch] Found ${billingHistory.length} billing history entries`)
    }

    // Fetch invoices
    console.log(`[Vultr Fetch] Fetching invoices...`)
    const invoicesResponse = await fetch('https://api.vultr.com/v2/billing/invoices', { headers })
    
    let invoices = []
    if (invoicesResponse.ok) {
      const invoicesData = await invoicesResponse.json()
      invoices = invoicesData.billing_invoices || []
      console.log(`[Vultr Fetch] Found ${invoices.length} invoices`)
    }

    // Credits are typically shown as negative balance
    let credits = 0
    if (account.balance && account.balance < 0) {
      credits = Math.abs(account.balance)
    }

    return transformVultrCostData(account, billingHistory, invoices, credits, startDate, endDate)
  } catch (error) {
    console.error('[Vultr Fetch] Vultr API error:', error)
    throw new Error(`Vultr API Error: ${error.message}`)
  }
}

/**
 * Transform Vultr response to our format
 */
const transformVultrCostData = (account, billingHistory, invoices, creditsBalance, startDate, endDate) => {
  const dailyData = []
  const serviceMap = new Map()
  let currentMonth = 0
  let lastMonth = 0

  const now = new Date()
  const start = new Date(startDate)
  const end = new Date(endDate)

  // Current month from pending charges
  currentMonth = parseFloat(account.pending_charges || 0)

  // Process billing history
  billingHistory.forEach((entry) => {
    const entryDate = new Date(entry.date)
    
    if (entryDate >= start && entryDate <= end) {
      const amount = parseFloat(entry.amount || 0)
      
      // Only count charges (positive amounts)
      if (amount > 0) {
        dailyData.push({
          date: entryDate.toISOString().split('T')[0],
          cost: amount,
        })

        if (entryDate.getMonth() === now.getMonth() && entryDate.getFullYear() === now.getFullYear()) {
          // Current month handled by pending_charges
        } else {
          lastMonth += amount
        }

        // Track by description for service breakdown
        const serviceName = entry.description || 'Vultr Services'
        const existing = serviceMap.get(serviceName) || 0
        serviceMap.set(serviceName, existing + amount)
      }
    }
  })

  // Process invoices for additional data
  invoices.forEach((invoice) => {
    const invoiceDate = new Date(invoice.date)
    
    if (invoiceDate >= start && invoiceDate <= end) {
      const amount = parseFloat(invoice.amount || 0)
      
      // Check if we already have this date in dailyData
      const existingDay = dailyData.find(d => d.date === invoiceDate.toISOString().split('T')[0])
      if (!existingDay && amount > 0) {
        dailyData.push({
          date: invoiceDate.toISOString().split('T')[0],
          cost: amount,
        })
      }
    }
  })

  // Sort daily data
  dailyData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  // If no service breakdown, create a default one
  if (serviceMap.size === 0 && (currentMonth > 0 || lastMonth > 0)) {
    serviceMap.set('Vultr Services', currentMonth + lastMonth)
  }

  const services = Array.from(serviceMap.entries())
    .map(([name, cost]) => ({ name, cost, change: 0 }))
    .sort((a, b) => b.cost - a.cost)

  console.log(`[Vultr Transform] Processed data:`)
  console.log(`  - Daily data points: ${dailyData.length}`)
  console.log(`  - Current month: $${currentMonth.toFixed(2)}`)
  console.log(`  - Last month: $${lastMonth.toFixed(2)}`)
  console.log(`  - Credits: $${creditsBalance.toFixed(2)}`)
  console.log(`  - Services: ${services.length}`)

  return {
    currentMonth,
    lastMonth,
    forecast: currentMonth * 1.1,
    credits: creditsBalance,
    savings: 0,
    services,
    dailyData,
  }
}

/**
 * Generic function to fetch cost data from any provider
 * Includes caching support
 */
export const fetchProviderCostData = async (providerId, credentials, startDate, endDate, useCache = true) => {
  // Generate cache key
  const cacheKey = `${providerId}-${startDate}-${endDate}`
  
  // Check cache if enabled (will be handled by caller)
  const provider = providerId.toLowerCase()
  
  let result
  switch (provider) {
    case 'aws':
      result = await fetchAWSCostData(credentials, startDate, endDate)
      break
    case 'azure':
      result = await fetchAzureCostData(credentials, startDate, endDate)
      break
    case 'gcp':
    case 'google':
      result = await fetchGCPCostData(credentials, startDate, endDate)
      break
    case 'digitalocean':
    case 'do':
      result = await fetchDigitalOceanCostData(credentials, startDate, endDate)
      break
    case 'ibm':
    case 'ibmcloud':
      result = await fetchIBMCloudCostData(credentials, startDate, endDate)
      break
    case 'linode':
    case 'akamai':
      result = await fetchLinodeCostData(credentials, startDate, endDate)
      break
    case 'vultr':
      result = await fetchVultrCostData(credentials, startDate, endDate)
      break
    default:
      throw new Error(`Unsupported provider: ${providerId}`)
  }

  return result
}

/**
 * Calculate date ranges for different periods
 */
export const getDateRange = (days) => {
  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)
  
  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  }
}

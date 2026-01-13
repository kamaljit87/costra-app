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

  try {
    // Create or reuse Cost Explorer client
    const cacheKey = `aws-${accessKeyId}-${region}`
    let client = clientCache.get(cacheKey)
    
    if (!client) {
      client = new CostExplorerClient({
        region,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      })
      clientCache.set(cacheKey, client)
    }

    // Fetch cost and usage data
    const command = new GetCostAndUsageCommand({
      TimePeriod: {
        Start: startDate,
        End: endDate,
      },
      Granularity: 'DAILY',
      Metrics: ['BlendedCost', 'UnblendedCost'],
      GroupBy: [
        {
          Type: 'DIMENSION',
          Key: 'SERVICE',
        },
      ],
    })

    const response = await client.send(command)
    return transformAWSCostData(response, startDate, endDate)
  } catch (error) {
    console.error('AWS Cost Explorer error:', error)
    throw new Error(`AWS API Error: ${error.message}`)
  }
}

/**
 * Transform AWS Cost Explorer response to our format
 */
const transformAWSCostData = (awsData, startDate, endDate) => {
  const resultsByTime = awsData.ResultsByTime || []
  const dailyData = []
  const serviceMap = new Map()
  let currentMonth = 0
  let lastMonth = 0

  // Process daily data
  resultsByTime.forEach((result) => {
    const date = result.TimePeriod?.Start
    const totalCost = parseFloat(result.Total?.BlendedCost?.Amount || 0)
    
    if (date && totalCost > 0) {
      dailyData.push({
        date,
        cost: totalCost,
      })

      // Calculate monthly totals
      const resultDate = new Date(date)
      const now = new Date()
      if (resultDate.getMonth() === now.getMonth() && resultDate.getFullYear() === now.getFullYear()) {
        currentMonth += totalCost
      } else {
        lastMonth += totalCost
      }
    }

    // Aggregate service costs
    const groups = result.Groups || []
    groups.forEach((group) => {
      const serviceName = group.Keys?.[0] || 'Other'
      const cost = parseFloat(group.Metrics?.BlendedCost?.Amount || 0)
      if (cost > 0) {
        const existing = serviceMap.get(serviceName) || 0
        serviceMap.set(serviceName, existing + cost)
      }
    })
  })

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
    credits: 0,
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

  try {
    // Get OAuth token
    const token = await getAzureAccessToken(tenantId, clientId, clientSecret)

    // Use REST API for cost query
    const url = `https://management.azure.com/subscriptions/${subscriptionId}/providers/Microsoft.CostManagement/query?api-version=2021-10-01`
    
    const payload = {
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
            name: 'PreTaxCost',
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

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Azure API Error: ${error.error?.message || response.statusText}`)
    }

    const result = await response.json()
    return transformAzureCostData(result, startDate, endDate)
  } catch (error) {
    console.error('Azure Cost Management error:', error)
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
 */
const transformAzureCostData = (azureData, startDate, endDate) => {
  const rows = azureData.properties?.rows || []
  const columns = azureData.properties?.columns || []

  const dailyData = []
  const serviceMap = new Map()
  let currentMonth = 0
  let lastMonth = 0

  // Find column indices
  const costIndex = columns.findIndex((col) => col.name === 'PreTaxCost')
  const serviceIndex = columns.findIndex((col) => col.name === 'ServiceName')
  const dateIndex = columns.findIndex((col) => col.name === 'UsageDate')

  const now = new Date()

  rows.forEach((row) => {
    const cost = parseFloat(row[costIndex] || 0)
    const serviceName = row[serviceIndex] || 'Other'
    const date = row[dateIndex]

    if (cost > 0 && date) {
      // Add to daily data
      dailyData.push({
        date: date instanceof Date ? date.toISOString().split('T')[0] : date,
        cost,
      })

      // Aggregate by service
      const existing = serviceMap.get(serviceName) || 0
      serviceMap.set(serviceName, existing + cost)

      // Determine if current or last month
      const rowDate = new Date(date)
      if (rowDate.getMonth() === now.getMonth() && rowDate.getFullYear() === now.getFullYear()) {
        currentMonth += cost
      } else {
        lastMonth += cost
      }
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

  return {
    currentMonth,
    lastMonth,
    forecast: currentMonth * 1.1,
    credits: 0,
    savings: 0,
    services,
    dailyData,
  }
}

/**
 * Google Cloud Platform Billing API Integration
 * Note: GCP requires service account JSON key
 */
export const fetchGCPCostData = async (credentials, startDate, endDate) => {
  const { projectId, serviceAccountKey } = credentials

  try {
    // GCP Billing API requires service account authentication
    // This is a simplified implementation - in production, use @google-cloud/billing
    // For now, we'll use a REST API approach
    
    if (!serviceAccountKey) {
      throw new Error('GCP requires service account key JSON')
    }

    // Parse service account key
    const keyData = typeof serviceAccountKey === 'string' 
      ? JSON.parse(serviceAccountKey) 
      : serviceAccountKey

    // Note: Full GCP implementation would use @google-cloud/billing SDK
    // This is a placeholder that shows the structure
    throw new Error('GCP integration requires @google-cloud/billing SDK. Please use the REST API or install the SDK.')
  } catch (error) {
    console.error('GCP Billing error:', error)
    throw new Error(`GCP API Error: ${error.message}`)
  }
}

/**
 * DigitalOcean API Integration
 */
export const fetchDigitalOceanCostData = async (credentials, startDate, endDate) => {
  const { apiToken } = credentials

  try {
    // DigitalOcean doesn't have a dedicated cost API, but we can use their billing API
    const response = await fetch('https://api.digitalocean.com/v2/customers/my/invoices', {
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`DigitalOcean API error: ${response.statusText}`)
    }

    const data = await response.json()
    return transformDigitalOceanCostData(data, startDate, endDate)
  } catch (error) {
    console.error('DigitalOcean API error:', error)
    throw new Error(`DigitalOcean API Error: ${error.message}`)
  }
}

/**
 * Transform DigitalOcean response to our format
 */
const transformDigitalOceanCostData = (doData, startDate, endDate) => {
  const invoices = doData.invoices || []
  const dailyData = []
  let currentMonth = 0
  let lastMonth = 0

  const now = new Date()
  const start = new Date(startDate)
  const end = new Date(endDate)

  invoices.forEach((invoice) => {
    const invoiceDate = new Date(invoice.invoice_date)
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
    }
  })

  return {
    currentMonth,
    lastMonth,
    forecast: currentMonth * 1.1,
    credits: 0,
    savings: 0,
    services: [{ name: 'DigitalOcean Services', cost: currentMonth, change: 0 }],
    dailyData,
  }
}

/**
 * IBM Cloud Cost Management API Integration
 */
export const fetchIBMCloudCostData = async (credentials, startDate, endDate) => {
  const { apiKey } = credentials

  try {
    // IBM Cloud uses REST API for cost data
    // This is a placeholder - actual implementation would use IBM Cloud SDK
    throw new Error('IBM Cloud integration requires IBM Cloud SDK. Please install: npm install @ibm-cloud/platform-services')
  } catch (error) {
    console.error('IBM Cloud error:', error)
    throw new Error(`IBM Cloud API Error: ${error.message}`)
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

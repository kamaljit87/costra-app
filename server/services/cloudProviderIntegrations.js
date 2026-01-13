/**
 * Cloud Provider API Integration Service
 * Fetches cost data from various cloud providers (AWS, Azure, GCP, etc.)
 */

import https from 'https'
import crypto from 'crypto'

/**
 * AWS Cost Explorer API Integration
 * Requires: AWS Access Key ID, Secret Access Key, and optionally Region
 */
export const fetchAWSCostData = async (credentials, startDate, endDate) => {
  const { accessKeyId, secretAccessKey, region = 'us-east-1' } = credentials

  // AWS Cost Explorer API endpoint
  const endpoint = `ce.${region}.amazonaws.com`
  const service = 'ce'
  const method = 'POST'
  const path = '/'
  const contentType = 'application/x-amz-json-1.1'
  const target = 'AWSInsightsIndexService.GetCostAndUsage'

  // Prepare request payload
  const payload = {
    TimePeriod: {
      Start: startDate,
      End: endDate,
    },
    Granularity: 'MONTHLY',
    Metrics: ['BlendedCost', 'UnblendedCost'],
    GroupBy: [
      {
        Type: 'DIMENSION',
        Key: 'SERVICE',
      },
    ],
  }

  // AWS Signature Version 4 signing
  const signedRequest = await signAWSRequest(
    method,
    path,
    payload,
    endpoint,
    service,
    accessKeyId,
    secretAccessKey,
    region
  )

  return new Promise((resolve, reject) => {
    const options = {
      hostname: endpoint,
      port: 443,
      path: path,
      method: method,
      headers: {
        'Content-Type': contentType,
        'X-Amz-Target': target,
        'Authorization': signedRequest.authorization,
        'X-Amz-Date': signedRequest.date,
      },
    }

    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => {
        data += chunk
      })
      res.on('end', () => {
        try {
          const result = JSON.parse(data)
          if (res.statusCode === 200) {
            resolve(transformAWSCostData(result))
          } else {
            reject(new Error(`AWS API Error: ${result.__type || 'Unknown error'}`))
          }
        } catch (error) {
          reject(new Error(`Failed to parse AWS response: ${error.message}`))
        }
      })
    })

    req.on('error', (error) => {
      reject(new Error(`AWS API request failed: ${error.message}`))
    })

    req.write(JSON.stringify(payload))
    req.end()
  })
}

/**
 * Transform AWS Cost Explorer response to our format
 */
const transformAWSCostData = (awsData) => {
  const resultsByTime = awsData.ResultsByTime || []
  const latestResult = resultsByTime[resultsByTime.length - 1] || {}
  const groups = latestResult.Groups || []

  // Calculate totals
  let currentMonth = 0
  let lastMonth = 0
  const services = []

  resultsByTime.forEach((result, index) => {
    const amount = parseFloat(result.Total?.BlendedCost?.Amount || 0)
    if (index === resultsByTime.length - 1) {
      currentMonth = amount
    } else if (index === resultsByTime.length - 2) {
      lastMonth = amount
    }
  })

  // Extract service costs
  groups.forEach((group) => {
    const serviceName = group.Keys?.[0] || 'Other'
    const cost = parseFloat(group.Metrics?.BlendedCost?.Amount || 0)
    if (cost > 0) {
      services.push({
        name: serviceName,
        cost: cost,
        change: 0, // AWS doesn't provide change percentage directly
      })
    }
  })

  return {
    currentMonth,
    lastMonth,
    forecast: currentMonth * 1.1, // Simple forecast (10% increase)
    credits: 0, // AWS credits need to be fetched separately
    savings: 0, // Savings plans need to be fetched separately
    services: services.sort((a, b) => b.cost - a.cost),
  }
}

/**
 * AWS Signature Version 4 signing (simplified)
 * Note: For production, use AWS SDK instead
 */
const signAWSRequest = async (method, path, payload, host, service, accessKey, secretKey, region) => {
  const amzDate = new Date().toISOString().replace(/[:\-]|\.\d{3}/g, '')
  const dateStamp = amzDate.substr(0, 8)

  const canonicalUri = path
  const canonicalQuerystring = ''
  const canonicalHeaders = `host:${host}\nx-amz-date:${amzDate}\n`
  const signedHeaders = 'host;x-amz-date'
  const payloadHash = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex')
  const canonicalRequest = `${method}\n${canonicalUri}\n${canonicalQuerystring}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`

  const algorithm = 'AWS4-HMAC-SHA256'
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`
  const stringToSign = `${algorithm}\n${amzDate}\n${credentialScope}\n${crypto.createHash('sha256').update(canonicalRequest).digest('hex')}`

  const kDate = crypto.createHmac('sha256', `AWS4${secretKey}`).update(dateStamp).digest()
  const kRegion = crypto.createHmac('sha256', kDate).update(region).digest()
  const kService = crypto.createHmac('sha256', kRegion).update(service).digest()
  const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest()
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex')

  const authorization = `${algorithm} Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

  return { authorization, date: amzDate }
}

/**
 * Azure Cost Management API Integration
 * Requires: Tenant ID, Client ID, Client Secret, and Subscription ID
 */
export const fetchAzureCostData = async (credentials, startDate, endDate) => {
  const { tenantId, clientId, clientSecret, subscriptionId } = credentials

  // First, get OAuth token
  const token = await getAzureAccessToken(tenantId, clientId, clientSecret)

  // Fetch cost data
  const url = `https://management.azure.com/subscriptions/${subscriptionId}/providers/Microsoft.CostManagement/query?api-version=2021-10-01`

  const payload = {
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

  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    const options = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }

    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => {
        data += chunk
      })
      res.on('end', () => {
        try {
          const result = JSON.parse(data)
          if (res.statusCode === 200) {
            resolve(transformAzureCostData(result))
          } else {
            reject(new Error(`Azure API Error: ${result.error?.message || 'Unknown error'}`))
          }
        } catch (error) {
          reject(new Error(`Failed to parse Azure response: ${error.message}`))
        }
      })
    })

    req.on('error', (error) => {
      reject(new Error(`Azure API request failed: ${error.message}`))
    })

    req.write(JSON.stringify(payload))
    req.end()
  })
}

/**
 * Get Azure OAuth access token
 */
const getAzureAccessToken = async (tenantId, clientId, clientSecret) => {
  return new Promise((resolve, reject) => {
    const url = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`
    const urlObj = new URL(url)

    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'https://management.azure.com/.default',
      grant_type: 'client_credentials',
    })

    const options = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }

    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => {
        data += chunk
      })
      res.on('end', () => {
        try {
          const result = JSON.parse(data)
          if (result.access_token) {
            resolve(result.access_token)
          } else {
            reject(new Error(`Azure auth failed: ${result.error_description || 'Unknown error'}`))
          }
        } catch (error) {
          reject(new Error(`Failed to parse Azure auth response: ${error.message}`))
        }
      })
    })

    req.on('error', (error) => {
      reject(new Error(`Azure auth request failed: ${error.message}`))
    })

    req.write(params.toString())
    req.end()
  })
}

/**
 * Transform Azure Cost Management response to our format
 */
const transformAzureCostData = (azureData) => {
  const rows = azureData.properties?.rows || []
  const columns = azureData.properties?.columns || []

  let currentMonth = 0
  let lastMonth = 0
  const services = []
  const serviceMap = new Map()

  // Find cost and service name column indices
  const costIndex = columns.findIndex((col) => col.name === 'PreTaxCost')
  const serviceIndex = columns.findIndex((col) => col.name === 'ServiceName')
  const dateIndex = columns.findIndex((col) => col.name === 'UsageDate')

  rows.forEach((row) => {
    const cost = parseFloat(row[costIndex] || 0)
    const serviceName = row[serviceIndex] || 'Other'
    const date = row[dateIndex]

    if (cost > 0) {
      // Aggregate by service
      const existing = serviceMap.get(serviceName) || 0
      serviceMap.set(serviceName, existing + cost)

      // Determine if current or last month
      const rowDate = new Date(date)
      const now = new Date()
      if (rowDate.getMonth() === now.getMonth() && rowDate.getFullYear() === now.getFullYear()) {
        currentMonth += cost
      } else {
        lastMonth += cost
      }
    }
  })

  // Convert service map to array
  serviceMap.forEach((cost, name) => {
    services.push({
      name,
      cost,
      change: 0,
    })
  })

  return {
    currentMonth,
    lastMonth,
    forecast: currentMonth * 1.1,
    credits: 0,
    savings: 0,
    services: services.sort((a, b) => b.cost - a.cost),
  }
}

/**
 * Google Cloud Platform Billing API Integration
 * Requires: Service Account JSON key or OAuth credentials
 */
export const fetchGCPCostData = async (credentials, startDate, endDate) => {
  const { projectId, serviceAccountKey } = credentials

  // For GCP, you typically use the Google Cloud Billing API
  // This is a simplified example - in production, use @google-cloud/billing
  // For now, we'll use a REST API approach with service account authentication

  // Note: GCP requires more complex authentication with JWT tokens
  // This is a placeholder - you should use the official GCP SDK
  throw new Error('GCP integration requires @google-cloud/billing SDK. Please install: npm install @google-cloud/billing')
}

/**
 * Generic function to fetch cost data from any provider
 */
export const fetchProviderCostData = async (providerId, credentials, startDate, endDate) => {
  switch (providerId.toLowerCase()) {
    case 'aws':
      return await fetchAWSCostData(credentials, startDate, endDate)
    case 'azure':
      return await fetchAzureCostData(credentials, startDate, endDate)
    case 'gcp':
      return await fetchGCPCostData(credentials, startDate, endDate)
    default:
      throw new Error(`Unsupported provider: ${providerId}`)
  }
}

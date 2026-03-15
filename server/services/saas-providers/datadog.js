import logger from '../../utils/logger.js'

const SITES = {
  us1: 'https://api.datadoghq.com',
  us3: 'https://us3.datadoghq.com',
  us5: 'https://us5.datadoghq.com',
  eu1: 'https://api.datadoghq.eu',
  ap1: 'https://ap1.datadoghq.com',
}

const SITE_OPTIONS = Object.entries(SITES).map(([key, url]) => ({
  value: key,
  label: `${key.toUpperCase()} (${url.replace('https://', '')})`,
}))

async function apiCall(credentials, path) {
  const baseUrl = SITES[credentials.site] || SITES.us1
  const res = await fetch(`${baseUrl}${path}`, {
    headers: {
      'DD-API-KEY': credentials.apiKey,
      'DD-APPLICATION-KEY': credentials.applicationKey,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(30000),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Datadog API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json()
}

const datadogAdapter = {
  id: 'datadog',
  name: 'Datadog',

  credentialFields: [
    { key: 'apiKey', label: 'API Key', type: 'password', required: true, placeholder: 'Your Datadog API key' },
    { key: 'applicationKey', label: 'Application Key', type: 'password', required: true, placeholder: 'Your Datadog Application key' },
    { key: 'site', label: 'Site / Region', type: 'select', required: true, options: SITE_OPTIONS, defaultValue: 'us1' },
  ],

  async testConnection(credentials) {
    try {
      await apiCall(credentials, '/api/v1/validate')
      return { success: true, message: 'Connected to Datadog successfully' }
    } catch (err) {
      return { success: false, message: `Datadog connection failed: ${err.message}` }
    }
  },

  async fetchCosts(credentials, startDate, endDate) {
    const startMonth = startDate.toISOString().slice(0, 7)
    const endMonth = endDate.toISOString().slice(0, 7)

    // Fetch monthly usage summary which includes estimated cost breakdowns
    const params = new URLSearchParams({
      start_month: startMonth,
      end_month: endMonth,
      include_org_details: 'false',
    })

    const data = await apiCall(credentials, `/api/v1/usage/summary?${params}`)
    const costs = []

    if (!data.usage) return costs

    // Map usage fields to cost entries
    const usageMapping = [
      { field: 'infra_host_top99p', name: 'Infrastructure Hosts', unit: 'hosts' },
      { field: 'container_avg', name: 'Containers', unit: 'containers' },
      { field: 'apm_host_top99p', name: 'APM Hosts', unit: 'hosts' },
      { field: 'apm_azure_app_service_host_top99p', name: 'APM Azure App Service', unit: 'hosts' },
      { field: 'logs_indexed_events_count_sum', name: 'Logs (Indexed)', unit: 'events' },
      { field: 'ingested_events_bytes_sum', name: 'Logs (Ingested)', unit: 'bytes' },
      { field: 'synthetics_check_calls_count_sum', name: 'Synthetics API', unit: 'checks' },
      { field: 'synthetics_browser_check_calls_count_sum', name: 'Synthetics Browser', unit: 'checks' },
      { field: 'rum_session_count_sum', name: 'RUM Sessions', unit: 'sessions' },
      { field: 'serverless_invocations_sum', name: 'Serverless Invocations', unit: 'invocations' },
      { field: 'custom_ts_avg', name: 'Custom Metrics', unit: 'metrics' },
      { field: 'profiling_host_top99p', name: 'Profiling Hosts', unit: 'hosts' },
      { field: 'dbm_host_top99p', name: 'Database Monitoring', unit: 'hosts' },
    ]

    for (const month of data.usage) {
      const date = month.date ? month.date.slice(0, 10) : `${startMonth}-01`

      for (const mapping of usageMapping) {
        const quantity = month[mapping.field]
        if (quantity && quantity > 0) {
          costs.push({
            serviceName: mapping.name,
            date,
            cost: 0, // Datadog usage API returns quantities, not costs
            usageQuantity: quantity,
            usageUnit: mapping.unit,
            metadata: { source: 'datadog_usage_summary', field: mapping.field },
          })
        }
      }
    }

    // Try to get estimated cost from the hourly usage v2 endpoint
    try {
      const hourlyParams = new URLSearchParams({
        filter_timestamp_start: startDate.toISOString(),
        filter_timestamp_end: endDate.toISOString(),
        filter_product_families: 'all',
      })
      const hourlyData = await apiCall(credentials, `/api/v2/usage/hourly_usage?${hourlyParams}`)

      if (hourlyData.data) {
        const costByProduct = {}
        for (const entry of hourlyData.data) {
          const product = entry.attributes?.product_family || 'other'
          const usage = entry.attributes?.measurements || []
          for (const m of usage) {
            if (m.usage_type && m.value) {
              const key = `${product}:${m.usage_type}`
              if (!costByProduct[key]) {
                costByProduct[key] = { product, usageType: m.usage_type, total: 0 }
              }
              costByProduct[key].total += m.value
            }
          }
        }
        logger.debug('Datadog hourly usage aggregated', { products: Object.keys(costByProduct).length })
      }
    } catch (err) {
      logger.debug('Datadog hourly usage fetch skipped', { error: err.message })
    }

    return costs
  },
}

export default datadogAdapter

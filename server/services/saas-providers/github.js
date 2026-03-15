import logger from '../../utils/logger.js'

const GITHUB_API = 'https://api.github.com'

async function apiCall(credentials, path) {
  const res = await fetch(`${GITHUB_API}${path}`, {
    headers: {
      Authorization: `Bearer ${credentials.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    signal: AbortSignal.timeout(30000),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`GitHub API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json()
}

// GitHub Actions runner minute multipliers
const RUNNER_MULTIPLIERS = {
  UBUNTU: { multiplier: 1, rate: 0.008 },         // $0.008/min
  MACOS: { multiplier: 10, rate: 0.08 },           // $0.08/min
  WINDOWS: { multiplier: 2, rate: 0.016 },         // $0.016/min
}

const githubAdapter = {
  id: 'github',
  name: 'GitHub',

  credentialFields: [
    { key: 'organization', label: 'Organization', type: 'text', required: true, placeholder: 'e.g. my-org' },
    { key: 'token', label: 'Personal Access Token', type: 'password', required: true, placeholder: 'ghp_... (needs admin:org scope)' },
  ],

  async testConnection(credentials) {
    try {
      const org = await apiCall(credentials, `/orgs/${encodeURIComponent(credentials.organization)}`)
      return { success: true, message: `Connected to GitHub org: ${org.login}` }
    } catch (err) {
      if (err.message.includes('401')) {
        return { success: false, message: 'Invalid token. Ensure it has admin:org scope.' }
      }
      if (err.message.includes('404')) {
        return { success: false, message: `Organization "${credentials.organization}" not found or token lacks access.` }
      }
      return { success: false, message: `GitHub connection failed: ${err.message}` }
    }
  },

  async fetchCosts(credentials, startDate, endDate) {
    const org = encodeURIComponent(credentials.organization)
    const costs = []
    const date = new Date().toISOString().slice(0, 8) + '01' // First of current month

    // 1. Actions billing
    try {
      const actions = await apiCall(credentials, `/orgs/${org}/settings/billing/actions`)
      const paidMinutes = actions.total_paid_minutes_used || 0
      const includedMinutes = actions.included_minutes || 0
      const totalMinutes = actions.total_minutes_used || 0

      // Break down by runner OS if available
      if (actions.minutes_used_breakdown) {
        for (const [os, minutes] of Object.entries(actions.minutes_used_breakdown)) {
          if (minutes > 0) {
            const runner = RUNNER_MULTIPLIERS[os] || RUNNER_MULTIPLIERS.UBUNTU
            const estimatedCost = Math.max(0, minutes - (includedMinutes / Object.keys(actions.minutes_used_breakdown).length)) * runner.rate
            costs.push({
              serviceName: `Actions (${os})`,
              date,
              cost: parseFloat(estimatedCost.toFixed(2)),
              usageQuantity: minutes,
              usageUnit: 'minutes',
              metadata: { source: 'github_billing_actions', os, multiplier: runner.multiplier },
            })
          }
        }
      } else if (totalMinutes > 0) {
        costs.push({
          serviceName: 'Actions',
          date,
          cost: parseFloat((paidMinutes * 0.008).toFixed(2)),
          usageQuantity: totalMinutes,
          usageUnit: 'minutes',
          metadata: { source: 'github_billing_actions', paidMinutes, includedMinutes },
        })
      }
    } catch (err) {
      logger.warn('GitHub Actions billing fetch failed', { error: err.message })
    }

    // 2. Packages billing
    try {
      const packages = await apiCall(credentials, `/orgs/${org}/settings/billing/packages`)
      const paidGb = packages.total_paid_gigabytes_bandwidth_used || 0
      const totalGb = packages.total_gigabytes_bandwidth_used || 0
      if (totalGb > 0) {
        costs.push({
          serviceName: 'Packages (Bandwidth)',
          date,
          cost: parseFloat((paidGb * 0.50).toFixed(2)), // $0.50/GB overage
          usageQuantity: totalGb,
          usageUnit: 'GB',
          metadata: { source: 'github_billing_packages', paidGb, includedGb: packages.included_gigabytes_bandwidth || 0 },
        })
      }
    } catch (err) {
      logger.warn('GitHub Packages billing fetch failed', { error: err.message })
    }

    // 3. Shared storage
    try {
      const storage = await apiCall(credentials, `/orgs/${org}/settings/billing/shared-storage`)
      const estimatedGb = storage.estimated_storage_for_month || 0
      if (estimatedGb > 0) {
        costs.push({
          serviceName: 'Shared Storage',
          date,
          cost: parseFloat((Math.max(0, estimatedGb - (storage.estimated_paid_storage_for_month || 0)) * 0.25).toFixed(2)),
          usageQuantity: estimatedGb,
          usageUnit: 'GB-months',
          metadata: { source: 'github_billing_storage', daysLeft: storage.days_left_in_billing_cycle },
        })
      }
    } catch (err) {
      logger.warn('GitHub Storage billing fetch failed', { error: err.message })
    }

    return costs
  },
}

export default githubAdapter

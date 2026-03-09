/**
 * CloudWatch-Based Rightsizing Service
 *
 * Generates EC2 rightsizing recommendations using CloudWatch metrics (CPU,
 * network, EBS) and EC2 instance metadata — no AWS opt-in required.
 *
 * Data sources:
 *  1. EC2 DescribeInstances → instance type, state, launch time
 *  2. CloudWatch GetMetricData → CPUUtilization, NetworkIn/Out, EBS IOPS
 *  3. Static EC2 instance catalog → vCPUs, memory, price per instance type
 *
 * This replaces the dependency on ce:GetRightsizingRecommendation which
 * requires explicit opt-in from the payer account.
 */

import logger from '../utils/logger.js'
import { retryWithBackoff } from '../utils/retry.js'

// ─── EC2 Instance Catalog (common types with approximate on-demand pricing USD/hr us-east-1) ──

const EC2_CATALOG = {
  // General Purpose - Current Gen
  't3.nano':    { vcpus: 2, memGiB: 0.5,  price: 0.0052, family: 't3', gen: 'current' },
  't3.micro':   { vcpus: 2, memGiB: 1,    price: 0.0104, family: 't3', gen: 'current' },
  't3.small':   { vcpus: 2, memGiB: 2,    price: 0.0208, family: 't3', gen: 'current' },
  't3.medium':  { vcpus: 2, memGiB: 4,    price: 0.0416, family: 't3', gen: 'current' },
  't3.large':   { vcpus: 2, memGiB: 8,    price: 0.0832, family: 't3', gen: 'current' },
  't3.xlarge':  { vcpus: 4, memGiB: 16,   price: 0.1664, family: 't3', gen: 'current' },
  't3.2xlarge': { vcpus: 8, memGiB: 32,   price: 0.3328, family: 't3', gen: 'current' },
  't4g.nano':    { vcpus: 2, memGiB: 0.5,  price: 0.0042, family: 't4g', gen: 'current' },
  't4g.micro':   { vcpus: 2, memGiB: 1,    price: 0.0084, family: 't4g', gen: 'current' },
  't4g.small':   { vcpus: 2, memGiB: 2,    price: 0.0168, family: 't4g', gen: 'current' },
  't4g.medium':  { vcpus: 2, memGiB: 4,    price: 0.0336, family: 't4g', gen: 'current' },
  't4g.large':   { vcpus: 2, memGiB: 8,    price: 0.0672, family: 't4g', gen: 'current' },
  't4g.xlarge':  { vcpus: 4, memGiB: 16,   price: 0.1344, family: 't4g', gen: 'current' },
  't4g.2xlarge': { vcpus: 8, memGiB: 32,   price: 0.2688, family: 't4g', gen: 'current' },
  'm5.large':   { vcpus: 2, memGiB: 8,    price: 0.096,  family: 'm5', gen: 'current' },
  'm5.xlarge':  { vcpus: 4, memGiB: 16,   price: 0.192,  family: 'm5', gen: 'current' },
  'm5.2xlarge': { vcpus: 8, memGiB: 32,   price: 0.384,  family: 'm5', gen: 'current' },
  'm5.4xlarge': { vcpus: 16, memGiB: 64,  price: 0.768,  family: 'm5', gen: 'current' },
  'm6i.large':   { vcpus: 2, memGiB: 8,   price: 0.096,  family: 'm6i', gen: 'current' },
  'm6i.xlarge':  { vcpus: 4, memGiB: 16,  price: 0.192,  family: 'm6i', gen: 'current' },
  'm6i.2xlarge': { vcpus: 8, memGiB: 32,  price: 0.384,  family: 'm6i', gen: 'current' },
  'm7g.large':   { vcpus: 2, memGiB: 8,   price: 0.0816, family: 'm7g', gen: 'current' },
  'm7g.xlarge':  { vcpus: 4, memGiB: 16,  price: 0.1632, family: 'm7g', gen: 'current' },
  'm7g.2xlarge': { vcpus: 8, memGiB: 32,  price: 0.3264, family: 'm7g', gen: 'current' },
  // Compute Optimized
  'c5.large':   { vcpus: 2, memGiB: 4,    price: 0.085,  family: 'c5', gen: 'current' },
  'c5.xlarge':  { vcpus: 4, memGiB: 8,    price: 0.17,   family: 'c5', gen: 'current' },
  'c5.2xlarge': { vcpus: 8, memGiB: 16,   price: 0.34,   family: 'c5', gen: 'current' },
  'c7g.large':  { vcpus: 2, memGiB: 4,    price: 0.0725, family: 'c7g', gen: 'current' },
  'c7g.xlarge': { vcpus: 4, memGiB: 8,    price: 0.145,  family: 'c7g', gen: 'current' },
  // Memory Optimized
  'r5.large':   { vcpus: 2, memGiB: 16,   price: 0.126,  family: 'r5', gen: 'current' },
  'r5.xlarge':  { vcpus: 4, memGiB: 32,   price: 0.252,  family: 'r5', gen: 'current' },
  'r5.2xlarge': { vcpus: 8, memGiB: 64,   price: 0.504,  family: 'r5', gen: 'current' },
  'r7g.large':  { vcpus: 2, memGiB: 16,   price: 0.1071, family: 'r7g', gen: 'current' },
  'r7g.xlarge': { vcpus: 4, memGiB: 32,   price: 0.2142, family: 'r7g', gen: 'current' },
  // Older Gen
  't2.micro':   { vcpus: 1, memGiB: 1,    price: 0.0116, family: 't2', gen: 'old' },
  't2.small':   { vcpus: 1, memGiB: 2,    price: 0.023,  family: 't2', gen: 'old' },
  't2.medium':  { vcpus: 2, memGiB: 4,    price: 0.0464, family: 't2', gen: 'old' },
  't2.large':   { vcpus: 2, memGiB: 8,    price: 0.0928, family: 't2', gen: 'old' },
  'm4.large':   { vcpus: 2, memGiB: 8,    price: 0.10,   family: 'm4', gen: 'old' },
  'm4.xlarge':  { vcpus: 4, memGiB: 16,   price: 0.20,   family: 'm4', gen: 'old' },
  'm3.large':   { vcpus: 2, memGiB: 7.5,  price: 0.133,  family: 'm3', gen: 'old' },
  'c4.large':   { vcpus: 2, memGiB: 3.75, price: 0.10,   family: 'c4', gen: 'old' },
  'c4.xlarge':  { vcpus: 4, memGiB: 7.5,  price: 0.199,  family: 'c4', gen: 'old' },
  'r4.large':   { vcpus: 2, memGiB: 15.25, price: 0.133, family: 'r4', gen: 'old' },
  'r4.xlarge':  { vcpus: 4, memGiB: 30.5,  price: 0.266, family: 'r4', gen: 'old' },
}

// Size ordering within a family
const SIZE_ORDER = ['nano', 'micro', 'small', 'medium', 'large', 'xlarge', '2xlarge', '4xlarge', '8xlarge', '12xlarge', '16xlarge', '24xlarge']

/**
 * Fetch EC2 rightsizing recommendations using CloudWatch metrics.
 * No AWS opt-in required — uses ec2:DescribeInstances + cloudwatch:GetMetricData.
 *
 * @param {object} credentials - AWS credentials (accessKeyId, secretAccessKey, sessionToken, region)
 * @param {object} options - { lookbackDays?: number }
 * @returns {{ recommendations: Array, totalPotentialSavings: number, recommendationCount: number, source: string }}
 */
export const fetchCloudWatchRightsizing = async (credentials, options = {}) => {
  const { accessKeyId, secretAccessKey, sessionToken, region = 'us-east-1' } = credentials
  const lookbackDays = options.lookbackDays || 14

  if (!accessKeyId || !secretAccessKey) {
    throw new Error('AWS credentials are missing')
  }

  // ── 1. List running EC2 instances ──────────────────────────────────
  const { EC2Client, DescribeInstancesCommand } = await import('@aws-sdk/client-ec2')
  const ec2Client = new EC2Client({
    region,
    credentials: { accessKeyId, secretAccessKey, sessionToken },
  })

  const instances = []
  let nextToken = undefined
  do {
    const resp = await retryWithBackoff(
      () => ec2Client.send(new DescribeInstancesCommand({
        Filters: [{ Name: 'instance-state-name', Values: ['running'] }],
        NextToken: nextToken,
        MaxResults: 100,
      })),
      { maxAttempts: 3, timeout: 30000 },
      'aws',
      { operation: 'describeInstances' }
    )

    for (const reservation of (resp.Reservations || [])) {
      for (const inst of (reservation.Instances || [])) {
        instances.push({
          instanceId: inst.InstanceId,
          instanceType: inst.InstanceType,
          launchTime: inst.LaunchTime,
          region: inst.Placement?.AvailabilityZone?.slice(0, -1) || region,
          name: inst.Tags?.find(t => t.Key === 'Name')?.Value || inst.InstanceId,
          platform: inst.PlatformDetails || 'Linux/UNIX',
        })
      }
    }
    nextToken = resp.NextToken
  } while (nextToken)

  if (instances.length === 0) {
    return { recommendations: [], totalPotentialSavings: 0, recommendationCount: 0, source: 'cloudwatch' }
  }

  logger.info('CloudWatch rightsizing: found running instances', { count: instances.length })

  // ── 2. Fetch CloudWatch metrics in batch ───────────────────────────
  const { CloudWatchClient, GetMetricDataCommand } = await import('@aws-sdk/client-cloudwatch')
  const cwClient = new CloudWatchClient({
    region,
    credentials: { accessKeyId, secretAccessKey, sessionToken },
  })

  const endTime = new Date()
  const startTime = new Date(endTime.getTime() - lookbackDays * 24 * 60 * 60 * 1000)

  // Build metric queries — batch up to 500 per API call
  const metricsPerInstance = [
    { name: 'CPUUtilization', stat: 'Maximum', ns: 'AWS/EC2' },
    { name: 'CPUUtilization', stat: 'Average', ns: 'AWS/EC2', suffix: 'avg' },
    { name: 'NetworkIn', stat: 'Average', ns: 'AWS/EC2' },
    { name: 'NetworkOut', stat: 'Average', ns: 'AWS/EC2' },
  ]

  const BATCH_SIZE = Math.floor(500 / metricsPerInstance.length) // instances per batch
  const metricsMap = new Map() // instanceId → { cpuMax, cpuAvg, netIn, netOut }

  for (let i = 0; i < instances.length; i += BATCH_SIZE) {
    const batch = instances.slice(i, i + BATCH_SIZE)
    const queries = []

    for (const inst of batch) {
      for (const m of metricsPerInstance) {
        const id = `${m.name.toLowerCase()}${m.suffix || ''}_${inst.instanceId.replace(/[^a-zA-Z0-9]/g, '')}`.substring(0, 255)
        queries.push({
          Id: id,
          MetricStat: {
            Metric: {
              Namespace: m.ns,
              MetricName: m.name,
              Dimensions: [{ Name: 'InstanceId', Value: inst.instanceId }],
            },
            Period: 3600, // 1-hour granularity
            Stat: m.stat,
          },
          ReturnData: true,
        })
      }
    }

    try {
      let cwNextToken = undefined
      const resultValues = {} // queryId → values array
      do {
        const resp = await retryWithBackoff(
          () => cwClient.send(new GetMetricDataCommand({
            MetricDataQueries: queries,
            StartTime: startTime,
            EndTime: endTime,
            NextToken: cwNextToken,
          })),
          { maxAttempts: 3, timeout: 60000 },
          'aws',
          { operation: 'getMetricData' }
        )

        for (const result of (resp.MetricDataResults || [])) {
          if (!resultValues[result.Id]) resultValues[result.Id] = []
          resultValues[result.Id].push(...(result.Values || []))
        }
        cwNextToken = resp.NextToken
      } while (cwNextToken)

      // Map results back to instances
      for (const inst of batch) {
        const suffix = inst.instanceId.replace(/[^a-zA-Z0-9]/g, '')
        const cpuMaxVals = resultValues[`cpuutilization_${suffix}`] || []
        const cpuAvgVals = resultValues[`cpuutilizationavg_${suffix}`] || []
        const netInVals = resultValues[`networkin_${suffix}`] || []
        const netOutVals = resultValues[`networkout_${suffix}`] || []

        metricsMap.set(inst.instanceId, {
          cpuMax: cpuMaxVals.length > 0 ? Math.max(...cpuMaxVals) : null,
          cpuAvg: cpuAvgVals.length > 0 ? cpuAvgVals.reduce((a, b) => a + b, 0) / cpuAvgVals.length : null,
          cpuP95: cpuMaxVals.length > 0 ? percentile(cpuMaxVals, 95) : null,
          netInAvg: netInVals.length > 0 ? netInVals.reduce((a, b) => a + b, 0) / netInVals.length : null,
          netOutAvg: netOutVals.length > 0 ? netOutVals.reduce((a, b) => a + b, 0) / netOutVals.length : null,
          dataPoints: cpuMaxVals.length,
        })
      }
    } catch (cwErr) {
      logger.warn('CloudWatch rightsizing: failed to fetch metrics batch', { error: cwErr.message })
    }
  }

  // ── 3. Analyze and generate recommendations ────────────────────────
  const allRecs = []

  for (const inst of instances) {
    const metrics = metricsMap.get(inst.instanceId)
    if (!metrics || metrics.dataPoints < 24) continue // Need at least 24 data points (1 day)

    const catalog = EC2_CATALOG[inst.instanceType]
    const currentPrice = catalog?.price || 0
    const currentMonthlyCost = currentPrice * 730

    // Skip if we can't find pricing
    if (currentMonthlyCost <= 0) continue

    const cpuMax = metrics.cpuMax
    const cpuAvg = metrics.cpuAvg
    const cpuP95 = metrics.cpuP95

    // ── Idle detection: CPU max < 5% over entire period → terminate candidate
    if (cpuMax !== null && cpuMax < 5) {
      allRecs.push({
        resourceId: inst.instanceId,
        resourceName: inst.name,
        serviceName: 'Amazon EC2',
        resourceType: inst.instanceType,
        region: inst.region,
        currentCost: currentMonthlyCost,
        utilization: {
          estimated: cpuAvg || 0,
          cpuUtilization: cpuAvg,
          cpuMax,
          cpuP95,
          memoryUtilization: null,
        },
        recommendation: 'terminate',
        potentialSavings: currentMonthlyCost,
        savingsPercent: 100,
        priority: 'high',
        reason: `Instance appears idle — peak CPU was only ${cpuMax.toFixed(1)}% over the last ${lookbackDays} days. Consider terminating.`,
        suggestedInstanceType: null,
        findingReasonCodes: ['CPU_IDLE'],
        source: 'cloudwatch',
      })
      continue
    }

    // ── Downsize detection: CPU p95 < 40% → find a smaller type
    if (cpuP95 !== null && cpuP95 < 40 && catalog) {
      const suggested = findSmallerInstance(inst.instanceType, cpuP95, catalog)
      if (suggested) {
        const suggestedPrice = EC2_CATALOG[suggested]?.price || 0
        const suggestedMonthlyCost = suggestedPrice * 730
        const savings = currentMonthlyCost - suggestedMonthlyCost
        const savingsPercent = currentMonthlyCost > 0 ? (savings / currentMonthlyCost) * 100 : 0

        if (savings > 1) { // Only recommend if saves > $1/mo
          const reasons = []
          if (cpuP95 < 40) reasons.push(`CPU p95 is only ${cpuP95.toFixed(1)}%`)
          if (cpuAvg !== null && cpuAvg < 20) reasons.push(`average CPU is ${cpuAvg.toFixed(1)}%`)

          allRecs.push({
            resourceId: inst.instanceId,
            resourceName: inst.name,
            serviceName: 'Amazon EC2',
            resourceType: inst.instanceType,
            region: inst.region,
            currentCost: currentMonthlyCost,
            utilization: {
              estimated: cpuAvg || 0,
              cpuUtilization: cpuAvg,
              cpuMax,
              cpuP95,
              memoryUtilization: null,
            },
            recommendation: 'downsize',
            potentialSavings: Math.round(savings * 100) / 100,
            savingsPercent: Math.round(savingsPercent),
            priority: savingsPercent >= 30 ? 'high' : savingsPercent >= 15 ? 'medium' : 'low',
            reason: `${reasons.join(', ')}. Consider downsizing from ${inst.instanceType} to ${suggested}.`,
            suggestedInstanceType: suggested,
            findingReasonCodes: ['CPU_OVER_PROVISIONED'],
            source: 'cloudwatch',
          })
        }
      }
    }

    // ── Old generation detection
    if (catalog?.gen === 'old') {
      const modernEquiv = findModernEquivalent(inst.instanceType)
      if (modernEquiv) {
        const modernPrice = EC2_CATALOG[modernEquiv]?.price || 0
        const modernMonthlyCost = modernPrice * 730
        const savings = currentMonthlyCost - modernMonthlyCost
        const savingsPercent = currentMonthlyCost > 0 ? (savings / currentMonthlyCost) * 100 : 0

        if (savings > 0) {
          allRecs.push({
            resourceId: inst.instanceId,
            resourceName: inst.name,
            serviceName: 'Amazon EC2',
            resourceType: inst.instanceType,
            region: inst.region,
            currentCost: currentMonthlyCost,
            utilization: {
              estimated: cpuAvg || 0,
              cpuUtilization: cpuAvg,
              cpuMax,
              cpuP95,
              memoryUtilization: null,
            },
            recommendation: 'downsize',
            potentialSavings: Math.round(savings * 100) / 100,
            savingsPercent: Math.round(savingsPercent),
            priority: 'medium',
            reason: `${inst.instanceType} is an older generation. Migrating to ${modernEquiv} offers ~${Math.round(savingsPercent)}% savings with better performance.`,
            suggestedInstanceType: modernEquiv,
            findingReasonCodes: ['OLD_GENERATION'],
            source: 'cloudwatch',
          })
        }
      }
    }
  }

  // Deduplicate: if same instance has both downsize + old-gen, keep the one with higher savings
  const dedupMap = new Map()
  for (const rec of allRecs) {
    const existing = dedupMap.get(rec.resourceId)
    if (!existing || rec.potentialSavings > existing.potentialSavings) {
      dedupMap.set(rec.resourceId, rec)
    }
  }

  const recommendations = [...dedupMap.values()].sort((a, b) => b.potentialSavings - a.potentialSavings)
  const totalPotentialSavings = recommendations.reduce((sum, r) => sum + r.potentialSavings, 0)

  return {
    recommendations: recommendations.slice(0, 50),
    totalPotentialSavings: Math.round(totalPotentialSavings * 100) / 100,
    recommendationCount: recommendations.length,
    source: 'cloudwatch',
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────

function percentile(values, p) {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const idx = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[Math.max(0, idx)]
}

/**
 * Find a smaller instance type that can handle the observed workload.
 * Strategy: step down one size within the same family, or suggest Graviton equivalent.
 */
function findSmallerInstance(currentType, cpuP95, currentCatalog) {
  const [familyPart, sizePart] = currentType.split('.')
  if (!sizePart) return null

  const sizeIdx = SIZE_ORDER.indexOf(sizePart)
  if (sizeIdx <= 0) return null // Already the smallest

  // Try one size down in the same family
  const smallerSize = SIZE_ORDER[sizeIdx - 1]
  const smallerType = `${familyPart}.${smallerSize}`
  if (EC2_CATALOG[smallerType]) return smallerType

  // Try Graviton equivalent (e.g., m5.large → m7g.large, or m5.xlarge → m7g.large)
  const gravitonMap = { m5: 'm7g', m6i: 'm7g', c5: 'c7g', c6i: 'c7g', r5: 'r7g', r6i: 'r7g', t3: 't4g' }
  const gravitonFamily = gravitonMap[familyPart]
  if (gravitonFamily) {
    // If CPU is very low, try one size down in Graviton
    if (cpuP95 < 25 && sizeIdx > 0) {
      const gSmaller = `${gravitonFamily}.${SIZE_ORDER[sizeIdx - 1]}`
      if (EC2_CATALOG[gSmaller]) return gSmaller
    }
    const gSame = `${gravitonFamily}.${sizePart}`
    if (EC2_CATALOG[gSame]) return gSame
  }

  return null
}

/**
 * Find a modern equivalent for an old-generation instance type.
 */
function findModernEquivalent(currentType) {
  const [familyPart, sizePart] = currentType.split('.')
  if (!sizePart) return null

  const modernMap = {
    t2: 't4g', t3: 't4g',
    m3: 'm7g', m4: 'm7g', m5: 'm7g',
    c3: 'c7g', c4: 'c7g', c5: 'c7g',
    r3: 'r7g', r4: 'r7g', r5: 'r7g',
  }

  const modernFamily = modernMap[familyPart]
  if (!modernFamily || modernFamily === familyPart) return null

  const modernType = `${modernFamily}.${sizePart}`
  return EC2_CATALOG[modernType] ? modernType : null
}

/**
 * Multi-Cloud Cost Optimization Recommendation Engine
 *
 * Analyzes billing/cost data across all connected providers to identify
 * cost-inefficient patterns and suggest optimizations.
 *
 * Works with data we actually have (billing data, CUR line items) —
 * not CloudWatch/monitoring metrics.
 */

import {
  getDailyCostDataForAnalysis,
  getServiceCostsHistory,
  getServiceUsageMetricsForAnalysis,
  getAnomalyBaselinesForUser,
  getResourcesForUser,
  getUserCloudProviders,
  bulkUpsertRecommendations,
  expireStaleRecommendations,
  pool,
} from '../database.js'
import { callClaude } from '../utils/aiClient.js'
import * as cache from '../utils/cache.js'
import logger from '../utils/logger.js'
import crypto from 'crypto'

// ─── Orchestrator ────────────────────────────────────────────────────

export const runOptimizationForUser = async (userId) => {
  // Redis lock to prevent concurrent runs
  const lockKey = `optimization-lock:${userId}`
  const locked = await cache.get(lockKey)
  if (locked) {
    logger.debug('Optimization already running for user, skipping', { userId })
    return
  }
  await cache.set(lockKey, '1', 300) // 5 min TTL

  try {
    logger.info('Starting optimization analysis', { userId })
    const context = await gatherAnalysisContext(userId)

    if (!context.hasData) {
      logger.debug('No cost data available for optimization', { userId })
      return
    }

    const recommendations = [
      ...analyzeCostTrends(context),
      ...analyzeIdleResources(context),
      ...analyzeRightsizing(context),
      ...analyzeReservedInstances(context),
      ...analyzeStorageOptimization(context),
      ...analyzeDataTransfer(context),
      ...analyzeServiceBestPractices(context),
      ...analyzeCrossProvider(context),
    ]

    // Score and set priorities
    recommendations.forEach(rec => {
      rec.priority = scorePriority(rec)
    })

    // AI enrichment for critical/high priority only
    const enriched = await enrichRecommendationsWithAI(recommendations, context)

    // Save to DB and expire stale
    if (enriched.length > 0) {
      await bulkUpsertRecommendations(userId, enriched)
    }
    await expireStaleRecommendations()

    logger.info('Optimization analysis complete', { userId, recommendationCount: enriched.length })
  } catch (error) {
    logger.error('Optimization analysis failed', { userId, error: error.message, stack: error.stack })
  } finally {
    try { await cache.del(lockKey) } catch (e) { /* ignore */ }
  }
}

// ─── Data Context ────────────────────────────────────────────────────

async function gatherAnalysisContext(userId) {
  try {
    const [providers, dailyCosts, serviceCosts, usageMetrics, baselines, resources] = await Promise.all([
      getUserCloudProviders(userId),
      getDailyCostDataForAnalysis(userId, 90),
      getServiceCostsHistory(userId, 3),
      getServiceUsageMetricsForAnalysis(userId, 90),
      getAnomalyBaselinesForUser(userId),
      getResourcesForUser(userId),
    ])

    const hasData = dailyCosts.length > 0 || serviceCosts.length > 0

    return {
      userId,
      hasData,
      providers: providers || [],
      dailyCosts,
      serviceCosts,
      usageMetrics,
      baselines,
      resources,
    }
  } catch (error) {
    logger.error('Failed to gather analysis context', { userId, error: error.message })
    return { userId, hasData: false, providers: [], dailyCosts: [], serviceCosts: [], usageMetrics: [], baselines: [], resources: [] }
  }
}

// ─── Analyzer 1: Cost Trends ─────────────────────────────────────────

function analyzeCostTrends(context) {
  const recs = []
  const { dailyCosts, providers } = context

  // Group daily costs by provider+account
  const grouped = groupBy(dailyCosts, r => `${r.provider_id}:${r.account_id || 'all'}`)

  for (const [key, data] of Object.entries(grouped)) {
    const [providerId, accountId] = key.split(':')
    if (data.length < 14) continue

    // Sort by date ascending
    const sorted = data.sort((a, b) => a.date.localeCompare(b.date))

    // Compute 7-day moving averages
    const movingAvgs = []
    for (let i = 6; i < sorted.length; i++) {
      const window = sorted.slice(i - 6, i + 1)
      const avg = window.reduce((s, d) => s + parseFloat(d.cost || 0), 0) / 7
      movingAvgs.push({ date: sorted[i].date, avg })
    }

    if (movingAvgs.length < 7) continue

    // Check for sustained increase in the most recent 7 moving averages
    const recent = movingAvgs.slice(-7)
    const startAvg = recent[0].avg
    const endAvg = recent[recent.length - 1].avg

    if (startAvg <= 0) continue

    const increasePercent = ((endAvg - startAvg) / startAvg) * 100

    if (increasePercent >= 20) {
      const estimatedMonthlyIncrease = (endAvg - startAvg) * 30
      recs.push({
        provider_id: providerId,
        account_id: accountId !== 'all' ? parseInt(accountId) : null,
        category: 'cost_trend',
        subcategory: 'sustained_increase',
        service_name: null,
        resource_id: null,
        title: `Sustained cost increase detected for ${providerId.toUpperCase()}`,
        description: `Daily costs have increased ${increasePercent.toFixed(0)}% over the last 7 days (from $${startAvg.toFixed(2)}/day to $${endAvg.toFixed(2)}/day).`,
        action: `Review recent deployments and resource changes for ${providerId.toUpperCase()} to identify the source of increased costs.`,
        estimated_monthly_savings: Math.round(estimatedMonthlyIncrease * 100) / 100,
        estimated_savings_percent: Math.round(increasePercent),
        confidence: 'medium',
        current_cost: Math.round(endAvg * 30 * 100) / 100,
        evidence: { startAvg, endAvg, increasePercent, dataPoints: recent.length },
      })
    }
  }

  return recs
}

// ─── Analyzer 2: Idle Resources ──────────────────────────────────────

function analyzeIdleResources(context) {
  const recs = []
  const { resources, usageMetrics } = context

  // CUR-based: resources with cost > 0 but zero/negligible usage
  for (const res of resources) {
    const cost = parseFloat(res.cost || 0)
    if (cost <= 0) continue

    const usageQty = parseFloat(res.usage_quantity || 0)
    const usageUnit = (res.usage_unit || '').toLowerCase()

    // Detect idle Elastic IPs
    if (usageUnit.includes('elasticip:idleaddress') || usageUnit.includes('elasticip-idleaddress')) {
      recs.push({
        provider_id: res.provider_id,
        account_id: res.account_id,
        category: 'idle_resource',
        subcategory: 'idle_elastic_ip',
        service_name: res.service_name,
        resource_id: res.resource_id,
        resource_name: res.resource_name,
        resource_type: 'Elastic IP',
        region: res.region,
        title: `Idle Elastic IP: ${res.resource_name || res.resource_id}`,
        description: `This Elastic IP is not associated with a running instance, costing $${cost.toFixed(2)}/month.`,
        action: `Release this Elastic IP if no longer needed, or associate it with an instance.`,
        estimated_monthly_savings: cost,
        estimated_savings_percent: 100,
        confidence: 'high',
        current_cost: cost,
        current_usage: usageQty,
        usage_unit: res.usage_unit,
        evidence: { resourceId: res.resource_id, region: res.region },
      })
      continue
    }

    // Detect resources with zero usage but significant cost
    if (usageQty === 0 && cost > 1) {
      recs.push({
        provider_id: res.provider_id,
        account_id: res.account_id,
        category: 'idle_resource',
        subcategory: 'zero_usage',
        service_name: res.service_name,
        resource_id: res.resource_id,
        resource_name: res.resource_name,
        resource_type: res.resource_type,
        region: res.region,
        title: `Potentially unused resource: ${res.resource_name || res.resource_id}`,
        description: `This ${res.service_name} resource has zero usage but costs $${cost.toFixed(2)}/month.`,
        action: `Verify if this resource is still needed. If not, terminate or delete it to save $${cost.toFixed(2)}/month.`,
        estimated_monthly_savings: cost,
        estimated_savings_percent: 100,
        confidence: 'medium',
        current_cost: cost,
        current_usage: 0,
        usage_unit: res.usage_unit,
        evidence: { resourceId: res.resource_id, usageType: res.usage_unit, region: res.region },
      })
    }
  }

  // Service-level: usage metrics showing zero usage for 7+ days
  const serviceUsageByKey = groupBy(usageMetrics, m => `${m.provider_id}:${m.service_name}:${m.account_id || 'all'}`)

  for (const [key, metrics] of Object.entries(serviceUsageByKey)) {
    const [providerId, serviceName, accountId] = key.split(':')
    if (metrics.length < 7) continue

    const recent7 = metrics
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 7)

    const allZeroUsage = recent7.every(m => parseFloat(m.usage_quantity || 0) === 0)
    const totalCost = recent7.reduce((s, m) => s + parseFloat(m.cost || 0), 0)

    if (allZeroUsage && totalCost > 5) {
      const monthlyCost = (totalCost / 7) * 30
      recs.push({
        provider_id: providerId,
        account_id: accountId !== 'all' ? parseInt(accountId) : null,
        category: 'idle_resource',
        subcategory: 'service_zero_usage',
        service_name: serviceName,
        title: `${serviceName} has zero usage for 7+ days`,
        description: `${serviceName} has been reporting zero usage for at least 7 consecutive days while still incurring costs (~$${monthlyCost.toFixed(2)}/month).`,
        action: `Review if ${serviceName} resources are still needed or can be shut down.`,
        estimated_monthly_savings: Math.round(monthlyCost * 100) / 100,
        estimated_savings_percent: 100,
        confidence: 'medium',
        current_cost: Math.round(monthlyCost * 100) / 100,
        evidence: { daysZero: 7, periodCost: totalCost },
      })
    }
  }

  return recs
}

// ─── Analyzer 3: Rightsizing ─────────────────────────────────────────

function analyzeRightsizing(context) {
  const recs = []
  const { resources } = context

  for (const res of resources) {
    const cost = parseFloat(res.cost || 0)
    if (cost <= 5) continue

    const usageUnit = (res.usage_unit || '').toLowerCase()
    const usageQty = parseFloat(res.usage_quantity || 0)
    const resourceType = res.resource_type || ''

    // EC2 instances: check if running less than 30% of month
    if (usageUnit.includes('boxusage') && usageQty > 0) {
      const monthHours = 730
      const utilization = (usageQty / monthHours) * 100

      if (utilization < 30 && utilization > 0) {
        recs.push({
          provider_id: res.provider_id,
          account_id: res.account_id,
          category: 'rightsizing',
          subcategory: 'low_utilization_instance',
          service_name: res.service_name,
          resource_id: res.resource_id,
          resource_name: res.resource_name,
          resource_type: resourceType,
          region: res.region,
          title: `Low utilization EC2 instance: ${resourceType || res.resource_id}`,
          description: `This instance runs only ${utilization.toFixed(0)}% of the time. Consider a smaller instance or Spot.`,
          action: `Downsize this instance or switch to a Spot/Reserved instance if the workload allows.`,
          estimated_monthly_savings: Math.round(cost * 0.4 * 100) / 100,
          estimated_savings_percent: 40,
          confidence: 'high',
          current_cost: cost,
          current_usage: usageQty,
          usage_unit: 'hours',
          evidence: { utilization, monthHours, instanceType: resourceType },
        })
      }
    }

    // Old-gen instance types
    const oldGenPatterns = [
      { pattern: /^m[34]\./i, replacement: 'm7g', savings: 20 },
      { pattern: /^m5\./i, replacement: 'm7g', savings: 15 },
      { pattern: /^c[34]\./i, replacement: 'c7g', savings: 20 },
      { pattern: /^c5\./i, replacement: 'c7g', savings: 15 },
      { pattern: /^r[34]\./i, replacement: 'r7g', savings: 20 },
      { pattern: /^r5\./i, replacement: 'r7g', savings: 15 },
      { pattern: /^t2\./i, replacement: 't4g', savings: 20 },
      { pattern: /^t3\./i, replacement: 't4g', savings: 10 },
    ]

    for (const { pattern, replacement, savings } of oldGenPatterns) {
      if (pattern.test(resourceType)) {
        const size = resourceType.split('.').pop()
        recs.push({
          provider_id: res.provider_id,
          account_id: res.account_id,
          category: 'rightsizing',
          subcategory: 'old_gen_instance',
          service_name: res.service_name,
          resource_id: res.resource_id,
          resource_name: res.resource_name,
          resource_type: resourceType,
          region: res.region,
          title: `Upgrade ${resourceType} to ${replacement}.${size}`,
          description: `${resourceType} is an older generation. Migrating to ${replacement}.${size} offers ~${savings}% cost savings with better performance.`,
          action: `Migrate this instance from ${resourceType} to ${replacement}.${size} (Graviton/current-gen).`,
          estimated_monthly_savings: Math.round(cost * (savings / 100) * 100) / 100,
          estimated_savings_percent: savings,
          confidence: 'high',
          current_cost: cost,
          evidence: { currentType: resourceType, suggestedType: `${replacement}.${size}` },
        })
        break
      }
    }
  }

  return recs
}

// ─── Analyzer 4: Reserved Instances / Savings Plans ──────────────────

function analyzeReservedInstances(context) {
  const recs = []
  const { resources, serviceCosts, providers } = context

  // CUR-based: check for on-demand resources running consistently
  const onDemandResources = resources.filter(r =>
    (r.usage_type || '').toLowerCase() === 'ondemand' && parseFloat(r.cost || 0) > 20
  )

  for (const res of onDemandResources) {
    const cost = parseFloat(res.cost || 0)
    recs.push({
      provider_id: res.provider_id,
      account_id: res.account_id,
      category: 'reserved_instance',
      subcategory: 'on_demand_to_ri',
      service_name: res.service_name,
      resource_id: res.resource_id,
      resource_name: res.resource_name,
      resource_type: res.resource_type,
      region: res.region,
      title: `RI/Savings Plan opportunity: ${res.resource_type || res.service_name}`,
      description: `This on-demand resource costs $${cost.toFixed(2)}/month. A 1-year Reserved Instance could save ~30%.`,
      action: `Purchase a 1-year Reserved Instance or Savings Plan for this ${res.resource_type || 'resource'}.`,
      estimated_monthly_savings: Math.round(cost * 0.3 * 100) / 100,
      estimated_savings_percent: 30,
      confidence: 'high',
      current_cost: cost,
      evidence: { pricingTerm: 'OnDemand', riSavings1yr: 30, riSavings3yr: 40 },
    })
  }

  // Service-level: stable costs for 3+ months suggest RI opportunity
  const servicesByKey = groupBy(serviceCosts, s => `${s.provider_id}:${s.service_name}:${s.account_id || 'all'}`)

  for (const [key, months] of Object.entries(servicesByKey)) {
    if (months.length < 3) continue
    const [providerId, serviceName, accountId] = key.split(':')

    // Only for compute/database services
    const computeServices = ['amazon elastic compute cloud', 'amazon relational database service', 'amazon elasticache', 'compute engine', 'virtual machines', 'cloud sql']
    if (!computeServices.some(s => serviceName.toLowerCase().includes(s.toLowerCase()))) continue

    const costs = months.map(m => parseFloat(m.cost || 0)).filter(c => c > 0)
    if (costs.length < 3) continue

    const avg = costs.reduce((s, c) => s + c, 0) / costs.length
    if (avg < 50) continue // skip small services

    const stdDev = Math.sqrt(costs.reduce((s, c) => s + Math.pow(c - avg, 2), 0) / costs.length)
    const cv = stdDev / avg // coefficient of variation

    if (cv < 0.15) { // < 15% variance = stable workload
      recs.push({
        provider_id: providerId,
        account_id: accountId !== 'all' ? parseInt(accountId) : null,
        category: 'reserved_instance',
        subcategory: 'stable_workload',
        service_name: serviceName,
        title: `Stable ${serviceName} spend — consider Reserved pricing`,
        description: `${serviceName} has consistent monthly costs (~$${avg.toFixed(2)}/month with ${(cv * 100).toFixed(0)}% variance). This workload pattern is ideal for Reserved Instances or Savings Plans.`,
        action: `Review ${serviceName} for 1-year or 3-year Reserved Instance/Savings Plan commitment to save ~30%.`,
        estimated_monthly_savings: Math.round(avg * 0.3 * 100) / 100,
        estimated_savings_percent: 30,
        confidence: 'medium',
        current_cost: Math.round(avg * 100) / 100,
        evidence: { avgMonthlyCost: avg, variance: cv, monthsAnalyzed: costs.length },
      })
    }
  }

  return recs
}

// ─── Analyzer 5: Storage Optimization ────────────────────────────────

function analyzeStorageOptimization(context) {
  const recs = []
  const { resources, serviceCosts } = context

  // CUR-based: gp2 EBS volumes → gp3 (20% cheaper)
  for (const res of resources) {
    const cost = parseFloat(res.cost || 0)
    if (cost <= 1) continue
    const usageUnit = (res.usage_unit || '').toLowerCase()

    if (usageUnit.includes('ebs:volumeusage.gp2') || usageUnit.includes('volumeusage.gp2')) {
      recs.push({
        provider_id: res.provider_id,
        account_id: res.account_id,
        category: 'storage_optimization',
        subcategory: 'gp2_to_gp3',
        service_name: res.service_name,
        resource_id: res.resource_id,
        resource_name: res.resource_name,
        resource_type: 'gp2',
        region: res.region,
        title: `Migrate EBS volume from gp2 to gp3`,
        description: `This gp2 EBS volume costs $${cost.toFixed(2)}/month. gp3 is 20% cheaper with better baseline performance.`,
        action: `Modify this EBS volume type from gp2 to gp3 via the AWS Console or CLI.`,
        estimated_monthly_savings: Math.round(cost * 0.2 * 100) / 100,
        estimated_savings_percent: 20,
        confidence: 'high',
        current_cost: cost,
        evidence: { currentType: 'gp2', suggestedType: 'gp3' },
      })
    }

    // EBS snapshots with high cost
    if (usageUnit.includes('ebs:snapshotusage') && cost > 10) {
      recs.push({
        provider_id: res.provider_id,
        account_id: res.account_id,
        category: 'storage_optimization',
        subcategory: 'snapshot_lifecycle',
        service_name: res.service_name,
        resource_id: res.resource_id,
        resource_name: res.resource_name,
        resource_type: 'EBS Snapshot',
        region: res.region,
        title: `High EBS snapshot costs: $${cost.toFixed(2)}/month`,
        description: `EBS snapshot storage is costing $${cost.toFixed(2)}/month. Old snapshots may no longer be needed.`,
        action: `Review and delete old EBS snapshots, or set up lifecycle policies with Amazon Data Lifecycle Manager.`,
        estimated_monthly_savings: Math.round(cost * 0.5 * 100) / 100,
        estimated_savings_percent: 50,
        confidence: 'medium',
        current_cost: cost,
        evidence: { snapshotCost: cost },
      })
    }
  }

  // Service-level: high S3 costs
  const s3Costs = serviceCosts.filter(s => s.service_name?.toLowerCase().includes('s3') || s.service_name?.toLowerCase().includes('simple storage'))
  if (s3Costs.length > 0) {
    const latestS3 = s3Costs[0]
    const s3Cost = parseFloat(latestS3.cost || 0)
    if (s3Cost > 50) {
      recs.push({
        provider_id: latestS3.provider_id,
        account_id: latestS3.account_id,
        category: 'storage_optimization',
        subcategory: 's3_lifecycle',
        service_name: latestS3.service_name,
        title: `S3 costs are $${s3Cost.toFixed(2)}/month — consider tiering`,
        description: `S3 storage costs are significant at $${s3Cost.toFixed(2)}/month. Intelligent-Tiering or lifecycle policies can reduce costs by 20-40%.`,
        action: `Enable S3 Intelligent-Tiering or configure lifecycle policies to move infrequently accessed data to cheaper storage classes.`,
        estimated_monthly_savings: Math.round(s3Cost * 0.25 * 100) / 100,
        estimated_savings_percent: 25,
        confidence: 'medium',
        current_cost: s3Cost,
        evidence: { monthlyS3Cost: s3Cost },
      })
    }
  }

  return recs
}

// ─── Analyzer 6: Data Transfer ───────────────────────────────────────

function analyzeDataTransfer(context) {
  const recs = []
  const { resources, serviceCosts } = context

  // CUR-based: data transfer line items
  for (const res of resources) {
    const cost = parseFloat(res.cost || 0)
    if (cost <= 10) continue
    const usageUnit = (res.usage_unit || '').toLowerCase()

    if (usageUnit.includes('datatransfer') && cost > 50) {
      const isRegional = usageUnit.includes('regional') || usageUnit.includes('inter')
      const isEgress = usageUnit.includes('-out-')

      recs.push({
        provider_id: res.provider_id,
        account_id: res.account_id,
        category: 'data_transfer',
        subcategory: isRegional ? 'cross_region' : (isEgress ? 'egress' : 'general'),
        service_name: res.service_name,
        resource_id: res.resource_id,
        resource_name: res.resource_name,
        region: res.region,
        title: `High data transfer cost: $${cost.toFixed(2)}/month`,
        description: `${isRegional ? 'Cross-region' : isEgress ? 'Internet egress' : 'Data transfer'} costs are $${cost.toFixed(2)}/month for ${res.service_name}.`,
        action: isRegional
          ? `Consider co-locating resources in the same region or using VPC endpoints to reduce cross-region transfer costs.`
          : `Consider using CloudFront or optimizing API responses to reduce egress costs.`,
        estimated_monthly_savings: Math.round(cost * 0.3 * 100) / 100,
        estimated_savings_percent: 30,
        confidence: 'medium',
        current_cost: cost,
        evidence: { transferType: isRegional ? 'cross_region' : isEgress ? 'egress' : 'general', usageUnit },
      })
    }
  }

  // Service-level: check if data transfer is disproportionate
  const totalCost = serviceCosts.reduce((s, sc) => s + parseFloat(sc.cost || 0), 0)
  if (totalCost > 0) {
    const transferCosts = serviceCosts.filter(s =>
      (s.service_name || '').toLowerCase().includes('data transfer') ||
      (s.service_name || '').toLowerCase().includes('cloudfront')
    )
    const transferTotal = transferCosts.reduce((s, sc) => s + parseFloat(sc.cost || 0), 0)
    const transferPercent = (transferTotal / totalCost) * 100

    if (transferPercent > 20 && transferTotal > 50) {
      recs.push({
        provider_id: transferCosts[0]?.provider_id || 'aws',
        account_id: transferCosts[0]?.account_id,
        category: 'data_transfer',
        subcategory: 'excessive_egress',
        title: `Data transfer is ${transferPercent.toFixed(0)}% of total costs`,
        description: `Data transfer costs ($${transferTotal.toFixed(2)}/month) represent ${transferPercent.toFixed(0)}% of total spend. This is unusually high.`,
        action: `Audit data transfer patterns. Consider VPC endpoints, CloudFront, or regional consolidation.`,
        estimated_monthly_savings: Math.round(transferTotal * 0.3 * 100) / 100,
        estimated_savings_percent: 30,
        confidence: 'medium',
        current_cost: Math.round(transferTotal * 100) / 100,
        evidence: { transferPercent, transferTotal, totalCost },
      })
    }
  }

  return recs
}

// ─── Analyzer 7: Service Best Practices ──────────────────────────────

function analyzeServiceBestPractices(context) {
  const recs = []
  const { resources, serviceCosts } = context

  // NAT Gateway: expensive if high cost
  for (const res of resources) {
    const cost = parseFloat(res.cost || 0)
    const usageUnit = (res.usage_unit || '').toLowerCase()

    if (usageUnit.includes('natgateway') && cost > 50) {
      recs.push({
        provider_id: res.provider_id,
        account_id: res.account_id,
        category: 'service_best_practice',
        subcategory: 'nat_gateway_cost',
        service_name: res.service_name,
        resource_id: res.resource_id,
        resource_name: res.resource_name,
        region: res.region,
        title: `NAT Gateway costs $${cost.toFixed(2)}/month`,
        description: `NAT Gateways have a fixed hourly cost plus per-GB data processing. VPC Endpoints for S3/DynamoDB can significantly reduce traffic through NAT.`,
        action: `Create VPC endpoints (Gateway type) for S3 and DynamoDB to route traffic directly, bypassing NAT Gateway.`,
        estimated_monthly_savings: Math.round(cost * 0.3 * 100) / 100,
        estimated_savings_percent: 30,
        confidence: 'medium',
        current_cost: cost,
        evidence: { natGatewayCost: cost },
      })
    }
  }

  // Service-level best practices for non-AWS providers
  const providerRules = [
    {
      providers: ['digitalocean', 'linode', 'vultr'],
      check: (serviceName, cost) => cost > 100,
      subcategory: 'review_plan_tier',
      titleFn: (svc, cost, provider) => `Review ${provider.toUpperCase()} ${svc} plan sizing`,
      descFn: (svc, cost, provider) => `${svc} costs $${cost.toFixed(2)}/month on ${provider.toUpperCase()}. Check if a smaller plan or different region offers better pricing.`,
      actionFn: (svc, provider) => `Review ${provider.toUpperCase()} plan tiers for ${svc} to see if a smaller or more cost-effective plan is available.`,
      savingsPercent: 15,
    },
  ]

  const latestMonth = serviceCosts.length > 0
    ? serviceCosts.reduce((latest, s) => {
        const key = s.year * 12 + s.month
        return key > latest ? key : latest
      }, 0)
    : 0

  const latestServices = serviceCosts.filter(s => (s.year * 12 + s.month) === latestMonth)

  for (const svc of latestServices) {
    const cost = parseFloat(svc.cost || 0)
    for (const rule of providerRules) {
      if (rule.providers.includes(svc.provider_id) && rule.check(svc.service_name, cost)) {
        recs.push({
          provider_id: svc.provider_id,
          account_id: svc.account_id,
          category: 'service_best_practice',
          subcategory: rule.subcategory,
          service_name: svc.service_name,
          title: rule.titleFn(svc.service_name, cost, svc.provider_id),
          description: rule.descFn(svc.service_name, cost, svc.provider_id),
          action: rule.actionFn(svc.service_name, svc.provider_id),
          estimated_monthly_savings: Math.round(cost * (rule.savingsPercent / 100) * 100) / 100,
          estimated_savings_percent: rule.savingsPercent,
          confidence: 'low',
          current_cost: cost,
          evidence: { provider: svc.provider_id, serviceName: svc.service_name },
        })
      }
    }
  }

  return recs
}

// ─── Analyzer 8: Cross-Provider Comparison ───────────────────────────

function analyzeCrossProvider(context) {
  const recs = []
  const { serviceCosts } = context

  // Map services to generic categories
  const categoryMap = {
    compute: ['elastic compute', 'ec2', 'compute engine', 'virtual machines', 'droplet', 'linode', 'vultr compute', 'bare metal'],
    storage: ['s3', 'simple storage', 'cloud storage', 'blob storage', 'spaces', 'object storage'],
    database: ['rds', 'relational database', 'cloud sql', 'azure sql', 'managed database', 'cosmos'],
    network: ['cloudfront', 'cloud cdn', 'azure cdn', 'load balancing', 'cloud load'],
  }

  // Get latest month per provider
  const providerCostsByCategory = {}

  const latestMonth = serviceCosts.length > 0
    ? serviceCosts.reduce((latest, s) => {
        const key = s.year * 12 + s.month
        return key > latest ? key : latest
      }, 0)
    : 0

  const latestServices = serviceCosts.filter(s => (s.year * 12 + s.month) === latestMonth)

  for (const svc of latestServices) {
    const svcNameLower = (svc.service_name || '').toLowerCase()
    const cost = parseFloat(svc.cost || 0)
    if (cost <= 0) continue

    for (const [category, keywords] of Object.entries(categoryMap)) {
      if (keywords.some(kw => svcNameLower.includes(kw))) {
        if (!providerCostsByCategory[category]) providerCostsByCategory[category] = {}
        if (!providerCostsByCategory[category][svc.provider_id]) providerCostsByCategory[category][svc.provider_id] = 0
        providerCostsByCategory[category][svc.provider_id] += cost
        break
      }
    }
  }

  // Compare providers within each category
  for (const [category, providerCosts] of Object.entries(providerCostsByCategory)) {
    const providers = Object.entries(providerCosts).sort((a, b) => b[1] - a[1])
    if (providers.length < 2) continue

    const [expensiveProvider, expensiveCost] = providers[0]
    const [cheaperProvider, cheaperCost] = providers[providers.length - 1]

    if (cheaperCost <= 0) continue
    const disparity = ((expensiveCost - cheaperCost) / cheaperCost) * 100

    if (disparity > 50 && expensiveCost > 50) {
      recs.push({
        provider_id: expensiveProvider,
        category: 'cross_provider',
        subcategory: `${category}_disparity`,
        title: `${category.charAt(0).toUpperCase() + category.slice(1)} costs vary across providers`,
        description: `${expensiveProvider.toUpperCase()} ${category} costs $${expensiveCost.toFixed(2)}/month vs $${cheaperCost.toFixed(2)}/month on ${cheaperProvider.toUpperCase()} — ${disparity.toFixed(0)}% higher.`,
        action: `Evaluate if some ${category} workloads could be moved to ${cheaperProvider.toUpperCase()} for cost savings, considering feature requirements.`,
        estimated_monthly_savings: Math.round((expensiveCost - cheaperCost) * 0.3 * 100) / 100,
        estimated_savings_percent: Math.round(disparity * 0.3),
        confidence: 'low',
        current_cost: expensiveCost,
        evidence: { category, providerCosts, disparity },
      })
    }
  }

  return recs
}

// ─── Priority Scoring ────────────────────────────────────────────────

function scorePriority(rec) {
  let score = 0

  // Savings magnitude (0-40 points)
  const savings = rec.estimated_monthly_savings || 0
  if (savings >= 500) score += 40
  else if (savings >= 100) score += 30
  else if (savings >= 50) score += 20
  else if (savings >= 10) score += 10

  // Confidence (0-30 points)
  if (rec.confidence === 'high') score += 30
  else if (rec.confidence === 'medium') score += 15
  else score += 5

  // Category actionability (0-20 points)
  const categoryWeights = {
    idle_resource: 20,
    reserved_instance: 18,
    storage_optimization: 15,
    rightsizing: 15,
    data_transfer: 12,
    service_best_practice: 10,
    cost_trend: 8,
    cross_provider: 5,
  }
  score += categoryWeights[rec.category] || 5

  // Map score to priority
  if (score >= 70) return 'critical'
  if (score >= 50) return 'high'
  if (score >= 30) return 'medium'
  return 'low'
}

// ─── AI Enrichment (Cost-Optimized) ──────────────────────────────────

async function enrichRecommendationsWithAI(recommendations, context) {
  if (recommendations.length === 0) return recommendations

  // Only enrich critical/high priority recommendations
  const toEnrich = recommendations.filter(r => r.priority === 'critical' || r.priority === 'high')
  if (toEnrich.length === 0) return recommendations

  // Check if data has changed by hashing
  const dataHash = crypto.createHash('md5')
    .update(toEnrich.map(r => `${r.category}:${r.subcategory}:${r.service_name}:${r.resource_id}:${r.current_cost}`).join('|'))
    .digest('hex')

  // Check cached hash
  const cacheKey = `optimization-ai-hash:${context.userId}`
  const cachedHash = await cache.get(cacheKey)
  if (cachedHash === dataHash) {
    logger.debug('AI enrichment skipped — data unchanged', { userId: context.userId })
    return recommendations
  }

  try {
    const systemPrompt = `You are a cloud cost optimization expert. For each recommendation below, generate:
1. A clear 1-2 sentence "description" explaining WHY this matters to the user's business (reference the actual dollar amounts)
2. A specific 1-2 sentence "action" explaining HOW to fix it

Return ONLY a valid JSON array of objects with "index" (0-based), "description", and "action" fields. No other text.`

    const recSummaries = toEnrich.map((r, i) => ({
      index: i,
      category: r.category,
      title: r.title,
      service: r.service_name,
      resource: r.resource_id,
      cost: r.current_cost,
      savings: r.estimated_monthly_savings,
    }))

    const responseText = await callClaude(
      systemPrompt,
      `Generate descriptions and actions for these ${toEnrich.length} recommendations:\n\n${JSON.stringify(recSummaries)}`,
      1024
    )

    if (responseText) {
      const jsonMatch = responseText.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        const aiResults = JSON.parse(jsonMatch[0])
        for (const aiRec of aiResults) {
          const idx = aiRec.index
          if (idx >= 0 && idx < toEnrich.length) {
            toEnrich[idx].description = aiRec.description || toEnrich[idx].description
            toEnrich[idx].action = aiRec.action || toEnrich[idx].action
            if (!toEnrich[idx].evidence) toEnrich[idx].evidence = {}
            toEnrich[idx].evidence.ai_enhanced = true
            toEnrich[idx].evidence.data_hash = dataHash
          }
        }
      }
      // Cache the hash for 24 hours
      await cache.set(cacheKey, dataHash, 86400)
    }
  } catch (error) {
    logger.warn('AI enrichment failed (using template descriptions)', { userId: context.userId, error: error.message })
  }

  return recommendations
}

// ─── Helpers ─────────────────────────────────────────────────────────

function groupBy(arr, keyFn) {
  const map = {}
  for (const item of arr) {
    const key = keyFn(item)
    if (!map[key]) map[key] = []
    map[key].push(item)
  }
  return map
}

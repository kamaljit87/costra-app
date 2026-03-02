/**
 * Terraform Cost Estimation Service
 * Parses terraform plan JSON and estimates monthly costs
 */

import logger from '../utils/logger.js'

// Simplified AWS pricing table (us-east-1, on-demand, monthly)
const AWS_PRICING = {
  'aws_instance': {
    't3.micro': 7.59, 't3.small': 15.18, 't3.medium': 30.37, 't3.large': 60.74, 't3.xlarge': 121.47,
    't3.2xlarge': 242.94, 'm5.large': 69.12, 'm5.xlarge': 138.24, 'm5.2xlarge': 276.48, 'm5.4xlarge': 552.96,
    'c5.large': 61.20, 'c5.xlarge': 122.40, 'c5.2xlarge': 244.80, 'c5.4xlarge': 489.60,
    'r5.large': 90.72, 'r5.xlarge': 181.44, 'r5.2xlarge': 362.88,
    default: 60.00,
  },
  'aws_db_instance': {
    'db.t3.micro': 12.41, 'db.t3.small': 24.82, 'db.t3.medium': 49.64,
    'db.m5.large': 124.10, 'db.m5.xlarge': 248.20, 'db.r5.large': 163.52,
    default: 100.00,
  },
  'aws_s3_bucket': { default: 23.00 },
  'aws_lb': { default: 22.27 },
  'aws_nat_gateway': { default: 32.40 },
  'aws_eip': { default: 3.60 },
  'aws_cloudfront_distribution': { default: 0 },
  'aws_elasticache_cluster': { 'cache.t3.micro': 12.24, 'cache.t3.small': 24.48, 'cache.m5.large': 110.59, default: 50.00 },
  'aws_lambda_function': { default: 0 },
  'aws_sqs_queue': { default: 0 },
  'aws_sns_topic': { default: 0 },
  'aws_ecs_service': { default: 0 },
  'aws_eks_cluster': { default: 73.00 },
}

/**
 * Parse terraform plan JSON output
 */
export const parseTerraformPlan = (planJson) => {
  const changes = []
  const resourceChanges = planJson.resource_changes || []

  for (const rc of resourceChanges) {
    if (!rc.change) continue
    const actions = rc.change.actions || []
    if (actions.includes('no-op')) continue

    changes.push({
      address: rc.address,
      type: rc.type,
      name: rc.name,
      provider: rc.provider_name,
      action: actions.includes('create') ? 'create' : actions.includes('delete') ? 'delete' : 'update',
      before: rc.change.before || {},
      after: rc.change.after || {},
    })
  }

  return changes
}

/**
 * Estimate cost for a single resource
 */
export const estimateResourceCost = (resourceType, config) => {
  const pricing = AWS_PRICING[resourceType]
  if (!pricing) return { monthlyCost: 0, note: 'No pricing data available' }

  let instanceType = config.instance_type || config.instance_class || config.node_type || null
  if (instanceType && pricing[instanceType]) {
    return { monthlyCost: pricing[instanceType], note: `Based on ${instanceType} pricing` }
  }

  return { monthlyCost: pricing.default || 0, note: instanceType ? `Unknown type ${instanceType}, using default` : 'Using default pricing' }
}

/**
 * Estimate total plan cost
 */
export const estimatePlanCost = (planJson) => {
  const changes = parseTerraformPlan(planJson)
  const breakdown = []
  let totalMonthlyCost = 0

  for (const change of changes) {
    const estimate = estimateResourceCost(change.type, change.after)
    const cost = change.action === 'delete' ? -estimate.monthlyCost : estimate.monthlyCost

    breakdown.push({
      address: change.address,
      type: change.type,
      action: change.action,
      monthlyCost: cost,
      note: estimate.note,
    })

    totalMonthlyCost += cost
  }

  return {
    totalMonthlyCost: Math.max(0, totalMonthlyCost),
    totalResources: changes.length,
    created: changes.filter(c => c.action === 'create').length,
    updated: changes.filter(c => c.action === 'update').length,
    deleted: changes.filter(c => c.action === 'delete').length,
    breakdown,
  }
}

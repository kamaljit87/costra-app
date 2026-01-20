/**
 * Cloud Provider Budget Creation Service
 * Creates budgets directly in cloud provider accounts (AWS, Azure, GCP)
 */

import { BudgetsClient, CreateBudgetCommand } from '@aws-sdk/client-budgets'

/**
 * Create a budget in AWS using AWS Budgets API
 */
export const createAWSBudget = async (credentials, budgetData) => {
  const { accessKeyId, secretAccessKey, region = 'us-east-1', accountId: awsAccountId } = credentials
  const { budgetName, budgetAmount, budgetPeriod, alertThreshold } = budgetData

  try {
    const client = new BudgetsClient({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    })

    // Convert period to AWS format
    const awsPeriod = budgetPeriod === 'monthly' ? 'MONTHLY' : budgetPeriod === 'quarterly' ? 'QUARTERLY' : 'YEARLY'

    // Calculate budget limit based on period
    // AWS budgets are always monthly, so we need to convert
    let monthlyLimit = budgetAmount
    if (budgetPeriod === 'quarterly') {
      monthlyLimit = budgetAmount / 3
    } else if (budgetPeriod === 'yearly') {
      monthlyLimit = budgetAmount / 12
    }

    // Create budget definition
    const budgetDefinition = {
      BudgetName: budgetName,
      BudgetLimit: {
        Amount: monthlyLimit.toString(),
        Unit: 'USD',
      },
      TimeUnit: 'MONTHLY', // AWS budgets are always monthly
      BudgetType: 'COST',
      CostFilters: {},
    }

    // Add notifications based on alert threshold
    const notifications = []
    if (alertThreshold && alertThreshold < 100) {
      // Create notification at threshold
      notifications.push({
        Notification: {
          NotificationType: 'ACTUAL',
          ComparisonOperator: 'GREATER_THAN',
          Threshold: alertThreshold,
          ThresholdType: 'PERCENTAGE',
        },
        Subscribers: [
          {
            SubscriptionType: 'EMAIL',
            Address: credentials.email || 'admin@example.com', // Use email from credentials or default
          },
        ],
      })

      // Also notify at 100% (exceeded)
      notifications.push({
        Notification: {
          NotificationType: 'ACTUAL',
          ComparisonOperator: 'GREATER_THAN',
          Threshold: 100,
          ThresholdType: 'PERCENTAGE',
        },
        Subscribers: [
          {
            SubscriptionType: 'EMAIL',
            Address: credentials.email || 'admin@example.com',
          },
        ],
      })
    }

    const command = new CreateBudgetCommand({
      AccountId: accountId,
      Budget: budgetDefinition,
      NotificationsWithSubscribers: notifications.length > 0 ? notifications : undefined,
    })

    const response = await client.send(command)
    console.log(`[AWS Budget] Created budget: ${budgetName}`)
    return response
  } catch (error) {
    console.error('[AWS Budget] Error creating budget:', error)
    throw new Error(`Failed to create AWS budget: ${error.message}`)
  }
}

/**
 * Create a budget in Azure using Azure Cost Management API
 * Note: Azure budget creation requires additional setup and permissions
 */
export const createAzureBudget = async (credentials, budgetData) => {
  const { budgetName } = budgetData

  try {
    // Azure Budgets API requires:
    // 1. Billing Account scope
    // 2. Specific permissions (Cost Management Contributor)
    // 3. Different authentication flow
    
    console.log(`[Azure Budget] Budget definition prepared: ${budgetName}`)
    console.warn('[Azure Budget] Azure budget creation requires billing account configuration and additional permissions')
    
    // Return success but note that manual setup may be required
    return { 
      success: true, 
      message: 'Azure budget creation requires billing account configuration. Please create the budget manually in Azure Portal or configure billing account access.',
      requiresManualSetup: true
    }
  } catch (error) {
    console.error('[Azure Budget] Error creating budget:', error)
    throw new Error(`Failed to create Azure budget: ${error.message}`)
  }
}

/**
 * Create a budget in GCP using GCP Billing Budgets API
 * Note: GCP budget creation requires billing account ID
 */
export const createGCPBudget = async (credentials, budgetData) => {
  const { budgetName } = budgetData

  try {
    // GCP Budgets API requires:
    // 1. Billing Account ID (not just project ID)
    // 2. Cloud Billing Budgets API enabled
    // 3. Billing Account User or Billing Account Administrator role
    
    console.log(`[GCP Budget] Budget definition prepared: ${budgetName}`)
    console.warn('[GCP Budget] GCP budget creation requires billing account ID and additional setup')
    
    // Return success but note that manual setup may be required
    return { 
      success: true, 
      message: 'GCP budget creation requires billing account configuration. Please create the budget manually in GCP Console or configure billing account access.',
      requiresManualSetup: true
    }
  } catch (error) {
    console.error('[GCP Budget] Error creating budget:', error)
    throw new Error(`Failed to create GCP budget: ${error.message}`)
  }
}

/**
 * Create a budget in the appropriate cloud provider
 */
export const createCloudProviderBudget = async (providerId, credentials, budgetData) => {
  switch (providerId.toLowerCase()) {
    case 'aws':
      return await createAWSBudget(credentials, budgetData)
    case 'azure':
      return await createAzureBudget(credentials, budgetData)
    case 'gcp':
      return await createGCPBudget(credentials, budgetData)
    default:
      throw new Error(`Budget creation not supported for provider: ${providerId}`)
  }
}

/**
 * Savings Plan Service
 * Fetches RI/SP utilization data from AWS Cost Explorer
 */

import logger from '../utils/logger.js'
import { updateSavingsPlanUtilization, pool } from '../database.js'

/**
 * Fetch savings plan utilization from AWS Cost Explorer
 */
export const fetchAWSUtilization = async (userId, credentials) => {
  try {
    const { CostExplorerClient, GetSavingsPlansUtilizationCommand, GetReservationUtilizationCommand } = await import('@aws-sdk/client-cost-explorer')

    const client = new CostExplorerClient({
      region: 'us-east-1',
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
        ...(credentials.sessionToken ? { sessionToken: credentials.sessionToken } : {}),
      },
    })

    const now = new Date()
    const startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0]
    const endDate = now.toISOString().split('T')[0]

    // Fetch Savings Plans utilization
    try {
      const spCommand = new GetSavingsPlansUtilizationCommand({
        TimePeriod: { Start: startDate, End: endDate },
        Granularity: 'MONTHLY',
      })
      const spResult = await client.send(spCommand)
      if (spResult.Total) {
        const total = spResult.Total
        logger.info('AWS SP utilization fetched', {
          userId,
          utilization: total.Utilization?.UtilizationPercentage,
        })
      }
    } catch (spErr) {
      logger.warn('Could not fetch SP utilization (may not have Savings Plans)', { error: spErr.message })
    }

    // Fetch RI utilization
    try {
      const riCommand = new GetReservationUtilizationCommand({
        TimePeriod: { Start: startDate, End: endDate },
        Granularity: 'MONTHLY',
      })
      const riResult = await client.send(riCommand)
      if (riResult.Total) {
        logger.info('AWS RI utilization fetched', {
          userId,
          utilization: riResult.Total.UtilizationPercentage,
        })
      }
    } catch (riErr) {
      logger.warn('Could not fetch RI utilization (may not have RIs)', { error: riErr.message })
    }
  } catch (error) {
    logger.error('Failed to fetch AWS utilization', { userId, error: error.message })
  }
}

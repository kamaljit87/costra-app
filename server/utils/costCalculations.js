import { fetchProviderCostData, getDateRange } from '../services/cloudProviderIntegrations.js'
import logger from './logger.js'

/**
 * Calculate forecast based on trend analysis
 * Uses linear regression on recent daily data to predict future costs
 */
export const calculateForecastFromTrend = (dailyData, currentMonth) => {
  if (!dailyData || dailyData.length < 7) {
    // Not enough data for trend analysis, use simple projection
    // Project based on days elapsed in month
    const now = new Date()
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const daysElapsed = now.getDate()
    
    if (daysElapsed > 0) {
      const dailyAverage = currentMonth / daysElapsed
      return dailyAverage * daysInMonth
    }
    
    // Fallback: 10% increase if no data
    return currentMonth * 1.1
  }

  // Get last 30 days of data for trend analysis
  const recentData = dailyData.slice(-30).filter(d => d.cost > 0)
  
  if (recentData.length < 7) {
    // Not enough recent data, use simple projection
    const now = new Date()
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const daysElapsed = now.getDate()
    
    if (daysElapsed > 0) {
      const dailyAverage = currentMonth / daysElapsed
      return dailyAverage * daysInMonth
    }
    
    return currentMonth * 1.1
  }

  // Calculate linear regression
  let sumX = 0
  let sumY = 0
  let sumXY = 0
  let sumX2 = 0
  const n = recentData.length

  recentData.forEach((day, index) => {
    const x = index
    const y = day.cost
    sumX += x
    sumY += y
    sumXY += x * y
    sumX2 += x * x
  })

  // Calculate slope (m) and intercept (b) for y = mx + b
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
  const intercept = (sumY - slope * sumX) / n

  // Project to end of month
  const now = new Date()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const daysElapsed = now.getDate()
  const daysRemaining = daysInMonth - daysElapsed

  // Use trend to predict remaining days
  const predictedRemaining = Math.max(0, daysRemaining * (slope * (n - 1) + intercept))
  const forecast = currentMonth + predictedRemaining

  // Ensure forecast is reasonable (not negative, not more than 10x current)
  if (forecast < 0) {
    return currentMonth * 1.1
  }
  if (forecast > currentMonth * 10) {
    logger.warn('Forecast seems unreasonably high, capping at 3x current month', {
      forecast,
      currentMonth,
      slope,
    })
    return currentMonth * 3
  }

  return forecast
}

/**
 * Fetch last month's actual cost data
 */
export const fetchLastMonthData = async (providerId, credentials, currentYear, currentMonth) => {
  try {
    // Calculate last month's date range
    const lastMonthDate = new Date(currentYear, currentMonth - 2, 1) // Month is 0-indexed, so -2 for last month
    const lastMonthYear = lastMonthDate.getFullYear()
    const lastMonthNum = lastMonthDate.getMonth() + 1
    const daysInLastMonth = new Date(lastMonthYear, lastMonthNum, 0).getDate()

    const lastMonthStart = `${lastMonthYear}-${String(lastMonthNum).padStart(2, '0')}-01`
    const lastMonthEnd = `${lastMonthYear}-${String(lastMonthNum).padStart(2, '0')}-${String(daysInLastMonth).padStart(2, '0')}`

    logger.debug('Fetching last month data', {
      providerId,
      lastMonthStart,
      lastMonthEnd,
      lastMonthYear,
      lastMonthNum,
    })

    // Fetch last month's data
    const lastMonthData = await fetchProviderCostData(
      providerId,
      credentials,
      lastMonthStart,
      lastMonthEnd
    )

    // Return the total cost for last month
    // Use currentMonth from the response as it represents the full month
    const lastMonthTotal = lastMonthData.currentMonth || 0

    logger.debug('Last month data fetched', {
      providerId,
      lastMonthTotal,
      lastMonthStart,
      lastMonthEnd,
    })

    return lastMonthTotal
  } catch (error) {
    logger.warn('Failed to fetch last month data', {
      providerId,
      error: error.message,
      currentYear,
      currentMonth,
    })
    // Return null to indicate data is not available (not a guess)
    return null
  }
}

/**
 * Enhance cost data with accurate lastMonth and forecast
 */
export const enhanceCostData = async (costData, providerId, credentials, currentYear, currentMonth, dailyData = null) => {
  const enhanced = { ...costData }

  // Fetch actual lastMonth data if not provided
  if (enhanced.lastMonth === null || enhanced.lastMonth === undefined) {
    logger.debug('Fetching last month data for accurate comparison', { providerId })
    enhanced.lastMonth = await fetchLastMonthData(providerId, credentials, currentYear, currentMonth)
  }

  // Calculate forecast from trend if not provided
  if (enhanced.forecast === null || enhanced.forecast === undefined) {
    logger.debug('Calculating forecast from trend', { providerId })
    const dataToUse = dailyData || enhanced.dailyData || []
    enhanced.forecast = calculateForecastFromTrend(dataToUse, enhanced.currentMonth || 0)
  }

  return enhanced
}

export default {
  calculateForecastFromTrend,
  fetchLastMonthData,
  enhanceCostData,
}

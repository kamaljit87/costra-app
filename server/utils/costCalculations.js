import { fetchProviderCostData, getDateRange } from '../services/cloudProviderIntegrations.js'
import logger from './logger.js'

/**
 * Calculate forecast based on weighted trend analysis
 * Uses exponentially weighted linear regression on recent daily data
 * Returns { forecast, confidence } where confidence is 0-100
 */
export const calculateForecastFromTrend = (dailyData, currentMonth) => {
  const now = new Date()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const daysElapsed = now.getDate()
  const daysRemaining = daysInMonth - daysElapsed

  // If no remaining days, forecast = current month actual
  if (daysRemaining <= 0) {
    return { forecast: currentMonth, confidence: 100 }
  }

  if (!dailyData || dailyData.length < 3) {
    // Very little data — simple daily average projection
    if (daysElapsed > 0 && currentMonth > 0) {
      const dailyAvg = currentMonth / daysElapsed
      return { forecast: dailyAvg * daysInMonth, confidence: 15 }
    }
    return { forecast: currentMonth, confidence: 5 }
  }

  // Get last 30 days of data for trend analysis
  const recentData = dailyData.slice(-30).filter(d => d.cost != null && d.cost >= 0)

  if (recentData.length < 3) {
    // Fallback: 7-day moving average projection
    const last7 = dailyData.slice(-7).filter(d => d.cost > 0)
    if (last7.length > 0) {
      const avg7 = last7.reduce((s, d) => s + d.cost, 0) / last7.length
      return { forecast: currentMonth + avg7 * daysRemaining, confidence: 25 }
    }
    if (daysElapsed > 0 && currentMonth > 0) {
      const dailyAvg = currentMonth / daysElapsed
      return { forecast: dailyAvg * daysInMonth, confidence: 15 }
    }
    return { forecast: currentMonth, confidence: 5 }
  }

  // Exponentially weighted linear regression
  // Recent data points get higher weight (decay factor 0.95)
  const DECAY = 0.95
  const n = recentData.length

  let sumW = 0, sumWX = 0, sumWY = 0, sumWXY = 0, sumWX2 = 0

  recentData.forEach((day, index) => {
    const w = Math.pow(DECAY, n - 1 - index) // More recent = higher weight
    const x = index
    const y = day.cost
    sumW += w
    sumWX += w * x
    sumWY += w * y
    sumWXY += w * x * y
    sumWX2 += w * x * x
  })

  const denominator = sumW * sumWX2 - sumWX * sumWX
  let slope, intercept

  if (Math.abs(denominator) < 1e-10) {
    // Degenerate case — flat line
    slope = 0
    intercept = sumWY / sumW
  } else {
    slope = (sumW * sumWXY - sumWX * sumWY) / denominator
    intercept = (sumWY - slope * sumWX) / sumW
  }

  // Project remaining days using the trend
  const lastIndex = n - 1
  let projectedRemaining = 0
  for (let i = 1; i <= daysRemaining; i++) {
    const predictedDay = slope * (lastIndex + i) + intercept
    projectedRemaining += Math.max(0, predictedDay)
  }

  let forecast = currentMonth + projectedRemaining

  // Calculate R-squared for confidence
  const meanY = sumWY / sumW
  let ssTot = 0, ssRes = 0
  recentData.forEach((day, index) => {
    const w = Math.pow(DECAY, n - 1 - index)
    const predicted = slope * index + intercept
    ssTot += w * (day.cost - meanY) ** 2
    ssRes += w * (day.cost - predicted) ** 2
  })
  const rSquared = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : 0

  // Calculate coefficient of variation (lower = more predictable)
  const costs = recentData.map(d => d.cost)
  const mean = costs.reduce((s, c) => s + c, 0) / costs.length
  const variance = costs.reduce((s, c) => s + (c - mean) ** 2, 0) / costs.length
  const cv = mean > 0 ? Math.sqrt(variance) / mean : 1

  // Confidence score (0-100) based on:
  // - Data point count (more data = higher confidence)
  // - R-squared of regression (better fit = higher confidence)
  // - Coefficient of variation (lower variance = higher confidence)
  const dataScore = Math.min(1, n / 20) * 30          // up to 30 points for data quantity
  const fitScore = rSquared * 40                        // up to 40 points for regression fit
  const stabilityScore = Math.max(0, 1 - cv) * 30     // up to 30 points for low variance
  const confidence = Math.round(Math.min(100, Math.max(5, dataScore + fitScore + stabilityScore)))

  // Sanity bounds with logarithmic dampening
  if (forecast < 0) {
    forecast = currentMonth
  } else if (currentMonth > 0 && forecast > currentMonth * 5) {
    // Logarithmic dampening: softly cap extreme forecasts
    const ratio = forecast / currentMonth
    const dampened = 5 + Math.log(ratio / 5) // logarithmic above 5x
    forecast = currentMonth * dampened
    logger.warn('Forecast dampened (was unreasonably high)', {
      originalForecast: currentMonth + projectedRemaining,
      dampenedForecast: forecast,
      currentMonth,
      slope,
    })
  }

  return { forecast, confidence }
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
    const result = calculateForecastFromTrend(dataToUse, enhanced.currentMonth || 0)
    enhanced.forecast = result.forecast
    enhanced.forecastConfidence = result.confidence
  }

  return enhanced
}

export default {
  calculateForecastFromTrend,
  fetchLastMonthData,
  enhanceCostData,
}

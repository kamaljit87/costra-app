/**
 * Holt-Winters Triple Exponential Smoothing
 * Handles level, trend, and weekly seasonality for cost anomaly detection.
 */

/**
 * Initialize seasonal components from the first complete season of data.
 * @param {number[]} data - Time series values
 * @param {number} seasonLength - Season length (default 7 for weekly)
 * @returns {number[]} Initial seasonal indices
 */
function initSeasonalComponents(data, seasonLength) {
  const seasons = Math.floor(data.length / seasonLength)
  if (seasons < 1) {
    return new Array(seasonLength).fill(0)
  }

  // Calculate averages for each season
  const seasonAvgs = []
  for (let i = 0; i < seasons; i++) {
    let sum = 0
    for (let j = 0; j < seasonLength; j++) {
      sum += data[i * seasonLength + j]
    }
    seasonAvgs.push(sum / seasonLength)
  }

  // Calculate seasonal indices as deviations from season averages
  const seasonal = new Array(seasonLength).fill(0)
  for (let i = 0; i < seasonLength; i++) {
    let sum = 0
    for (let j = 0; j < seasons; j++) {
      const avg = seasonAvgs[j] || 1
      sum += (data[j * seasonLength + i] - avg)
    }
    seasonal[i] = sum / seasons
  }

  return seasonal
}

/**
 * Perform Holt-Winters triple exponential smoothing (additive model).
 *
 * @param {number[]} data - Historical daily cost values (oldest first)
 * @param {object} [options] - Smoothing parameters
 * @param {number} [options.alpha=0.3] - Level smoothing (0-1)
 * @param {number} [options.beta=0.1] - Trend smoothing (0-1)
 * @param {number} [options.gamma=0.3] - Seasonal smoothing (0-1)
 * @param {number} [options.seasonLength=7] - Season length (7 = weekly)
 * @param {number} [options.forecastSteps=7] - Steps to forecast ahead
 * @returns {{ fitted: number[], forecast: number[], level: number, trend: number, seasonal: number[], residuals: number[] }}
 */
export function holtWinters(data, options = {}) {
  const {
    alpha = 0.3,
    beta = 0.1,
    gamma = 0.3,
    seasonLength = 7,
    forecastSteps = 7,
  } = options

  if (!data || data.length < seasonLength + 2) {
    // Not enough data — fall back to simple average
    const avg = data && data.length > 0 ? data.reduce((a, b) => a + b, 0) / data.length : 0
    return {
      fitted: data ? data.map(() => avg) : [],
      forecast: new Array(forecastSteps).fill(avg),
      level: avg,
      trend: 0,
      seasonal: new Array(seasonLength).fill(0),
      residuals: data ? data.map(v => v - avg) : [],
    }
  }

  // Initialize
  const seasonal = initSeasonalComponents(data, seasonLength)
  let level = data.slice(0, seasonLength).reduce((a, b) => a + b, 0) / seasonLength
  let trend = 0
  if (data.length >= 2 * seasonLength) {
    const firstSeasonAvg = data.slice(0, seasonLength).reduce((a, b) => a + b, 0) / seasonLength
    const secondSeasonAvg = data.slice(seasonLength, 2 * seasonLength).reduce((a, b) => a + b, 0) / seasonLength
    trend = (secondSeasonAvg - firstSeasonAvg) / seasonLength
  }

  const fitted = []
  const residuals = []

  // Smoothing pass
  for (let i = 0; i < data.length; i++) {
    const value = data[i]
    const seasonIdx = i % seasonLength
    const prevLevel = level
    const prevTrend = trend

    // Update level
    level = alpha * (value - seasonal[seasonIdx]) + (1 - alpha) * (prevLevel + prevTrend)

    // Update trend
    trend = beta * (level - prevLevel) + (1 - beta) * prevTrend

    // Update seasonal
    seasonal[seasonIdx] = gamma * (value - level) + (1 - gamma) * seasonal[seasonIdx]

    const fittedValue = level + trend + seasonal[seasonIdx]
    fitted.push(fittedValue)
    residuals.push(value - fittedValue)
  }

  // Forecast
  const forecast = []
  for (let i = 1; i <= forecastSteps; i++) {
    const seasonIdx = (data.length + i - 1) % seasonLength
    forecast.push(level + trend * i + seasonal[seasonIdx])
  }

  return { fitted, forecast, level, trend, seasonal, residuals }
}

/**
 * Detect anomalies using Holt-Winters residuals.
 * An anomaly is a point where the residual exceeds a threshold based on
 * the standard deviation of residuals.
 *
 * @param {number[]} data - Historical daily cost values (oldest first)
 * @param {object} [options] - Detection options
 * @param {number} [options.sensitivityMultiplier=2.5] - Std dev multiplier for threshold
 * @param {number} [options.seasonLength=7] - Season length
 * @returns {{ anomalies: Array<{ index: number, value: number, expected: number, variance: number, type: string }>, model: object }}
 */
export function detectAnomaliesHW(data, options = {}) {
  const { sensitivityMultiplier = 2.5, seasonLength = 7 } = options

  const model = holtWinters(data, { seasonLength, forecastSteps: 1 })

  // Calculate residual standard deviation
  const validResiduals = model.residuals.filter(r => !isNaN(r) && isFinite(r))
  if (validResiduals.length < 3) {
    return { anomalies: [], model }
  }

  const mean = validResiduals.reduce((a, b) => a + b, 0) / validResiduals.length
  const variance = validResiduals.reduce((a, b) => a + (b - mean) ** 2, 0) / validResiduals.length
  const stdDev = Math.sqrt(variance)
  const threshold = stdDev * sensitivityMultiplier

  const anomalies = []
  // Only check recent points (last 7 days)
  const startIdx = Math.max(0, data.length - 7)
  for (let i = startIdx; i < data.length; i++) {
    const residual = model.residuals[i]
    if (Math.abs(residual) > threshold && threshold > 0) {
      const expected = model.fitted[i]
      const actual = data[i]
      const variancePercent = expected !== 0 ? ((actual - expected) / expected) * 100 : 0
      anomalies.push({
        index: i,
        value: actual,
        expected: Math.round(expected * 100) / 100,
        residual: Math.round(residual * 100) / 100,
        variance: Math.round(variancePercent * 100) / 100,
        type: residual > 0 ? 'spike' : 'drop',
      })
    }
  }

  return { anomalies, model }
}

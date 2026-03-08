export interface CloudProvider {
  id: string
  name: string
}

export interface CostData {
  provider: CloudProvider
  currentMonth: number
  lastMonth: number
  /** Last month cost for same date range as current month-to-date; used for % comparison. */
  lastMonthSamePeriod?: number
  forecast: number
  credits: number
  savings: number
  taxCurrentMonth: number
  taxLastMonth: number
  services: ServiceCost[]
  chartData1Month: CostDataPoint[]
  chartData2Months: CostDataPoint[]
  chartData3Months: CostDataPoint[]
  chartData4Months: CostDataPoint[]
  chartData6Months: CostDataPoint[]
  chartData12Months: CostDataPoint[]
  allHistoricalData: CostDataPoint[]
}

export interface ServiceCost {
  name: string
  cost: number
  change: number // percentage change
}

export interface SavingsPlan {
  id: string
  name: string
  provider: string
  discount: number
  status: 'active' | 'expired' | 'pending'
  expiresAt?: string
}

export interface CostDataPoint {
  date: string
  cost: number
}

import { costDataAPI } from './api'

// Slice daily data starting from the 1st of N months ago
const sliceByMonths = (sortedDailyData: CostDataPoint[], monthsBack: number): CostDataPoint[] => {
  if (sortedDailyData.length === 0) return []
  const cutoff = new Date()
  cutoff.setDate(1)
  cutoff.setMonth(cutoff.getMonth() - monthsBack)
  // Format as YYYY-MM-DD using local date parts (not toISOString which converts to UTC and can shift the date back a day in UTC+ timezones)
  const y = cutoff.getFullYear()
  const m = String(cutoff.getMonth() + 1).padStart(2, '0')
  const d = String(cutoff.getDate()).padStart(2, '0')
  const cutoffStr = `${y}-${m}-${d}`
  return sortedDailyData.filter(dp => dp.date >= cutoffStr)
}

// Helper function to aggregate daily data into monthly data
export const aggregateToMonthly = (dailyData: CostDataPoint[]): CostDataPoint[] => {
  if (dailyData.length === 0) return []
  
  const monthlyMap = new Map<string, number>()
  
  dailyData.forEach(point => {
    // Parse YYYY-MM-DD string directly to avoid timezone shifts from new Date()
    const monthKey = point.date.substring(0, 7) + '-01'
    const existing = monthlyMap.get(monthKey) || 0
    monthlyMap.set(monthKey, existing + point.cost)
  })
  
  // Convert map to array and sort by date
  const result = Array.from(monthlyMap.entries())
    .map(([date, cost]) => ({ date, cost }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  
  return result
}

// Get month name from date string
export const getMonthName = (dateStr: string): string => {
  // Append time to avoid UTC-only parsing which can shift dates in non-UTC timezones
  const date = new Date(dateStr + 'T12:00:00')
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

// Get cost data from API
export const getCostData = async (): Promise<CostData[]> => {
  try {
    // Fetch ~6 months of daily data for initial dashboard load (covers default 6M chart view).
    // 12M data is lazy-loaded when the user selects that period.
    const fetchEndDate = new Date()
    fetchEndDate.setHours(23, 59, 59, 999)
    const fetchStartDate = new Date()
    fetchStartDate.setDate(1) // start of month
    fetchStartDate.setMonth(fetchStartDate.getMonth() - 5) // 6 months back (current + 5 prior)
    fetchStartDate.setHours(0, 0, 0, 0)
    const startStr = fetchStartDate.toISOString().split('T')[0]
    const endStr = fetchEndDate.toISOString().split('T')[0]

    // Fetch cost summary + all providers' daily data in parallel (single batch request)
    const [response, batchDailyResponse] = await Promise.all([
      costDataAPI.getCostData(),
      costDataAPI.getBatchDailyCostData(startStr, endStr),
    ])
    const costData = response.costData || []
    const dailyByProvider: Record<string, CostDataPoint[]> = batchDailyResponse.dailyDataByProvider || {}

    const costDataWithHistory = costData.map((data: any) => {
      const providerId = data.provider.id
      const dailyData: CostDataPoint[] = dailyByProvider[providerId] || []
      const sortedDaily = [...dailyData].sort((a, b) => a.date.localeCompare(b.date))

      return {
        ...data,
        chartData1Month: sliceByMonths(sortedDaily, 0),
        chartData2Months: sliceByMonths(sortedDaily, 1),
        chartData3Months: sliceByMonths(sortedDaily, 2),
        chartData4Months: sliceByMonths(sortedDaily, 3),
        chartData6Months: sliceByMonths(sortedDaily, 5),
        // 12M left empty — lazy-loaded when user selects that period
        chartData12Months: [],
        allHistoricalData: sortedDaily,
      }
    })

    return costDataWithHistory
  } catch (error) {
    console.error('Failed to fetch cost data:', error)
    // Fallback to mock data on error
    return getMockCostData()
  }
}

// Empty fallback when API calls fail
const getMockCostData = (): CostData[] => {
  return []
}

import { savingsPlansAPI } from './api'

export const getSavingsPlans = async (): Promise<SavingsPlan[]> => {
  try {
    const response = await savingsPlansAPI.getSavingsPlans()
    return response.savingsPlans || []
  } catch (error) {
    console.error('Failed to fetch savings plans:', error)
    // Fallback to mock data on error
    return getMockSavingsPlans()
  }
}

// Empty fallback when API calls fail
const getMockSavingsPlans = (): SavingsPlan[] => {
  return []
}

// Period type for all period selectors
export type PeriodType = '1month' | '2months' | '3months' | '4months' | '6months' | '12months' | 'custom'

// Helper function to get date range for a period
// All periods start from the 1st of a calendar month:
//   '1month'  → 1st of current month to now
//   '2months' → 1st of previous month to now
//   '3months' → 1st of 2 months ago to now  (etc.)
export const getDateRangeForPeriod = (period: PeriodType, customStartDate?: string, customEndDate?: string): { startDate: Date, endDate: Date } => {
  const endDate = new Date()
  endDate.setHours(23, 59, 59, 999)
  const startDate = new Date()

  if (period === 'custom' && customStartDate && customEndDate) {
    const parsedStart = new Date(customStartDate + 'T12:00:00')
    const parsedEnd = new Date(customEndDate + 'T12:00:00')

    const isValidDate = (d: Date) => !isNaN(d.getTime())
    const isReasonableYear = (d: Date) => d.getFullYear() >= 1970 && d.getFullYear() <= 2100

    if (isValidDate(parsedStart) && isValidDate(parsedEnd) && isReasonableYear(parsedStart) && isReasonableYear(parsedEnd)) {
      startDate.setTime(parsedStart.getTime())
      startDate.setHours(0, 0, 0, 0)
      endDate.setTime(parsedEnd.getTime())
      endDate.setHours(23, 59, 59, 999)
      return { startDate, endDate }
    } else {
      console.warn('[getDateRangeForPeriod] Invalid or out-of-range custom dates provided:', {
        period,
        customStartDate,
        customEndDate,
      })
      // Fallback: 1st of current month
      startDate.setDate(1)
      startDate.setHours(0, 0, 0, 0)
      return { startDate, endDate }
    }
  }

  // monthsBack: how many months before the current month to start from
  // '1month' = current month only (0 months back), '2months' = 1 month back, etc.
  let monthsBack = 0
  switch (period) {
    case '1month':  monthsBack = 0;  break
    case '2months': monthsBack = 1;  break
    case '3months': monthsBack = 2;  break
    case '4months': monthsBack = 3;  break
    case '6months': monthsBack = 5;  break
    case '12months': monthsBack = 11; break
    default:        monthsBack = 0;
  }

  startDate.setDate(1)
  startDate.setMonth(startDate.getMonth() - monthsBack)
  startDate.setHours(0, 0, 0, 0)
  return { startDate, endDate }
}

// Get period label for display
export const getPeriodLabel = (period: PeriodType): string => {
  switch (period) {
    case '1month': return 'Current Month'
    case '2months': return '2 Months'
    case '3months': return '3 Months'
    case '4months': return '4 Months'
    case '6months': return '6 Months'
    case '12months': return '1 Year'
    case 'custom': return 'Custom'
    default: return 'Current Month'
  }
}

// Get daily cost data for a specific date range
export const fetchDailyCostDataForRange = async (
  providerId: string,
  startDate: Date,
  endDate: Date,
): Promise<CostDataPoint[]> => {
  try {
    const dailyResponse = await costDataAPI.getDailyCostData(
      providerId,
      startDate.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0]
    )
    
    const dailyData: CostDataPoint[] = dailyResponse.dailyData || []
    
    // Sort by date
    return [...dailyData].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    )
  } catch (error) {
    console.warn('Failed to fetch daily cost data for range:', error)
    // Return empty array on error, let caller handle fallback
    return []
  }
}

// Get detailed cost data for a specific provider with historical data
export const getProviderCostDetails = async (
  providerId: string,
): Promise<CostData | null> => {
  try {
    // Get monthly cost data
    const response = await costDataAPI.getCostData()
    const costData = response.costData || []
    const providerData = costData.find((data: any) => data.provider.id === providerId)
    
    if (!providerData) {
      return null
    }

    // Always fetch 365 days (1 year) of data for initial load
    // This ensures we have enough data for all period options including 1 year
    const fetchStartDate = (() => {
      const d = new Date()
      d.setDate(d.getDate() - 365) // Fetch 1 year of data
      d.setHours(0, 0, 0, 0)
      return d
    })()
    const fetchEndDate = new Date()
    fetchEndDate.setHours(23, 59, 59, 999)
    
    try {
      const dailyResponse = await costDataAPI.getDailyCostData(
        providerId,
        fetchStartDate.toISOString().split('T')[0],
        fetchEndDate.toISOString().split('T')[0]
      )
      
      const dailyData: CostDataPoint[] = dailyResponse.dailyData || []
      
      // Sort and slice for different periods
      const sortedDaily = [...dailyData].sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      )

      return {
        ...providerData,
        chartData1Month: sliceByMonths(sortedDaily, 0),
        chartData2Months: sliceByMonths(sortedDaily, 1),
        chartData3Months: sliceByMonths(sortedDaily, 2),
        chartData4Months: sliceByMonths(sortedDaily, 3),
        chartData6Months: sliceByMonths(sortedDaily, 5),
        chartData12Months: sliceByMonths(sortedDaily, 11),
        allHistoricalData: sortedDaily,
      }
    } catch (dailyError) {
      console.warn('Failed to fetch daily cost data:', dailyError)
      return {
        ...providerData,
        chartData1Month: [],
        chartData2Months: [],
        chartData3Months: [],
        chartData4Months: [],
        chartData6Months: [],
        chartData12Months: [],
        allHistoricalData: [],
      }
    }
  } catch (error) {
    console.error('Failed to fetch provider cost details:', error)
    // Fallback to mock data
    const allData = await getCostData()
    const data = allData.find(data => data.provider.id === providerId)
    return data || null
  }
}
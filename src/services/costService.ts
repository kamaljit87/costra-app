export interface CloudProvider {
  id: string
  name: string
}

export interface CostData {
  provider: CloudProvider
  currentMonth: number
  lastMonth: number
  forecast: number
  credits: number
  savings: number
  services: ServiceCost[]
  chartData30Days: CostDataPoint[]
  chartData60Days: CostDataPoint[]
  chartData120Days: CostDataPoint[]
  chartData180Days: CostDataPoint[]
  chartData4Months: CostDataPoint[]
  chartData6Months: CostDataPoint[]
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

// Helper function to slice daily data for different periods
const sliceDailyData = (dailyData: CostDataPoint[], days: number): CostDataPoint[] => {
  if (dailyData.length === 0) return []
  const sorted = [...dailyData].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  return sorted.slice(-days)
}

// Helper function to aggregate daily data into monthly data
export const aggregateToMonthly = (dailyData: CostDataPoint[]): CostDataPoint[] => {
  if (dailyData.length === 0) return []
  
  const monthlyMap = new Map<string, number>()
  
  dailyData.forEach(point => {
    const date = new Date(point.date)
    // Use YYYY-MM format as key, but store as first day of month
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`
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
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

// Generate mock historical data for charts (daily data)
const generateHistoricalData = (
  baseCost: number,
  days: number,
  variance: number = 0.1
): CostDataPoint[] => {
  const data: CostDataPoint[] = []
  const now = new Date()
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now)
    date.setDate(date.getDate() - i)
    date.setHours(0, 0, 0, 0)
    
    const randomFactor = 1 + (Math.random() - 0.5) * variance * 2
    const cost = baseCost * randomFactor
    
    data.push({
      date: date.toISOString().split('T')[0],
      cost: Math.max(0, cost),
    })
  }
  
  return data
}

// Get cost data from API or return mock data for demo mode
export const getCostData = async (isDemoMode: boolean = false): Promise<CostData[]> => {
  // If demo mode, return mock data
  if (isDemoMode) {
    await new Promise(resolve => setTimeout(resolve, 500))
    return getMockCostData()
  }

  try {
    const response = await costDataAPI.getCostData()
    const costData = response.costData || []
    
    // Calculate date range for fetching daily data (180 days back)
    const fetchEndDate = new Date()
    fetchEndDate.setHours(23, 59, 59, 999)
    const fetchStartDate = new Date()
    fetchStartDate.setDate(fetchStartDate.getDate() - 180)
    fetchStartDate.setHours(0, 0, 0, 0)
    
    // Fetch daily data for each provider in parallel
    const costDataWithHistory = await Promise.all(
      costData.map(async (data: any) => {
        try {
          // Fetch daily cost data from the API
          const dailyResponse = await costDataAPI.getDailyCostData(
            data.provider.id,
            fetchStartDate.toISOString().split('T')[0],
            fetchEndDate.toISOString().split('T')[0]
          )
          
          const dailyData: CostDataPoint[] = dailyResponse.dailyData || []
          
          // Sort by date
          const sortedDaily = [...dailyData].sort((a, b) => 
            new Date(a.date).getTime() - new Date(b.date).getTime()
          )
          
          console.log(`Dashboard: Fetched ${sortedDaily.length} daily data points for ${data.provider.id}`)
          
          return {
            ...data,
            chartData30Days: sliceDailyData(sortedDaily, 30),
            chartData60Days: sliceDailyData(sortedDaily, 60),
            chartData120Days: sliceDailyData(sortedDaily, 120),
            chartData180Days: sliceDailyData(sortedDaily, 180),
            chartData4Months: sliceDailyData(sortedDaily, 120),
            chartData6Months: sliceDailyData(sortedDaily, 180),
            allHistoricalData: sortedDaily,
          }
        } catch (dailyError) {
          console.warn(`Failed to fetch daily data for ${data.provider.id}, using mock data:`, dailyError)
          // Fallback to mock data for this provider
          const allHistoricalData = generateHistoricalData(data.currentMonth || 100, 365, 0.15)
          return {
            ...data,
            chartData30Days: sliceDailyData(allHistoricalData, 30),
            chartData60Days: sliceDailyData(allHistoricalData, 60),
            chartData120Days: sliceDailyData(allHistoricalData, 120),
            chartData180Days: sliceDailyData(allHistoricalData, 180),
            chartData4Months: sliceDailyData(allHistoricalData, 120),
            chartData6Months: sliceDailyData(allHistoricalData, 180),
            allHistoricalData,
          }
        }
      })
    )
    
    return costDataWithHistory
  } catch (error) {
    console.error('Failed to fetch cost data:', error)
    // Fallback to mock data on error
    return getMockCostData()
  }
}

// Mock data for demo mode
const getMockCostData = (): CostData[] => {
  const generateAllData = (baseCost: number) => {
    const allHistoricalData = generateHistoricalData(baseCost, 365, 0.15)
    return {
      chartData30Days: sliceDailyData(allHistoricalData, 30),
      chartData60Days: sliceDailyData(allHistoricalData, 60),
      chartData120Days: sliceDailyData(allHistoricalData, 120),
      chartData180Days: sliceDailyData(allHistoricalData, 180),
      chartData4Months: sliceDailyData(allHistoricalData, 120),
      chartData6Months: sliceDailyData(allHistoricalData, 180),
      allHistoricalData,
    }
  }

  return [
    {
      provider: { id: 'aws', name: 'Amazon Web Services' },
      currentMonth: 12450.75,
      lastMonth: 11800.50,
      forecast: 13500.00,
      credits: 500.00,
      savings: 1250.00,
      services: [
        { name: 'EC2 Instances', cost: 5200.00, change: 5.2 },
        { name: 'S3 Storage', cost: 3200.50, change: -2.1 },
        { name: 'RDS Databases', cost: 2100.25, change: 8.5 },
        { name: 'Lambda Functions', cost: 850.00, change: 12.3 },
        { name: 'CloudFront CDN', cost: 1100.00, change: -1.5 },
      ],
      ...generateAllData(12450.75),
    },
    {
      provider: { id: 'azure', name: 'Microsoft Azure' },
      currentMonth: 8950.25,
      lastMonth: 9200.00,
      forecast: 9800.00,
      credits: 300.00,
      savings: 850.00,
      services: [
        { name: 'Virtual Machines', cost: 3800.00, change: -3.2 },
        { name: 'Blob Storage', cost: 2100.25, change: 4.5 },
        { name: 'SQL Database', cost: 1850.00, change: 6.8 },
        { name: 'Functions', cost: 650.00, change: 9.2 },
        { name: 'CDN', cost: 550.00, change: -2.1 },
      ],
      ...generateAllData(8950.25),
    },
    {
      provider: { id: 'gcp', name: 'Google Cloud Platform' },
      currentMonth: 6750.50,
      lastMonth: 7100.00,
      forecast: 7200.00,
      credits: 200.00,
      savings: 600.00,
      services: [
        { name: 'Compute Engine', cost: 2800.00, change: -5.5 },
        { name: 'Cloud Storage', cost: 1850.50, change: 3.2 },
        { name: 'Cloud SQL', cost: 1200.00, change: 7.1 },
        { name: 'Cloud Functions', cost: 550.00, change: 11.5 },
        { name: 'Cloud CDN', cost: 350.00, change: -1.8 },
      ],
      ...generateAllData(6750.50),
    },
  ]
}

import { savingsPlansAPI } from './api'

export const getSavingsPlans = async (isDemoMode: boolean = false): Promise<SavingsPlan[]> => {
  // If demo mode, return mock data
  if (isDemoMode) {
    await new Promise(resolve => setTimeout(resolve, 300))
    return getMockSavingsPlans()
  }

  try {
    const response = await savingsPlansAPI.getSavingsPlans()
    return response.savingsPlans || []
  } catch (error) {
    console.error('Failed to fetch savings plans:', error)
    // Fallback to mock data on error
    return getMockSavingsPlans()
  }
}

// Mock savings plans for demo mode
const getMockSavingsPlans = (): SavingsPlan[] => {
  return [
    {
      id: '1',
      name: 'AWS Reserved Instances',
      provider: 'AWS',
      discount: 30,
      status: 'active',
      expiresAt: '2024-12-31',
    },
    {
      id: '2',
      name: 'Azure Reserved VM Instances',
      provider: 'Azure',
      discount: 25,
      status: 'active',
      expiresAt: '2024-11-30',
    },
    {
      id: '3',
      name: 'GCP Committed Use Discounts',
      provider: 'GCP',
      discount: 20,
      status: 'active',
      expiresAt: '2025-01-15',
    },
    {
      id: '4',
      name: 'AWS Savings Plans',
      provider: 'AWS',
      discount: 15,
      status: 'pending',
    },
  ]
}

// Helper function to get date range for a period
export const getDateRangeForPeriod = (period: '30days' | '60days' | '120days' | '180days' | '4months' | '6months' | '12months' | 'custom', customStartDate?: string, customEndDate?: string): { startDate: Date, endDate: Date } => {
  const endDate = new Date()
  endDate.setHours(23, 59, 59, 999)
  const startDate = new Date()

  if (period === 'custom' && customStartDate && customEndDate) {
    startDate.setTime(new Date(customStartDate).getTime())
    startDate.setHours(0, 0, 0, 0)
    endDate.setTime(new Date(customEndDate).getTime())
    endDate.setHours(23, 59, 59, 999)
    return { startDate, endDate }
  }

  switch (period) {
    case '30days':
      startDate.setDate(startDate.getDate() - 30)
      break
    case '60days':
      startDate.setDate(startDate.getDate() - 60)
      break
    case '120days':
      startDate.setDate(startDate.getDate() - 120)
      break
    case '180days':
      startDate.setDate(startDate.getDate() - 180)
      break
    case '4months':
      // Use days instead of months to avoid date overflow issues
      startDate.setDate(startDate.getDate() - 120) // ~4 months
      break
    case '6months':
      // Use days instead of months to avoid date overflow issues
      startDate.setDate(startDate.getDate() - 180) // ~6 months
      break
    case '12months':
      // Full year of data
      startDate.setDate(startDate.getDate() - 365) // ~12 months
      break
    default:
      startDate.setDate(startDate.getDate() - 30)
  }

  startDate.setHours(0, 0, 0, 0)
  return { startDate, endDate }
}

// Get daily cost data for a specific date range
export const fetchDailyCostDataForRange = async (
  providerId: string,
  startDate: Date,
  endDate: Date,
  isDemoMode: boolean = false
): Promise<CostDataPoint[]> => {
  if (isDemoMode) {
    // Generate mock data for the date range
    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    const baseCost = 1000 // Default base cost
    return generateHistoricalData(baseCost, days, 0.15)
  }

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
  isDemoMode: boolean = false
): Promise<CostData | null> => {
  if (isDemoMode) {
    const allData = await getCostData(isDemoMode)
    const data = allData.find(data => data.provider.id === providerId)
    return data || null
  }

  try {
    // Get monthly cost data
    const response = await costDataAPI.getCostData()
    const costData = response.costData || []
    const providerData = costData.find((data: any) => data.provider.id === providerId)
    
    if (!providerData) {
      return null
    }

    // Always fetch at least 180 days (6 months) of data for initial load
    // This ensures we have enough data for all period options
    const fetchStartDate = (() => {
      const d = new Date()
      d.setDate(d.getDate() - 180) // Fetch 6 months of data
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
        chartData30Days: sliceDailyData(sortedDaily, 30),
        chartData60Days: sliceDailyData(sortedDaily, 60),
        chartData120Days: sliceDailyData(sortedDaily, 120),
        chartData180Days: sliceDailyData(sortedDaily, 180),
        chartData4Months: sliceDailyData(sortedDaily, 120), // 4 months ≈ 120 days
        chartData6Months: sliceDailyData(sortedDaily, 180), // 6 months ≈ 180 days
        allHistoricalData: sortedDaily,
      }
    } catch (dailyError) {
      console.warn('Failed to fetch daily cost data, using mock data:', dailyError)
      // If daily data fetch fails, generate mock data
      const allHistoricalData = generateHistoricalData(providerData.currentMonth, 365, 0.15)
      return {
        ...providerData,
        chartData30Days: sliceDailyData(allHistoricalData, 30),
        chartData60Days: sliceDailyData(allHistoricalData, 60),
        chartData120Days: sliceDailyData(allHistoricalData, 120),
        chartData180Days: sliceDailyData(allHistoricalData, 180),
        chartData4Months: sliceDailyData(allHistoricalData, 120),
        chartData6Months: sliceDailyData(allHistoricalData, 180),
        allHistoricalData,
      }
    }
  } catch (error) {
    console.error('Failed to fetch provider cost details:', error)
    // Fallback to mock data
    const allData = await getCostData(true)
    const data = allData.find(data => data.provider.id === providerId)
    return data || null
  }
}
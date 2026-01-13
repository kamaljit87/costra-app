export interface CloudProvider {
  id: string
  name: string
  icon: string
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
    
    // Add historical chart data to each provider (using mock data for now)
    // In production, this would fetch from daily_cost_data table
    return costData.map((data: any) => {
      const allHistoricalData = generateHistoricalData(data.currentMonth, 365, 0.15)
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
    })
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
      provider: { id: 'aws', name: 'Amazon Web Services', icon: '☁️' },
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
      provider: { id: 'azure', name: 'Microsoft Azure', icon: '🔷' },
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
      provider: { id: 'gcp', name: 'Google Cloud Platform', icon: '🔵' },
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

    // Fetch daily cost data for last 180 days
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - 180)
    
    try {
      const dailyResponse = await costDataAPI.getDailyCostData(
        providerId,
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0]
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
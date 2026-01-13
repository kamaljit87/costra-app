import { costDataAPI, savingsPlansAPI } from './api'

export interface CloudProvider {
  id: string
  name: string
  icon: string
}

export interface CostDataPoint {
  date: string
  cost: number
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
  change: number
}

export interface SavingsPlan {
  id: string
  name: string
  provider: string
  discount: number
  status: 'active' | 'expired' | 'pending'
  expiresAt?: string
}

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
    
    const trendFactor = 1 + (Math.sin(i / 10) * 0.05)
    const randomFactor = 1 + (Math.random() - 0.5) * variance * 2
    const cost = baseCost * trendFactor * randomFactor
    
    data.push({
      date: date.toISOString(),
      cost: Math.max(0, cost),
    })
  }
  
  return data
}

const generateMonthlyData = (
  baseCost: number,
  months: number,
  variance: number = 0.1
): CostDataPoint[] => {
  const data: CostDataPoint[] = []
  const now = new Date()
  
  for (let i = months - 1; i >= 0; i--) {
    const date = new Date(now)
    date.setMonth(date.getMonth() - i)
    date.setDate(1)
    date.setHours(0, 0, 0, 0)
    
    const randomFactor = 1 + (Math.random() - 0.5) * variance * 2
    const cost = baseCost * randomFactor
    
    data.push({
      date: date.toISOString(),
      cost: Math.max(0, cost),
    })
  }
  
  return data
}

const getMockCostData = (): CostData[] => {
  const awsBaseCost = 12450.75
  const azureBaseCost = 8950.25
  const gcpBaseCost = 6750.50
  
  const awsAllData = generateHistoricalData(awsBaseCost, 365, 0.15)
  const azureAllData = generateHistoricalData(azureBaseCost, 365, 0.15)
  const gcpAllData = generateHistoricalData(gcpBaseCost, 365, 0.15)
  
  return [
    {
      provider: { id: 'aws', name: 'Amazon Web Services', icon: '☁️' },
      currentMonth: awsBaseCost,
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
      chartData30Days: awsAllData.slice(-30),
      chartData60Days: awsAllData.slice(-60),
      chartData120Days: awsAllData.slice(-120),
      chartData180Days: awsAllData.slice(-180),
      chartData4Months: generateMonthlyData(awsBaseCost, 4, 0.2),
      chartData6Months: generateMonthlyData(awsBaseCost, 6, 0.25),
      allHistoricalData: awsAllData,
    },
    {
      provider: { id: 'azure', name: 'Microsoft Azure', icon: '🔷' },
      currentMonth: azureBaseCost,
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
      chartData30Days: azureAllData.slice(-30),
      chartData60Days: azureAllData.slice(-60),
      chartData120Days: azureAllData.slice(-120),
      chartData180Days: azureAllData.slice(-180),
      chartData4Months: generateMonthlyData(azureBaseCost, 4, 0.2),
      chartData6Months: generateMonthlyData(azureBaseCost, 6, 0.25),
      allHistoricalData: azureAllData,
    },
    {
      provider: { id: 'gcp', name: 'Google Cloud Platform', icon: '🔵' },
      currentMonth: gcpBaseCost,
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
      chartData30Days: gcpAllData.slice(-30),
      chartData60Days: gcpAllData.slice(-60),
      chartData120Days: gcpAllData.slice(-120),
      chartData180Days: gcpAllData.slice(-180),
      chartData4Months: generateMonthlyData(gcpBaseCost, 4, 0.2),
      chartData6Months: generateMonthlyData(gcpBaseCost, 6, 0.25),
      allHistoricalData: gcpAllData,
    },
  ]
}

export const getCostData = async (isDemoMode: boolean = false): Promise<CostData[]> => {
  if (isDemoMode) {
    await new Promise(resolve => setTimeout(resolve, 500))
    return getMockCostData()
  }

  try {
    const response = await costDataAPI.getCostData()
    const costData = response.costData || []
    
    return costData.map((data: any) => {
      const allData = generateHistoricalData(data.currentMonth, 365, 0.15)
      return {
        ...data,
        chartData30Days: allData.slice(-30),
        chartData60Days: allData.slice(-60),
        chartData120Days: allData.slice(-120),
        chartData180Days: allData.slice(-180),
        chartData4Months: generateMonthlyData(data.currentMonth, 4, 0.2),
        chartData6Months: generateMonthlyData(data.currentMonth, 6, 0.25),
        allHistoricalData: allData,
      }
    })
  } catch (error) {
    console.error('Failed to fetch cost data:', error)
    return getMockCostData()
  }
}

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

export const getSavingsPlans = async (isDemoMode: boolean = false): Promise<SavingsPlan[]> => {
  if (isDemoMode) {
    await new Promise(resolve => setTimeout(resolve, 300))
    return getMockSavingsPlans()
  }

  try {
    const response = await savingsPlansAPI.getSavingsPlans()
    return response.savingsPlans || []
  } catch (error) {
    console.error('Failed to fetch savings plans:', error)
    return getMockSavingsPlans()
  }
}

export const getProviderCostDetails = async (
  providerId: string,
  isDemoMode: boolean = false
): Promise<CostData | null> => {
  const allData = await getCostData(isDemoMode)
  return allData.find(data => data.provider.id === providerId) || null
}

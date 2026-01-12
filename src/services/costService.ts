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

import { costDataAPI } from './api'

// Get cost data from API or return mock data for demo mode
export const getCostData = async (isDemoMode: boolean = false): Promise<CostData[]> => {
  // If demo mode, return mock data
  if (isDemoMode) {
    await new Promise(resolve => setTimeout(resolve, 500))
    return getMockCostData()
  }

  try {
    const response = await costDataAPI.getCostData()
    return response.costData || []
  } catch (error) {
    console.error('Failed to fetch cost data:', error)
    // Fallback to mock data on error
    return getMockCostData()
  }
}

// Mock data for demo mode
const getMockCostData = (): CostData[] => {
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


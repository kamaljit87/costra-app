import { useState } from 'react'
import { Package, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronRight } from 'lucide-react'
import { useCurrency } from '../contexts/CurrencyContext'
import { productTeamAPI } from '../services/api'

interface ProductCost {
  productName: string
  totalCost: number
  resourceCount: number
  serviceCount: number
  services: string[]
}

interface ProductCostCardProps {
  product: ProductCost
  startDate: string
  endDate: string
  providerId?: string
  accountId?: number
}

export default function ProductCostCard({ product, startDate, endDate, providerId, accountId }: ProductCostCardProps) {
  const { convertAmount } = useCurrency()
  const [isExpanded, setIsExpanded] = useState(false)
  const [services, setServices] = useState<Array<{ serviceName: string; cost: number; resourceCount: number }>>([])
  const [isLoadingServices, setIsLoadingServices] = useState(false)
  const [trend, setTrend] = useState<{ change: number; changePercent: number } | null>(null)
  const [isLoadingTrend, setIsLoadingTrend] = useState(false)

  const loadServices = async () => {
    if (services.length > 0) return // Already loaded
    
    setIsLoadingServices(true)
    try {
      const response = await productTeamAPI.getProductServices(
        product.productName,
        startDate,
        endDate,
        providerId,
        accountId
      )
      setServices(response.services || [])
    } catch (error) {
      console.error('Failed to load product services:', error)
    } finally {
      setIsLoadingServices(false)
    }
  }

  const loadTrend = async () => {
    if (trend !== null) return // Already loaded
    
    setIsLoadingTrend(true)
    try {
      // Calculate previous period for comparison
      const start = new Date(startDate + 'T12:00:00')
      const end = new Date(endDate + 'T12:00:00')
      const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
      
      const prevEnd = new Date(start)
      prevEnd.setDate(prevEnd.getDate() - 1)
      const prevStart = new Date(prevEnd)
      prevStart.setDate(prevStart.getDate() - daysDiff)
      
      const prevResponse = await productTeamAPI.getCostByProduct(
        prevStart.toISOString().split('T')[0],
        prevEnd.toISOString().split('T')[0],
        providerId,
        accountId
      )
      
      const prevProduct = prevResponse.products?.find((p: ProductCost) => p.productName === product.productName)
      const prevCost = prevProduct?.totalCost || 0
      
      if (prevCost > 0) {
        const change = product.totalCost - prevCost
        const changePercent = (change / prevCost) * 100
        setTrend({ change, changePercent })
      } else {
        setTrend({ change: product.totalCost, changePercent: product.totalCost > 0 ? 100 : 0 })
      }
    } catch (error) {
      console.error('Failed to load product trend:', error)
    } finally {
      setIsLoadingTrend(false)
    }
  }

  const handleExpand = () => {
    setIsExpanded(!isExpanded)
    if (!isExpanded) {
      loadServices()
      loadTrend()
    }
  }

  const getTrendIcon = () => {
    if (!trend) return <Minus className="h-4 w-4 text-gray-400" />
    if (trend.changePercent > 0) return <TrendingUp className="h-4 w-4 text-red-600" />
    if (trend.changePercent < 0) return <TrendingDown className="h-4 w-4 text-green-600" />
    return <Minus className="h-4 w-4 text-gray-400" />
  }

  const getTrendColor = () => {
    if (!trend) return 'text-gray-600'
    if (trend.changePercent > 0) return 'text-red-600'
    if (trend.changePercent < 0) return 'text-green-600'
    return 'text-gray-600'
  }

  return (
    <div className="card group">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="p-3 bg-gradient-to-br from-accent-100 to-accent-50 rounded-2xl group-hover:scale-110 transition-transform duration-300">
            <Package className="h-6 w-6 text-accent-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold text-gray-900">{product.productName}</h3>
            <p className="text-sm text-gray-500">
              {product.resourceCount} resource{product.resourceCount !== 1 ? 's' : ''} • {product.serviceCount} service{product.serviceCount !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <button
          onClick={handleExpand}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          {isExpanded ? (
            <ChevronDown className="h-5 w-5 text-gray-600" />
          ) : (
            <ChevronRight className="h-5 w-5 text-gray-600" />
          )}
        </button>
      </div>

      <div className="mb-6">
        <div className="text-4xl font-bold text-gray-900 mb-3">
          {convertAmount(product.totalCost)}
        </div>
        {isLoadingTrend ? (
          <div className="text-sm text-gray-500">Loading trend...</div>
        ) : trend ? (
          <div className={`flex items-center gap-2 text-sm font-medium ${getTrendColor()}`}>
            {getTrendIcon()}
            <span>
              {trend.changePercent > 0 ? '+' : ''}{trend.changePercent.toFixed(1)}% vs previous period
            </span>
          </div>
        ) : (
          <div className="text-sm text-gray-500">No previous data</div>
        )}
      </div>

      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Service Breakdown</h4>
          {isLoadingServices ? (
            <div className="text-sm text-gray-500">Loading services...</div>
          ) : services.length > 0 ? (
            <div className="space-y-2">
              {services.map((service, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-700">{service.serviceName}</span>
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-900">{convertAmount(service.cost)}</div>
                    <div className="text-xs text-gray-500">{service.resourceCount} resource{service.resourceCount !== 1 ? 's' : ''}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-gray-500">No service data available</div>
          )}
        </div>
      )}
    </div>
  )
}

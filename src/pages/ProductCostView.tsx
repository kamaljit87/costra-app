import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Package, Info, RefreshCw } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useNotification } from '../contexts/NotificationContext'
import { productTeamAPI } from '../services/api'
import Layout from '../components/Layout'
import Breadcrumbs from '../components/Breadcrumbs'
import ProductCostCard from '../components/ProductCostCard'

interface ProductCost {
  productName: string
  totalCost: number
  resourceCount: number
  serviceCount: number
  services: string[]
}

export default function ProductCostView() {
  const { isDemoMode } = useAuth()
  const { showError } = useNotification()
  const [searchParams] = useSearchParams()
  const providerId = searchParams.get('providerId') || undefined
  const accountId = searchParams.get('accountId') ? parseInt(searchParams.get('accountId')!) : undefined
  
  const [products, setProducts] = useState<ProductCost[]>([])
  const [isLoading, setIsLoading] = useState(true)
  
  // Default to last 30 days
  const [startDate, setStartDate] = useState(() => {
    const date = new Date()
    date.setDate(date.getDate() - 30)
    return date.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0]
  })

  useEffect(() => {
    if (!isDemoMode) {
      loadProducts()
    }
  }, [isDemoMode, startDate, endDate, providerId, accountId])

  const loadProducts = async () => {
    try {
      setIsLoading(true)
      const response = await productTeamAPI.getCostByProduct(
        startDate,
        endDate,
        providerId,
        accountId
      )
      setProducts(response.products || [])
    } catch (error) {
      console.error('Failed to load products:', error)
      showError('Failed to load product costs')
    } finally {
      setIsLoading(false)
    }
  }

  if (isDemoMode) {
    return (
      <Layout>
        <div className="p-6">
          <Breadcrumbs />
          <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
            <Package className="h-12 w-12 text-yellow-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Product Costs Not Available in Demo Mode</h2>
            <p className="text-gray-600">
              Please sign in to view product-level cost allocation.
            </p>
          </div>
        </div>
      </Layout>
    )
  }

  const totalCost = products.reduce((sum, p) => sum + p.totalCost, 0)

  return (
    <Layout>
      <div className="p-6">
        <Breadcrumbs />

        {/* Header */}
        <div className="mt-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <Package className="h-8 w-8 text-accent-600" />
                Product Costs
              </h1>
              <p className="mt-2 text-gray-600">
                View costs aggregated by product tags
              </p>
            </div>
            <button
              onClick={loadProducts}
              className="flex items-center gap-2 px-4 py-2 bg-accent-600 text-white rounded-lg hover:bg-accent-700 transition-colors"
            >
              <RefreshCw className="h-5 w-5" />
              Refresh
            </button>
          </div>

          {/* Date Range Selector */}
          <div className="flex items-center gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-accent-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-accent-500"
              />
            </div>
          </div>
        </div>

        {/* Info Section */}
        <div className="mb-8 bg-accent-50 border border-accent-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-accent-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-gray-700">
              <p className="font-medium mb-1">About Product Costs</p>
              <p>
                Costs are aggregated by resources tagged with "product", "productname", or "product_name" tags.
                Resources without these tags are grouped as "Untagged". Use this view to understand spending
                by product line and identify opportunities for cost optimization.
              </p>
            </div>
          </div>
        </div>

        {/* Summary */}
        {products.length > 0 && (
          <div className="mb-6 bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Total Product Costs</span>
              <span className="text-2xl font-bold text-gray-900">
                ${totalCost.toFixed(2)}
              </span>
            </div>
          </div>
        )}

        {/* Products Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <RefreshCw className="h-8 w-8 text-accent-600 animate-spin mx-auto mb-4" />
              <p className="text-gray-500">Loading product costs...</p>
            </div>
          </div>
        ) : products.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
            <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Product Costs Found</h3>
            <p className="text-gray-600">
              No resources with product tags found for the selected period. Tag your resources with
              "product", "productname", or "product_name" tags to see product-level cost allocation.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product) => (
              <ProductCostCard
                key={product.productName}
                product={product}
                startDate={startDate}
                endDate={endDate}
                providerId={providerId}
                accountId={accountId}
              />
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}

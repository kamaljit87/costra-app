import { useState, useEffect, useCallback, useRef } from 'react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Helmet } from 'react-helmet-async'
import {
  ScanLine,
  Upload,
  FileText,
  Trash2,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  TrendingUp,
  DollarSign,
  Globe,
  Clock,
  Zap,
} from 'lucide-react'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { useNotification } from '../contexts/NotificationContext'
import { billAnalyzerAPI } from '../services/api'
import Layout from '../components/Layout'
import FeatureInfoButton from '../components/FeatureInfoButton'

interface BillService {
  name: string
  cost: number
  percentage: number
  region?: string
}

interface BillRegion {
  name: string
  cost: number
  percentage: number
}

interface CostDriver {
  description: string
  impact: 'high' | 'medium' | 'low'
  amount: number
}

interface Optimization {
  title: string
  description: string
  estimatedSavings: string
  priority: 'high' | 'medium' | 'low'
}

interface RawAnalysis {
  grossCost?: number
  credits?: number
  totalCost?: number
  [key: string]: any
}

interface BillAnalysis {
  id: number
  file_name: string
  file_size: number
  file_type: string
  provider: string
  billing_period: string
  total_cost: number
  currency: string
  services: BillService[]
  regions: BillRegion[]
  cost_drivers: CostDriver[]
  optimizations: Optimization[]
  summary: string
  raw_analysis: RawAnalysis
  credits_consumed: number
  status: string
  created_at: string
}

interface CreditBalance {
  used: number
  limit: number
  remaining: number
  periodStart: string
  periodEnd: string
}

const CHART_COLORS = ['#3F4ABF', '#6366F1', '#818CF8', '#A5B4FC', '#C7D2FE', '#E0E7FF', '#22C55E', '#F59E0B']

/**
 * Normalize services/regions arrays from the API.
 * DB numeric columns may arrive as strings, so we parseFloat everything.
 * Also computes percentage from cost when the AI returns 0-cost items with non-zero percentages.
 */
function normalizeServices(services: any[] | null | undefined): BillService[] {
  if (!services || !Array.isArray(services)) return []
  return services.map(s => ({
    name: s.name || 'Unknown',
    cost: parseFloat(s.cost) || 0,
    percentage: parseFloat(s.percentage) || 0,
    region: s.region,
  }))
}

function normalizeRegions(regions: any[] | null | undefined): BillRegion[] {
  if (!regions || !Array.isArray(regions)) return []
  return regions.map(r => ({
    name: truncateLabel(r.name || 'Unknown', 30),
    cost: parseFloat(r.cost) || 0,
    percentage: parseFloat(r.percentage) || 0,
  }))
}

function truncateLabel(text: string, maxLen: number): string {
  return text.length > maxLen ? text.slice(0, maxLen - 1) + '…' : text
}

const PRIORITY_STYLES = {
  high: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800',
  medium: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800',
  low: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800',
}

const IMPACT_STYLES = {
  high: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  medium: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  low: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getCreditCost(bytes: number): number {
  const mb = bytes / (1024 * 1024)
  if (mb < 5) return 5
  if (mb <= 15) return 10
  return 20
}

function getProviderIcon(provider: string): string {
  const p = (provider || '').toLowerCase()
  if (p.includes('aws') || p.includes('amazon')) return 'AWS'
  if (p.includes('azure') || p.includes('microsoft')) return 'Azure'
  if (p.includes('gcp') || p.includes('google')) return 'GCP'
  if (p.includes('digital')) return 'DigitalOcean'
  return provider || 'Unknown'
}

export default function BillAnalyzerPage() {
  const { showSuccess, showError } = useNotification()

  const [credits, setCredits] = useState<CreditBalance | null>(null)
  const [analyses, setAnalyses] = useState<BillAnalysis[]>([])
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; onConfirm: () => void }>({ open: false, onConfirm: () => {} })
  const [currentAnalysis, setCurrentAnalysis] = useState<BillAnalysis | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true)
      const [creditsData, analysesData] = await Promise.all([
        billAnalyzerAPI.getCredits(),
        billAnalyzerAPI.getAnalyses(),
      ])
      setCredits(creditsData)
      setAnalyses(analysesData.analyses || [])
    } catch (err: any) {
      if (!err.message?.includes('403')) {
        setError(err.message || 'Failed to load data')
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) setSelectedFile(file)
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setSelectedFile(file)
  }, [])

  const handleUpload = async () => {
    if (!selectedFile) return

    try {
      setIsUploading(true)
      setError(null)
      const result = await billAnalyzerAPI.upload(selectedFile)
      setCurrentAnalysis(result.analysis)
      setCredits(result.credits)
      setSelectedFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      // Refresh history
      const analysesData = await billAnalyzerAPI.getAnalyses()
      setAnalyses(analysesData.analyses || [])
      showSuccess('Bill analysis completed successfully')
    } catch (err: any) {
      setError(err.message || 'Analysis failed')
      showError(err.message || 'Analysis failed')
    } finally {
      setIsUploading(false)
    }
  }

  const handleViewAnalysis = async (id: number) => {
    try {
      const result = await billAnalyzerAPI.getAnalysis(id)
      setCurrentAnalysis(result.analysis)
    } catch (err: any) {
      showError(err.message || 'Failed to load analysis')
    }
  }

  const handleDeleteAnalysis = (id: number) => {
    setConfirmDialog({
      open: true,
      onConfirm: async () => {
        try {
          await billAnalyzerAPI.deleteAnalysis(id)
          setAnalyses(prev => prev.filter(a => a.id !== id))
          if (currentAnalysis?.id === id) setCurrentAnalysis(null)
          showSuccess('Analysis deleted')
        } catch (err: any) {
          showError(err.message || 'Failed to delete')
        }
      }
    })
  }

  const formatCost = (amount: number, currency?: string) => {
    if (amount == null) return 'N/A'
    const curr = currency || 'USD'
    try {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: curr }).format(amount)
    } catch {
      return `${curr} ${amount.toFixed(2)}`
    }
  }

  const creditPercentage = credits ? Math.round((credits.used / Math.max(credits.limit, 1)) * 100) : 0
  const creditColor = creditPercentage > 80 ? 'bg-red-500' : creditPercentage > 50 ? 'bg-amber-500' : 'bg-green-500'

  // Extract gross/net/credits from raw_analysis (new AI prompt) or fall back to total_cost
  const raw = currentAnalysis?.raw_analysis
  const netCost = parseFloat(String(currentAnalysis?.total_cost)) || 0
  const grossCost = parseFloat(String(raw?.grossCost)) || 0
  const billCredits = parseFloat(String(raw?.credits)) || 0

  // Normalize chart data — parseFloat all costs, handle zero-cost bills
  const chartServices = normalizeServices(currentAnalysis?.services).slice(0, 8)
  const chartRegions = normalizeRegions(currentAnalysis?.regions)
  const pieTotalCost = chartServices.reduce((sum, s) => sum + s.cost, 0)
  const barTotalCost = chartRegions.reduce((sum, r) => sum + r.cost, 0)
  const allServices = normalizeServices(currentAnalysis?.services)

  return (
    <Layout>
      <Helmet><title>Bill Analyzer - Costra</title></Helmet>

      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-accent-50 rounded-lg dark:bg-accent-900/20">
              <ScanLine className="h-6 w-6 text-accent-600 dark:text-accent-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">AI Bill Analyzer</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Upload cloud bills for AI-powered cost analysis</p>
            </div>
            <FeatureInfoButton featureId="billAnalyzer" />
          </div>

          {/* Credit Indicator */}
          {credits && (
            <div className="flex items-center gap-3 bg-white dark:bg-gray-800 border border-surface-300 dark:border-gray-700 rounded-lg px-4 py-2.5 shadow-xs">
              <Zap className="h-4 w-4 text-amber-500" />
              <div className="text-sm">
                <span className="font-semibold text-gray-900 dark:text-white">{credits.remaining}</span>
                <span className="text-gray-500 dark:text-gray-400">/{credits.limit} credits</span>
              </div>
              <div className="w-20 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div className={`h-full ${creditColor} rounded-full transition-all`} style={{ width: `${Math.min(creditPercentage, 100)}%` }} />
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <p className="text-sm">{error}</p>
            <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700">&times;</button>
          </div>
        )}

        {/* Upload Zone */}
        {!isUploading && (
          <div
            className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all ${
              isDragOver
                ? 'border-accent-500 bg-accent-50 dark:bg-accent-900/10'
                : 'border-surface-300 dark:border-gray-700 hover:border-accent-400 bg-white dark:bg-gray-800'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              accept=".pdf,.csv,.xlsx,.xls,.jpg,.jpeg,.png,.gif,.webp"
              className="hidden"
            />
            <Upload className="h-10 w-10 mx-auto text-gray-400 dark:text-gray-500 mb-3" />
            <p className="text-lg font-medium text-gray-900 dark:text-white mb-1">
              {isDragOver ? 'Drop your bill here' : 'Drag & drop your cloud bill'}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              PDF, CSV, Excel, or image files up to 20MB
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn-secondary text-sm"
            >
              Choose File
            </button>

            {selectedFile && (
              <div className="mt-4 inline-flex items-center gap-3 bg-accent-50 dark:bg-accent-900/20 border border-accent-200 dark:border-accent-800 rounded-lg px-4 py-3">
                <FileText className="h-5 w-5 text-accent-600 dark:text-accent-400" />
                <div className="text-left">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{selectedFile.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {formatFileSize(selectedFile.size)} &middot; {getCreditCost(selectedFile.size)} credits
                  </p>
                </div>
                <button
                  onClick={handleUpload}
                  disabled={isUploading}
                  className="btn-primary text-sm ml-2"
                >
                  Analyze
                </button>
                <button
                  onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  &times;
                </button>
              </div>
            )}
          </div>
        )}

        {/* Processing Indicator */}
        {isUploading && (
          <div className="bg-white dark:bg-gray-800 border border-surface-300 dark:border-gray-700 rounded-xl p-12 text-center shadow-card">
            <Loader2 className="h-12 w-12 mx-auto text-accent-600 dark:text-accent-400 animate-spin mb-4" />
            <p className="text-lg font-medium text-gray-900 dark:text-white mb-1">Analyzing your bill...</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              AI is extracting cost data, identifying services, and generating optimization insights. This may take 15-60 seconds.
            </p>
          </div>
        )}

        {/* Analysis Result */}
        {currentAnalysis && !isUploading && (
          <div className="space-y-6">
            {/* Summary Card */}
            <div className="bg-white dark:bg-gray-800 border border-surface-300 dark:border-gray-700 rounded-xl p-6 shadow-card">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                <div className="flex items-center gap-4">
                  <div className="p-2.5 bg-accent-50 dark:bg-accent-900/20 rounded-xl">
                    <DollarSign className="h-7 w-7 text-accent-600 dark:text-accent-400" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                      {formatCost(grossCost > 0 ? grossCost : netCost, currentAnalysis.currency)}
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {grossCost > 0 && grossCost !== netCost ? 'Gross Charges' : 'Total Bill Amount'}
                    </p>
                  </div>
                  {billCredits > 0 && (
                    <>
                      <div className="hidden sm:block h-10 w-px bg-surface-300 dark:bg-gray-700" />
                      <div className="hidden sm:block">
                        <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                          -{formatCost(billCredits, currentAnalysis.currency)}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Credits / Discounts</p>
                      </div>
                      <div className="hidden sm:block h-10 w-px bg-surface-300 dark:bg-gray-700" />
                      <div className="hidden sm:block">
                        <p className="text-lg font-semibold text-gray-900 dark:text-white">
                          {formatCost(netCost, currentAnalysis.currency)}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Amount Due</p>
                      </div>
                    </>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                  <span className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-900/50 px-2.5 py-1 rounded-md">
                    <Globe className="h-4 w-4" />
                    {getProviderIcon(currentAnalysis.provider)}
                  </span>
                  <span className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-900/50 px-2.5 py-1 rounded-md">
                    <Clock className="h-4 w-4" />
                    {currentAnalysis.billing_period || 'N/A'}
                  </span>
                  <span className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-900/50 px-2.5 py-1 rounded-md">
                    <FileText className="h-4 w-4" />
                    {currentAnalysis.file_name}
                  </span>
                </div>
              </div>
              {/* Mobile credits breakdown */}
              {billCredits > 0 && (
                <div className="sm:hidden flex items-center gap-4 mb-4 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                  <div>
                    <p className="text-sm font-semibold text-green-600 dark:text-green-400">-{formatCost(billCredits, currentAnalysis.currency)}</p>
                    <p className="text-xs text-gray-500">Credits</p>
                  </div>
                  <div className="h-6 w-px bg-surface-300 dark:bg-gray-700" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{formatCost(netCost, currentAnalysis.currency)}</p>
                    <p className="text-xs text-gray-500">Amount Due</p>
                  </div>
                </div>
              )}
              {currentAnalysis.summary && (
                <div className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 leading-relaxed space-y-1">
                  {currentAnalysis.summary.split('\n').filter(Boolean).map((line: string, i: number) => (
                    <p key={i}>{line}</p>
                  ))}
                </div>
              )}
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Cost by Service */}
              {chartServices.length > 0 && (
                <div className="bg-white dark:bg-gray-800 border border-surface-300 dark:border-gray-700 rounded-xl p-6 shadow-card">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Cost by Service</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={chartServices}
                        dataKey={pieTotalCost > 0 ? 'cost' : 'percentage'}
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        innerRadius={45}
                        paddingAngle={2}
                      >
                        {chartServices.map((_: BillService, i: number) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(_value: number, _name: string, props: any) => {
                          const entry = props.payload
                          const cost = formatCost(entry.cost, currentAnalysis.currency)
                          return `${cost} (${entry.percentage?.toFixed(1) || 0}%)`
                        }}
                      />
                      <Legend
                        layout="vertical"
                        align="right"
                        verticalAlign="middle"
                        iconType="circle"
                        iconSize={8}
                        formatter={(value: string, entry: any) => {
                          const item = entry.payload
                          return `${value} — ${item.percentage?.toFixed(1) || 0}%`
                        }}
                        wrapperStyle={{ fontSize: '12px', lineHeight: '20px', paddingLeft: '12px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Cost by Region */}
              {chartRegions.length > 0 && (
                <div className="bg-white dark:bg-gray-800 border border-surface-300 dark:border-gray-700 rounded-xl p-6 shadow-card">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Cost by Region</h3>
                  <ResponsiveContainer width="100%" height={Math.max(280, chartRegions.length * 50)}>
                    <BarChart data={chartRegions} layout="vertical" margin={{ left: 10, right: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis
                        type="number"
                        tickFormatter={(v: number) =>
                          barTotalCost > 0 ? formatCost(v, currentAnalysis.currency) : `${v}%`
                        }
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={150}
                        tick={{ fontSize: 11 }}
                      />
                      <Tooltip
                        formatter={(value: number) => formatCost(value, currentAnalysis.currency)}
                        labelStyle={{ fontWeight: 600 }}
                      />
                      <Bar
                        dataKey={barTotalCost > 0 ? 'cost' : 'percentage'}
                        fill="#3F4ABF"
                        radius={[0, 4, 4, 0]}
                        barSize={24}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Cost Breakdown Table */}
            {allServices.length > 0 && (
              <div className="bg-white dark:bg-gray-800 border border-surface-300 dark:border-gray-700 rounded-xl shadow-card overflow-hidden">
                <div className="px-6 py-4 border-b border-surface-300 dark:border-gray-700">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">Service Breakdown</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[500px]">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-900/50 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        <th className="px-6 py-3">Service</th>
                        <th className="px-6 py-3 text-right">Cost</th>
                        <th className="px-6 py-3 text-right">% of Total</th>
                        <th className="px-6 py-3">Region</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-300 dark:divide-gray-700">
                      {allServices.map((service: BillService, i: number) => (
                        <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-900/30">
                          <td className="px-6 py-3 text-sm font-medium text-gray-900 dark:text-white">{service.name}</td>
                          <td className="px-6 py-3 text-sm text-right text-gray-900 dark:text-white">
                            {formatCost(service.cost, currentAnalysis.currency)}
                          </td>
                          <td className="px-6 py-3 text-sm text-right text-gray-500 dark:text-gray-400">
                            {service.percentage?.toFixed(1) || '—'}%
                          </td>
                          <td className="px-6 py-3 text-sm text-gray-500 dark:text-gray-400">
                            {service.region || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Cost Drivers */}
            {currentAnalysis.cost_drivers && currentAnalysis.cost_drivers.length > 0 && (
              <div className="bg-white dark:bg-gray-800 border border-surface-300 dark:border-gray-700 rounded-xl p-6 shadow-card">
                <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-accent-600 dark:text-accent-400" />
                  Top Cost Drivers
                </h3>
                <div className="space-y-3">
                  {currentAnalysis.cost_drivers.map((driver: CostDriver, i: number) => (
                    <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                      <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${IMPACT_STYLES[driver.impact] || IMPACT_STYLES.medium}`}>
                        {driver.impact}
                      </span>
                      <div className="flex-1">
                        <p className="text-sm text-gray-900 dark:text-white">{driver.description}</p>
                      </div>
                      {driver.amount > 0 && (
                        <span className="text-sm font-medium text-gray-900 dark:text-white whitespace-nowrap">
                          {formatCost(driver.amount, currentAnalysis.currency)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Optimization Suggestions */}
            {currentAnalysis.optimizations && currentAnalysis.optimizations.length > 0 && (
              <div className="bg-white dark:bg-gray-800 border border-surface-300 dark:border-gray-700 rounded-xl p-6 shadow-card">
                <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-amber-500" />
                  Optimization Suggestions
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {currentAnalysis.optimizations.map((opt: Optimization, i: number) => (
                    <div key={i} className={`border rounded-lg p-4 ${PRIORITY_STYLES[opt.priority] || PRIORITY_STYLES.medium}`}>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-semibold">{opt.title}</h4>
                        <span className="text-xs font-medium uppercase">{opt.priority}</span>
                      </div>
                      <p className="text-sm opacity-90 mb-2">{opt.description}</p>
                      {opt.estimatedSavings && (
                        <p className="text-xs font-medium">
                          Estimated savings: {opt.estimatedSavings}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Analysis History */}
        {analyses.length > 0 && (
          <div className="bg-white dark:bg-gray-800 border border-surface-300 dark:border-gray-700 rounded-xl shadow-card overflow-hidden">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 dark:hover:bg-gray-900/30"
            >
              <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Clock className="h-5 w-5 text-gray-400" />
                Analysis History ({analyses.length})
              </h3>
              {showHistory ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
            </button>
            {showHistory && (
              <div className="border-t border-surface-300 dark:border-gray-700">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-900/50 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        <th className="px-6 py-3">Date</th>
                        <th className="px-6 py-3">File</th>
                        <th className="px-6 py-3">Provider</th>
                        <th className="px-6 py-3 text-right">Total Cost</th>
                        <th className="px-6 py-3 text-right">Credits</th>
                        <th className="px-6 py-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-300 dark:divide-gray-700">
                      {analyses.map((a) => (
                        <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/30">
                          <td className="px-6 py-3 text-sm text-gray-500 dark:text-gray-400">
                            {new Date(a.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-3 text-sm text-gray-900 dark:text-white">
                            {a.file_name}
                          </td>
                          <td className="px-6 py-3 text-sm text-gray-600 dark:text-gray-400">
                            {getProviderIcon(a.provider)}
                          </td>
                          <td className="px-6 py-3 text-sm text-right font-medium text-gray-900 dark:text-white">
                            {a.total_cost ? formatCost(parseFloat(String(a.total_cost)), a.currency) : '—'}
                          </td>
                          <td className="px-6 py-3 text-sm text-right text-gray-500 dark:text-gray-400">
                            {a.credits_consumed}
                          </td>
                          <td className="px-6 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleViewAnalysis(a.id)}
                                className="text-accent-600 hover:text-accent-800 dark:text-accent-400 dark:hover:text-accent-300 text-sm font-medium"
                              >
                                View
                              </button>
                              <button
                                onClick={() => handleDeleteAnalysis(a.id)}
                                className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !currentAnalysis && analyses.length === 0 && !isUploading && (
          <div className="text-center py-12 bg-white dark:bg-gray-800 border border-surface-300 dark:border-gray-700 rounded-xl">
            <ScanLine className="h-12 w-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">No analyses yet</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Upload a cloud bill to get started with AI-powered cost analysis</p>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 text-accent-600 animate-spin" />
          </div>
        )}
      </div>
      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog(prev => ({ ...prev, open }))}
        title="Delete Analysis"
        description="Delete this analysis? This cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={confirmDialog.onConfirm}
      />
    </Layout>
  )
}

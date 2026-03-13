import { useState, useEffect, useMemo, useCallback } from 'react'
import { insightsAPI, cloudProvidersAPI } from '../services/api'
import { useCurrency } from '../contexts/CurrencyContext'
import Layout from '../components/Layout'
import Breadcrumbs from '../components/Breadcrumbs'
import { ProviderIcon } from '../components/CloudProviderIcons'
import { Spinner } from '@/components/ui/spinner'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  Search, Filter, ChevronRight, Server, Database, HardDrive,
  Cpu, MemoryStick, Activity, Info, Shield, X, AlertTriangle,
  ExternalLink,
} from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────────

interface ResourceMeta {
  instanceType: string | null
  memory: string | null
  vcpus: string | null
  storageType: string | null
  sizeGib: number | null
  iops: number | null
  engine: string | null
  clusterId: string | null
  accountName: string | null
  awsAccountId: string | null
}

interface RecOption {
  label: string | null
  savings: number
  costSavings: number
  type: string | null
  sizeGib?: number | null
  iops?: number | null
  action: string
  risk: number
}

interface Recommendation {
  title: string
  description: string
  action: string
  priority: string
  savings: number
  savingsPercent: number
  confidence: string
  category: string
  subcategory: string
  evidence: Record<string, any>
}

interface Resource {
  id: number
  resourceId: string
  resourceName: string
  resourceType: string
  serviceName: string
  region: string | null
  providerId: string
  accountId: number
  cost: number
  estimatedNewCost: number
  savingsPercent: number
  metadata: ResourceMeta
  usageQuantity: number
  usageUnit: string | null
  lastSeen: string | null
  recommendations: Recommendation[]
  instanceOptions: RecOption[]
  storageOptions: RecOption[]
}

interface ServiceGroup {
  serviceName: string
  totalSpend: number
  resourceCount: number
  resources: Resource[]
}

interface UtilPoint {
  timestamp: string
  value: number
  unit: string
}

interface UtilData {
  cpu: UtilPoint[]
  memory: UtilPoint[]
  storage: UtilPoint[]
  iops: UtilPoint[]
}

// ─── Provider label map ─────────────────────────────────────────────

const PROVIDER_LABELS: Record<string, string> = {
  aws: 'AWS',
  azure: 'Azure',
  gcp: 'GCP',
  linode: 'Linode',
  digitalocean: 'DigitalOcean',
  vultr: 'Vultr',
  ibm: 'IBM Cloud',
  oci: 'OCI',
}

// Providers that support rightsizing recommendations
const RIGHTSIZING_PROVIDERS = new Set(['aws', 'azure', 'gcp'])

// ─── Helpers ────────────────────────────────────────────────────────

const SERVICE_ICONS: Record<string, typeof Server> = {
  ec2: Server,
  rds: Database,
  s3: HardDrive,
  ebs: HardDrive,
  lambda: Activity,
}

function getServiceIcon(name: string) {
  const lower = name.toLowerCase()
  for (const [k, Icon] of Object.entries(SERVICE_ICONS)) {
    if (lower.includes(k)) return Icon
  }
  return Server
}

function riskDots(risk: number) {
  return Array.from({ length: 5 }, (_, i) => (
    <span
      key={i}
      className={`inline-block w-2.5 h-2.5 rounded-sm ${i < risk ? 'bg-gray-800' : 'bg-gray-200'}`}
    />
  ))
}

// ─── Main Page ──────────────────────────────────────────────────────

export default function RightsizingPage() {
  const { formatCurrency } = useCurrency()

  // Data state
  const [services, setServices] = useState<ServiceGroup[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Connected providers (fetched from API)
  const [connectedProviders, setConnectedProviders] = useState<{ id: string; label: string }[]>([])
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null)
  const [selectedService, setSelectedService] = useState<string | null>(null)
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  // Setup hints (returned when provider needs configuration)
  const [setupHints, setSetupHints] = useState<any[]>([])
  const [showSetupDialog, setShowSetupDialog] = useState(false)

  // Utilization data
  const [utilData, setUtilData] = useState<UtilData | null>(null)
  const [utilLoading, setUtilLoading] = useState(false)

  // ── Fetch connected cloud providers on mount ──────────────────────
  useEffect(() => {
    const fetchProviders = async () => {
      try {
        const result = await cloudProvidersAPI.getCloudProviders()
        const accounts = result.accounts || result.providers || []
        const uniqueIds = ([...new Set(accounts.map((a: any) => a.provider_id || a.providerId))] as string[])
          .filter(id => RIGHTSIZING_PROVIDERS.has(id))
        const providers = uniqueIds.map(id => ({
          id,
          label: PROVIDER_LABELS[id] || id.charAt(0).toUpperCase() + id.slice(1),
        }))
        setConnectedProviders(providers)
        if (providers.length > 0 && !selectedProvider) {
          setSelectedProvider(providers[0].id)
        }
      } catch {
        // Fallback: show nothing until provider data loads
      }
    }
    fetchProviders()
  }, [])

  // ── Fetch explorer data ───────────────────────────────────────────
  const fetchData = useCallback(async () => {
    if (!selectedProvider) return
    setIsLoading(true)
    setError(null)
    try {
      const result = await insightsAPI.getRightsizingExplorer(selectedProvider)
      const data = result.data || {}
      setServices(data.services || [])
      setSetupHints(data.setupHints || [])

      // Auto-select first service
      if (data.services?.length > 0 && !selectedService) {
        setSelectedService(data.services[0].serviceName)
      }
    } catch (err: any) {
      console.error('Failed to fetch rightsizing data:', err)
      setError(err.message || 'Failed to load data')
    } finally {
      setIsLoading(false)
    }
  }, [selectedProvider])

  useEffect(() => {
    setSelectedService(null)
    setSelectedResource(null)
    fetchData()
  }, [selectedProvider, fetchData])

  // ── Fetch utilization when resource selected ──────────────────────
  useEffect(() => {
    if (!selectedResource) {
      setUtilData(null)
      return
    }
    let cancelled = false
    const fetch = async () => {
      setUtilLoading(true)
      try {
        const result = await insightsAPI.getResourceUtilization(selectedResource.resourceId, 10)
        if (!cancelled) setUtilData(result.data || null)
      } catch {
        if (!cancelled) setUtilData(null)
      } finally {
        if (!cancelled) setUtilLoading(false)
      }
    }
    fetch()
    return () => { cancelled = true }
  }, [selectedResource?.resourceId])

  // ── Derived data ──────────────────────────────────────────────────
  const activeService = useMemo(
    () => services.find(s => s.serviceName === selectedService) || null,
    [services, selectedService]
  )

  const filteredResources = useMemo(() => {
    if (!activeService) return []
    if (!searchTerm) return activeService.resources
    const term = searchTerm.toLowerCase()
    return activeService.resources.filter(r =>
      r.resourceName.toLowerCase().includes(term) ||
      r.resourceId.toLowerCase().includes(term) ||
      (r.metadata.engine || '').toLowerCase().includes(term)
    )
  }, [activeService, searchTerm])

  const totalRecommendations = useMemo(
    () => services.reduce((sum, s) =>
      sum + s.resources.reduce((rs, r) => rs + r.recommendations.length, 0), 0
    ),
    [services]
  )

  // ── Render ────────────────────────────────────────────────────────
  return (
    <Layout>
      <Breadcrumbs />

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Rightsizing</h1>
        <p className="text-sm text-gray-500 mt-1">
          Recommendations for rightsizing your public cloud resources to an appropriate timeline and cost basis for your organization.
        </p>
      </div>

      {connectedProviders.length === 0 && !isLoading ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
          <Server className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">No cloud providers connected</h2>
          <p className="text-sm text-gray-500 max-w-md mx-auto">
            Connect at least one cloud provider in Settings → Cloud Providers to see rightsizing recommendations.
          </p>
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner className="h-8 w-8" />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-red-700">
          {error}
        </div>
      ) : (
        <div className="flex gap-0 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden" style={{ minHeight: 'calc(100vh - 220px)' }}>
          {/* ─── LEFT PANEL: Service Explorer ─────────────────── */}
          <div className="w-80 shrink-0 border-r border-gray-200 flex flex-col">
            {/* Provider tabs */}
            <div className="border-b border-gray-200">
              <div className="flex px-4 pt-3 pb-0">
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wider mr-3 py-2">Explorer</span>
                {connectedProviders.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedProvider(p.id)}
                    className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                      selectedProvider === p.id
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Service sub-tabs */}
            <div className="border-b border-gray-200 px-3 py-2 overflow-x-auto">
              <div className="flex gap-1 flex-wrap">
                {services.map(svc => {
                  const Icon = getServiceIcon(svc.serviceName)
                  const isActive = selectedService === svc.serviceName
                  return (
                    <button
                      key={svc.serviceName}
                      onClick={() => {
                        setSelectedService(svc.serviceName)
                        setSelectedResource(null)
                        setSearchTerm('')
                      }}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                        isActive
                          ? 'bg-gray-900 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      <Icon className="w-3 h-3" />
                      {svc.serviceName.replace(/Amazon |AWS |Google |Azure |Microsoft /gi, '').substring(0, 12)}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Search + filter */}
            <div className="px-3 py-2 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Filter resources…"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
            </div>

            {/* Total spend */}
            <div className="px-4 py-3 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400 font-medium">Total Spend</span>
                <Info className="w-3 h-3 text-gray-300" />
              </div>
              <div className="text-2xl font-bold text-blue-600 mt-1">
                {formatCurrency(activeService?.totalSpend || 0)}
              </div>
            </div>

            {/* Resource list table */}
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-gray-500">Resource Name</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-500">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredResources.map(resource => (
                    <tr
                      key={resource.id}
                      onClick={() => setSelectedResource(resource)}
                      className={`cursor-pointer border-b border-gray-50 transition-colors ${
                        selectedResource?.id === resource.id
                          ? 'bg-blue-50'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <td className="px-3 py-2.5">
                        <div className="font-medium text-gray-800 truncate max-w-[180px]" title={resource.resourceName}>
                          {resource.resourceName}
                        </div>
                        <div className="text-gray-400 truncate max-w-[180px]">
                          {resource.metadata.engine || resource.resourceType}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        <div className="font-medium text-gray-700">{formatCurrency(resource.cost)}</div>
                        {resource.savingsPercent > 0 && (
                          <div className="text-green-600 text-[10px]">-{resource.savingsPercent}%</div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredResources.length === 0 && (
                    <tr>
                      <td colSpan={2} className="text-center py-8 text-gray-400">
                        {setupHints.length > 0 ? (
                          <button
                            onClick={() => setShowSetupDialog(true)}
                            className="text-blue-600 hover:text-blue-700 underline underline-offset-2 text-xs"
                          >
                            Setup required — click for details
                          </button>
                        ) : (
                          <div className="space-y-1">
                            <p>No rightsizing recommendations</p>
                            <p className="text-[10px]">Your instances are right-sized, or no running EC2 instances were found</p>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ─── RIGHT PANEL: Resource Detail ─────────────────── */}
          <div className="flex-1 overflow-y-auto">
            {!selectedResource && setupHints.length > 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-16 px-8">
                <AlertTriangle className="w-12 h-12 mb-4 text-amber-400" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Setup Required</h3>
                <p className="text-sm text-gray-500 mb-6 text-center max-w-md">
                  Your cloud provider needs additional configuration before rightsizing recommendations can be generated.
                </p>
                <button
                  onClick={() => setShowSetupDialog(true)}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  View Setup Instructions
                </button>
              </div>
            ) : !selectedResource ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 py-20">
                <Server className="w-12 h-12 mb-3 text-gray-300" />
                <p className="text-sm font-medium">Select a resource to view recommendations</p>
                <p className="text-xs mt-1">
                  {totalRecommendations} recommendation{totalRecommendations !== 1 ? 's' : ''} available across {services.length} service{services.length !== 1 ? 's' : ''}
                </p>
              </div>
            ) : (
              <ResourceDetail
                resource={selectedResource}
                utilData={utilData}
                utilLoading={utilLoading}
                formatCurrency={formatCurrency}
                onClose={() => setSelectedResource(null)}
              />
            )}
          </div>
        </div>
      )}

      {/* ─── Setup Instructions Dialog ──────────────────────────── */}
      {showSetupDialog && setupHints.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowSetupDialog(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <h2 className="text-lg font-semibold text-gray-900">Setup Required</h2>
              </div>
              <button onClick={() => setShowSetupDialog(false)} className="p-1 rounded-md hover:bg-gray-100 text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-6">
              {setupHints.map((hint, i) => (
                <div key={i}>
                  <div className="flex items-center gap-2 mb-2">
                    <ProviderIcon providerId={hint.provider} className="w-5 h-5" />
                    <h3 className="text-sm font-bold text-gray-900">{hint.title}</h3>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">{hint.message}</p>
                  {hint.steps && hint.steps.length > 0 && (
                    <ol className="space-y-2">
                      {hint.steps.map((step: string, j: number) => (
                        <li key={j} className="flex items-start gap-3">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center mt-0.5">
                            {j + 1}
                          </span>
                          <span className="text-sm text-gray-700">{step}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                  {hint.provider === 'aws' && hint.type === 'opt_in_required' && (
                    <a
                      href="https://console.aws.amazon.com/cost-management/home#/settings"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 transition-colors"
                    >
                      Open AWS Cost Explorer Preferences
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                  {hint.provider === 'aws' && hint.type === 'permission_required' && (
                    <a
                      href="https://console.aws.amazon.com/cloudformation"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 transition-colors"
                    >
                      Open AWS CloudFormation
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
              ))}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">How rightsizing works</p>
                  <p className="text-blue-600">
                    Costdoq analyzes your EC2 instance CPU, network, and disk utilization via CloudWatch metrics
                    over the past 14 days to identify over-provisioned or idle instances. No manual opt-in is needed
                    for the CloudWatch approach — just ensure the Costdoq IAM role has the required permissions.
                  </p>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setShowSetupDialog(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}

// ─── Resource Detail Sub-component ──────────────────────────────────

function ResourceDetail({
  resource,
  utilData,
  utilLoading,
  formatCurrency,
  onClose,
}: {
  resource: Resource
  utilData: UtilData | null
  utilLoading: boolean
  formatCurrency: (n: number) => string
  onClose: () => void
}) {
  const meta = resource.metadata
  const hasRecs = resource.recommendations.length > 0

  return (
    <div className="p-6">
      {/* Header: close button */}
      <div className="flex justify-between items-start mb-4">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <ProviderIcon providerId={resource.providerId} className="w-5 h-5" />
          {resource.resourceName}
        </h2>
        <button onClick={onClose} className="p-1 rounded-md hover:bg-gray-100 text-gray-400">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* ── Metadata table ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-px bg-gray-200 rounded-lg overflow-hidden mb-6">
        {[
          ['Account', meta.accountName || meta.awsAccountId || '–'],
          ['Instance Type', meta.instanceType || '–'],
          ['Resource Name', resource.resourceId],
          ['Memory', meta.memory || '–'],
          ['Engine', meta.engine || '–'],
          ['Storage Type', meta.storageType || '–'],
          ['Region', resource.region || '–'],
          ['Size GiB', meta.sizeGib ? `${meta.sizeGib}` : '–'],
          ['Cluster ID', meta.clusterId || 'N/A'],
          ['IOPS', meta.iops ? `${meta.iops}` : '–'],
        ].map(([label, value]) => (
          <div key={label} className="bg-white px-4 py-2.5 flex justify-between">
            <span className="text-xs font-medium text-gray-500 uppercase">{label}</span>
            <span className="text-xs font-semibold text-gray-800 text-right">{value}</span>
          </div>
        ))}
      </div>

      {/* ── Cost comparison bar ──────────────────────────────────── */}
      <div className="flex items-center justify-between bg-gray-50 rounded-lg p-4 mb-6">
        <div>
          <span className="text-xs text-gray-500 font-medium block">Cost</span>
          <span className="text-xl font-bold text-gray-900">{formatCurrency(resource.cost)}</span>
        </div>
        {hasRecs && (
          <>
            <ChevronRight className="w-5 h-5 text-gray-400" />
            <div className="text-right">
              <span className="text-xs text-gray-500 font-medium block">Estimated New Cost</span>
              <span className="text-xl font-bold text-green-600">
                {formatCurrency(resource.estimatedNewCost)} ({resource.savingsPercent}%)
              </span>
            </div>
          </>
        )}
      </div>

      {/* ── Recommendations ──────────────────────────────────────── */}
      {hasRecs && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-900">
              Recommendations ({resource.recommendations.length})
            </h3>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Filter className="w-3 h-3" />
              {resource.instanceOptions.length + resource.storageOptions.length} Selected
            </div>
          </div>

          {/* Instance options */}
          {resource.instanceOptions.length > 0 && (
            <div className="mb-4">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Instance</span>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {resource.instanceOptions.map((opt, i) => (
                  <RecCard key={i} option={opt} formatCurrency={formatCurrency} />
                ))}
              </div>
            </div>
          )}

          {/* Storage options */}
          {resource.storageOptions.length > 0 && (
            <div className="mb-4">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Storage</span>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {resource.storageOptions.map((opt, i) => (
                  <RecCard key={i} option={opt} formatCurrency={formatCurrency} isStorage />
                ))}
              </div>
            </div>
          )}

          {/* Fallback: simple recommendation list if no structured options */}
          {resource.instanceOptions.length === 0 && resource.storageOptions.length === 0 && (
            <div className="space-y-2">
              {resource.recommendations.map((rec, i) => (
                <div key={i} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                  <div className="flex items-center gap-2 mb-1">
                    <PriorityBadge priority={rec.priority} />
                    <span className="text-sm font-medium text-gray-900">{rec.title}</span>
                  </div>
                  <p className="text-xs text-gray-600 mb-2">{rec.description}</p>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-green-600 font-semibold">
                      Save {formatCurrency(rec.savings)}/mo ({rec.savingsPercent}%)
                    </span>
                    <span className="text-gray-400">Action: {rec.action}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* No recommendations state */}
      {!hasRecs && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 flex items-center gap-3">
          <Shield className="w-5 h-5 text-green-600" />
          <div>
            <span className="text-sm font-medium text-green-800">Optimally sized</span>
            <p className="text-xs text-green-600">No rightsizing recommendations for this resource.</p>
          </div>
        </div>
      )}

      {/* ── Utilization Charts ───────────────────────────────────── */}
      <div className="mb-4">
        <h3 className="text-sm font-bold text-gray-900 mb-3">Resource Utilization</h3>
      </div>

      {utilLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner className="h-6 w-6" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <UtilChart title="CPU (%)" data={utilData?.cpu || []} color="#3b82f6" icon={Cpu} />
          <UtilChart title="Memory (%)" data={utilData?.memory || []} color="#8b5cf6" icon={MemoryStick} />
          <UtilChart title="Storage (%)" data={utilData?.storage || []} color="#10b981" icon={HardDrive} />
          <UtilChart title="IOPS (count)" data={utilData?.iops || []} color="#f59e0b" icon={Activity} />
        </div>
      )}
    </div>
  )
}

// ─── Recommendation Card ────────────────────────────────────────────

function RecCard({
  option,
  formatCurrency,
  isStorage = false,
}: {
  option: RecOption
  formatCurrency: (n: number) => string
  isStorage?: boolean
}) {
  const isRecommended = option.label === 'RECOMMENDED'

  return (
    <div className={`
      min-w-[160px] border rounded-lg p-3 flex flex-col gap-2 text-xs
      ${isRecommended
        ? 'border-orange-400 bg-orange-50 ring-1 ring-orange-200'
        : 'border-gray-200 bg-white'
      }
    `}>
      {isRecommended && (
        <span className="self-start px-1.5 py-0.5 bg-orange-500 text-white text-[10px] font-bold rounded uppercase">
          Recommended
        </span>
      )}
      <div className="space-y-1.5">
        <div className="flex justify-between">
          <span className="text-gray-500 font-medium">Savings</span>
          <span className="font-bold text-green-600">{Math.round(option.savings)}%</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500 font-medium">Cost Savings</span>
          <span className="font-semibold text-gray-800">{formatCurrency(option.costSavings)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500 font-medium">Type</span>
          <span className="font-semibold text-gray-800">{option.type || '–'}</span>
        </div>
        {isStorage && option.sizeGib && (
          <div className="flex justify-between">
            <span className="text-gray-500 font-medium">Size GiB</span>
            <span className="font-semibold text-gray-800">{option.sizeGib}</span>
          </div>
        )}
        {isStorage && option.iops && (
          <div className="flex justify-between">
            <span className="text-gray-500 font-medium">IOPS</span>
            <span className="font-semibold text-gray-800">{option.iops}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-gray-500 font-medium">Action</span>
          <span className="font-semibold text-gray-800">{option.action}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-500 font-medium">Risk</span>
          <div className="flex gap-0.5">{riskDots(option.risk)}</div>
        </div>
      </div>
    </div>
  )
}

// ─── Priority Badge ─────────────────────────────────────────────────

function PriorityBadge({ priority }: { priority: string }) {
  const colors: Record<string, string> = {
    critical: 'bg-red-100 text-red-700',
    high: 'bg-orange-100 text-orange-700',
    medium: 'bg-yellow-100 text-yellow-700',
    low: 'bg-blue-100 text-blue-700',
  }
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${colors[priority] || colors.low}`}>
      {priority}
    </span>
  )
}

// ─── Utilization Chart ──────────────────────────────────────────────

function UtilChart({
  title,
  data,
  color,
  icon: Icon,
}: {
  title: string
  data: UtilPoint[]
  color: string
  icon: typeof Cpu
}) {
  const chartData = useMemo(() => {
    if (data.length === 0) return []
    return data.map(d => ({
      time: new Date(d.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      value: d.value,
    }))
  }, [data])

  const isPercent = title.includes('%')
  const isEmpty = chartData.length === 0

  return (
    <div className="border border-gray-200 rounded-lg p-3">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-3.5 h-3.5 text-gray-500" />
        <span className="text-xs font-semibold text-gray-700 uppercase">{title}</span>
      </div>
      {isEmpty ? (
        <div className="flex items-center justify-center h-32 text-xs text-gray-400">
          No utilization data available
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={140}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="time" tick={{ fontSize: 10 }} stroke="#9ca3af" />
            <YAxis
              domain={isPercent ? [0, 100] : ['auto', 'auto']}
              tick={{ fontSize: 10 }}
              stroke="#9ca3af"
              width={35}
              tickFormatter={v => isPercent ? `${v}%` : v.toLocaleString()}
            />
            <Tooltip
              contentStyle={{ fontSize: 11, borderRadius: 8 }}
              formatter={(value: number) => [isPercent ? `${value.toFixed(1)}%` : value.toLocaleString(), '']}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3 }}
            />
            {isPercent && (
              <Line
                type="monotone"
                dataKey={() => 100}
                stroke="#ef4444"
                strokeWidth={1}
                strokeDasharray="4 4"
                dot={false}
                name="Capacity"
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

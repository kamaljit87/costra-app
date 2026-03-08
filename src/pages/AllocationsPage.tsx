import { useState, useEffect } from 'react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { } from '../contexts/AuthContext'
import { useNotification } from '../contexts/NotificationContext'
import { allocationsAPI } from '../services/api'
import Layout from '../components/Layout'
import Breadcrumbs from '../components/Breadcrumbs'
import FeatureInfoButton from '../components/FeatureInfoButton'
import { Split, Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react'

interface AllocationRule {
  id: number
  name: string
  description: string | null
  source_filter: Record<string, unknown>
  split_method: string
  split_targets: { name: string; percentage: number }[]
  is_enabled: boolean
  created_at: string
}

const SPLIT_METHODS = [
  { value: 'even', label: 'Even Split', description: 'Split equally among all targets' },
  { value: 'proportional', label: 'Proportional', description: 'Split based on usage or existing allocation' },
  { value: 'fixed', label: 'Fixed Percentage', description: 'Define exact percentages for each target' },
]

export default function AllocationsPage() {
  const { showSuccess, showError } = useNotification()
  const [rules, setRules] = useState<AllocationRule[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; onConfirm: () => void }>({ open: false, onConfirm: () => {} })
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formMethod, setFormMethod] = useState('even')
  const [formService, setFormService] = useState('')
  const [formTargets, setFormTargets] = useState<{ name: string; percentage: number }[]>([
    { name: '', percentage: 50 }, { name: '', percentage: 50 },
  ])

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setIsLoading(true)
      const res = await allocationsAPI.list()
      setRules(res.rules || [])
    } catch {
      showError('Failed to load allocation rules')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreate = async () => {
    if (!formName.trim() || formTargets.some(t => !t.name.trim())) return
    try {
      await allocationsAPI.create({
        name: formName.trim(),
        description: formDescription.trim() || undefined,
        sourceFilter: formService.trim() ? { service: formService.trim() } : {},
        splitMethod: formMethod,
        splitTargets: formTargets,
      })
      showSuccess('Allocation rule created')
      setShowCreateForm(false)
      setFormName('')
      setFormDescription('')
      setFormService('')
      setFormTargets([{ name: '', percentage: 50 }, { name: '', percentage: 50 }])
      await loadData()
    } catch {
      showError('Failed to create allocation rule')
    }
  }

  const handleToggle = async (rule: AllocationRule) => {
    try {
      await allocationsAPI.update(rule.id, { isEnabled: !rule.is_enabled })
      showSuccess(`Rule ${rule.is_enabled ? 'disabled' : 'enabled'}`)
      await loadData()
    } catch {
      showError('Failed to update rule')
    }
  }

  const handleDelete = (ruleId: number) => {
    setConfirmDialog({
      open: true,
      onConfirm: async () => {
        try {
          await allocationsAPI.delete(ruleId)
          showSuccess('Rule deleted')
          await loadData()
        } catch {
          showError('Failed to delete rule')
        }
      }
    })
  }


  return (
    <Layout>
      <div className="p-6 max-w-5xl mx-auto">
        <Breadcrumbs />
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Split className="h-8 w-8 text-indigo-600" />
              Cost Allocation Rules
              <FeatureInfoButton featureId="allocations" />
            </h1>
            <p className="text-sm text-gray-500 mt-1">Define rules for splitting shared costs between teams and products</p>
          </div>
          <button onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-accent-600 text-white rounded-lg hover:bg-accent-700 text-sm">
            <Plus className="h-4 w-4" /> New Rule
          </button>
        </div>

        {showCreateForm && (
          <div className="mb-6 p-5 bg-white rounded-xl border shadow-sm">
            <h3 className="font-semibold mb-4">Create Allocation Rule</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Rule Name</label>
                <input type="text" value={formName} onChange={e => setFormName(e.target.value)}
                  placeholder="e.g. Split shared RDS costs" className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Split Method</label>
                <select value={formMethod} onChange={e => setFormMethod(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-white">
                  {SPLIT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
                <p className="text-xs text-gray-400 mt-1">{SPLIT_METHODS.find(m => m.value === formMethod)?.description}</p>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Source Service (optional)</label>
                <input type="text" value={formService} onChange={e => setFormService(e.target.value)}
                  placeholder="e.g. Amazon RDS" className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Description</label>
                <input type="text" value={formDescription} onChange={e => setFormDescription(e.target.value)}
                  placeholder="Optional" className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-xs text-gray-500 mb-2">Split Targets</label>
              {formTargets.map((t, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <input type="text" value={t.name} placeholder="Team/Product name"
                    onChange={e => { const n = [...formTargets]; n[i].name = e.target.value; setFormTargets(n) }}
                    className="flex-1 px-3 py-2 border rounded-lg text-sm" />
                  {formMethod === 'fixed' && (
                    <input type="number" value={t.percentage} placeholder="%"
                      onChange={e => { const n = [...formTargets]; n[i].percentage = parseFloat(e.target.value) || 0; setFormTargets(n) }}
                      className="w-20 px-3 py-2 border rounded-lg text-sm" />
                  )}
                  {formTargets.length > 2 && (
                    <button onClick={() => setFormTargets(formTargets.filter((_, j) => j !== i))}
                      className="text-red-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                  )}
                </div>
              ))}
              <button onClick={() => setFormTargets([...formTargets, { name: '', percentage: 0 }])}
                className="text-xs text-accent-600 hover:text-accent-700">+ Add target</button>
            </div>
            <div className="flex gap-2">
              <button onClick={handleCreate} className="px-4 py-2 bg-accent-600 text-white rounded-lg text-sm">Create Rule</button>
              <button onClick={() => setShowCreateForm(false)} className="px-4 py-2 bg-gray-100 rounded-lg text-sm">Cancel</button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 rounded-full border-2 border-gray-200 border-t-gray-600 animate-spin" />
          </div>
        ) : rules.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border">
            <Split className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-lg font-medium text-gray-700">No allocation rules</p>
            <p className="text-sm text-gray-500 mt-1">Create rules to fairly split shared infrastructure costs between teams.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rules.map(rule => {
              const targets = typeof rule.split_targets === 'string' ? JSON.parse(rule.split_targets as unknown as string) : rule.split_targets
              return (
                <div key={rule.id} className={`bg-white rounded-xl border p-4 ${!rule.is_enabled ? 'opacity-60' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{rule.name}</span>
                        <span className="px-2 py-0.5 bg-gray-100 rounded-full text-xs">{rule.split_method}</span>
                      </div>
                      {rule.description && <p className="text-xs text-gray-500 mt-1">{rule.description}</p>}
                      <p className="text-xs text-gray-400 mt-1">
                        Targets: {(targets as { name: string }[]).map(t => t.name).join(', ')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleToggle(rule)} className="p-1.5 text-gray-400 hover:text-gray-600">
                        {rule.is_enabled
                          ? <ToggleRight className="h-6 w-6 text-green-500" />
                          : <ToggleLeft className="h-6 w-6 text-gray-400" />}
                      </button>
                      <button onClick={() => handleDelete(rule.id)} className="p-1.5 text-gray-400 hover:text-red-500">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog(prev => ({ ...prev, open }))}
        title="Delete Allocation Rule"
        description="Delete this allocation rule?"
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={confirmDialog.onConfirm}
      />
    </Layout>
  )
}

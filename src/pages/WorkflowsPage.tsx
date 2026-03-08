import { useState, useEffect } from 'react'
import { } from '../contexts/AuthContext'
import { useNotification } from '../contexts/NotificationContext'
import { workflowsAPI } from '../services/api'
import Layout from '../components/Layout'
import Breadcrumbs from '../components/Breadcrumbs'
import FeatureInfoButton from '../components/FeatureInfoButton'
import { ClipboardList, Plus, MessageSquare, ChevronRight, ArrowLeft } from 'lucide-react'

interface WorkflowItem {
  id: number
  type: string
  title: string
  description: string
  status: string
  creator_name: string
  assignee_name: string | null
  created_at: string
  metadata: Record<string, unknown>
}

interface Comment {
  id: number
  user_name: string
  comment: string
  created_at: string
}

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-blue-100 text-blue-700',
  in_review: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  resolved: 'bg-gray-100 text-gray-600',
}

const TYPE_LABELS: Record<string, string> = {
  anomaly_review: 'Anomaly Review',
  optimization_approval: 'Optimization Approval',
  budget_review: 'Budget Review',
}

export default function WorkflowsPage() {
  const { showSuccess, showError } = useNotification()
  const [items, setItems] = useState<WorkflowItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedItem, setSelectedItem] = useState<WorkflowItem | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [formTitle, setFormTitle] = useState('')
  const [formType, setFormType] = useState('anomaly_review')
  const [formDescription, setFormDescription] = useState('')

  useEffect(() => {
    loadItems()
  }, [filterStatus])

  const loadItems = async () => {
    try {
      setIsLoading(true)
      const res = await workflowsAPI.list({ status: filterStatus || undefined })
      setItems(res.items || [])
    } catch {
      showError('Failed to load workflow items')
    } finally {
      setIsLoading(false)
    }
  }

  const loadItemDetail = async (item: WorkflowItem) => {
    try {
      const res = await workflowsAPI.get(item.id)
      setSelectedItem(res.item)
      setComments(res.comments || [])
    } catch {
      showError('Failed to load item details')
    }
  }

  const handleStatusChange = async (itemId: number, status: string) => {
    try {
      await workflowsAPI.update(itemId, { status })
      showSuccess(`Status updated to ${status}`)
      await loadItems()
      if (selectedItem?.id === itemId) {
        setSelectedItem({ ...selectedItem, status })
      }
    } catch {
      showError('Failed to update status')
    }
  }

  const handleAddComment = async () => {
    if (!newComment.trim() || !selectedItem) return
    try {
      await workflowsAPI.addComment(selectedItem.id, newComment.trim())
      setNewComment('')
      await loadItemDetail(selectedItem)
    } catch {
      showError('Failed to add comment')
    }
  }

  const handleCreate = async () => {
    if (!formTitle.trim()) return
    try {
      await workflowsAPI.create({ type: formType, title: formTitle.trim(), description: formDescription.trim() || undefined })
      showSuccess('Workflow item created')
      setShowCreateForm(false)
      setFormTitle('')
      setFormDescription('')
      await loadItems()
    } catch {
      showError('Failed to create workflow item')
    }
  }


  if (selectedItem) {
    return (
      <Layout>
        <div className="p-6 max-w-4xl mx-auto">
          <button onClick={() => setSelectedItem(null)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
            <ArrowLeft className="h-4 w-4" /> Back to list
          </button>
          <div className="bg-white rounded-xl border p-6 mb-4">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-xl font-bold">{selectedItem.title}</h2>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[selectedItem.status] || ''}`}>
                {selectedItem.status.replace('_', ' ')}
              </span>
              <span className="px-2 py-0.5 bg-gray-100 rounded-full text-xs">{TYPE_LABELS[selectedItem.type] || selectedItem.type}</span>
            </div>
            {selectedItem.description && <p className="text-sm text-gray-600 mb-3">{selectedItem.description}</p>}
            <div className="text-xs text-gray-400">Created by {selectedItem.creator_name} on {new Date(selectedItem.created_at).toLocaleDateString()}</div>
            <div className="flex gap-2 mt-4">
              {['open', 'in_review', 'approved', 'rejected', 'resolved'].filter(s => s !== selectedItem.status).map(s => (
                <button key={s} onClick={() => handleStatusChange(selectedItem.id, s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium ${STATUS_COLORS[s] || 'bg-gray-100'} hover:opacity-80`}>
                  {s.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Comments</h3>
            {comments.length === 0 ? (
              <p className="text-sm text-gray-400 mb-4">No comments yet.</p>
            ) : (
              <div className="space-y-3 mb-4">
                {comments.map(c => (
                  <div key={c.id} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium">{c.user_name}</span>
                      <span className="text-xs text-gray-400">{new Date(c.created_at).toLocaleString()}</span>
                    </div>
                    <p className="text-sm text-gray-700">{c.comment}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input type="text" value={newComment} onChange={e => setNewComment(e.target.value)}
                placeholder="Add a comment..." className="flex-1 px-3 py-2 border rounded-lg text-sm"
                onKeyDown={e => e.key === 'Enter' && handleAddComment()} />
              <button onClick={handleAddComment} className="px-4 py-2 bg-accent-600 text-white rounded-lg text-sm">Send</button>
            </div>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="p-6 max-w-5xl mx-auto">
        <Breadcrumbs />
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <ClipboardList className="h-8 w-8 text-indigo-600" />
              FinOps Reviews
              <FeatureInfoButton featureId="workflows" />
            </h1>
            <p className="text-sm text-gray-500 mt-1">Review anomalies, approve optimizations, and track cost decisions</p>
          </div>
          <button onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-accent-600 text-white rounded-lg hover:bg-accent-700 text-sm">
            <Plus className="h-4 w-4" /> New Item
          </button>
        </div>

        {showCreateForm && (
          <div className="mb-6 p-5 bg-white rounded-xl border shadow-sm">
            <h3 className="font-semibold mb-4">Create Review Item</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Title</label>
                <input type="text" value={formTitle} onChange={e => setFormTitle(e.target.value)}
                  placeholder="e.g. Review EC2 cost spike" className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Type</label>
                <select value={formType} onChange={e => setFormType(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-white">
                  <option value="anomaly_review">Anomaly Review</option>
                  <option value="optimization_approval">Optimization Approval</option>
                  <option value="budget_review">Budget Review</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs text-gray-500 mb-1">Description</label>
                <input type="text" value={formDescription} onChange={e => setFormDescription(e.target.value)}
                  placeholder="Optional details..." className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleCreate} className="px-4 py-2 bg-accent-600 text-white rounded-lg text-sm">Create</button>
              <button onClick={() => setShowCreateForm(false)} className="px-4 py-2 bg-gray-100 rounded-lg text-sm">Cancel</button>
            </div>
          </div>
        )}

        <div className="flex gap-2 mb-6">
          {['', 'open', 'in_review', 'approved', 'rejected', 'resolved'].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${filterStatus === s ? 'bg-accent-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {s ? s.replace('_', ' ') : 'All'}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 rounded-full border-2 border-gray-200 border-t-gray-600 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border">
            <ClipboardList className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-lg font-medium text-gray-700">No review items</p>
            <p className="text-sm text-gray-500 mt-1">Create items manually or they'll be auto-generated from anomalies and optimizations.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map(item => (
              <button key={item.id} onClick={() => loadItemDetail(item)}
                className="w-full text-left bg-white rounded-xl border p-4 hover:border-accent-300 transition">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{item.title}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[item.status] || ''}`}>
                        {item.status.replace('_', ' ')}
                      </span>
                      <span className="px-2 py-0.5 bg-gray-100 rounded-full text-xs">{TYPE_LABELS[item.type] || item.type}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      by {item.creator_name} &middot; {new Date(item.created_at).toLocaleDateString()}
                      {item.assignee_name && <> &middot; assigned to {item.assignee_name}</>}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-gray-300" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}

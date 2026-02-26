import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNotification } from '../contexts/NotificationContext'
import { organizationsAPI } from '../services/api'
import Layout from '../components/Layout'
import Breadcrumbs from '../components/Breadcrumbs'
import { Building2, UserPlus, Crown, Shield, Eye, Users, Mail, Trash2 } from 'lucide-react'

interface Member {
  id: number
  user_id: number
  name: string
  email: string
  avatar_url: string | null
  role: string
  joined_at: string
}

interface Invite {
  id: number
  email: string
  role: string
  invited_by_name: string
  created_at: string
}

interface Organization {
  id: number
  name: string
  slug: string
  owner_id: number
  member_role: string
  created_at: string
}

const ROLE_ICONS: Record<string, typeof Crown> = {
  owner: Crown,
  admin: Shield,
  member: Users,
  viewer: Eye,
}

const ROLE_COLORS: Record<string, string> = {
  owner: 'text-yellow-600 bg-yellow-50',
  admin: 'text-purple-600 bg-purple-50',
  member: 'text-blue-600 bg-blue-50',
  viewer: 'text-gray-600 bg-gray-50',
}

export default function OrganizationPage() {
  const { isDemoMode } = useAuth()
  const { showSuccess, showError } = useNotification()
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [showCreateOrg, setShowCreateOrg] = useState(false)
  const [newOrgName, setNewOrgName] = useState('')

  useEffect(() => {
    if (!isDemoMode) loadOrganizations()
  }, [isDemoMode])

  const loadOrganizations = async () => {
    try {
      setIsLoading(true)
      const response = await organizationsAPI.list()
      setOrganizations(response.organizations || [])
      if (response.organizations?.length > 0) {
        await selectOrg(response.organizations[0])
      }
    } catch (error) {
      showError('Failed to load organizations')
    } finally {
      setIsLoading(false)
    }
  }

  const selectOrg = async (org: Organization) => {
    setSelectedOrg(org)
    try {
      const [membersRes, invitesRes] = await Promise.all([
        organizationsAPI.getMembers(org.id),
        org.member_role === 'owner' || org.member_role === 'admin'
          ? organizationsAPI.getInvites(org.id)
          : Promise.resolve({ invites: [] }),
      ])
      setMembers(membersRes.members || [])
      setInvites(invitesRes.invites || [])
    } catch {
      setMembers([])
      setInvites([])
    }
  }

  const handleCreateOrg = async () => {
    if (!newOrgName.trim()) return
    try {
      await organizationsAPI.create(newOrgName.trim())
      showSuccess('Organization created')
      setNewOrgName('')
      setShowCreateOrg(false)
      await loadOrganizations()
    } catch {
      showError('Failed to create organization')
    }
  }

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !selectedOrg) return
    try {
      await organizationsAPI.createInvite(selectedOrg.id, inviteEmail.trim(), inviteRole)
      showSuccess(`Invite sent to ${inviteEmail}`)
      setInviteEmail('')
      setShowInviteForm(false)
      const res = await organizationsAPI.getInvites(selectedOrg.id)
      setInvites(res.invites || [])
    } catch {
      showError('Failed to send invite')
    }
  }

  const handleRoleChange = async (userId: number, newRole: string) => {
    if (!selectedOrg) return
    try {
      await organizationsAPI.updateMemberRole(selectedOrg.id, userId, newRole)
      showSuccess('Role updated')
      await selectOrg(selectedOrg)
    } catch {
      showError('Failed to update role')
    }
  }

  const handleRemoveMember = async (userId: number) => {
    if (!selectedOrg || !confirm('Remove this member?')) return
    try {
      await organizationsAPI.removeMember(selectedOrg.id, userId)
      showSuccess('Member removed')
      await selectOrg(selectedOrg)
    } catch {
      showError('Failed to remove member')
    }
  }

  const isAdmin = selectedOrg?.member_role === 'owner' || selectedOrg?.member_role === 'admin'

  if (isDemoMode) {
    return (
      <Layout>
        <div className="p-6">
          <Breadcrumbs />
          <div className="text-center py-12 text-gray-500">Organization management is not available in demo mode.</div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="p-6 max-w-5xl mx-auto">
        <Breadcrumbs />
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Building2 className="h-8 w-8 text-accent-600" />
            Organization
          </h1>
          <button
            onClick={() => setShowCreateOrg(true)}
            className="px-4 py-2 bg-accent-600 text-white rounded-lg hover:bg-accent-700 text-sm"
          >
            New Organization
          </button>
        </div>

        {/* Create Org Modal */}
        {showCreateOrg && (
          <div className="mb-6 p-4 bg-white rounded-lg border shadow-sm">
            <h3 className="font-semibold mb-3">Create Organization</h3>
            <div className="flex gap-2">
              <input
                type="text" value={newOrgName} onChange={e => setNewOrgName(e.target.value)}
                placeholder="Organization name" className="flex-1 px-3 py-2 border rounded-lg text-sm"
              />
              <button onClick={handleCreateOrg} className="px-4 py-2 bg-accent-600 text-white rounded-lg text-sm">Create</button>
              <button onClick={() => setShowCreateOrg(false)} className="px-4 py-2 bg-gray-100 rounded-lg text-sm">Cancel</button>
            </div>
          </div>
        )}

        {/* Org Selector */}
        {organizations.length > 1 && (
          <div className="flex gap-2 mb-6">
            {organizations.map(org => (
              <button key={org.id} onClick={() => selectOrg(org)}
                className={`px-4 py-2 rounded-lg text-sm ${selectedOrg?.id === org.id
                  ? 'bg-accent-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                {org.name}
              </button>
            ))}
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-800" />
          </div>
        ) : selectedOrg ? (
          <div className="space-y-6">
            {/* Members */}
            <div className="bg-white rounded-xl border p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Members ({members.length})</h2>
                {isAdmin && (
                  <button onClick={() => setShowInviteForm(!showInviteForm)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-accent-50 text-accent-600 rounded-lg text-sm hover:bg-accent-100">
                    <UserPlus className="h-4 w-4" /> Invite
                  </button>
                )}
              </div>

              {/* Invite Form */}
              {showInviteForm && isAdmin && (
                <div className="mb-4 p-3 bg-gray-50 rounded-lg flex gap-2 items-end">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">Email</label>
                    <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                      placeholder="user@example.com" className="w-full px-3 py-2 border rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Role</label>
                    <select value={inviteRole} onChange={e => setInviteRole(e.target.value)}
                      className="px-3 py-2 border rounded-lg text-sm">
                      <option value="admin">Admin</option>
                      <option value="member">Member</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </div>
                  <button onClick={handleInvite} className="px-4 py-2 bg-accent-600 text-white rounded-lg text-sm">Send</button>
                </div>
              )}

              {/* Member List */}
              <div className="space-y-2">
                {members.map(member => {
                  const RoleIcon = ROLE_ICONS[member.role] || Users
                  return (
                    <div key={member.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50">
                      <div className="flex items-center gap-3">
                        {member.avatar_url ? (
                          <img src={member.avatar_url} alt="" className="h-8 w-8 rounded-full" />
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-accent-100 flex items-center justify-center text-accent-600 font-semibold text-sm">
                            {member.name?.charAt(0).toUpperCase() || '?'}
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-medium">{member.name}</p>
                          <p className="text-xs text-gray-500">{member.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${ROLE_COLORS[member.role]}`}>
                          <RoleIcon className="h-3 w-3" />
                          {member.role}
                        </span>
                        {isAdmin && member.role !== 'owner' && (
                          <div className="flex items-center gap-1">
                            <select value={member.role} onChange={e => handleRoleChange(member.user_id, e.target.value)}
                              className="text-xs border rounded px-1 py-0.5">
                              <option value="admin">Admin</option>
                              <option value="member">Member</option>
                              <option value="viewer">Viewer</option>
                            </select>
                            <button onClick={() => handleRemoveMember(member.user_id)}
                              className="p-1 text-red-400 hover:text-red-600">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Pending Invites */}
            {isAdmin && invites.length > 0 && (
              <div className="bg-white rounded-xl border p-6">
                <h2 className="text-lg font-semibold mb-4">Pending Invites ({invites.length})</h2>
                <div className="space-y-2">
                  {invites.map(invite => (
                    <div key={invite.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                      <div className="flex items-center gap-3">
                        <Mail className="h-5 w-5 text-gray-400" />
                        <div>
                          <p className="text-sm font-medium">{invite.email}</p>
                          <p className="text-xs text-gray-500">Invited by {invite.invited_by_name} as {invite.role}</p>
                        </div>
                      </div>
                      <button onClick={async () => {
                        await organizationsAPI.deleteInvite(selectedOrg.id, invite.id)
                        const res = await organizationsAPI.getInvites(selectedOrg.id)
                        setInvites(res.invites || [])
                      }} className="text-xs text-red-500 hover:text-red-700">Cancel</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            No organization found. Create one to get started.
          </div>
        )}
      </div>
    </Layout>
  )
}

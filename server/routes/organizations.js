import express from 'express'
import { authenticateToken } from '../middleware/auth.js'
import { attachOrg, requireOrgRole } from '../middleware/orgAuth.js'
import {
  createOrganization, getOrganizationsByUser, getOrganizationById,
  getOrganizationMembers, addOrganizationMember, removeOrganizationMember,
  updateMemberRole, createOrganizationInvite, getOrganizationInvites,
  acceptOrganizationInvite, deleteOrganizationInvite, updateOrganization,
  getUserByEmail, migrateExistingUsersToOrgs
} from '../database.js'
import logger from '../utils/logger.js'

const router = express.Router()
router.use(authenticateToken)

/**
 * GET /api/organizations
 * List all organizations the user belongs to
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const orgs = await getOrganizationsByUser(userId)
    res.json({ organizations: orgs })
  } catch (error) {
    logger.error('Error listing organizations', { error: error.message })
    res.status(500).json({ error: 'Failed to list organizations' })
  }
})

/**
 * POST /api/organizations
 * Create a new organization
 */
router.post('/', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const { name } = req.body
    if (!name || name.trim().length < 2) {
      return res.status(400).json({ error: 'Organization name must be at least 2 characters' })
    }
    const org = await createOrganization(name.trim(), userId)
    res.status(201).json({ organization: org })
  } catch (error) {
    logger.error('Error creating organization', { error: error.message })
    res.status(500).json({ error: 'Failed to create organization' })
  }
})

/**
 * GET /api/organizations/:id
 * Get organization details
 */
router.get('/:id', attachOrg, async (req, res) => {
  try {
    const orgId = parseInt(req.params.id, 10)
    const userId = req.user.userId || req.user.id
    const org = await getOrganizationById(orgId)
    if (!org) return res.status(404).json({ error: 'Organization not found' })
    // Verify membership via attachOrg check
    if (req.orgId !== orgId) {
      return res.status(403).json({ error: 'Not a member of this organization' })
    }
    const members = await getOrganizationMembers(orgId)
    res.json({ organization: org, members, role: req.orgRole })
  } catch (error) {
    logger.error('Error getting organization', { error: error.message })
    res.status(500).json({ error: 'Failed to get organization' })
  }
})

/**
 * PUT /api/organizations/:id
 * Update organization name (admin+ only)
 */
router.put('/:id', attachOrg, requireOrgRole('admin'), async (req, res) => {
  try {
    const orgId = parseInt(req.params.id, 10)
    const { name } = req.body
    if (!name || name.trim().length < 2) {
      return res.status(400).json({ error: 'Organization name must be at least 2 characters' })
    }
    const org = await updateOrganization(orgId, { name: name.trim() })
    res.json({ organization: org })
  } catch (error) {
    logger.error('Error updating organization', { error: error.message })
    res.status(500).json({ error: 'Failed to update organization' })
  }
})

/**
 * GET /api/organizations/:id/members
 * List organization members
 */
router.get('/:id/members', attachOrg, async (req, res) => {
  try {
    const orgId = parseInt(req.params.id, 10)
    if (req.orgId !== orgId) {
      return res.status(403).json({ error: 'Not a member of this organization' })
    }
    const members = await getOrganizationMembers(orgId)
    res.json({ members })
  } catch (error) {
    logger.error('Error listing members', { error: error.message })
    res.status(500).json({ error: 'Failed to list members' })
  }
})

/**
 * PUT /api/organizations/:id/members/:userId/role
 * Update a member's role (admin+ only)
 */
router.put('/:id/members/:userId/role', attachOrg, requireOrgRole('admin'), async (req, res) => {
  try {
    const orgId = parseInt(req.params.id, 10)
    const targetUserId = parseInt(req.params.userId, 10)
    const { role } = req.body
    if (!['admin', 'member', 'viewer'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be admin, member, or viewer' })
    }
    const updated = await updateMemberRole(orgId, targetUserId, role)
    if (!updated) return res.status(400).json({ error: 'Cannot change owner role' })
    res.json({ member: updated })
  } catch (error) {
    logger.error('Error updating member role', { error: error.message })
    res.status(500).json({ error: 'Failed to update member role' })
  }
})

/**
 * DELETE /api/organizations/:id/members/:userId
 * Remove a member (admin+ only)
 */
router.delete('/:id/members/:userId', attachOrg, requireOrgRole('admin'), async (req, res) => {
  try {
    const orgId = parseInt(req.params.id, 10)
    const targetUserId = parseInt(req.params.userId, 10)
    await removeOrganizationMember(orgId, targetUserId)
    res.json({ success: true })
  } catch (error) {
    logger.error('Error removing member', { error: error.message })
    res.status(500).json({ error: 'Failed to remove member' })
  }
})

/**
 * POST /api/organizations/:id/invites
 * Create an invite (admin+ only)
 */
router.post('/:id/invites', attachOrg, requireOrgRole('admin'), async (req, res) => {
  try {
    const orgId = parseInt(req.params.id, 10)
    const userId = req.user.userId || req.user.id
    const { email, role } = req.body
    if (!email) return res.status(400).json({ error: 'Email is required' })
    if (role && !['admin', 'member', 'viewer'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' })
    }
    const invite = await createOrganizationInvite(orgId, email, role || 'member', userId)
    // TODO: Send invite email via emailService
    res.status(201).json({ invite })
  } catch (error) {
    logger.error('Error creating invite', { error: error.message })
    res.status(500).json({ error: 'Failed to create invite' })
  }
})

/**
 * GET /api/organizations/:id/invites
 * List pending invites (admin+ only)
 */
router.get('/:id/invites', attachOrg, requireOrgRole('admin'), async (req, res) => {
  try {
    const orgId = parseInt(req.params.id, 10)
    const invites = await getOrganizationInvites(orgId)
    res.json({ invites })
  } catch (error) {
    logger.error('Error listing invites', { error: error.message })
    res.status(500).json({ error: 'Failed to list invites' })
  }
})

/**
 * DELETE /api/organizations/:id/invites/:inviteId
 * Cancel an invite (admin+ only)
 */
router.delete('/:id/invites/:inviteId', attachOrg, requireOrgRole('admin'), async (req, res) => {
  try {
    const orgId = parseInt(req.params.id, 10)
    const inviteId = parseInt(req.params.inviteId, 10)
    await deleteOrganizationInvite(orgId, inviteId)
    res.json({ success: true })
  } catch (error) {
    logger.error('Error deleting invite', { error: error.message })
    res.status(500).json({ error: 'Failed to delete invite' })
  }
})

/**
 * POST /api/organizations/accept-invite
 * Accept an organization invite
 */
router.post('/accept-invite', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id
    const { token } = req.body
    if (!token) return res.status(400).json({ error: 'Invite token is required' })
    const invite = await acceptOrganizationInvite(token, userId)
    if (!invite) return res.status(400).json({ error: 'Invalid or expired invite' })
    res.json({ success: true, organizationId: invite.organization_id })
  } catch (error) {
    logger.error('Error accepting invite', { error: error.message })
    res.status(500).json({ error: 'Failed to accept invite' })
  }
})

/**
 * POST /api/organizations/migrate
 * One-time migration: create default orgs for existing users (admin only)
 */
router.post('/migrate', async (req, res) => {
  try {
    const count = await migrateExistingUsersToOrgs()
    res.json({ migrated: count })
  } catch (error) {
    logger.error('Error migrating users', { error: error.message })
    res.status(500).json({ error: 'Migration failed' })
  }
})

export default router

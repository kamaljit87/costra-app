import { getUserOrgMembership, getOrganizationsByUser } from '../database.js'
import logger from '../utils/logger.js'

/**
 * Middleware to attach organization context to the request.
 * Reads org ID from X-Organization-Id header or query param.
 * If no org specified, uses the user's first/default org.
 * Sets req.orgId and req.orgRole on the request.
 */
export const attachOrg = async (req, res, next) => {
  try {
    const userId = req.user?.userId || req.user?.id
    if (!userId) return next()

    let orgId = req.headers['x-organization-id'] || req.query.orgId
    if (orgId) orgId = parseInt(orgId, 10)

    if (orgId) {
      const membership = await getUserOrgMembership(orgId, userId)
      if (!membership) {
        return res.status(403).json({ error: 'Not a member of this organization' })
      }
      req.orgId = orgId
      req.orgRole = membership.role
    } else {
      // Default to first org
      const orgs = await getOrganizationsByUser(userId)
      if (orgs.length > 0) {
        req.orgId = orgs[0].id
        req.orgRole = orgs[0].member_role
      }
    }

    next()
  } catch (error) {
    logger.error('Error attaching org context', { error: error.message })
    next()
  }
}

/**
 * Factory: require a minimum org role to proceed.
 * Role hierarchy: owner > admin > member > viewer
 */
const ROLE_LEVELS = { owner: 4, admin: 3, member: 2, viewer: 1 }

export const requireOrgRole = (minRole) => {
  return (req, res, next) => {
    if (!req.orgId || !req.orgRole) {
      return res.status(403).json({ error: 'Organization context required' })
    }
    const userLevel = ROLE_LEVELS[req.orgRole] || 0
    const requiredLevel = ROLE_LEVELS[minRole] || 0
    if (userLevel < requiredLevel) {
      return res.status(403).json({ error: `Requires ${minRole} role or higher` })
    }
    next()
  }
}

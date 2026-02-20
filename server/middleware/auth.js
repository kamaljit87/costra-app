import jwt from 'jsonwebtoken'
import crypto from 'node:crypto'
import { getUserIdByApiKeyHash, isUserAdmin } from '../database.js'

export const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1] // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' })
  }

  // API key (read-only): costra_<hex>
  if (token.startsWith('costra_') && token.length > 20) {
    try {
      const keyHash = crypto.createHash('sha256').update(token).digest('hex')
      const userId = await getUserIdByApiKeyHash(keyHash)
      if (userId) {
        req.user = { userId, id: userId }
        return next()
      }
    } catch (_) {}
    return res.status(403).json({ error: 'Invalid API key' })
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' })
    }
    req.user = user
    next()
  })
}

/** Require admin role (must be used after authenticateToken) */
export const requireAdmin = async (req, res, next) => {
  try {
    const userId = req.user?.userId || req.user?.id
    if (!userId) return res.status(401).json({ error: 'Authentication required' })
    const admin = await isUserAdmin(userId)
    if (!admin) return res.status(403).json({ error: 'Admin access required' })
    next()
  } catch (err) {
    res.status(500).json({ error: 'Failed to verify admin status' })
  }
}

/** Require JWT only (used for key management; API keys cannot create/delete keys) */
export const requireJwt = (req, res, next) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]
  if (!token) return res.status(401).json({ error: 'Access token required' })
  if (token.startsWith('costra_')) return res.status(403).json({ error: 'API keys cannot manage keys; use your session token' })
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' })
    req.user = user
    next()
  })
}

/**
 * Pagination utilities
 * Day 5: Database & Performance optimizations
 */

/**
 * Parse pagination parameters from request
 * @param {Object} req - Express request object
 * @param {Object} defaults - Default pagination values
 * @param {number} defaults.page - Default page number (default: 1)
 * @param {number} defaults.limit - Default items per page (default: 50)
 * @param {number} defaults.maxLimit - Maximum items per page (default: 1000)
 * @returns {Object} Pagination parameters { page, limit, offset }
 */
export const parsePagination = (req, defaults = {}) => {
  const {
    page: defaultPage = 1,
    limit: defaultLimit = 50,
    maxLimit = 1000,
  } = defaults

  const page = Math.max(1, parseInt(req.query.page, 10) || defaultPage)
  let limit = parseInt(req.query.limit, 10) || defaultLimit
  limit = Math.min(Math.max(1, limit), maxLimit) // Clamp between 1 and maxLimit
  const offset = (page - 1) * limit

  return { page, limit, offset }
}

/**
 * Create pagination metadata
 * @param {number} page - Current page
 * @param {number} limit - Items per page
 * @param {number} total - Total items
 * @returns {Object} Pagination metadata
 */
export const createPaginationMeta = (page, limit, total) => {
  const totalPages = Math.ceil(total / limit)
  const hasMore = page < totalPages
  const hasPrev = page > 1

  return {
    page,
    limit,
    total,
    totalPages,
    hasMore,
    hasPrev,
  }
}

/**
 * Create paginated response
 * @param {Array} data - Array of items
 * @param {Object} meta - Pagination metadata
 * @returns {Object} Paginated response
 */
export const createPaginatedResponse = (data, meta) => {
  return {
    data,
    pagination: meta,
  }
}

/**
 * Cost cache CSV: persist fetched cost data per user/account/month so we can
 * serve from cache without calling the cloud provider every time.
 * Sync and fetch-month write CSV; cost data layer can load from CSV when DB has no row.
 */

import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import logger from '../utils/logger.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const CACHE_DIR = process.env.COST_CACHE_DIR || path.join(__dirname, '..', 'storage', 'cost-cache')

/** Ensure the cost-cache root directory exists (call on startup). */
export async function ensureCostCacheDir() {
  await fs.mkdir(CACHE_DIR, { recursive: true })
}

function getCSVPath(userId, accountId, year, month) {
  const monthStr = String(month).padStart(2, '0')
  return path.join(CACHE_DIR, String(userId), String(accountId), `${year}-${monthStr}.csv`)
}

/**
 * Ensure directory exists for a file path
 */
async function ensureDir(filePath) {
  const dir = path.dirname(filePath)
  await fs.mkdir(dir, { recursive: true })
}

/**
 * Write cost data for a user/account/month to CSV.
 * @param {number} userId
 * @param {number} accountId
 * @param {number} year
 * @param {number} month
 * @param {Object} data - { dailyData: [{ date, cost }], services: [{ name, cost, change? }], total: number }
 */
export async function writeCostCacheCSV(userId, accountId, year, month, data) {
  const filePath = getCSVPath(userId, accountId, year, month)
  try {
    await ensureDir(filePath)
    const lines = ['date,cost,service_name']
    const dailyData = data.dailyData || []
    const services = data.services || []
    const total = data.total != null ? data.total : dailyData.reduce((s, d) => s + (Number(d.cost) || 0), 0)

    for (const d of dailyData) {
      const date = (d.date || '').toString().split('T')[0]
      const cost = Number(d.cost) || 0
      lines.push(`${date},${cost},`)
    }
    for (const s of services) {
      const name = (s.name || '').replace(/,/g, ';')
      const cost = Number(s.cost) || 0
      lines.push(`,${cost},${name}`)
    }
    lines.push(`TOTAL,${total},`)

    await fs.writeFile(filePath, lines.join('\n'), 'utf8')
    logger.debug('Cost cache CSV written', { userId, accountId, year, month, path: filePath })
  } catch (err) {
    logger.warn('Cost cache CSV write failed', { userId, accountId, year, month, error: err.message })
  }
}

/**
 * Read cost data for a user/account/month from CSV.
 * @returns {Promise<{ dailyData: Array<{date, cost}>, services: Array<{name, cost, change}>, total: number } | null>}
 */
export async function readCostCacheCSV(userId, accountId, year, month) {
  const filePath = getCSVPath(userId, accountId, year, month)
  try {
    const raw = await fs.readFile(filePath, 'utf8')
    const lines = raw.split(/\r?\n/).filter(Boolean)
    if (lines.length < 2) return null

    const dailyData = []
    const services = []
    let total = 0

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]
      const parts = line.split(',')
      const date = (parts[0] || '').trim()
      const cost = parseFloat(parts[1]) || 0
      const serviceName = (parts[2] || '').trim().replace(/;/g, ',')

      if (date.toUpperCase() === 'TOTAL') {
        total = cost
        continue
      }
      if (serviceName) {
        services.push({ name: serviceName, cost, change: 0 })
      } else if (date) {
        dailyData.push({ date, cost })
      }
    }

    if (total === 0 && dailyData.length > 0) {
      total = dailyData.reduce((s, d) => s + (d.cost || 0), 0)
    }

    return { dailyData, services, total }
  } catch (err) {
    if (err.code !== 'ENOENT') {
      logger.warn('Cost cache CSV read failed', { userId, accountId, year, month, error: err.message })
    }
    return null
  }
}

/**
 * Try to load a month from CSV for all given accounts. Returns array of loaded data per account.
 * @param {number} userId
 * @param {Array<{ id, provider_id, provider_name, account_alias }>} accounts
 * @param {number} year
 * @param {number} month
 * @returns {Promise<Array<{ account, dailyData, services, total }>>}
 */
export async function loadMonthFromCSVForAccounts(userId, accounts, year, month) {
  const out = []
  for (const account of accounts) {
    const data = await readCostCacheCSV(userId, account.id, year, month)
    if (data && (data.dailyData?.length > 0 || data.services?.length > 0)) {
      out.push({
        account,
        dailyData: data.dailyData,
        services: data.services,
        total: data.total,
      })
    }
  }
  return out
}

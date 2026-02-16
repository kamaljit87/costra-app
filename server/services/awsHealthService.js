/**
 * Fetches AWS billing/cost-related health or status notifications and creates
 * in-app notifications for users who have AWS connected.
 *
 * Uses a configurable RSS feed (e.g. AWS status page). No AWS credentials required.
 */

import logger from '../utils/logger.js'
import { createNotification, getUserIdsWithProvider, saveProviderHealthEvent } from '../database.js'

const AWS_PROVIDER_ID = 'aws'

/** RSS URL; set COSTRA_AWS_HEALTH_RSS_URL to override. Tries billing feed first, then general. */
const RSS_URLS = [
  process.env.COSTRA_AWS_HEALTH_RSS_URL,
  'https://status.aws.amazon.com/rss/billing.rss',
  'https://status.aws.amazon.com/rss/health.rss',
].filter(Boolean)

/** Keywords in title/description that indicate billing/cost relevance */
const BILLING_KEYWORDS = [
  'cost',
  'billing',
  'cost explorer',
  'data export',
  'data exports',
  'cur',
  'cost and usage',
  'usage report',
  'invoice',
  'payment',
]

function isBillingRelevant(text) {
  if (!text || typeof text !== 'string') return false
  const lower = text.toLowerCase()
  return BILLING_KEYWORDS.some((k) => lower.includes(k))
}

/**
 * Parse RSS 2.0 XML into items with title, link, description, pubDate
 */
function parseRssItems(xml) {
  const items = []
  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi
  let match
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1]
    const title = block.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<[^>]+>/g, '').trim() || ''
    const link = block.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1]?.trim() || ''
    const desc = block.match(/<description[^>]*>([\s\S]*?)<\/description>/i)?.[1]?.replace(/<[^>]+>/g, '').trim() || ''
    const pubDate = block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1]?.trim() || ''
    if (title) items.push({ title, link, description: desc, pubDate })
  }
  return items
}

/**
 * Generate a stable external id for deduplication
 */
function externalId(item) {
  const str = `${item.title}|${item.pubDate}|${item.link}`
  let h = 0
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i)
    h = (h << 5) - h + c
    h = h & h
  }
  return `aws-${Math.abs(h).toString(36)}`
}

/**
 * Fetch RSS from one of the configured URLs and return parsed items (billing-relevant only)
 */
export async function fetchAwsBillingHealthFeed(urlList = RSS_URLS) {
  const urls = Array.isArray(urlList) ? urlList : [urlList]
  for (const url of urls) {
    if (!url) continue
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(15000),
        headers: { Accept: 'application/rss+xml, application/xml, text/xml' },
      })
      if (!res.ok) {
        logger.debug('AWS health RSS fetch failed', { url, status: res.status })
        continue
      }
      const xml = await res.text()
      const items = parseRssItems(xml)
      const relevant = items.filter((item) => isBillingRelevant(item.title) || isBillingRelevant(item.description))
      logger.debug('AWS health feed fetched', { url, total: items.length, billingRelevant: relevant.length })
      return relevant
    } catch (err) {
      logger.debug('AWS health RSS fetch error', { url, error: err.message })
    }
  }
  return []
}

/**
 * Fetch AWS billing-related health items, persist new events, and create notifications
 * for all users who have AWS connected. Call from cron (e.g. every 1–2 hours).
 */
export async function fetchAndNotifyAwsBillingIssues() {
  const items = await fetchAwsBillingHealthFeed()
  if (items.length === 0) return { notified: 0, events: 0 }

  const userIds = await getUserIdsWithProvider(AWS_PROVIDER_ID)
  if (userIds.length === 0) {
    logger.debug('No AWS users to notify for billing issues')
    return { notified: 0, events: items.length }
  }

  let newEvents = 0
  let notificationsCreated = 0

  for (const item of items) {
    const eventDate = item.pubDate ? new Date(item.pubDate) : null
    const extId = externalId(item)
    const message = (item.description || item.title).slice(0, 500)
    const link = item.link || 'https://health.aws.amazon.com/health/status'
    const inserted = await saveProviderHealthEvent(AWS_PROVIDER_ID, extId, item.title, message, link, eventDate)
    if (!inserted) continue
    newEvents += 1
    for (const userId of userIds) {
      try {
        await createNotification(userId, {
          type: 'provider_alert',
          title: 'AWS: ' + item.title,
          message,
          link,
          linkText: 'View status',
          metadata: { providerId: AWS_PROVIDER_ID, externalId: extId },
        })
        notificationsCreated += 1
      } catch (err) {
        logger.error('Failed to create AWS billing alert notification', { userId, error: err.message })
      }
    }
  }

  if (newEvents > 0) {
    logger.info('AWS billing health notifications created', {
      newEvents,
      userIds: userIds.length,
      notificationsCreated,
    })
  }

  return { notified: notificationsCreated, events: newEvents }
}

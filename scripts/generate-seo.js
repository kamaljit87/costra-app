#!/usr/bin/env node

/**
 * SEO Asset Generator for Costdoq
 * ================================
 * Generates production-ready sitemap.xml and robots.txt for costdoq.com.
 *
 * Architecture:
 *   - Reads public routes from a single config (STATIC_ROUTES)
 *   - Auto-discovers blog posts from src/content/blog/*.md frontmatter
 *   - Validates XML output before writing
 *   - Supports sitemap index splitting at 50,000 URLs
 *   - Optionally pings Google after generation
 *
 * Usage:
 *   node scripts/generate-seo.js                # Generate to public/
 *   node scripts/generate-seo.js --ping         # Generate + ping Google
 *   node scripts/generate-seo.js --out dist     # Generate to dist/
 *
 * Automation:
 *   - Runs automatically during Vite build (via vite-plugin-blog closeBundle)
 *   - Can be added to CI/CD: "node scripts/generate-seo.js --ping"
 *   - Can run as daily cron: 0 3 * * * cd /var/servers/costdoq-app && node scripts/generate-seo.js --ping
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

// ─── Configuration ──────────────────────────────────────────────────────────

const SITE_URL = 'https://costdoq.com'
const BLOG_DIR = path.join(ROOT, 'src/content/blog')
const MAX_URLS_PER_SITEMAP = 50_000

/**
 * All public marketing pages on costdoq.com that should be indexed.
 * Protected/auth/admin routes are excluded — they live on app.costdoq.com.
 *
 * To add a new page: add an entry here and it will appear in both
 * sitemap.xml and be allowed in robots.txt automatically.
 */
const STATIC_ROUTES = [
  { path: '/',        changefreq: 'weekly',  priority: '1.0' },
  { path: '/blog',    changefreq: 'daily',   priority: '0.9' },
  { path: '/contact', changefreq: 'monthly', priority: '0.6' },
  { path: '/privacy', changefreq: 'yearly',  priority: '0.3' },
  { path: '/terms',   changefreq: 'yearly',  priority: '0.3' },
]

/**
 * Routes that crawlers must never index.
 * Organized by category for maintainability.
 */
const DISALLOWED_ROUTES = {
  auth: [
    '/login', '/signup', '/waitlist', '/forgot-password',
    '/reset-password', '/verify-email', '/confirm-delete',
    '/cancel-delete', '/verify-email-change', '/cancel-email-change',
    '/auth/',
  ],
  app: [
    '/dashboard', '/settings', '/profile', '/provider/',
    '/budgets', '/products', '/teams', '/compare',
    '/recommendations', '/reports', '/organization',
    '/anomalies', '/policies', '/forecasts', '/kubernetes',
    '/workflows', '/savings-plans', '/allocations', '/terraform',
    '/saas', '/custom-dashboard', '/bill-analyzer', '/rightsizing',
    '/docs', '/chat-demo',
  ],
  internal: [
    '/admin/', '/debug', '/internal/', '/api/',
  ],
}

// ─── Blog Discovery ─────────────────────────────────────────────────────────

/**
 * Parse YAML frontmatter from markdown files without requiring gray-matter.
 * Handles simple key: "value" pairs — sufficient for date and slug extraction.
 */
function parseFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match) return {}
  const data = {}
  for (const line of match[1].split('\n')) {
    const kv = line.match(/^(\w[\w-]*)\s*:\s*(.*)$/)
    if (!kv) continue
    data[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, '')
  }
  return data
}

/**
 * Discover all blog posts from markdown files in src/content/blog/.
 * Returns array of { slug, date } sorted newest-first.
 */
function discoverBlogPosts() {
  if (!fs.existsSync(BLOG_DIR)) return []
  return fs.readdirSync(BLOG_DIR)
    .filter(f => f.endsWith('.md'))
    .map(file => {
      const raw = fs.readFileSync(path.join(BLOG_DIR, file), 'utf-8')
      const data = parseFrontmatter(raw)
      return {
        slug: data.slug || file.replace(/\.md$/, ''),
        date: data.date || '',
      }
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

// ─── Sitemap Generation ─────────────────────────────────────────────────────

/** Escape XML special characters in URLs */
function escXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** Build a single <url> entry */
function urlEntry({ loc, lastmod, changefreq, priority }) {
  return `  <url>
    <loc>${escXml(loc)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`
}

/** Build a complete sitemap XML string from an array of URL objects */
function buildSitemap(urls) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(urlEntry).join('\n')}
</urlset>`
}

/** Build a sitemap index when URLs exceed MAX_URLS_PER_SITEMAP */
function buildSitemapIndex(count) {
  const today = new Date().toISOString().split('T')[0]
  const entries = []
  for (let i = 0; i < count; i++) {
    const filename = i === 0 ? 'sitemap.xml' : `sitemap-${i + 1}.xml`
    entries.push(`  <sitemap>
    <loc>${SITE_URL}/${filename}</loc>
    <lastmod>${today}</lastmod>
  </sitemap>`)
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</sitemapindex>`
}

/** Validate sitemap XML has correct structure */
function validateSitemap(xml) {
  const errors = []
  if (!xml.startsWith('<?xml version="1.0"')) {
    errors.push('Missing XML declaration')
  }
  if (!xml.includes('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
      && !xml.includes('<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')) {
    errors.push('Missing or invalid xmlns namespace')
  }
  // Every <url> must have <loc>
  const urlBlocks = xml.match(/<url>[\s\S]*?<\/url>/g) || []
  for (let i = 0; i < urlBlocks.length; i++) {
    if (!urlBlocks[i].includes('<loc>')) {
      errors.push(`URL entry #${i + 1} missing <loc>`)
    }
  }
  // Check for unescaped ampersands in URLs (common mistake)
  const locs = xml.match(/<loc>(.*?)<\/loc>/g) || []
  for (const loc of locs) {
    if (/&(?!amp;|lt;|gt;|quot;|apos;)/.test(loc)) {
      errors.push(`Unescaped ampersand in ${loc}`)
    }
  }
  return errors
}

// ─── Robots.txt Generation ──────────────────────────────────────────────────

function buildRobotsTxt() {
  const lines = [
    '# robots.txt — https://costdoq.com',
    '# Generated automatically by scripts/generate-seo.js',
    `# Last updated: ${new Date().toISOString().split('T')[0]}`,
    '#',
    '# costdoq.com    = marketing site (indexed)',
    '# app.costdoq.com = web application (not indexed)',
    '',
    'User-agent: *',
    '',
    '# Public marketing pages (explicitly allowed)',
    ...STATIC_ROUTES.map(r => `Allow: ${r.path === '/' ? '/$' : r.path}`),
    'Allow: /blog/',
    '',
    '# Auth and login flows',
    ...DISALLOWED_ROUTES.auth.map(r => `Disallow: ${r}`),
    '',
    '# Authenticated app routes',
    ...DISALLOWED_ROUTES.app.map(r => `Disallow: ${r}`),
    '',
    '# Admin, internal, and API',
    ...DISALLOWED_ROUTES.internal.map(r => `Disallow: ${r}`),
    '',
    '# Block query parameter variations from being indexed',
    'Disallow: /*?*',
    '',
    '# Crawl-delay: be polite to the server',
    'Crawl-delay: 1',
    '',
    '# Sitemap location',
    `Sitemap: ${SITE_URL}/sitemap.xml`,
    '',
    '# Specific bot rules',
    'User-agent: GPTBot',
    'Disallow: /',
    '',
    'User-agent: ChatGPT-User',
    'Disallow: /',
    '',
    'User-agent: CCBot',
    'Disallow: /',
    '',
    'User-agent: Google-Extended',
    'Disallow: /',
    '',
  ]
  return lines.join('\n')
}

// ─── Google Ping ────────────────────────────────────────────────────────────

/**
 * Notify Google that the sitemap has been updated.
 * This is a lightweight hint — Google will re-crawl on its own schedule.
 * Note: Google deprecated the ping endpoint in 2023 but still accepts it.
 * The primary method should be Google Search Console API or just waiting.
 */
async function pingGoogle() {
  const url = `https://www.google.com/ping?sitemap=${encodeURIComponent(SITE_URL + '/sitemap.xml')}`
  try {
    const res = await fetch(url)
    if (res.ok) {
      console.log(`  ✓ Pinged Google (status ${res.status})`)
    } else {
      console.warn(`  ⚠ Google ping returned ${res.status} (non-critical)`)
    }
  } catch (err) {
    console.warn(`  ⚠ Google ping failed: ${err.message} (non-critical)`)
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2)
  const shouldPing = args.includes('--ping')
  const outIdx = args.indexOf('--out')
  const outDir = outIdx !== -1 && args[outIdx + 1]
    ? path.resolve(ROOT, args[outIdx + 1])
    : path.join(ROOT, 'public')

  console.log('🔍 Generating SEO assets for costdoq.com\n')

  // 1. Discover all URLs
  const today = new Date().toISOString().split('T')[0]
  const blogPosts = discoverBlogPosts()

  const allUrls = [
    ...STATIC_ROUTES.map(r => ({
      loc: `${SITE_URL}${r.path}`,
      lastmod: today,
      changefreq: r.changefreq,
      priority: r.priority,
    })),
    ...blogPosts.map(p => ({
      loc: `${SITE_URL}/blog/${p.slug}`,
      lastmod: p.date || today,
      changefreq: 'monthly',
      priority: '0.7',
    })),
  ]

  console.log(`  Found ${STATIC_ROUTES.length} static routes`)
  console.log(`  Found ${blogPosts.length} blog posts`)
  console.log(`  Total URLs: ${allUrls.length}\n`)

  // 2. Ensure output directory exists
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true })
  }

  // 3. Generate sitemap(s)
  if (allUrls.length <= MAX_URLS_PER_SITEMAP) {
    // Single sitemap
    const xml = buildSitemap(allUrls)
    const errors = validateSitemap(xml)
    if (errors.length > 0) {
      console.error('  ✗ Sitemap validation failed:')
      errors.forEach(e => console.error(`    - ${e}`))
      process.exit(1)
    }
    fs.writeFileSync(path.join(outDir, 'sitemap.xml'), xml, 'utf-8')
    console.log(`  ✓ sitemap.xml (${allUrls.length} URLs)`)
  } else {
    // Split into multiple sitemaps + index
    const chunks = []
    for (let i = 0; i < allUrls.length; i += MAX_URLS_PER_SITEMAP) {
      chunks.push(allUrls.slice(i, i + MAX_URLS_PER_SITEMAP))
    }

    for (let i = 0; i < chunks.length; i++) {
      const filename = i === 0 ? 'sitemap.xml' : `sitemap-${i + 1}.xml`
      const xml = buildSitemap(chunks[i])
      const errors = validateSitemap(xml)
      if (errors.length > 0) {
        console.error(`  ✗ ${filename} validation failed:`)
        errors.forEach(e => console.error(`    - ${e}`))
        process.exit(1)
      }
      fs.writeFileSync(path.join(outDir, filename), xml, 'utf-8')
      console.log(`  ✓ ${filename} (${chunks[i].length} URLs)`)
    }

    const indexXml = buildSitemapIndex(chunks.length)
    fs.writeFileSync(path.join(outDir, 'sitemap-index.xml'), indexXml, 'utf-8')
    console.log(`  ✓ sitemap-index.xml (${chunks.length} sitemaps)`)
  }

  // 4. Generate robots.txt
  const robotsTxt = buildRobotsTxt()
  fs.writeFileSync(path.join(outDir, 'robots.txt'), robotsTxt, 'utf-8')
  console.log(`  ✓ robots.txt`)

  console.log(`\n  Output directory: ${outDir}`)

  // 5. Optionally ping Google
  if (shouldPing) {
    console.log('')
    return pingGoogle().then(() => {
      console.log('\n✅ Done')
    })
  }

  console.log('\n✅ Done')
  console.log('   Tip: run with --ping to notify Google of the update')
}

main()

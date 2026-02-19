import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import type { Plugin } from 'vite'

const BLOG_DIR = path.resolve(__dirname, '../src/content/blog')
const SITE_URL = 'https://costra.app'

const STATIC_ROUTES = [
  '/',
  '/blog',
  '/privacy',
  '/terms',
  '/contact',
]

function getBlogPosts() {
  if (!fs.existsSync(BLOG_DIR)) return []
  const files = fs.readdirSync(BLOG_DIR).filter(f => f.endsWith('.md'))
  return files.map(file => {
    const raw = fs.readFileSync(path.join(BLOG_DIR, file), 'utf-8')
    const { data } = matter(raw)
    return {
      title: data.title || '',
      slug: data.slug || file.replace(/\.md$/, ''),
      date: data.date || '',
      description: data.description || '',
      author: data.author || 'Costra Team',
      tags: data.tags || [],
      image: data.image || null,
    }
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

export default function blogPlugin(): Plugin {
  const virtualModuleId = 'virtual:blog-manifest'
  const resolvedVirtualModuleId = '\0' + virtualModuleId

  return {
    name: 'vite-plugin-blog',

    resolveId(id) {
      if (id === virtualModuleId) return resolvedVirtualModuleId
    },

    load(id) {
      if (id === resolvedVirtualModuleId) {
        const posts = getBlogPosts()
        return `export default ${JSON.stringify(posts)}`
      }
    },

    closeBundle() {
      const posts = getBlogPosts()
      const today = new Date().toISOString().split('T')[0]
      const urls = [
        ...STATIC_ROUTES.map(route => ({
          loc: `${SITE_URL}${route}`,
          lastmod: today,
          priority: route === '/' ? '1.0' : '0.8',
        })),
        ...posts.map(p => ({
          loc: `${SITE_URL}/blog/${p.slug}`,
          lastmod: p.date || today,
          priority: '0.7',
        })),
      ]

      const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>`

      const outDir = path.resolve(__dirname, '../dist')
      if (fs.existsSync(outDir)) {
        fs.writeFileSync(path.join(outDir, 'sitemap.xml'), sitemap)
      }
    },
  }
}

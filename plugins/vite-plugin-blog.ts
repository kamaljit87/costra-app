import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import matter from 'gray-matter'
import type { Plugin } from 'vite'

const BLOG_DIR = path.resolve(__dirname, '../src/content/blog')

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
      author: data.author || 'Costdoq Team',
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
      // Generate sitemap.xml and robots.txt into dist/ via the shared SEO script
      const scriptPath = path.resolve(__dirname, '../scripts/generate-seo.js')
      if (fs.existsSync(scriptPath)) {
        try {
          execSync(`node ${scriptPath} --out dist`, {
            cwd: path.resolve(__dirname, '..'),
            stdio: 'inherit',
          })
        } catch (err) {
          console.error('SEO generation failed:', err)
        }
      }
    },
  }
}

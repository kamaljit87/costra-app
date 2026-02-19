import matter from 'gray-matter'
import { marked } from 'marked'
import type { BlogPost } from '@/types/blog'

const modules = import.meta.glob('/src/content/blog/*.md', { query: '?raw', import: 'default', eager: true })

export function getPostBySlug(slug: string): BlogPost | null {
  for (const [filepath, raw] of Object.entries(modules)) {
    const { data, content } = matter(raw as string)
    const fileSlug = data.slug || filepath.split('/').pop()?.replace('.md', '')
    if (fileSlug === slug) {
      return {
        title: data.title || '',
        slug: fileSlug!,
        date: data.date || '',
        description: data.description || '',
        author: data.author || 'Costra Team',
        tags: data.tags || [],
        image: data.image,
        content,
      }
    }
  }
  return null
}

export function renderMarkdown(md: string): string {
  return marked.parse(md, { async: false }) as string
}

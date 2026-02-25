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

function slugify(text: string): string {
  return text.toLowerCase().replace(/<[^>]*>/g, '').replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim()
}

const renderer = new marked.Renderer()
renderer.heading = ({ tokens, depth }: { tokens: { raw: string }[]; depth: number }) => {
  const text = tokens.map(t => t.raw).join('')
  const id = slugify(text)
  return `<h${depth} id="${id}">${text}</h${depth}>\n`
}

export function renderMarkdown(md: string): string {
  return marked.parse(md, { async: false, renderer }) as string
}

export interface TocHeading {
  id: string
  text: string
  level: number
}

export function extractHeadings(html: string): TocHeading[] {
  const headings: TocHeading[] = []
  const regex = /<h([23]) id="([^"]*)">(.*?)<\/h[23]>/g
  let match
  while ((match = regex.exec(html)) !== null) {
    headings.push({
      level: parseInt(match[1]),
      id: match[2],
      text: match[3].replace(/<[^>]*>/g, ''),
    })
  }
  return headings
}

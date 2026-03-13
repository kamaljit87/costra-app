import { marked } from 'marked'
import type { BlogPost } from '@/types/blog'

const modules = import.meta.glob('/src/content/blog/*.md', { query: '?raw', import: 'default', eager: true })

/**
 * Parse YAML frontmatter without gray-matter (which requires Node.js Buffer).
 * Handles simple key: value and key: [array] fields.
 */
function parseFrontmatter(raw: string): { data: Record<string, any>; content: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/)
  if (!match) return { data: {}, content: raw }

  const yaml = match[1]
  const content = match[2]
  const data: Record<string, any> = {}

  for (const line of yaml.split('\n')) {
    const kvMatch = line.match(/^(\w[\w-]*)\s*:\s*(.*)$/)
    if (!kvMatch) continue
    const key = kvMatch[1]
    let value: any = kvMatch[2].trim()

    // Handle YAML arrays: ["tag1", "tag2"]
    if (value.startsWith('[') && value.endsWith(']')) {
      value = value.slice(1, -1).split(',').map((s: string) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean)
    } else {
      // Strip surrounding quotes
      value = value.replace(/^["']|["']$/g, '')
    }
    data[key] = value
  }

  return { data, content }
}

export function getPostBySlug(slug: string): BlogPost | null {
  for (const [filepath, raw] of Object.entries(modules)) {
    const { data, content } = parseFrontmatter(raw as string)
    const fileSlug = data.slug || filepath.split('/').pop()?.replace('.md', '')
    if (fileSlug === slug) {
      return {
        title: data.title || '',
        slug: fileSlug!,
        date: data.date || '',
        description: data.description || '',
        author: data.author || 'Costdoq Team',
        tags: Array.isArray(data.tags) ? data.tags : [],
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

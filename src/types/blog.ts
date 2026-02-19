export interface BlogPostMeta {
  title: string
  slug: string
  date: string
  description: string
  author: string
  tags: string[]
  image?: string
}

export interface BlogPost extends BlogPostMeta {
  content: string
}

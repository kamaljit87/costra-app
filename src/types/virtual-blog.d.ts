declare module 'virtual:blog-manifest' {
  import type { BlogPostMeta } from './blog'
  const posts: BlogPostMeta[]
  export default posts
}

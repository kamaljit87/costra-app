import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import LandingNav from '@/components/LandingNav'
import blogPosts from 'virtual:blog-manifest'
import type { BlogPostMeta } from '@/types/blog'
import { Blog8 } from '@/components/ui/blog8'
import type { Post } from '@/components/ui/blog8'

const FALLBACK_IMAGES = [
  'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&h=450&fit=crop',
  'https://images.unsplash.com/photo-1504639725590-34d0984388bd?w=800&h=450&fit=crop',
  'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&h=450&fit=crop',
  'https://images.unsplash.com/photo-1535378917042-10a22c95931a?w=800&h=450&fit=crop',
]

function mapToPosts(posts: BlogPostMeta[]): Post[] {
  return posts.map((post, index) => ({
    id: post.slug,
    title: post.title,
    summary: post.description,
    label: post.tags[0] || 'General',
    author: post.author,
    published: new Date(post.date + 'T12:00:00').toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
    url: `/blog/${post.slug}`,
    image: post.image || FALLBACK_IMAGES[index % FALLBACK_IMAGES.length],
    tags: post.tags,
  }))
}

export default function BlogListPage() {
  const posts = mapToPosts(blogPosts)

  return (
    <div className="min-h-screen bg-white">
      <Helmet>
        <title>Blog - Costra | Multi-Cloud Cost Management Insights</title>
        <meta name="description" content="Insights on cloud cost optimization, FinOps best practices, and multi-cloud management from the Costra team." />
        <meta property="og:title" content="Costra Blog - Cloud Cost Optimization Insights" />
        <meta property="og:description" content="Cloud cost optimization insights and FinOps best practices." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://costra.app/blog" />
      </Helmet>

      <LandingNav />

      <main className="pt-20">
        {posts.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-500 text-lg">No posts yet. Check back soon!</p>
          </div>
        ) : (
          <Blog8
            heading="Blog"
            description="Insights on cloud cost optimization and FinOps best practices."
            posts={posts}
          />
        )}
      </main>

      <footer className="bg-surface-100 border-t border-surface-300 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-center text-sm text-gray-500 space-y-2 sm:space-y-0">
            <p>&copy; {new Date().getFullYear()} Costra. All rights reserved.</p>
            <div className="flex space-x-6">
              <Link to="/privacy" className="hover:text-gray-900 transition-colors">Privacy Policy</Link>
              <Link to="/terms" className="hover:text-gray-900 transition-colors">Terms of Service</Link>
              <Link to="/contact" className="hover:text-gray-900 transition-colors">Contact Us</Link>
              <Link to="/blog" className="hover:text-gray-900 transition-colors">Blog</Link>
            </div>
          </div>
          <p className="text-center text-xs text-gray-400 mt-4">
            A product of{' '}
            <a href="https://indraopstech.com" target="_blank" rel="noopener noreferrer" className="hover:text-gray-600 transition-colors">Indraops Technologies</a>
          </p>
        </div>
      </footer>
    </div>
  )
}

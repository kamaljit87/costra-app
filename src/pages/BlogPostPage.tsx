import { useParams, Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useMemo } from 'react'
import LandingNav from '@/components/LandingNav'
import { NotFound } from '@/components/ui/ghost-404-page'
import { getPostBySlug, renderMarkdown } from '@/lib/blog'
import { ArrowLeft, Calendar } from 'lucide-react'

export default function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>()
  const post = useMemo(() => slug ? getPostBySlug(slug) : null, [slug])

  if (!post) return <NotFound />

  const html = useMemo(() => renderMarkdown(post.content), [post.content])

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    author: { '@type': 'Organization', name: post.author },
    publisher: { '@type': 'Organization', name: 'Costra' },
    url: `https://costra.app/blog/${post.slug}`,
    ...(post.image && { image: `https://costra.app${post.image}` }),
  }

  return (
    <div className="min-h-screen bg-white">
      <Helmet>
        <title>{post.title} - Costra Blog</title>
        <meta name="description" content={post.description} />
        <meta property="og:title" content={post.title} />
        <meta property="og:description" content={post.description} />
        <meta property="og:type" content="article" />
        <meta property="og:url" content={`https://costra.app/blog/${post.slug}`} />
        {post.image && <meta property="og:image" content={`https://costra.app${post.image}`} />}
        <meta name="twitter:card" content="summary_large_image" />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      <LandingNav />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16">
        <Link to="/blog" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-900 mb-8 transition-colors">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Blog
        </Link>

        <article>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">{post.title}</h1>
          <div className="flex items-center gap-4 text-sm text-gray-500 mb-10 pb-6 border-b border-surface-200">
            <span className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {new Date(post.date + 'T12:00:00').toLocaleDateString('en-US', {
                year: 'numeric', month: 'long', day: 'numeric',
              })}
            </span>
            <span>{post.author}</span>
          </div>

          <div
            className="prose prose-gray max-w-none prose-headings:font-semibold prose-a:text-accent-600 prose-a:no-underline hover:prose-a:underline"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </article>
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

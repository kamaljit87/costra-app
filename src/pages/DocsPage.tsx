import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useMemo } from 'react'
import LandingNav from '@/components/LandingNav'
import { renderMarkdown } from '@/lib/blog'

import docContent from '../content/docs/USER_DOCUMENTATION.md?raw'

export default function DocsPage() {
  const html = useMemo(() => renderMarkdown(String(docContent)), [])

  return (
    <div className="min-h-screen bg-white">
      <Helmet>
        <title>User Documentation - Costra</title>
        <meta name="description" content="Costra user guide: get started, connect cloud providers, budgets, reports, and more." />
        <meta property="og:title" content="User Documentation - Costra" />
        <meta property="og:description" content="Learn how to use Costra to manage and optimize your cloud costs." />
        <meta property="og:type" content="website" />
      </Helmet>

      <LandingNav />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16">
        <Link to="/" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-900 mb-8 transition-colors">
          ← Back to Home
        </Link>

        <div
          className="prose prose-gray max-w-none prose-headings:font-semibold prose-a:text-accent-600 prose-a:no-underline hover:prose-a:underline prose-headings:scroll-mt-24"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </main>

      <footer className="bg-surface-100 border-t border-surface-300 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-center text-sm text-gray-500 space-y-2 sm:space-y-0">
            <p>&copy; {new Date().getFullYear()} Costra. All rights reserved.</p>
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-1">
              <Link to="/privacy" className="hover:text-gray-900 transition-colors">Privacy Policy</Link>
              <Link to="/terms" className="hover:text-gray-900 transition-colors">Terms of Service</Link>
              <Link to="/contact" className="hover:text-gray-900 transition-colors">Contact Us</Link>
              <Link to="/blog" className="hover:text-gray-900 transition-colors">Blog</Link>
              <Link to="/docs" className="hover:text-gray-900 transition-colors">Docs</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

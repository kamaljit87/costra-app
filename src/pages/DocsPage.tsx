import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useMemo, useState, useEffect, useRef, useCallback } from 'react'
import { ChevronDown } from 'lucide-react'
import LandingNav from '@/components/LandingNav'
import { renderMarkdown, extractHeadings, type TocHeading } from '@/lib/blog'

import docContent from '../content/docs/USER_DOCUMENTATION.md?raw'

function useScrollSpy(headingIds: string[]) {
  const [activeId, setActiveId] = useState('')

  useEffect(() => {
    if (!headingIds.length) return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id)
          }
        }
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0.1 }
    )
    for (const id of headingIds) {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [headingIds])

  return activeId
}

function TocNav({ headings, activeId, onLinkClick }: { headings: TocHeading[]; activeId: string; onLinkClick?: () => void }) {
  return (
    <nav className="space-y-0.5">
      {headings.map((h) => (
        <a
          key={h.id}
          href={`#${h.id}`}
          onClick={(e) => {
            e.preventDefault()
            const el = document.getElementById(h.id)
            if (el) el.scrollIntoView({ behavior: 'smooth' })
            onLinkClick?.()
          }}
          className={`block py-1.5 text-[13px] leading-snug transition-colors duration-150 border-l-2 ${
            h.level === 3 ? 'pl-6' : 'pl-4'
          } ${
            activeId === h.id
              ? 'border-accent-500 text-accent-600 font-medium'
              : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-surface-300'
          }`}
        >
          {h.text}
        </a>
      ))}
    </nav>
  )
}

export default function DocsPage() {
  const html = useMemo(() => renderMarkdown(String(docContent)), [])
  const headings = useMemo(() => extractHeadings(html), [html])
  const headingIds = useMemo(() => headings.map((h) => h.id), [headings])
  const activeId = useScrollSpy(headingIds)
  const [mobileOpen, setMobileOpen] = useState(false)
  const tocRef = useRef<HTMLDivElement>(null)

  const closeMobile = useCallback(() => setMobileOpen(false), [])

  // Scroll active TOC item into view in sidebar
  useEffect(() => {
    if (!activeId || !tocRef.current) return
    const activeEl = tocRef.current.querySelector(`a[href="#${activeId}"]`)
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [activeId])

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

      {/* Mobile TOC toggle */}
      <div className="lg:hidden sticky top-16 z-30 bg-white/95 backdrop-blur-sm border-b border-surface-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="flex items-center justify-between w-full py-3 text-sm text-gray-600"
          >
            <span className="font-medium">On this page</span>
            <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${mobileOpen ? 'rotate-180' : ''}`} />
          </button>
          {mobileOpen && (
            <div className="pb-4 max-h-[50vh] overflow-y-auto">
              <TocNav headings={headings} activeId={activeId} onLinkClick={closeMobile} />
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="lg:grid lg:grid-cols-[260px_1fr] lg:gap-10">

          {/* Desktop sidebar TOC */}
          <aside className="hidden lg:block pt-24 pb-16">
            <div ref={tocRef} className="sticky top-24 h-[calc(100vh-7rem)] overflow-y-auto pr-4 pb-8">
              <Link to="/" className="inline-flex items-center text-sm text-gray-400 hover:text-gray-900 mb-6 transition-colors">
                &larr; Back to Home
              </Link>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
                On this page
              </p>
              <TocNav headings={headings} activeId={activeId} />
            </div>
          </aside>

          {/* Main content */}
          <main className="pt-24 pb-16 min-w-0">
            <div className="lg:hidden mb-6">
              <Link to="/" className="inline-flex items-center text-sm text-gray-400 hover:text-gray-900 transition-colors">
                &larr; Back to Home
              </Link>
            </div>

            <article
              className="prose prose-gray max-w-none
                prose-headings:font-semibold
                prose-a:text-accent-600 prose-a:no-underline hover:prose-a:underline
                prose-headings:scroll-mt-24
                prose-h2:text-2xl prose-h2:mt-12 prose-h2:mb-4 prose-h2:pb-2 prose-h2:border-b prose-h2:border-surface-200
                prose-h3:text-lg prose-h3:mt-8 prose-h3:mb-3
                prose-p:text-gray-600 prose-p:leading-relaxed
                prose-li:text-gray-600
                prose-strong:text-gray-900
                prose-hr:border-surface-200 prose-hr:my-10"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </main>
        </div>
      </div>

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

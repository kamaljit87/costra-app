import { X, Info, Lightbulb, BookOpen, Star, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { featureInfoContent } from '../data/featureInfoContent'

interface FeatureInfoDialogProps {
  featureId: string
  isOpen: boolean
  onClose: () => void
}

export default function FeatureInfoDialog({ featureId, isOpen, onClose }: FeatureInfoDialogProps) {
  if (!isOpen) return null

  const content = featureInfoContent[featureId]
  if (!content) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-surface-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent-50 dark:bg-accent-900/30 flex items-center justify-center">
              <Info className="h-5 w-5 text-accent-500" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">{content.title}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">{content.subtitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-surface-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Description */}
          <div className="bg-accent-50 dark:bg-accent-900/20 border border-accent-100 dark:border-accent-800 rounded-xl p-4">
            <p className="text-sm text-gray-700 dark:text-gray-300">{content.description}</p>
          </div>

          {/* Key Features */}
          <div>
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <Star className="h-5 w-5 text-accent-500" />
              Key Features
            </h4>
            <ul className="space-y-2">
              {content.keyFeatures.map((feature, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                  <span className="text-accent-500 mt-1">•</span>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* How to Use */}
          <div>
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-accent-500" />
              How to Use
            </h4>
            <ol className="space-y-2 list-decimal list-inside">
              {content.howToUse.map((step, i) => (
                <li key={i} className="text-sm text-gray-600 dark:text-gray-300 pl-2">{step}</li>
              ))}
            </ol>
          </div>

          {/* Tips */}
          {content.tips && content.tips.length > 0 && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4">
              <h4 className="text-sm font-semibold text-yellow-800 dark:text-yellow-300 mb-2 flex items-center gap-2">
                <Lightbulb className="h-4 w-4" />
                Tips
              </h4>
              <ul className="space-y-1">
                {content.tips.map((tip, i) => (
                  <li key={i} className="text-sm text-yellow-700 dark:text-yellow-400 flex items-start gap-2">
                    <span>•</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Related Pages */}
          {content.relatedPages && content.relatedPages.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2">Related</h4>
              <div className="flex flex-wrap gap-2">
                {content.relatedPages.map((page, i) => (
                  <Link
                    key={i}
                    to={page.path}
                    onClick={onClose}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-accent-600 dark:text-accent-400 bg-accent-50 dark:bg-accent-900/30 rounded-lg hover:bg-accent-100 dark:hover:bg-accent-900/50 transition-colors"
                  >
                    {page.label}
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white dark:bg-gray-800 border-t border-surface-200 dark:border-gray-700 px-6 py-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-primary-800 text-white rounded-xl hover:bg-[#1a2f4d] transition-colors font-medium"
          >
            Got it!
          </button>
        </div>
      </div>
    </div>
  )
}

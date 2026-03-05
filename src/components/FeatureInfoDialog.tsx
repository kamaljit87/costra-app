import { Info, Lightbulb, BookOpen, Star, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { featureInfoContent } from '../data/featureInfoContent'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface FeatureInfoDialogProps {
  featureId: string
  isOpen: boolean
  onClose: () => void
}

export default function FeatureInfoDialog({ featureId, isOpen, onClose }: FeatureInfoDialogProps) {
  const content = featureInfoContent[featureId]
  if (!content) return null

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl !rounded-2xl p-0 gap-0 sm:max-h-[90vh] flex flex-col">
        <DialogHeader className="px-6 py-4 border-b border-surface-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent-50 dark:bg-accent-900/30 flex items-center justify-center">
              <Info className="h-5 w-5 text-accent-500" />
            </div>
            <div>
              <DialogTitle className="text-xl font-semibold text-gray-900 dark:text-white">{content.title}</DialogTitle>
              <p className="text-sm text-gray-500 dark:text-gray-400">{content.subtitle}</p>
            </div>
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
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
        <DialogFooter className="border-t border-surface-200 dark:border-gray-700 px-6 py-4">
          <Button onClick={onClose} className="rounded-xl">
            Got it!
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

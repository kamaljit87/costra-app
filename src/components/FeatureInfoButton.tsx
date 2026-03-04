import { useState } from 'react'
import { Info } from 'lucide-react'
import FeatureInfoDialog from './FeatureInfoDialog'

interface FeatureInfoButtonProps {
  featureId: string
}

export default function FeatureInfoButton({ featureId }: FeatureInfoButtonProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="p-1.5 text-gray-400 hover:text-accent-600 dark:text-gray-500 dark:hover:text-accent-400 hover:bg-accent-50 dark:hover:bg-accent-900/30 rounded-lg transition-colors"
        title="Learn more about this feature"
        aria-label="Feature information"
      >
        <Info className="h-5 w-5" />
      </button>
      <FeatureInfoDialog featureId={featureId} isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  )
}

import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'

const containerVariants = {
  hidden: {
    opacity: 0,
    y: 30,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.7,
      ease: [0.43, 0.13, 0.23, 0.96] as const,
      delayChildren: 0.1,
      staggerChildren: 0.1,
    },
  },
}

const itemVariants = {
  hidden: {
    opacity: 0,
    y: 20,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.43, 0.13, 0.23, 0.96] as const,
    },
  },
}

const numberVariants = {
  hidden: (direction: number) => ({
    opacity: 0,
    x: direction * 40,
    y: 15,
    rotate: direction * 5,
  }),
  visible: {
    opacity: 0.7,
    x: 0,
    y: 0,
    rotate: 0,
    transition: {
      duration: 0.8,
      ease: [0.43, 0.13, 0.23, 0.96] as const,
    },
  },
}

const ghostVariants = {
  hidden: {
    scale: 0.8,
    opacity: 0,
    y: 15,
    rotate: -5,
  },
  visible: {
    scale: 1,
    opacity: 1,
    y: 0,
    rotate: 0,
    transition: {
      duration: 0.6,
      ease: [0.43, 0.13, 0.23, 0.96] as const,
    },
  },
  hover: {
    scale: 1.1,
    y: -10,
    rotate: [0, -5, 5, -5, 0],
    transition: {
      duration: 0.8,
      ease: 'easeInOut' as const,
      rotate: {
        duration: 2,
        ease: 'linear' as const,
        repeat: Infinity,
        repeatType: 'reverse' as const,
      },
    },
  },
  floating: {
    y: [-5, 5],
    transition: {
      y: {
        duration: 2,
        ease: 'easeInOut' as const,
        repeat: Infinity,
        repeatType: 'reverse' as const,
      },
    },
  },
}

function GhostIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 120"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M60 20c-22 0-40 18-40 40v35l15-12 10 12 15-15 15 15 10-12 15 12V60c0-22-18-40-40-40z"
        fill="currentColor"
      />
      <ellipse cx="42" cy="52" rx="6" ry="8" fill="white" opacity={0.9} />
      <ellipse cx="78" cy="52" rx="6" ry="8" fill="white" opacity={0.9} />
      <circle cx="42" cy="54" r="3" fill="gray" />
      <circle cx="78" cy="54" r="3" fill="gray" />
    </svg>
  )
}

export function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-surface-50 px-4">
      <AnimatePresence mode="wait">
        <motion.div
          className="text-center"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          exit="hidden"
        >
          <div className="flex items-center justify-center gap-4 md:gap-6 mb-8 md:mb-12">
            <motion.span
              className="text-[80px] md:text-[120px] font-bold text-gray-900 opacity-70 font-sans select-none"
              variants={numberVariants}
              custom={-1}
            >
              4
            </motion.span>
            <motion.div
              variants={ghostVariants}
              whileHover="hover"
              animate={['visible', 'floating']}
              className="text-accent-500"
            >
              <GhostIcon className="w-[80px] h-[80px] md:w-[120px] md:h-[120px] object-contain select-none" />
            </motion.div>
            <motion.span
              className="text-[80px] md:text-[120px] font-bold text-gray-900 opacity-70 font-sans select-none"
              variants={numberVariants}
              custom={1}
            >
              4
            </motion.span>
          </div>

          <motion.h1
            className="text-3xl md:text-5xl font-bold text-gray-900 mb-4 md:mb-6 opacity-90 font-sans select-none"
            variants={itemVariants}
          >
            Boo! Page missing!
          </motion.h1>

          <motion.p
            className="text-lg md:text-xl text-gray-600 mb-8 md:mb-12 opacity-80 font-sans select-none"
            variants={itemVariants}
          >
            Whoops! This page must be a ghost — it&apos;s not here!
          </motion.p>

          <motion.div
            variants={itemVariants}
            whileHover={{
              scale: 1.05,
              transition: {
                duration: 0.3,
                ease: [0.43, 0.13, 0.23, 0.96] as const,
              },
            }}
          >
            <Link
              to="/"
              className="inline-block bg-accent-500 text-white px-8 py-3 rounded-full text-lg font-medium hover:bg-accent-600 transition-colors font-sans select-none"
            >
              Back to home
            </Link>
          </motion.div>

          <motion.div className="mt-12" variants={itemVariants}>
            <a
              href="https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/404"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-500 hover:text-gray-700 transition-opacity underline font-sans select-none"
            >
              What does 404 mean?
            </a>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

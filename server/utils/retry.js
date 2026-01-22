import logger from './logger.js'

/**
 * Circuit Breaker State
 */
const CircuitState = {
  CLOSED: 'CLOSED',    // Normal operation
  OPEN: 'OPEN',        // Failing, reject immediately
  HALF_OPEN: 'HALF_OPEN', // Testing if service recovered
}

/**
 * Circuit Breaker Configuration
 */
const DEFAULT_CIRCUIT_CONFIG = {
  failureThreshold: 5,        // Open circuit after 5 failures
  resetTimeout: 60000,         // Try again after 60 seconds
  halfOpenMaxAttempts: 3,      // Allow 3 attempts in half-open state
}

/**
 * Retry Configuration
 */
const DEFAULT_RETRY_CONFIG = {
  maxAttempts: 3,
  initialDelay: 1000,          // 1 second
  maxDelay: 30000,              // 30 seconds
  factor: 2,                    // Exponential backoff factor
  timeout: 30000,               // 30 seconds per attempt
}

/**
 * Circuit Breaker class
 */
class CircuitBreaker {
  constructor(name, config = {}) {
    this.name = name
    this.config = { ...DEFAULT_CIRCUIT_CONFIG, ...config }
    this.state = CircuitState.CLOSED
    this.failureCount = 0
    this.successCount = 0
    this.nextAttempt = null
    this.halfOpenAttempts = 0
  }

  /**
   * Check if request should be allowed
   */
  canAttempt() {
    const now = Date.now()

    if (this.state === CircuitState.CLOSED) {
      return true
    }

    if (this.state === CircuitState.OPEN) {
      if (now >= this.nextAttempt) {
        // Transition to half-open
        this.state = CircuitState.HALF_OPEN
        this.halfOpenAttempts = 0
        logger.info(`Circuit breaker ${this.name} transitioning to HALF_OPEN`, {
          circuitName: this.name,
        })
        return true
      }
      return false
    }

    if (this.state === CircuitState.HALF_OPEN) {
      if (this.halfOpenAttempts < this.config.halfOpenMaxAttempts) {
        return true
      }
      // Too many attempts in half-open, open circuit again
      this.state = CircuitState.OPEN
      this.nextAttempt = now + this.config.resetTimeout
      logger.warn(`Circuit breaker ${this.name} re-opened after too many half-open attempts`, {
        circuitName: this.name,
        attempts: this.halfOpenAttempts,
      })
      return false
    }

    return false
  }

  /**
   * Record success
   */
  recordSuccess() {
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++
      this.halfOpenAttempts++
      if (this.successCount >= 2) {
        // Close circuit after 2 successes in half-open
        this.state = CircuitState.CLOSED
        this.failureCount = 0
        this.successCount = 0
        this.halfOpenAttempts = 0
        logger.info(`Circuit breaker ${this.name} closed after successful recovery`, {
          circuitName: this.name,
        })
      }
    } else if (this.state === CircuitState.CLOSED) {
      this.failureCount = 0
    }
  }

  /**
   * Record failure
   */
  recordFailure() {
    this.failureCount++
    this.successCount = 0

    if (this.state === CircuitState.HALF_OPEN) {
      // Failure in half-open, open circuit immediately
      this.state = CircuitState.OPEN
      this.nextAttempt = Date.now() + this.config.resetTimeout
      this.halfOpenAttempts = 0
      logger.warn(`Circuit breaker ${this.name} opened after failure in half-open state`, {
        circuitName: this.name,
      })
    } else if (this.state === CircuitState.CLOSED && this.failureCount >= this.config.failureThreshold) {
      // Too many failures, open circuit
      this.state = CircuitState.OPEN
      this.nextAttempt = Date.now() + this.config.resetTimeout
      logger.error(`Circuit breaker ${this.name} opened after ${this.failureCount} failures`, {
        circuitName: this.name,
        failureCount: this.failureCount,
      })
    }
  }

  /**
   * Get current state
   */
  getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      nextAttempt: this.nextAttempt,
    }
  }
}

// Global circuit breakers per provider
const circuitBreakers = new Map()

/**
 * Get or create circuit breaker for a provider
 */
const getCircuitBreaker = (providerId) => {
  if (!circuitBreakers.has(providerId)) {
    circuitBreakers.set(providerId, new CircuitBreaker(`provider-${providerId}`))
  }
  return circuitBreakers.get(providerId)
}

/**
 * Check if error is retryable
 */
const isRetryableError = (error) => {
  if (!error) return false

  // Network errors
  if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
    return true
  }

  // Rate limiting (429)
  if (error.statusCode === 429 || error.$metadata?.httpStatusCode === 429) {
    return true
  }

  // Timeout errors
  if (error.name === 'TimeoutError' || error.message?.includes('timeout')) {
    return true
  }

  // AWS SDK errors
  if (error.$metadata?.httpStatusCode) {
    const statusCode = error.$metadata.httpStatusCode
    // Retry on 5xx errors and 429
    if (statusCode >= 500 || statusCode === 429) {
      return true
    }
  }

  // Azure errors
  if (error.statusCode >= 500 || error.statusCode === 429) {
    return true
  }

  // GCP errors
  if (error.code >= 500 || error.code === 429) {
    return true
  }

  return false
}

/**
 * Sleep for specified milliseconds
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Retry function with exponential backoff and circuit breaker
 * 
 * @param {Function} fn - Async function to retry
 * @param {Object} options - Retry configuration
 * @param {string} providerId - Provider ID for circuit breaker
 * @param {Object} context - Context for logging (requestId, userId, etc.)
 * @returns {Promise} Result of the function
 */
export const retryWithBackoff = async (fn, options = {}, providerId = 'unknown', context = {}) => {
  const config = { ...DEFAULT_RETRY_CONFIG, ...options }
  const circuitBreaker = getCircuitBreaker(providerId)

  // Check circuit breaker
  if (!circuitBreaker.canAttempt()) {
    const state = circuitBreaker.getState()
    logger.warn('Request blocked by circuit breaker', {
      providerId,
      circuitState: state.state,
      nextAttempt: state.nextAttempt ? new Date(state.nextAttempt).toISOString() : null,
      ...context,
    })
    throw new Error(`Service ${providerId} is temporarily unavailable (circuit breaker open). Please try again later.`)
  }

  let lastError
  let delay = config.initialDelay

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      // Create timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Request timeout after ${config.timeout}ms`))
        }, config.timeout)
      })

      // Race between function and timeout
      const result = await Promise.race([fn(), timeoutPromise])

      // Success - record and return
      circuitBreaker.recordSuccess()
      if (attempt > 1) {
        logger.info(`Request succeeded after ${attempt} attempts`, {
          providerId,
          attempt,
          ...context,
        })
      }
      return result
    } catch (error) {
      lastError = error

      // Check if error is retryable
      if (!isRetryableError(error)) {
        // Non-retryable error - record failure and throw immediately
        circuitBreaker.recordFailure()
        logger.error('Non-retryable error encountered', {
          providerId,
          attempt,
          error: error.message,
          errorCode: error.code || error.statusCode,
          ...context,
        })
        throw error
      }

      // Log retry attempt
      logger.warn(`Retry attempt ${attempt}/${config.maxAttempts}`, {
        providerId,
        attempt,
        maxAttempts: config.maxAttempts,
        delay: delay,
        error: error.message,
        errorCode: error.code || error.statusCode,
        ...context,
      })

      // If this is the last attempt, record failure and throw
      if (attempt === config.maxAttempts) {
        circuitBreaker.recordFailure()
        logger.error(`All retry attempts exhausted for ${providerId}`, {
          providerId,
          attempts: config.maxAttempts,
          error: error.message,
          ...context,
        })
        throw new Error(`Failed after ${config.maxAttempts} attempts: ${error.message}`)
      }

      // Wait before retrying (exponential backoff)
      await sleep(delay)
      delay = Math.min(delay * config.factor, config.maxDelay)
    }
  }

  // Should never reach here, but just in case
  circuitBreaker.recordFailure()
  throw lastError || new Error('Unknown error in retry logic')
}

/**
 * Get circuit breaker state for monitoring
 */
export const getCircuitBreakerState = (providerId) => {
  const breaker = circuitBreakers.get(providerId)
  return breaker ? breaker.getState() : null
}

/**
 * Reset circuit breaker (for testing or manual recovery)
 */
export const resetCircuitBreaker = (providerId) => {
  const breaker = circuitBreakers.get(providerId)
  if (breaker) {
    breaker.state = CircuitState.CLOSED
    breaker.failureCount = 0
    breaker.successCount = 0
    breaker.halfOpenAttempts = 0
    breaker.nextAttempt = null
    logger.info(`Circuit breaker ${providerId} manually reset`, { providerId })
  }
}

export default {
  retryWithBackoff,
  getCircuitBreakerState,
  resetCircuitBreaker,
  isRetryableError,
}

/**
 * Provider Adapter Registry
 *
 * Each cloud provider has its own adapter module with a standard interface.
 * This registry maps provider IDs (and aliases) to their adapters.
 *
 * Adding a new provider:
 * 1. Create a new file in this directory (e.g. newprovider.js)
 * 2. Import and register it below
 * 3. That's it — sync, cost data, and service details will use it automatically
 */

import awsAdapter from './aws.js'
import azureAdapter from './azure.js'
import gcpAdapter from './gcp.js'
import digitaloceanAdapter from './digitalocean.js'
import linodeAdapter from './linode.js'
import vultrAdapter from './vultr.js'
import ibmAdapter from './ibm.js'

const adapters = [
  awsAdapter,
  azureAdapter,
  gcpAdapter,
  digitaloceanAdapter,
  linodeAdapter,
  vultrAdapter,
  ibmAdapter,
]

// Build lookup map: id + aliases → adapter
const adapterMap = new Map()
for (const adapter of adapters) {
  adapterMap.set(adapter.id.toLowerCase(), adapter)
  if (adapter.aliases) {
    for (const alias of adapter.aliases) {
      adapterMap.set(alias.toLowerCase(), adapter)
    }
  }
}

/**
 * Get the provider adapter for a given provider ID.
 * Supports aliases (e.g. 'akamai' → linode, 'do' → digitalocean).
 * Returns null if no adapter is found.
 */
export function getProviderAdapter(providerId) {
  if (!providerId) return null
  return adapterMap.get(providerId.toLowerCase().trim()) || null
}

/**
 * Get all registered provider adapters.
 */
export function getAllProviderAdapters() {
  return adapters
}

/**
 * Check if a provider ID is supported.
 */
export function isProviderSupported(providerId) {
  return getProviderAdapter(providerId) !== null
}

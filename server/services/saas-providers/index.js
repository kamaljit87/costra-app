import datadogAdapter from './datadog.js'
import githubAdapter from './github.js'
import snowflakeAdapter from './snowflake.js'

const adapters = new Map()

function register(adapter) {
  adapters.set(adapter.id, adapter)
}

register(datadogAdapter)
register(githubAdapter)
register(snowflakeAdapter)

export function getSaaSAdapter(providerType) {
  return adapters.get(providerType) || null
}

export function getAllSaaSAdapters() {
  return Array.from(adapters.values())
}

export function getCredentialFields(providerType) {
  const adapter = adapters.get(providerType)
  return adapter ? adapter.credentialFields : []
}

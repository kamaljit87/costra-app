import logger from '../../utils/logger.js'

// Default Snowflake credit rates by edition
const CREDIT_RATES = {
  standard: 2.0,
  enterprise: 3.0,
  business_critical: 4.0,
}

const STORAGE_RATE_PER_TB = 23.0 // $/TB/month

const snowflakeAdapter = {
  id: 'snowflake',
  name: 'Snowflake',

  credentialFields: [
    { key: 'account', label: 'Account Identifier', type: 'text', required: true, placeholder: 'e.g. xy12345.us-east-1' },
    { key: 'username', label: 'Username', type: 'text', required: true, placeholder: 'Your Snowflake username' },
    { key: 'password', label: 'Password', type: 'password', required: true, placeholder: 'Your Snowflake password' },
    { key: 'warehouse', label: 'Warehouse', type: 'text', required: false, placeholder: 'e.g. COMPUTE_WH (optional)' },
    { key: 'creditRate', label: 'Credit Rate ($/credit)', type: 'text', required: false, placeholder: 'Default: 2.00 (Standard edition)' },
  ],

  async testConnection(credentials) {
    let snowflake
    try {
      snowflake = await import('snowflake-sdk')
    } catch {
      return { success: false, message: 'Snowflake SDK not installed. Run: npm install snowflake-sdk' }
    }

    return new Promise((resolve) => {
      const conn = snowflake.createConnection({
        account: credentials.account,
        username: credentials.username,
        password: credentials.password,
        warehouse: credentials.warehouse || undefined,
        application: 'CostDoq',
      })

      const timeout = setTimeout(() => {
        resolve({ success: false, message: 'Connection timed out after 30 seconds' })
      }, 30000)

      conn.connect((err) => {
        clearTimeout(timeout)
        if (err) {
          resolve({ success: false, message: `Snowflake connection failed: ${err.message}` })
          return
        }
        conn.execute({
          sqlText: 'SELECT CURRENT_VERSION() AS version',
          complete: (queryErr, _stmt, rows) => {
            conn.destroy(() => {})
            if (queryErr) {
              resolve({ success: false, message: `Snowflake query failed: ${queryErr.message}` })
            } else {
              resolve({ success: true, message: `Connected to Snowflake v${rows[0]?.VERSION || 'unknown'}` })
            }
          },
        })
      })
    })
  },

  async fetchCosts(credentials, startDate, endDate) {
    let snowflake
    try {
      snowflake = await import('snowflake-sdk')
    } catch {
      throw new Error('Snowflake SDK not installed. Run: npm install snowflake-sdk')
    }

    const creditRate = parseFloat(credentials.creditRate) || CREDIT_RATES.standard
    const costs = []

    const conn = await new Promise((resolve, reject) => {
      const c = snowflake.createConnection({
        account: credentials.account,
        username: credentials.username,
        password: credentials.password,
        warehouse: credentials.warehouse || undefined,
        database: 'SNOWFLAKE',
        schema: 'ACCOUNT_USAGE',
        application: 'CostDoq',
      })
      c.connect((err) => err ? reject(err) : resolve(c))
    })

    const runQuery = (sqlText, binds = []) =>
      new Promise((resolve, reject) => {
        conn.execute({
          sqlText,
          binds,
          complete: (err, _stmt, rows) => err ? reject(err) : resolve(rows),
        })
      })

    try {
      // 1. Compute credits (metering history) - grouped by day and warehouse
      try {
        const computeRows = await runQuery(
          `SELECT DATE(START_TIME) AS usage_date, WAREHOUSE_NAME,
             SUM(CREDITS_USED) AS credits_used
           FROM SNOWFLAKE.ACCOUNT_USAGE.METERING_HISTORY
           WHERE START_TIME >= ? AND START_TIME < ?
           GROUP BY usage_date, WAREHOUSE_NAME
           ORDER BY usage_date`,
          [startDate.toISOString(), endDate.toISOString()]
        )

        for (const row of computeRows) {
          const credits = parseFloat(row.CREDITS_USED || 0)
          if (credits > 0) {
            costs.push({
              serviceName: `Compute - ${row.WAREHOUSE_NAME || 'Unknown'}`,
              date: row.USAGE_DATE.toISOString().slice(0, 10),
              cost: parseFloat((credits * creditRate).toFixed(2)),
              usageQuantity: credits,
              usageUnit: 'credits',
              metadata: { source: 'snowflake_metering_history', warehouse: row.WAREHOUSE_NAME, creditRate },
            })
          }
        }
      } catch (err) {
        logger.warn('Snowflake metering history query failed', { error: err.message })
      }

      // 2. Storage usage - monthly aggregation
      try {
        const storageRows = await runQuery(
          `SELECT USAGE_DATE, AVERAGE_STAGE_BYTES, AVERAGE_DATABASE_BYTES, AVERAGE_FAILSAFE_BYTES
           FROM SNOWFLAKE.ACCOUNT_USAGE.STORAGE_USAGE
           WHERE USAGE_DATE >= ? AND USAGE_DATE < ?
           ORDER BY USAGE_DATE`,
          [startDate.toISOString().slice(0, 10), endDate.toISOString().slice(0, 10)]
        )

        for (const row of storageRows) {
          const totalBytes = (parseFloat(row.AVERAGE_DATABASE_BYTES || 0) +
            parseFloat(row.AVERAGE_STAGE_BYTES || 0) +
            parseFloat(row.AVERAGE_FAILSAFE_BYTES || 0))
          const tbUsed = totalBytes / (1024 ** 4)
          const dailyCost = (tbUsed * STORAGE_RATE_PER_TB) / 30 // approximate daily

          if (dailyCost > 0.001) {
            costs.push({
              serviceName: 'Storage',
              date: row.USAGE_DATE.toISOString().slice(0, 10),
              cost: parseFloat(dailyCost.toFixed(2)),
              usageQuantity: parseFloat(tbUsed.toFixed(6)),
              usageUnit: 'TB',
              metadata: { source: 'snowflake_storage_usage', dbBytes: row.AVERAGE_DATABASE_BYTES, stageBytes: row.AVERAGE_STAGE_BYTES },
            })
          }
        }
      } catch (err) {
        logger.warn('Snowflake storage query failed', { error: err.message })
      }

      // 3. Serverless credits (if available)
      try {
        const serverlessRows = await runQuery(
          `SELECT DATE(START_TIME) AS usage_date, SERVICE_TYPE,
             SUM(CREDITS_USED) AS credits_used
           FROM SNOWFLAKE.ACCOUNT_USAGE.SERVERLESS_TASK_HISTORY
           WHERE START_TIME >= ? AND START_TIME < ?
           GROUP BY usage_date, SERVICE_TYPE
           ORDER BY usage_date`,
          [startDate.toISOString(), endDate.toISOString()]
        )

        for (const row of serverlessRows) {
          const credits = parseFloat(row.CREDITS_USED || 0)
          if (credits > 0) {
            costs.push({
              serviceName: `Serverless - ${row.SERVICE_TYPE || 'Tasks'}`,
              date: row.USAGE_DATE.toISOString().slice(0, 10),
              cost: parseFloat((credits * creditRate).toFixed(2)),
              usageQuantity: credits,
              usageUnit: 'credits',
              metadata: { source: 'snowflake_serverless', serviceType: row.SERVICE_TYPE },
            })
          }
        }
      } catch (err) {
        // Serverless task history may not exist in all editions
        logger.debug('Snowflake serverless query skipped', { error: err.message })
      }
    } finally {
      conn.destroy(() => {})
    }

    return costs
  },
}

export default snowflakeAdapter

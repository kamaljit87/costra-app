import pkg from 'pg'
const { Pool } = pkg

// Create PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  // Ensure password is treated as string
  ...(process.env.DATABASE_URL ? {} : {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'costra',
    user: process.env.DB_USER || 'postgres',
    password: String(process.env.DB_PASSWORD || 'postgres'),
  }),
})

// Test connection
pool.on('connect', () => {
  console.log('Connected to PostgreSQL database')
})

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err)
  process.exit(-1)
})

// Initialize database schema
export const initDatabase = async () => {
  try {
    const client = await pool.connect()
    
    try {
      // Users table
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT,
          google_id TEXT UNIQUE,
          avatar_url TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `)

      // Add avatar_url column if it doesn't exist (for existing databases)
      await client.query(`
        DO $$ 
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name = 'avatar_url'
          ) THEN
            ALTER TABLE users ADD COLUMN avatar_url TEXT;
          END IF;
        END $$;
      `)

      // Add google_id column if it doesn't exist (for existing databases)
      await client.query(`
        DO $$ 
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name = 'google_id'
          ) THEN
            ALTER TABLE users ADD COLUMN google_id TEXT UNIQUE;
          END IF;
        END $$;
      `)

      // Add updated_at column if it doesn't exist (for existing databases)
      await client.query(`
        DO $$ 
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name = 'updated_at'
          ) THEN
            ALTER TABLE users ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
          END IF;
        END $$;
      `)

      // User preferences table (currency, etc.)
      await client.query(`
        CREATE TABLE IF NOT EXISTS user_preferences (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL UNIQUE,
          currency TEXT DEFAULT 'USD',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `)

      // Cloud providers table
      await client.query(`
        CREATE TABLE IF NOT EXISTS cloud_providers (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL,
          provider_id TEXT NOT NULL,
          provider_name TEXT NOT NULL,
          icon TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          UNIQUE(user_id, provider_id)
        )
      `)

      // Cost data table
      await client.query(`
        CREATE TABLE IF NOT EXISTS cost_data (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL,
          provider_id TEXT NOT NULL,
          month INTEGER NOT NULL,
          year INTEGER NOT NULL,
          current_month_cost DECIMAL(15, 2) DEFAULT 0,
          last_month_cost DECIMAL(15, 2) DEFAULT 0,
          forecast_cost DECIMAL(15, 2) DEFAULT 0,
          credits DECIMAL(15, 2) DEFAULT 0,
          savings DECIMAL(15, 2) DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          UNIQUE(user_id, provider_id, month, year)
        )
      `)

      // Service costs table
      await client.query(`
        CREATE TABLE IF NOT EXISTS service_costs (
          id SERIAL PRIMARY KEY,
          cost_data_id INTEGER NOT NULL,
          service_name TEXT NOT NULL,
          cost DECIMAL(15, 2) NOT NULL,
          change_percent DECIMAL(10, 2) DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (cost_data_id) REFERENCES cost_data(id) ON DELETE CASCADE
        )
      `)

      // Daily cost data table for historical tracking
      await client.query(`
        CREATE TABLE IF NOT EXISTS daily_cost_data (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL,
          provider_id TEXT NOT NULL,
          date DATE NOT NULL,
          cost DECIMAL(15, 2) DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          UNIQUE(user_id, provider_id, date)
        )
      `)

      // Cost data cache table for API response caching
      await client.query(`
        CREATE TABLE IF NOT EXISTS cost_data_cache (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL,
          provider_id TEXT NOT NULL,
          cache_key TEXT NOT NULL,
          cache_data JSONB NOT NULL,
          expires_at TIMESTAMP NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          UNIQUE(user_id, provider_id, cache_key)
        )
      `)

      // Savings plans table
      await client.query(`
        CREATE TABLE IF NOT EXISTS savings_plans (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL,
          name TEXT NOT NULL,
          provider TEXT NOT NULL,
          discount_percent DECIMAL(5, 2) NOT NULL,
          status TEXT DEFAULT 'pending',
          expires_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `)

      // Cloud provider credentials table (encrypted) - supports multiple accounts per provider
      await client.query(`
        CREATE TABLE IF NOT EXISTS cloud_provider_credentials (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL,
          provider_id TEXT NOT NULL,
          provider_name TEXT NOT NULL,
          account_alias TEXT,
          credentials_encrypted TEXT NOT NULL,
          is_active BOOLEAN DEFAULT true,
          last_sync_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `)

      // Add account_alias column if it doesn't exist (for existing databases)
      await client.query(`
        DO $$ 
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'cloud_provider_credentials' AND column_name = 'account_alias'
          ) THEN
            ALTER TABLE cloud_provider_credentials ADD COLUMN account_alias TEXT;
          END IF;
        END $$;
      `)

      // Drop old unique constraint if it exists (to allow multiple accounts per provider)
      await client.query(`
        DO $$ 
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'cloud_provider_credentials_user_id_provider_id_key' 
            AND table_name = 'cloud_provider_credentials'
          ) THEN
            ALTER TABLE cloud_provider_credentials 
            DROP CONSTRAINT cloud_provider_credentials_user_id_provider_id_key;
          END IF;
        END $$;
      `)

      // Add account_id column to daily_cost_data for multi-account support
      await client.query(`
        DO $$ 
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'daily_cost_data' AND column_name = 'account_id'
          ) THEN
            ALTER TABLE daily_cost_data ADD COLUMN account_id INTEGER REFERENCES cloud_provider_credentials(id) ON DELETE CASCADE;
          END IF;
        END $$;
      `)

      // Add account_id column to cost_data for multi-account support
      await client.query(`
        DO $$ 
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'cost_data' AND column_name = 'account_id'
          ) THEN
            ALTER TABLE cost_data ADD COLUMN account_id INTEGER REFERENCES cloud_provider_credentials(id) ON DELETE CASCADE;
          END IF;
        END $$;
      `)

      // Add account_id column to cost_data_cache for multi-account support
      await client.query(`
        DO $$ 
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'cost_data_cache' AND column_name = 'account_id'
          ) THEN
            ALTER TABLE cost_data_cache ADD COLUMN account_id INTEGER REFERENCES cloud_provider_credentials(id) ON DELETE CASCADE;
          END IF;
        END $$;
      `)

      // Create indexes for better performance
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_cost_data_user_month_year 
        ON cost_data(user_id, month, year)
      `)

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_service_costs_cost_data_id 
        ON service_costs(cost_data_id)
      `)

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_savings_plans_user_id 
        ON savings_plans(user_id)
      `)

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_cloud_provider_credentials_user_id 
        ON cloud_provider_credentials(user_id)
      `)

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_daily_cost_data_user_provider_date 
        ON daily_cost_data(user_id, provider_id, date)
      `)

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_cost_data_cache_user_provider 
        ON cost_data_cache(user_id, provider_id)
      `)

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_cost_data_cache_expires 
        ON cost_data_cache(expires_at)
      `)

      console.log('Database schema initialized successfully')
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error initializing database:', error)
    throw error
  }
}

// User operations
export const createUser = async (name, email, passwordHash) => {
  const client = await pool.connect()
  try {
    const result = await client.query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
      [name, email, passwordHash]
    )
    const userId = result.rows[0].id
    
    // Create default preferences
    await client.query(
      'INSERT INTO user_preferences (user_id, currency) VALUES ($1, $2)',
      [userId, 'USD']
    )
    
    return userId
  } finally {
    client.release()
  }
}

export const createOrUpdateGoogleUser = async (googleId, name, email, avatarUrl) => {
  const client = await pool.connect()
  try {
    // Check if user exists by Google ID
    let result = await client.query(
      'SELECT id FROM users WHERE google_id = $1',
      [googleId]
    )

    let userId
    if (result.rows.length > 0) {
      // Update existing user
      userId = result.rows[0].id
      await client.query(
        'UPDATE users SET name = $1, email = $2, avatar_url = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4',
        [name, email, avatarUrl, userId]
      )
    } else {
      // Check if user exists by email
      result = await client.query(
        'SELECT id FROM users WHERE email = $1',
        [email]
      )

      if (result.rows.length > 0) {
        // Link Google account to existing user
        userId = result.rows[0].id
        await client.query(
          'UPDATE users SET google_id = $1, avatar_url = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
          [googleId, avatarUrl, userId]
        )
      } else {
        // Create new user
        result = await client.query(
          'INSERT INTO users (name, email, google_id, avatar_url) VALUES ($1, $2, $3, $4) RETURNING id',
          [name, email, googleId, avatarUrl]
        )
        userId = result.rows[0].id

        // Create default preferences
        await client.query(
          'INSERT INTO user_preferences (user_id, currency) VALUES ($1, $2)',
          [userId, 'USD']
        )
      }
    }

    return userId
  } finally {
    client.release()
  }
}

export const getUserByGoogleId = async (googleId) => {
  const client = await pool.connect()
  try {
    const result = await client.query('SELECT * FROM users WHERE google_id = $1', [googleId])
    return result.rows[0] || null
  } finally {
    client.release()
  }
}

export const getUserByEmail = async (email) => {
  const client = await pool.connect()
  try {
    const result = await client.query('SELECT * FROM users WHERE email = $1', [email])
    return result.rows[0] || null
  } finally {
    client.release()
  }
}

export const getUserById = async (id) => {
  const client = await pool.connect()
  try {
    const result = await client.query(
      'SELECT id, name, email, avatar_url, password_hash, google_id, created_at FROM users WHERE id = $1',
      [id]
    )
    return result.rows[0] || null
  } finally {
    client.release()
  }
}

// User preferences operations
export const getUserPreferences = async (userId) => {
  const client = await pool.connect()
  try {
    const result = await client.query(
      'SELECT * FROM user_preferences WHERE user_id = $1',
      [userId]
    )
    return result.rows[0] || null
  } finally {
    client.release()
  }
}

export const updateUserCurrency = async (userId, currency) => {
  const client = await pool.connect()
  try {
    await client.query(
      'UPDATE user_preferences SET currency = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2',
      [currency, userId]
    )
  } finally {
    client.release()
  }
}

// Cost data operations
export const getCostDataForUser = async (userId, month, year) => {
  const client = await pool.connect()
  try {
    const result = await client.query(
      `SELECT cd.*, cp.provider_name, cp.icon, cp.provider_id as provider_code
       FROM cost_data cd
       JOIN cloud_providers cp ON cd.provider_id = cp.provider_id AND cd.user_id = cp.user_id
       WHERE cd.user_id = $1 AND cd.month = $2 AND cd.year = $3
       ORDER BY cd.current_month_cost DESC`,
      [userId, month, year]
    )

    const costData = result.rows

    // Get service costs for each cost data entry
    for (const cost of costData) {
      const servicesResult = await client.query(
        'SELECT * FROM service_costs WHERE cost_data_id = $1',
        [cost.id]
      )
      cost.services = servicesResult.rows
    }

    return costData
  } finally {
    client.release()
  }
}

export const saveCostData = async (userId, providerId, month, year, costData) => {
  const client = await pool.connect()
  try {
    // Start transaction
    await client.query('BEGIN')

    try {
      // Ensure provider exists
      await client.query(
        `INSERT INTO cloud_providers (user_id, provider_id, provider_name, icon)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, provider_id) DO NOTHING`,
        [userId, providerId, costData.providerName, costData.icon]
      )

      // Save cost data
      const costResult = await client.query(
        `INSERT INTO cost_data 
         (user_id, provider_id, month, year, current_month_cost, last_month_cost, forecast_cost, credits, savings, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
         ON CONFLICT (user_id, provider_id, month, year) 
         DO UPDATE SET 
           current_month_cost = EXCLUDED.current_month_cost,
           last_month_cost = EXCLUDED.last_month_cost,
           forecast_cost = EXCLUDED.forecast_cost,
           credits = EXCLUDED.credits,
           savings = EXCLUDED.savings,
           updated_at = CURRENT_TIMESTAMP
         RETURNING id`,
        [
          userId,
          providerId,
          month,
          year,
          costData.currentMonth,
          costData.lastMonth,
          costData.forecast,
          costData.credits,
          costData.savings
        ]
      )

      const costDataId = costResult.rows[0].id

      // Clear old service costs and insert new ones
      await client.query('DELETE FROM service_costs WHERE cost_data_id = $1', [costDataId])

      if (costData.services && costData.services.length > 0) {
        for (const service of costData.services) {
          await client.query(
            'INSERT INTO service_costs (cost_data_id, service_name, cost, change_percent) VALUES ($1, $2, $3, $4)',
            [costDataId, service.name, service.cost, service.change]
          )
        }
      }

      await client.query('COMMIT')
      return costDataId
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    }
  } finally {
    client.release()
  }
}

// Update credits for a provider
export const updateProviderCredits = async (userId, providerId, month, year, credits) => {
  const client = await pool.connect()
  try {
    const now = new Date()
    const currentMonth = month || (now.getMonth() + 1)
    const currentYear = year || now.getFullYear()

    // First, ensure the cost_data entry exists
    const existingResult = await client.query(
      `SELECT id FROM cost_data 
       WHERE user_id = $1 AND provider_id = $2 AND month = $3 AND year = $4`,
      [userId, providerId, currentMonth, currentYear]
    )

    if (existingResult.rows.length === 0) {
      // Create a new entry with default values if it doesn't exist
      await client.query(
        `INSERT INTO cost_data 
         (user_id, provider_id, month, year, current_month_cost, last_month_cost, forecast_cost, credits, savings)
         VALUES ($1, $2, $3, $4, 0, 0, 0, $5, 0)`,
        [userId, providerId, currentMonth, currentYear, credits]
      )
    } else {
      // Update existing entry
      await client.query(
        `UPDATE cost_data 
         SET credits = $1, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $2 AND provider_id = $3 AND month = $4 AND year = $5`,
        [credits, userId, providerId, currentMonth, currentYear]
      )
    }

    return true
  } finally {
    client.release()
  }
}

// Savings plans operations
export const getSavingsPlansForUser = async (userId) => {
  const client = await pool.connect()
  try {
    const result = await client.query(
      'SELECT * FROM savings_plans WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    )
    return result.rows
  } finally {
    client.release()
  }
}

export const saveSavingsPlan = async (userId, plan) => {
  const client = await pool.connect()
  try {
    await client.query(
      `INSERT INTO savings_plans (user_id, name, provider, discount_percent, status, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, plan.name, plan.provider, plan.discount, plan.status || 'pending', plan.expiresAt || null]
    )
  } finally {
    client.release()
  }
}

// Cloud provider credentials operations
export const addCloudProvider = async (userId, providerId, providerName, credentials, accountAlias = null) => {
  const client = await pool.connect()
  try {
    const { encrypt } = await import('./services/encryption.js')
    const credentialsJson = JSON.stringify(credentials)
    const encryptedCredentials = encrypt(credentialsJson)

    // Generate default alias if not provided
    const alias = accountAlias || `${providerName} Account`

    const result = await client.query(
      `INSERT INTO cloud_provider_credentials 
       (user_id, provider_id, provider_name, account_alias, credentials_encrypted, is_active, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
       RETURNING id`,
      [userId, providerId, providerName, alias, encryptedCredentials, true]
    )
    return result.rows[0].id
  } finally {
    client.release()
  }
}

export const getUserCloudProviders = async (userId) => {
  const client = await pool.connect()
  try {
    const result = await client.query(
      `SELECT id, provider_id, provider_name, account_alias, is_active, last_sync_at, created_at, updated_at
       FROM cloud_provider_credentials
       WHERE user_id = $1
       ORDER BY provider_id, created_at DESC`,
      [userId]
    )
    return result.rows
  } finally {
    client.release()
  }
}

// Get credentials by account ID (for multi-account support)
export const getCloudProviderCredentialsByAccountId = async (userId, accountId) => {
  const client = await pool.connect()
  try {
    const result = await client.query(
      `SELECT id, provider_id, provider_name, account_alias, credentials_encrypted
       FROM cloud_provider_credentials
       WHERE user_id = $1 AND id = $2 AND is_active = true`,
      [userId, accountId]
    )
    
    if (result.rows.length === 0) {
      return null
    }
    
    const { decrypt } = await import('./services/encryption.js')
    const decrypted = decrypt(result.rows[0].credentials_encrypted)
    return {
      accountId: result.rows[0].id,
      providerId: result.rows[0].provider_id,
      providerName: result.rows[0].provider_name,
      accountAlias: result.rows[0].account_alias,
      credentials: JSON.parse(decrypted)
    }
  } finally {
    client.release()
  }
}

// Get credentials by provider ID (legacy - returns first active account for backward compatibility)
export const getCloudProviderCredentials = async (userId, providerId) => {
  const client = await pool.connect()
  try {
    const result = await client.query(
      `SELECT id, credentials_encrypted, account_alias
       FROM cloud_provider_credentials
       WHERE user_id = $1 AND provider_id = $2 AND is_active = true
       ORDER BY created_at ASC
       LIMIT 1`,
      [userId, providerId]
    )
    
    if (result.rows.length === 0) {
      return null
    }
    
    const { decrypt } = await import('./services/encryption.js')
    const decrypted = decrypt(result.rows[0].credentials_encrypted)
    return JSON.parse(decrypted)
  } finally {
    client.release()
  }
}

// Get all active accounts for a specific provider type
export const getCloudProviderAccountsByType = async (userId, providerId) => {
  const client = await pool.connect()
  try {
    const result = await client.query(
      `SELECT id, provider_id, provider_name, account_alias, credentials_encrypted, is_active, last_sync_at
       FROM cloud_provider_credentials
       WHERE user_id = $1 AND provider_id = $2 AND is_active = true
       ORDER BY created_at ASC`,
      [userId, providerId]
    )
    
    const { decrypt } = await import('./services/encryption.js')
    
    return result.rows.map(row => ({
      accountId: row.id,
      providerId: row.provider_id,
      providerName: row.provider_name,
      accountAlias: row.account_alias,
      credentials: JSON.parse(decrypt(row.credentials_encrypted)),
      isActive: row.is_active,
      lastSyncAt: row.last_sync_at
    }))
  } finally {
    client.release()
  }
}

// Delete by account ID (for multi-account support)
export const deleteCloudProviderByAccountId = async (userId, accountId) => {
  const client = await pool.connect()
  try {
    const result = await client.query(
      `DELETE FROM cloud_provider_credentials
       WHERE user_id = $1 AND id = $2
       RETURNING id`,
      [userId, accountId]
    )
    return result.rows.length > 0
  } finally {
    client.release()
  }
}

// Legacy delete by provider ID (deletes all accounts of that provider type)
export const deleteCloudProvider = async (userId, providerId) => {
  const client = await pool.connect()
  try {
    const result = await client.query(
      `DELETE FROM cloud_provider_credentials
       WHERE user_id = $1 AND provider_id = $2
       RETURNING id`,
      [userId, providerId]
    )
    return result.rows.length > 0
  } finally {
    client.release()
  }
}

// Update status by account ID (for multi-account support)
export const updateCloudProviderStatusByAccountId = async (userId, accountId, isActive) => {
  const client = await pool.connect()
  try {
    await client.query(
      `UPDATE cloud_provider_credentials
       SET is_active = $1, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $2 AND id = $3`,
      [isActive, userId, accountId]
    )
  } finally {
    client.release()
  }
}

// Legacy update by provider ID
export const updateCloudProviderStatus = async (userId, providerId, isActive) => {
  const client = await pool.connect()
  try {
    await client.query(
      `UPDATE cloud_provider_credentials
       SET is_active = $1, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $2 AND provider_id = $3`,
      [isActive, userId, providerId]
    )
  } finally {
    client.release()
  }
}

// Update account alias
export const updateCloudProviderAlias = async (userId, accountId, accountAlias) => {
  const client = await pool.connect()
  try {
    await client.query(
      `UPDATE cloud_provider_credentials
       SET account_alias = $1, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $2 AND id = $3`,
      [accountAlias, userId, accountId]
    )
  } finally {
    client.release()
  }
}

// Update last sync time for an account
export const updateCloudProviderSyncTime = async (userId, accountId) => {
  const client = await pool.connect()
  try {
    await client.query(
      `UPDATE cloud_provider_credentials
       SET last_sync_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1 AND id = $2`,
      [userId, accountId]
    )
  } finally {
    client.release()
  }
}

// Daily cost data operations
export const saveDailyCostData = async (userId, providerId, date, cost, accountId = null) => {
  const client = await pool.connect()
  try {
    if (accountId) {
      // New multi-account aware save
      await client.query(
        `INSERT INTO daily_cost_data (user_id, provider_id, account_id, date, cost, updated_at)
         VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
         ON CONFLICT (user_id, provider_id, date)
         DO UPDATE SET cost = EXCLUDED.cost, account_id = EXCLUDED.account_id, updated_at = CURRENT_TIMESTAMP`,
        [userId, providerId, accountId, date, cost]
      )
    } else {
      // Legacy save without account_id
      await client.query(
        `INSERT INTO daily_cost_data (user_id, provider_id, date, cost, updated_at)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
         ON CONFLICT (user_id, provider_id, date)
         DO UPDATE SET cost = EXCLUDED.cost, updated_at = CURRENT_TIMESTAMP`,
        [userId, providerId, date, cost]
      )
    }
  } finally {
    client.release()
  }
}

export const saveBulkDailyCostData = async (userId, providerId, dailyData, accountId = null) => {
  const client = await pool.connect()
  try {
    console.log(`[saveBulkDailyCostData] Saving ${dailyData.length} data points for user ${userId}, provider ${providerId}, account ${accountId}`)
    
    await client.query('BEGIN')
    
    try {
      let savedCount = 0
      for (const { date, cost } of dailyData) {
        // Ensure date is in YYYY-MM-DD format
        let dateStr
        if (date instanceof Date) {
          dateStr = date.toISOString().split('T')[0]
        } else if (typeof date === 'string') {
          // If it's already in YYYY-MM-DD format, use it; otherwise try to parse
          if (date.match(/^\d{4}-\d{2}-\d{2}$/)) {
            dateStr = date
          } else {
            dateStr = new Date(date).toISOString().split('T')[0]
          }
        } else {
          dateStr = String(date).split('T')[0]
        }
        
        const costValue = parseFloat(cost) || 0
        
        if (accountId) {
          await client.query(
            `INSERT INTO daily_cost_data (user_id, provider_id, account_id, date, cost, updated_at)
             VALUES ($1, $2, $3, $4::date, $5, CURRENT_TIMESTAMP)
             ON CONFLICT (user_id, provider_id, date)
             DO UPDATE SET cost = EXCLUDED.cost, account_id = EXCLUDED.account_id, updated_at = CURRENT_TIMESTAMP`,
            [userId, providerId, accountId, dateStr, costValue]
          )
        } else {
          await client.query(
            `INSERT INTO daily_cost_data (user_id, provider_id, date, cost, updated_at)
             VALUES ($1, $2, $3::date, $4, CURRENT_TIMESTAMP)
             ON CONFLICT (user_id, provider_id, date)
             DO UPDATE SET cost = EXCLUDED.cost, updated_at = CURRENT_TIMESTAMP`,
            [userId, providerId, dateStr, costValue]
          )
        }
        savedCount++
      }
      await client.query('COMMIT')
      console.log(`[saveBulkDailyCostData] Successfully saved ${savedCount} data points`)
    } catch (error) {
      await client.query('ROLLBACK')
      console.error('[saveBulkDailyCostData] Error saving data:', error)
      throw error
    }
  } finally {
    client.release()
  }
}

// Get daily cost data - supports both account_id (for multi-account) and legacy provider_id
export const getDailyCostData = async (userId, providerId, startDate, endDate, accountId = null) => {
  const client = await pool.connect()
  try {
    // Ensure dates are in the correct format (YYYY-MM-DD)
    const startDateStr = typeof startDate === 'string' ? startDate : startDate.toISOString().split('T')[0]
    const endDateStr = typeof endDate === 'string' ? endDate : endDate.toISOString().split('T')[0]
    
    console.log(`[getDailyCostData] Querying: user_id=${userId}, provider_id=${providerId}, account_id=${accountId}, startDate=${startDateStr}, endDate=${endDateStr}`)
    
    let result
    if (accountId) {
      // Query by specific account
      result = await client.query(
        `SELECT date, cost
         FROM daily_cost_data
         WHERE user_id = $1 AND account_id = $2 AND date >= $3::date AND date <= $4::date
         ORDER BY date ASC`,
        [userId, accountId, startDateStr, endDateStr]
      )
    } else {
      // Legacy query by provider_id
      result = await client.query(
        `SELECT date, cost
         FROM daily_cost_data
         WHERE user_id = $1 AND provider_id = $2 AND date >= $3::date AND date <= $4::date
         ORDER BY date ASC`,
        [userId, providerId, startDateStr, endDateStr]
      )
    }
    
    console.log(`[getDailyCostData] Found ${result.rows.length} rows`)
    
    const mappedData = result.rows.map(row => {
      // Handle both Date objects and strings
      let dateStr
      if (row.date instanceof Date) {
        dateStr = row.date.toISOString().split('T')[0]
      } else if (typeof row.date === 'string') {
        dateStr = row.date.split('T')[0]
      } else {
        dateStr = String(row.date).split('T')[0]
      }
      
      return {
        date: dateStr,
        cost: parseFloat(row.cost) || 0
      }
    })
    
    return mappedData
  } catch (error) {
    console.error('[getDailyCostData] Error:', error)
    throw error
  } finally {
    client.release()
  }
}

// Cache operations
export const getCachedCostData = async (userId, providerId, cacheKey) => {
  const client = await pool.connect()
  try {
    const result = await client.query(
      `SELECT cache_data, expires_at
       FROM cost_data_cache
       WHERE user_id = $1 AND provider_id = $2 AND cache_key = $3 AND expires_at > CURRENT_TIMESTAMP`,
      [userId, providerId, cacheKey]
    )
    
    if (result.rows.length > 0) {
      return result.rows[0].cache_data
    }
    return null
  } finally {
    client.release()
  }
}

export const setCachedCostData = async (userId, providerId, cacheKey, cacheData, ttlMinutes = 60) => {
  const client = await pool.connect()
  try {
    const expiresAt = new Date()
    expiresAt.setMinutes(expiresAt.getMinutes() + ttlMinutes)
    
    await client.query(
      `INSERT INTO cost_data_cache (user_id, provider_id, cache_key, cache_data, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, provider_id, cache_key)
       DO UPDATE SET cache_data = EXCLUDED.cache_data, expires_at = EXCLUDED.expires_at`,
      [userId, providerId, cacheKey, JSON.stringify(cacheData), expiresAt]
    )
  } finally {
    client.release()
  }
}

export const clearExpiredCache = async () => {
  const client = await pool.connect()
  try {
    await client.query(
      'DELETE FROM cost_data_cache WHERE expires_at < CURRENT_TIMESTAMP'
    )
  } finally {
    client.release()
  }
}

// Clear all cache for a user (used during sync to ensure fresh data)
export const clearUserCache = async (userId) => {
  const client = await pool.connect()
  try {
    const result = await client.query(
      'DELETE FROM cost_data_cache WHERE user_id = $1',
      [userId]
    )
    console.log(`[clearUserCache] Cleared ${result.rowCount} cache entries for user ${userId}`)
    return result.rowCount
  } finally {
    client.release()
  }
}

// Update user profile (name, email)
export const updateUserProfile = async (userId, { name, email }) => {
  const client = await pool.connect()
  try {
    const updates = []
    const values = []
    let paramIndex = 1

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`)
      values.push(name)
    }
    if (email !== undefined) {
      updates.push(`email = $${paramIndex++}`)
      values.push(email)
    }

    if (updates.length === 0) {
      // No updates, just return current user
      const result = await client.query(
        'SELECT id, name, email, avatar_url FROM users WHERE id = $1',
        [userId]
      )
      return result.rows[0]
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`)
    values.push(userId)

    const result = await client.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING id, name, email, avatar_url`,
      values
    )
    return result.rows[0]
  } finally {
    client.release()
  }
}

// Update user avatar
export const updateUserAvatar = async (userId, avatarUrl) => {
  const client = await pool.connect()
  try {
    const result = await client.query(
      'UPDATE users SET avatar_url = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, name, email, avatar_url',
      [avatarUrl, userId]
    )
    return result.rows[0]
  } finally {
    client.release()
  }
}

// Update user password
export const updateUserPassword = async (userId, passwordHash) => {
  const client = await pool.connect()
  try {
    await client.query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [passwordHash, userId]
    )
  } finally {
    client.release()
  }
}

// Close database connection pool
export const closeDatabase = async () => {
  await pool.end()
  console.log('Database connection pool closed')
}

// Export pool for use in other modules
export { pool }

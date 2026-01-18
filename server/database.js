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

      // Resources table - stores resource-level cost and metadata
      await client.query(`
        CREATE TABLE IF NOT EXISTS resources (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL,
          account_id INTEGER,
          provider_id TEXT NOT NULL,
          resource_id TEXT NOT NULL,
          resource_name TEXT,
          resource_type TEXT NOT NULL,
          service_name TEXT NOT NULL,
          region TEXT,
          cost DECIMAL(15, 2) DEFAULT 0,
          usage_quantity DECIMAL(15, 4),
          usage_unit TEXT,
          usage_type TEXT,
          first_seen_date DATE,
          last_seen_date DATE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (account_id) REFERENCES cloud_provider_credentials(id) ON DELETE CASCADE,
          UNIQUE(user_id, provider_id, resource_id, last_seen_date)
        )
      `)
      await client.query(`CREATE INDEX IF NOT EXISTS idx_resources_user_provider ON resources(user_id, provider_id)`)
      await client.query(`CREATE INDEX IF NOT EXISTS idx_resources_service ON resources(user_id, service_name)`)
      await client.query(`CREATE INDEX IF NOT EXISTS idx_resources_region ON resources(user_id, region)`)

      // Resource tags table - stores tags for resources
      await client.query(`
        CREATE TABLE IF NOT EXISTS resource_tags (
          id SERIAL PRIMARY KEY,
          resource_id INTEGER NOT NULL,
          tag_key TEXT NOT NULL,
          tag_value TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE,
          UNIQUE(resource_id, tag_key)
        )
      `)
      await client.query(`CREATE INDEX IF NOT EXISTS idx_resource_tags_resource ON resource_tags(resource_id)`)
      await client.query(`CREATE INDEX IF NOT EXISTS idx_resource_tags_key_value ON resource_tags(tag_key, tag_value)`)

      // Service usage metrics table - stores usage alongside costs per service
      await client.query(`
        CREATE TABLE IF NOT EXISTS service_usage_metrics (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL,
          account_id INTEGER,
          provider_id TEXT NOT NULL,
          service_name TEXT NOT NULL,
          date DATE NOT NULL,
          cost DECIMAL(15, 2) DEFAULT 0,
          usage_quantity DECIMAL(15, 4),
          usage_unit TEXT,
          usage_type TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (account_id) REFERENCES cloud_provider_credentials(id) ON DELETE CASCADE,
          UNIQUE(user_id, provider_id, service_name, date, usage_type)
        )
      `)
      await client.query(`CREATE INDEX IF NOT EXISTS idx_service_usage_user_service_date ON service_usage_metrics(user_id, provider_id, service_name, date)`)

      // Anomaly baselines table - stores 30-day rolling averages for anomaly detection
      await client.query(`
        CREATE TABLE IF NOT EXISTS anomaly_baselines (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL,
          account_id INTEGER,
          provider_id TEXT NOT NULL,
          service_name TEXT NOT NULL,
          baseline_date DATE NOT NULL,
          baseline_cost DECIMAL(15, 2) NOT NULL,
          baseline_usage DECIMAL(15, 4),
          rolling_30day_avg DECIMAL(15, 2) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (account_id) REFERENCES cloud_provider_credentials(id) ON DELETE CASCADE,
          UNIQUE(user_id, provider_id, service_name, baseline_date)
        )
      `)
      await client.query(`CREATE INDEX IF NOT EXISTS idx_anomaly_baselines_user_service_date ON anomaly_baselines(user_id, provider_id, service_name, baseline_date)`)

      // Cost explanations table - stores plain-English explanations for cost changes
      await client.query(`
        CREATE TABLE IF NOT EXISTS cost_explanations (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL,
          account_id INTEGER,
          provider_id TEXT NOT NULL,
          explanation_month INTEGER NOT NULL,
          explanation_year INTEGER NOT NULL,
          explanation_text TEXT NOT NULL,
          cost_change DECIMAL(15, 2) NOT NULL,
          contributing_factors JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (account_id) REFERENCES cloud_provider_credentials(id) ON DELETE CASCADE,
          UNIQUE(user_id, provider_id, explanation_month, explanation_year)
        )
      `)
      await client.query(`CREATE INDEX IF NOT EXISTS idx_cost_explanations_user_month ON cost_explanations(user_id, provider_id, explanation_month, explanation_year)`)

      // Business metrics table - stores business metrics for unit economics (customers, API calls, transactions)
      await client.query(`
        CREATE TABLE IF NOT EXISTS business_metrics (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL,
          account_id INTEGER,
          provider_id TEXT,
          metric_type TEXT NOT NULL,
          metric_name TEXT NOT NULL,
          date DATE NOT NULL,
          metric_value DECIMAL(15, 4) NOT NULL,
          unit TEXT,
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (account_id) REFERENCES cloud_provider_credentials(id) ON DELETE CASCADE,
          UNIQUE(user_id, metric_type, metric_name, date, provider_id, account_id)
        )
      `)
      await client.query(`CREATE INDEX IF NOT EXISTS idx_business_metrics_user_date ON business_metrics(user_id, date)`)
      await client.query(`CREATE INDEX IF NOT EXISTS idx_business_metrics_type_name ON business_metrics(metric_type, metric_name)`)

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
            -- Drop old unique constraint
            ALTER TABLE cost_data DROP CONSTRAINT IF EXISTS cost_data_user_id_provider_id_month_year_key;
            -- Add new unique constraint with account_id
            ALTER TABLE cost_data ADD CONSTRAINT cost_data_user_provider_account_month_year_key 
              UNIQUE(user_id, provider_id, account_id, month, year);
          END IF;
        END $$;
      `)
      
      // Ensure unique constraint includes account_id (handle case where column exists but constraint doesn't)
      // Use partial unique index to handle NULL account_id properly
      await client.query(`
        DO $$ 
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'cost_data' AND column_name = 'account_id'
          ) THEN
            -- Drop old unique constraint if it exists
            ALTER TABLE cost_data DROP CONSTRAINT IF EXISTS cost_data_user_id_provider_id_month_year_key;
            ALTER TABLE cost_data DROP CONSTRAINT IF EXISTS cost_data_user_provider_account_month_year_key;
            
            -- Drop old indexes if they exist
            DROP INDEX IF EXISTS cost_data_user_provider_account_month_year_idx;
            DROP INDEX IF EXISTS cost_data_user_provider_month_year_null_account_idx;
            
            -- Create partial unique indexes to handle NULL account_id
            -- For records with account_id
            CREATE UNIQUE INDEX IF NOT EXISTS cost_data_user_provider_account_month_year_idx 
              ON cost_data(user_id, provider_id, account_id, month, year) 
              WHERE account_id IS NOT NULL;
            
            -- For records without account_id (legacy)
            CREATE UNIQUE INDEX IF NOT EXISTS cost_data_user_provider_month_year_null_account_idx 
              ON cost_data(user_id, provider_id, month, year) 
              WHERE account_id IS NULL;
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
  } catch (error) {
    console.error('getUserById error:', error)
    throw error
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
    if (result.rows[0]) {
      return result.rows[0]
    }
    // If no preferences exist, create default ones
    const insertResult = await client.query(
      'INSERT INTO user_preferences (user_id, currency) VALUES ($1, $2) RETURNING *',
      [userId, 'USD']
    )
    return insertResult.rows[0]
  } catch (error) {
    console.error('getUserPreferences error:', error)
    // Return default preferences if table doesn't exist or other error
    return { user_id: userId, currency: 'USD' }
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

// Get aggregated service costs for a date range
// This calculates proportional service costs based on the period's total cost
export const getServiceCostsForDateRange = async (userId, providerId, startDate, endDate) => {
  const client = await pool.connect()
  try {
    // Step 1: Get total daily costs for the date range
    const dailyTotalResult = await client.query(
      `SELECT COALESCE(SUM(cost), 0) as total_cost
       FROM daily_cost_data
       WHERE user_id = $1 
         AND provider_id = $2
         AND date >= $3::date
         AND date <= $4::date`,
      [userId, providerId, startDate, endDate]
    )
    
    const periodTotalCost = parseFloat(dailyTotalResult.rows[0]?.total_cost) || 0
    
    console.log(`[getServiceCostsForDateRange] Period total cost: $${periodTotalCost.toFixed(2)}`)
    
    // Step 2: Get the latest month's service breakdown to use as proportions
    const latestCostDataResult = await client.query(
      `SELECT cd.id
       FROM cost_data cd
       WHERE cd.user_id = $1 AND cd.provider_id = $2
       ORDER BY cd.year DESC, cd.month DESC
       LIMIT 1`,
      [userId, providerId]
    )
    
    if (latestCostDataResult.rows.length === 0) {
      return []
    }
    
    const costDataId = latestCostDataResult.rows[0].id
    
    // Step 3: Get service costs and calculate their percentages
    const servicesResult = await client.query(
      `SELECT service_name, cost, change_percent
       FROM service_costs 
       WHERE cost_data_id = $1
       ORDER BY cost DESC`,
      [costDataId]
    )
    
    if (servicesResult.rows.length === 0) {
      return []
    }
    
    // Calculate total of all services to get percentages
    const servicesTotalCost = servicesResult.rows.reduce(
      (sum, row) => sum + (parseFloat(row.cost) || 0), 0
    )
    
    // Always apply proportions based on period's total cost
    // If period total is 0, services will show 0 (which is correct)
    return servicesResult.rows.map(row => {
      const serviceCost = parseFloat(row.cost) || 0
      const proportion = servicesTotalCost > 0 ? serviceCost / servicesTotalCost : 0
      
      return {
        name: row.service_name,
        // Apply the proportion to the period's total cost
        cost: periodTotalCost * proportion,
        change: parseFloat(row.change_percent) || 0,
      }
    })
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

      // Save cost data (with account_id support)
      const accountId = costData.accountId || null
      
      // Check if record exists first, then update or insert
      const existingResult = await client.query(
        `SELECT id FROM cost_data 
         WHERE user_id = $1 AND provider_id = $2 AND month = $4 AND year = $5
           AND (account_id = $3 OR (account_id IS NULL AND $3 IS NULL))`,
        [userId, providerId, accountId, month, year]
      )
      
      let finalCostDataId
      if (existingResult.rows.length > 0) {
        // Update existing record
        const updateResult = await client.query(
          `UPDATE cost_data SET
             current_month_cost = $1,
             last_month_cost = $2,
             forecast_cost = $3,
             credits = $4,
             savings = $5,
             account_id = COALESCE($6, account_id),
             updated_at = CURRENT_TIMESTAMP
           WHERE id = $7
           RETURNING id`,
          [
            costData.currentMonth,
            costData.lastMonth,
            costData.forecast,
            costData.credits,
            costData.savings,
            accountId,
            existingResult.rows[0].id
          ]
        )
        finalCostDataId = updateResult.rows[0].id
      } else {
        // Insert new record
        const insertResult = await client.query(
          `INSERT INTO cost_data 
           (user_id, provider_id, account_id, month, year, current_month_cost, last_month_cost, forecast_cost, credits, savings, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
           RETURNING id`,
          [
            userId,
            providerId,
            accountId,
            month,
            year,
            costData.currentMonth,
            costData.lastMonth,
            costData.forecast,
            costData.credits,
            costData.savings
          ]
        )
        finalCostDataId = insertResult.rows[0].id
      }
      
      const costDataId = finalCostDataId

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

// ============================================================================
// Resource and Tag Operations
// ============================================================================

/**
 * Save or update a resource
 */
export const saveResource = async (userId, accountId, providerId, resource) => {
  const client = await pool.connect()
  try {
    const result = await client.query(
      `INSERT INTO resources (
        user_id, account_id, provider_id, resource_id, resource_name,
        resource_type, service_name, region, cost, usage_quantity,
        usage_unit, usage_type, first_seen_date, last_seen_date, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id, provider_id, resource_id, last_seen_date)
      DO UPDATE SET
        resource_name = EXCLUDED.resource_name,
        resource_type = EXCLUDED.resource_type,
        service_name = EXCLUDED.service_name,
        region = EXCLUDED.region,
        cost = EXCLUDED.cost,
        usage_quantity = EXCLUDED.usage_quantity,
        usage_unit = EXCLUDED.usage_unit,
        usage_type = EXCLUDED.usage_type,
        last_seen_date = EXCLUDED.last_seen_date,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id`,
      [
        userId, accountId, providerId, resource.resourceId,
        resource.resourceName || null, resource.resourceType,
        resource.serviceName, resource.region || null,
        resource.cost || 0, resource.usageQuantity || null,
        resource.usageUnit || null, resource.usageType || null,
        resource.firstSeenDate || null, resource.lastSeenDate || new Date().toISOString().split('T')[0]
      ]
    )
    return result.rows[0].id
  } finally {
    client.release()
  }
}

/**
 * Save tags for a resource
 */
export const saveResourceTags = async (resourceId, tags) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    
    // Delete existing tags for this resource
    await client.query('DELETE FROM resource_tags WHERE resource_id = $1', [resourceId])
    
    // Insert new tags
    if (tags && Object.keys(tags).length > 0) {
      for (const [key, value] of Object.entries(tags)) {
        await client.query(
          'INSERT INTO resource_tags (resource_id, tag_key, tag_value) VALUES ($1, $2, $3)',
          [resourceId, key, value || null]
        )
      }
    }
    
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

/**
 * Get available dimensions (tag keys) and their values
 */
export const getAvailableDimensions = async (userId, providerId = null) => {
  const client = await pool.connect()
  try {
    let query = `
      SELECT DISTINCT rt.tag_key, rt.tag_value, COUNT(DISTINCT r.id) as resource_count
      FROM resource_tags rt
      JOIN resources r ON rt.resource_id = r.id
      WHERE r.user_id = $1
      ${providerId ? 'AND r.provider_id = $2' : ''}
      GROUP BY rt.tag_key, rt.tag_value
      ORDER BY rt.tag_key, rt.tag_value
    `
    
    const params = providerId ? [userId, providerId] : [userId]
    const result = await client.query(query, params)
    
    // Group by dimension (tag_key)
    const dimensions = {}
    
    result.rows.forEach(row => {
      const key = row.tag_key
      if (!dimensions[key]) {
        dimensions[key] = []
      }
      dimensions[key].push({
        value: row.tag_value || '(empty)',
        resourceCount: parseInt(row.resource_count) || 0
      })
    })
    
    return dimensions
  } catch (error) {
    console.error('[getAvailableDimensions] Error:', error)
    return {}
  } finally {
    client.release()
  }
}

/**
 * Get costs grouped by dimension (tag)
 */
export const getCostByDimension = async (userId, dimensionKey, dimensionValue = null, providerId = null, accountId = null) => {
  const client = await pool.connect()
  try {
    // Build query to aggregate costs by dimension value
    let query = `
      SELECT 
        COALESCE(rt.tag_value, '(untagged)') as dimension_value,
        SUM(r.cost) as total_cost,
        COUNT(DISTINCT r.id) as resource_count,
        COUNT(DISTINCT r.service_name) as service_count,
        COUNT(DISTINCT r.region) as region_count
      FROM resources r
      LEFT JOIN resource_tags rt ON r.id = rt.resource_id AND rt.tag_key = $1
      WHERE r.user_id = $2
      ${providerId ? 'AND r.provider_id = $3' : ''}
      ${accountId ? 'AND r.account_id = $4' : 'AND r.account_id IS NULL'}
      ${dimensionValue ? `AND (rt.tag_value = $${providerId ? (accountId ? 5 : 4) : (accountId ? 4 : 3)} OR rt.tag_value IS NULL)` : ''}
      GROUP BY rt.tag_value
      ORDER BY SUM(r.cost) DESC
    `
    
    const params = [dimensionKey, userId]
    let paramIndex = 3
    
    if (providerId) {
      params.push(providerId)
      paramIndex++
    }
    
    if (accountId) {
      params.push(accountId)
      paramIndex++
    }
    
    if (dimensionValue) {
      params.push(dimensionValue)
    }
    
    const result = await client.query(query, params)
    
    // Get service breakdown for each dimension value
    const breakdownPromises = result.rows.map(async (row) => {
      const servicesQuery = `
        SELECT 
          r.service_name,
          SUM(r.cost) as service_cost,
          COUNT(DISTINCT r.id) as resource_count
        FROM resources r
        LEFT JOIN resource_tags rt ON r.id = rt.resource_id AND rt.tag_key = $1
        WHERE r.user_id = $2
          AND COALESCE(rt.tag_value, '(untagged)') = $3
          ${providerId ? 'AND r.provider_id = $4' : ''}
          ${accountId ? 'AND r.account_id = $5' : 'AND r.account_id IS NULL'}
        GROUP BY r.service_name
        ORDER BY SUM(r.cost) DESC
        LIMIT 10
      `
      
      const servicesParams = [dimensionKey, userId, row.dimension_value]
      if (providerId) servicesParams.push(providerId)
      if (accountId) servicesParams.push(accountId)
      
      const servicesResult = await client.query(servicesQuery, servicesParams)
      
      return {
        dimensionValue: row.dimension_value,
        totalCost: parseFloat(row.total_cost) || 0,
        resourceCount: parseInt(row.resource_count) || 0,
        serviceCount: parseInt(row.service_count) || 0,
        regionCount: parseInt(row.region_count) || 0,
        services: servicesResult.rows.map(s => ({
          serviceName: s.service_name,
          cost: parseFloat(s.service_cost) || 0,
          resourceCount: parseInt(s.resource_count) || 0
        }))
      }
    })
    
    const breakdowns = await Promise.all(breakdownPromises)
    
    return breakdowns
  } catch (error) {
    console.error('[getCostByDimension] Error:', error)
    return []
  } finally {
    client.release()
  }
}

/**
 * Get untagged resources ranked by cost
 */
export const getUntaggedResources = async (userId, providerId = null, limit = 50) => {
  const client = await pool.connect()
  try {
    let query = `
      SELECT r.*, COALESCE(COUNT(rt.id), 0) as tag_count
      FROM resources r
      LEFT JOIN resource_tags rt ON r.id = rt.resource_id
      WHERE r.user_id = $1
      ${providerId ? 'AND r.provider_id = $2' : ''}
      GROUP BY r.id
      HAVING COALESCE(COUNT(rt.id), 0) = 0
      ORDER BY r.cost DESC, r.last_seen_date DESC
      LIMIT $${providerId ? 3 : 2}
    `
    
    const params = providerId ? [userId, providerId, limit] : [userId, limit]
    const result = await client.query(query, params)
    
    return result.rows.map(row => ({
      id: row.id,
      resourceId: row.resource_id,
      resourceName: row.resource_name,
      resourceType: row.resource_type,
      serviceName: row.service_name,
      region: row.region,
      cost: parseFloat(row.cost) || 0,
      providerId: row.provider_id,
      firstSeenDate: row.first_seen_date,
      lastSeenDate: row.last_seen_date,
      ageDays: row.first_seen_date ? 
        Math.floor((new Date() - new Date(row.first_seen_date)) / (1000 * 60 * 60 * 24)) : null
    }))
  } catch (error) {
    console.error('[getUntaggedResources] Error:', error)
    // Return empty array if table doesn't exist or query fails
    return []
  } finally {
    client.release()
  }
}

// ============================================================================
// Service Usage Metrics Operations
// ============================================================================

/**
 * Save service usage metrics
 */
export const saveServiceUsageMetrics = async (userId, accountId, providerId, metrics) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    
    for (const metric of metrics) {
      await client.query(
        `INSERT INTO service_usage_metrics (
          user_id, account_id, provider_id, service_name, date,
          cost, usage_quantity, usage_unit, usage_type, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
        ON CONFLICT (user_id, provider_id, service_name, date, usage_type)
        DO UPDATE SET
          cost = EXCLUDED.cost,
          usage_quantity = EXCLUDED.usage_quantity,
          usage_unit = EXCLUDED.usage_unit,
          updated_at = CURRENT_TIMESTAMP`,
        [
          userId, accountId, providerId,
          metric.serviceName, metric.date,
          metric.cost || 0, metric.usageQuantity || null,
          metric.usageUnit || null, metric.usageType || null
        ]
      )
    }
    
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

/**
 * Get cost vs usage data for services
 * Falls back to service_costs if service_usage_metrics is empty
 */
export const getCostVsUsage = async (userId, providerId, startDate, endDate, accountId = null) => {
  const client = await pool.connect()
  try {
    // First try service_usage_metrics (has usage data)
    let query = `
      SELECT 
        service_name,
        SUM(cost) as total_cost,
        SUM(usage_quantity) as total_usage,
        usage_unit,
        usage_type,
        COUNT(DISTINCT date) as days_with_data
      FROM service_usage_metrics
      WHERE user_id = $1
        AND provider_id = $2
        AND date >= $3::date
        AND date <= $4::date
        ${accountId ? 'AND account_id = $5' : 'AND account_id IS NULL'}
      GROUP BY service_name, usage_unit, usage_type
      HAVING SUM(cost) > 0
      ORDER BY SUM(cost) DESC
    `
    
    const params = accountId ? [userId, providerId, startDate, endDate, accountId] : 
                              [userId, providerId, startDate, endDate]
    
    const result = await client.query(query, params)
    
    // If we have usage metrics, return them
    if (result.rows.length > 0) {
      return result.rows.map(row => {
        const totalCost = parseFloat(row.total_cost) || 0
        const totalUsage = parseFloat(row.total_usage) || 0
        const unitCost = totalUsage > 0 ? totalCost / totalUsage : null
        
        return {
          serviceName: row.service_name,
          cost: totalCost,
          usage: totalUsage,
          usageUnit: row.usage_unit,
          usageType: row.usage_type,
          unitCost: unitCost,
          daysWithData: parseInt(row.days_with_data) || 0
        }
      })
    }
    
    // Fallback: Use service_costs from cost_data (cost only, no usage)
    // Get the most recent cost data for the period
    const startDateObj = new Date(startDate)
    const endDateObj = new Date(endDate)
    
    const fallbackQuery = `
      SELECT DISTINCT sc.service_name, sc.cost, sc.change_percent
      FROM service_costs sc
      JOIN cost_data cd ON sc.cost_data_id = cd.id
      WHERE cd.user_id = $1 AND cd.provider_id = $2
        AND (cd.year > ${startDateObj.getFullYear()} OR 
             (cd.year = ${startDateObj.getFullYear()} AND cd.month >= ${startDateObj.getMonth() + 1}))
        AND (cd.year < ${endDateObj.getFullYear()} OR 
             (cd.year = ${endDateObj.getFullYear()} AND cd.month <= ${endDateObj.getMonth() + 1}))
      ORDER BY sc.cost DESC
      LIMIT 50
    `
    
    const fallbackResult = await client.query(fallbackQuery, [userId, providerId])
    
    return fallbackResult.rows.map(row => ({
      serviceName: row.service_name,
      cost: parseFloat(row.cost) || 0,
      usage: null, // No usage data available
      usageUnit: null,
      usageType: null,
      unitCost: null,
      daysWithData: 0
    }))
  } catch (error) {
    console.error('[getCostVsUsage] Error:', error)
    return []
  } finally {
    client.release()
  }
}

// ============================================================================
// Anomaly Detection Operations
// ============================================================================

/**
 * Calculate and save 30-day rolling average baseline
 */
export const calculateAnomalyBaseline = async (userId, providerId, serviceName, baselineDate, accountId = null) => {
  const client = await pool.connect()
  try {
    // Get 30 days of historical data ending at baselineDate
    const endDate = new Date(baselineDate)
    const startDate = new Date(endDate)
    startDate.setDate(startDate.getDate() - 30)
    
    // Calculate 30-day rolling average from daily cost data
    const costData = await getDailyCostData(userId, providerId, startDate.toISOString().split('T')[0], 
                                            endDate.toISOString().split('T')[0], accountId)
    
    // Get service-specific costs if available
    let serviceCostData = []
    try {
      const usageResult = await client.query(
        `SELECT date, SUM(cost) as daily_cost
         FROM service_usage_metrics
         WHERE user_id = $1 AND provider_id = $2 AND service_name = $3
           AND date >= $4::date AND date <= $5::date
           ${accountId ? 'AND account_id = $6' : 'AND account_id IS NULL'}
         GROUP BY date
         ORDER BY date ASC`,
        accountId ? [userId, providerId, serviceName, startDate.toISOString().split('T')[0], 
                     endDate.toISOString().split('T')[0], accountId] :
                    [userId, providerId, serviceName, startDate.toISOString().split('T')[0], 
                     endDate.toISOString().split('T')[0]]
      )
      serviceCostData = usageResult.rows
    } catch (err) {
      // If service_usage_metrics doesn't have data, use daily_cost_data
      console.log(`[calculateAnomalyBaseline] No usage metrics for ${serviceName}, using daily costs`)
    }
    
    // Calculate baseline (average daily cost over 30 days)
    let dailyCosts = []
    if (serviceCostData.length > 0) {
      dailyCosts = serviceCostData.map(r => parseFloat(r.daily_cost) || 0)
    } else {
      // Fall back to daily_cost_data (will need service-level breakdown from API)
      dailyCosts = costData.map(d => d.cost)
    }
    
    const rollingAvg = dailyCosts.length > 0 ? 
      dailyCosts.reduce((sum, cost) => sum + cost, 0) / dailyCosts.length : 0
    
    // Get current cost for baseline date
    const currentCost = dailyCosts[dailyCosts.length - 1] || 0
    
    // Save baseline
    await client.query(
      `INSERT INTO anomaly_baselines (
        user_id, account_id, provider_id, service_name, baseline_date,
        baseline_cost, rolling_30day_avg, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id, provider_id, service_name, baseline_date)
      DO UPDATE SET
        baseline_cost = EXCLUDED.baseline_cost,
        rolling_30day_avg = EXCLUDED.rolling_30day_avg`,
      [userId, accountId, providerId, serviceName, baselineDate, currentCost, rollingAvg]
    )
    
    return { baselineCost: currentCost, rollingAvg }
  } finally {
    client.release()
  }
}

/**
 * Get anomalies (costs significantly different from baseline)
 */
export const getAnomalies = async (userId, providerId = null, thresholdPercent = 20, accountId = null) => {
  const client = await pool.connect()
  try {
    // Get recent baselines (last 7 days)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    
    // Build query and params dynamically
    let params = [userId, sevenDaysAgo.toISOString().split('T')[0]]
    let paramIndex = 3
    
    // Build WHERE conditions
    let whereConditions = ['ab.user_id = $1', 'ab.baseline_date >= $2::date']
    
    if (providerId) {
      whereConditions.push(`ab.provider_id = $${paramIndex}`)
      params.push(providerId)
      paramIndex++
    }
    
    if (accountId) {
      whereConditions.push(`ab.account_id = $${paramIndex}`)
      params.push(accountId)
      paramIndex++
    } else {
      whereConditions.push('ab.account_id IS NULL')
    }
    
    // Calculate variance expression
    const varianceExpr = `CASE 
      WHEN ab.baseline_cost > 0 AND ab.rolling_30day_avg > 0 THEN
        ((ab.baseline_cost - ab.rolling_30day_avg) / ab.rolling_30day_avg * 100)
      ELSE 0
    END`
    
    // Use CTE to allow alias in ORDER BY
    params.push(thresholdPercent)
    let query = `
      WITH anomalies_with_variance AS (
        SELECT 
          ab.*,
          ${varianceExpr} as variance_percent
        FROM anomaly_baselines ab
        WHERE ${whereConditions.join(' AND ')}
          AND ABS(${varianceExpr}) >= $${paramIndex}
      )
      SELECT * FROM anomalies_with_variance
      ORDER BY ABS(variance_percent) DESC
      LIMIT 50
    `
    
    const result = await client.query(query, params)
    
    return result.rows.map(row => {
      const variancePercent = parseFloat(row.variance_percent) || 0
      const isIncrease = variancePercent > 0
      
      return {
        providerId: row.provider_id,
        serviceName: row.service_name,
        baselineDate: row.baseline_date,
        baselineCost: parseFloat(row.baseline_cost) || 0,
        rollingAvg: parseFloat(row.rolling_30day_avg) || 0,
        variancePercent: Math.abs(variancePercent),
        isIncrease,
        message: `${row.service_name} costs are ${Math.abs(variancePercent).toFixed(1)}% ${isIncrease ? 'higher' : 'lower'} than their 30-day baseline`
      }
    })
  } catch (error) {
    console.error('[getAnomalies] Database error:', error)
    // Return empty array if table doesn't exist or query fails
    return []
  } finally {
    client.release()
  }
}

// ============================================================================
// Cost Explanation Operations
// ============================================================================

/**
 * Generate and save cost explanation for a month
 */
export const generateCostExplanation = async (userId, providerId, month, year, accountId = null) => {
  const client = await pool.connect()
  try {
    // Get current month and last month costs, including credits
    const currentCostResult = await client.query(
      `SELECT current_month_cost, last_month_cost, credits, savings
       FROM cost_data
       WHERE user_id = $1 AND provider_id = $2 AND month = $3 AND year = $4
         ${accountId ? 'AND account_id = $5' : 'AND account_id IS NULL'}`,
      accountId ? [userId, providerId, month, year, accountId] : [userId, providerId, month, year]
    )
    
    if (currentCostResult.rows.length === 0) {
      return null
    }
    
    const currentCost = parseFloat(currentCostResult.rows[0].current_month_cost) || 0
    const lastMonthCost = parseFloat(currentCostResult.rows[0].last_month_cost) || 0
    const credits = parseFloat(currentCostResult.rows[0].credits) || 0
    const savings = parseFloat(currentCostResult.rows[0].savings) || 0
    
    // Calculate gross cost (before credits) and net cost (after credits)
    const grossCost = currentCost + credits + savings
    const netCost = currentCost
    const netCostChange = netCost - lastMonthCost
    const grossCostChange = grossCost - lastMonthCost
    const changePercent = lastMonthCost > 0 ? (grossCostChange / lastMonthCost) * 100 : 0
    
    // Get service-level changes
    const serviceParams = accountId ? [userId, providerId, month, year, accountId] : [userId, providerId, month, year]
    const servicesResult = await client.query(
      `SELECT sc.service_name, sc.cost, sc.change_percent
       FROM service_costs sc
       JOIN cost_data cd ON sc.cost_data_id = cd.id
       WHERE cd.user_id = $1 AND cd.provider_id = $2 AND cd.month = $3 AND cd.year = $4
         ${accountId ? 'AND cd.account_id = $5' : 'AND cd.account_id IS NULL'}
       ORDER BY ABS(sc.change_percent) DESC
       LIMIT 5`,
      serviceParams
    )
    
    // Build explanation - account for credits properly
    let explanation = `Your ${providerId.toUpperCase()} cloud spend `
    
    // If credits are applied, explain the net cost vs gross cost
    if (credits > 0 || savings > 0) {
      const totalDiscounts = credits + savings
      explanation += `this month is $${grossCost.toFixed(2)} before credits and savings. `
      explanation += `After applying $${totalDiscounts.toFixed(2)} in credits`
      if (savings > 0) {
        explanation += ` and $${savings.toFixed(2)} in savings`
      }
      explanation += `, your net cost is $${netCost.toFixed(2)}. `
      
      // Compare gross costs month-over-month
      if (grossCostChange > 0) {
        explanation += `Your actual spending increased by $${Math.abs(grossCostChange).toFixed(2)} `
        explanation += `(${Math.abs(changePercent).toFixed(1)}% increase) compared to last month. `
      } else if (grossCostChange < 0) {
        explanation += `Your actual spending decreased by $${Math.abs(grossCostChange).toFixed(2)} `
        explanation += `(${Math.abs(changePercent).toFixed(1)}% decrease) compared to last month. `
      } else {
        explanation += `Your actual spending remained the same compared to last month. `
      }
      
      // Add credits information
      if (credits > 0) {
        explanation += `You've used $${credits.toFixed(2)} in credits this month. `
      }
    } else {
      // No credits - standard explanation
      if (netCostChange > 0) {
        explanation += `increased by $${Math.abs(netCostChange).toFixed(2)} this month `
        explanation += `(${Math.abs(changePercent).toFixed(1)}% increase). `
      } else if (netCostChange < 0) {
        explanation += `decreased by $${Math.abs(netCostChange).toFixed(2)} this month `
        explanation += `(${Math.abs(changePercent).toFixed(1)}% decrease). `
      } else {
        explanation += `remained the same this month. `
      }
    }
    
    const contributingFactors = []
    if (servicesResult.rows.length > 0) {
      const topChange = servicesResult.rows[0]
      if (Math.abs(parseFloat(topChange.change_percent)) > 10) {
        explanation += `This change was primarily driven by ${topChange.service_name}, `
        explanation += `which ${parseFloat(topChange.change_percent) > 0 ? 'increased' : 'decreased'} `
        explanation += `by ${Math.abs(parseFloat(topChange.change_percent)).toFixed(1)}%. `
        
        contributingFactors.push({
          service: topChange.service_name,
          changePercent: parseFloat(topChange.change_percent),
          cost: parseFloat(topChange.cost)
        })
      }
    }
    
    // Save explanation
    await client.query(
      `INSERT INTO cost_explanations (
        user_id, account_id, provider_id, explanation_month, explanation_year,
        explanation_text, cost_change, contributing_factors, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id, provider_id, explanation_month, explanation_year)
      DO UPDATE SET
        explanation_text = EXCLUDED.explanation_text,
        cost_change = EXCLUDED.cost_change,
        contributing_factors = EXCLUDED.contributing_factors`,
      [userId, accountId, providerId, month, year, explanation, netCostChange, JSON.stringify(contributingFactors)]
    )
    
    return { explanation, costChange: netCostChange, contributingFactors }
  } finally {
    client.release()
  }
}

// ============================================================================
// Business Metrics & Unit Economics Operations
// ============================================================================

/**
 * Save or update business metric
 */
export const saveBusinessMetric = async (userId, metric) => {
  const client = await pool.connect()
  try {
    const result = await client.query(
      `INSERT INTO business_metrics (
        user_id, account_id, provider_id, metric_type, metric_name,
        date, metric_value, unit, notes, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id, metric_type, metric_name, date, provider_id, account_id)
      DO UPDATE SET
        metric_value = EXCLUDED.metric_value,
        unit = EXCLUDED.unit,
        notes = EXCLUDED.notes,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id`,
      [
        userId,
        metric.accountId || null,
        metric.providerId || null,
        metric.metricType,
        metric.metricName,
        metric.date,
        metric.metricValue,
        metric.unit || null,
        metric.notes || null
      ]
    )
    return result.rows[0].id
  } finally {
    client.release()
  }
}

/**
 * Get business metrics for a date range
 */
export const getBusinessMetrics = async (userId, startDate, endDate, metricType = null, metricName = null, providerId = null) => {
  const client = await pool.connect()
  try {
    let query = `
      SELECT *
      FROM business_metrics
      WHERE user_id = $1
        AND date >= $2::date
        AND date <= $3::date
      ${metricType ? 'AND metric_type = $4' : ''}
      ${metricName ? `AND metric_name = $${metricType ? 5 : 4}` : ''}
      ${providerId ? `AND (provider_id = $${metricType ? (metricName ? 6 : 5) : (metricName ? 5 : 4)} OR provider_id IS NULL)` : ''}
      ORDER BY date DESC, metric_type, metric_name
    `
    
    const params = [userId, startDate, endDate]
    if (metricType) params.push(metricType)
    if (metricName) params.push(metricName)
    if (providerId) params.push(providerId)
    
    const result = await client.query(query, params)
    
    return result.rows.map(row => ({
      id: row.id,
      metricType: row.metric_type,
      metricName: row.metric_name,
      date: row.date,
      metricValue: parseFloat(row.metric_value) || 0,
      unit: row.unit,
      notes: row.notes,
      providerId: row.provider_id
    }))
  } finally {
    client.release()
  }
}

/**
 * Get unit economics (cost per business metric)
 */
export const getUnitEconomics = async (userId, startDate, endDate, providerId = null, accountId = null) => {
  const client = await pool.connect()
  try {
    // Get total cost for the period
    let costQuery = `
      SELECT SUM(cost) as total_cost
      FROM daily_cost_data
      WHERE user_id = $1
        AND date >= $2::date
        AND date <= $3::date
      ${providerId ? 'AND provider_id = $4' : ''}
      ${accountId ? `AND account_id = $${providerId ? 5 : 4}` : 'AND account_id IS NULL'}
    `
    
    const costParams = [userId, startDate, endDate]
    if (providerId) costParams.push(providerId)
    if (accountId) costParams.push(accountId)
    
    const costResult = await client.query(costQuery, costParams)
    const totalCost = parseFloat(costResult.rows[0]?.total_cost) || 0
    
    // Get business metrics aggregated by type and name
    let metricsQuery = `
      SELECT 
        metric_type,
        metric_name,
        unit,
        SUM(metric_value) as total_metric_value,
        COUNT(DISTINCT date) as days_with_data
      FROM business_metrics
      WHERE user_id = $1
        AND date >= $2::date
        AND date <= $3::date
      ${providerId ? 'AND (provider_id = $4 OR provider_id IS NULL)' : ''}
      ${accountId ? `AND (account_id = $${providerId ? 5 : 4} OR account_id IS NULL)` : ''}
      GROUP BY metric_type, metric_name, unit
      HAVING SUM(metric_value) > 0
      ORDER BY metric_type, metric_name
    `
    
    const metricsParams = [userId, startDate, endDate]
    if (providerId) metricsParams.push(providerId)
    if (accountId) metricsParams.push(accountId)
    
    const metricsResult = await client.query(metricsQuery, metricsParams)
    
    // Calculate unit economics
    const unitEconomics = metricsResult.rows.map(row => {
      const totalMetricValue = parseFloat(row.total_metric_value) || 0
      const unitCost = totalMetricValue > 0 ? totalCost / totalMetricValue : null
      
      return {
        metricType: row.metric_type,
        metricName: row.metric_name,
        unit: row.unit,
        totalMetricValue: totalMetricValue,
        totalCost: totalCost,
        unitCost: unitCost,
        daysWithData: parseInt(row.days_with_data) || 0
      }
    })
    
    return {
      totalCost,
      unitEconomics,
      period: { startDate, endDate }
    }
  } catch (error) {
    console.error('[getUnitEconomics] Error:', error)
    return {
      totalCost: 0,
      unitEconomics: [],
      period: { startDate, endDate }
    }
  } finally {
    client.release()
  }
}

/**
 * Get cost explanation for a month
 */
export const getCostExplanation = async (userId, providerId, month, year, accountId = null) => {
  const client = await pool.connect()
  try {
    const result = await client.query(
      `SELECT explanation_text, cost_change, contributing_factors
       FROM cost_explanations
       WHERE user_id = $1 AND provider_id = $2 AND explanation_month = $3 AND explanation_year = $4
         ${accountId ? 'AND account_id = $5' : 'AND account_id IS NULL'}`,
      accountId ? [userId, providerId, month, year, accountId] : [userId, providerId, month, year]
    )
    
    if (result.rows.length > 0) {
      const row = result.rows[0]
      return {
        explanation: row.explanation_text,
        costChange: parseFloat(row.cost_change) || 0,
        contributingFactors: row.contributing_factors || []
      }
    }
    
    return null
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

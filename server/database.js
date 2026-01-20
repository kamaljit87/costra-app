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

      // Custom date range explanations table - for caching AI-enhanced explanations
      await client.query(`
        CREATE TABLE IF NOT EXISTS cost_explanations_range (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL,
          account_id INTEGER,
          provider_id TEXT NOT NULL,
          start_date DATE NOT NULL,
          end_date DATE NOT NULL,
          explanation_text TEXT NOT NULL,
          cost_change DECIMAL(15, 2) NOT NULL,
          contributing_factors JSONB,
          ai_enhanced BOOLEAN DEFAULT false,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (account_id) REFERENCES cloud_provider_credentials(id) ON DELETE CASCADE,
          UNIQUE(user_id, provider_id, start_date, end_date, account_id)
        )
      `)
      await client.query(`CREATE INDEX IF NOT EXISTS idx_cost_explanations_range_user ON cost_explanations_range(user_id, provider_id, start_date, end_date)`)

      // Budgets table - for cost budgets and alerts
      await client.query(`
        CREATE TABLE IF NOT EXISTS budgets (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL,
          account_id INTEGER,
          provider_id TEXT,
          budget_name TEXT NOT NULL,
          budget_amount DECIMAL(15, 2) NOT NULL,
          budget_period TEXT NOT NULL CHECK (budget_period IN ('monthly', 'quarterly', 'yearly')),
          alert_threshold INTEGER DEFAULT 80 CHECK (alert_threshold >= 0 AND alert_threshold <= 100),
          current_spend DECIMAL(15, 2) DEFAULT 0,
          status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'exceeded')),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (account_id) REFERENCES cloud_provider_credentials(id) ON DELETE CASCADE
        )
      `)
      await client.query(`CREATE INDEX IF NOT EXISTS idx_budgets_user ON budgets(user_id)`)
      await client.query(`CREATE INDEX IF NOT EXISTS idx_budgets_provider ON budgets(user_id, provider_id)`)
      await client.query(`CREATE INDEX IF NOT EXISTS idx_budgets_account ON budgets(user_id, account_id)`)

      // Budget alerts table - for tracking budget alert history
      await client.query(`
        CREATE TABLE IF NOT EXISTS budget_alerts (
          id SERIAL PRIMARY KEY,
          budget_id INTEGER NOT NULL,
          alert_type TEXT NOT NULL CHECK (alert_type IN ('threshold', 'exceeded')),
          alert_percentage INTEGER NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (budget_id) REFERENCES budgets(id) ON DELETE CASCADE
        )
      `)
      await client.query(`CREATE INDEX IF NOT EXISTS idx_budget_alerts_budget ON budget_alerts(budget_id)`)
      await client.query(`CREATE INDEX IF NOT EXISTS idx_budget_alerts_created ON budget_alerts(created_at DESC)`)

      // Reports table - for storing generated showback/chargeback reports
      await client.query(`
        CREATE TABLE IF NOT EXISTS reports (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL,
          report_type TEXT NOT NULL CHECK (report_type IN ('showback', 'chargeback')),
          report_name TEXT NOT NULL,
          start_date DATE NOT NULL,
          end_date DATE NOT NULL,
          provider_id TEXT,
          account_id INTEGER,
          team_name TEXT,
          product_name TEXT,
          report_data JSONB NOT NULL,
          file_path TEXT,
          file_format TEXT CHECK (file_format IN ('pdf', 'csv')),
          status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'completed', 'failed')),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          completed_at TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (account_id) REFERENCES cloud_provider_credentials(id) ON DELETE CASCADE
        )
      `)
      await client.query(`CREATE INDEX IF NOT EXISTS idx_reports_user ON reports(user_id)`)
      await client.query(`CREATE INDEX IF NOT EXISTS idx_reports_type ON reports(user_id, report_type)`)
      await client.query(`CREATE INDEX IF NOT EXISTS idx_reports_created ON reports(user_id, created_at DESC)`)

      // Notifications table - for user notifications (budgets, anomalies, sync, etc.)
      await client.query(`
        CREATE TABLE IF NOT EXISTS notifications (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL,
          type TEXT NOT NULL CHECK (type IN ('budget', 'anomaly', 'sync', 'report', 'warning', 'info', 'success')),
          title TEXT NOT NULL,
          message TEXT,
          link TEXT,
          link_text TEXT,
          is_read BOOLEAN DEFAULT false,
          metadata JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          read_at TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `)
      await client.query(`CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read, created_at DESC)`)
      await client.query(`CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(user_id, type, created_at DESC)`)

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

      // Add connection metadata columns for automated CloudFormation connections
      await client.query(`
        DO $$ 
        BEGIN
          -- Add external_id for secure cross-account access
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'cloud_provider_credentials' AND column_name = 'external_id'
          ) THEN
            ALTER TABLE cloud_provider_credentials ADD COLUMN external_id TEXT;
          END IF;
          
          -- Add role_arn for IAM role-based connections
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'cloud_provider_credentials' AND column_name = 'role_arn'
          ) THEN
            ALTER TABLE cloud_provider_credentials ADD COLUMN role_arn TEXT;
          END IF;
          
          -- Add connection_type (automated/manual, billing/resource)
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'cloud_provider_credentials' AND column_name = 'connection_type'
          ) THEN
            ALTER TABLE cloud_provider_credentials ADD COLUMN connection_type TEXT DEFAULT 'manual';
          END IF;
          
          -- Add connection_status (pending/healthy/error)
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'cloud_provider_credentials' AND column_name = 'connection_status'
          ) THEN
            ALTER TABLE cloud_provider_credentials ADD COLUMN connection_status TEXT DEFAULT 'pending';
          END IF;
          
          -- Add aws_account_id for AWS connections
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'cloud_provider_credentials' AND column_name = 'aws_account_id'
          ) THEN
            ALTER TABLE cloud_provider_credentials ADD COLUMN aws_account_id TEXT;
          END IF;
          
          -- Add last_health_check for connection health monitoring
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'cloud_provider_credentials' AND column_name = 'last_health_check'
          ) THEN
            ALTER TABLE cloud_provider_credentials ADD COLUMN last_health_check TIMESTAMP;
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
export const addCloudProvider = async (
  userId,
  providerId,
  providerName,
  credentials,
  accountAlias = null,
  connectionMetadata = {}
) => {
  const client = await pool.connect()
  try {
    const { encrypt } = await import('./services/encryption.js')
    const credentialsJson = JSON.stringify(credentials)
    const encryptedCredentials = encrypt(credentialsJson)

    // Generate default alias if not provided
    const alias = accountAlias || `${providerName} Account`

    const {
      externalId = null,
      roleArn = null,
      connectionType = 'manual',
      connectionStatus = 'pending',
      awsAccountId = null,
    } = connectionMetadata

    const result = await client.query(
      `INSERT INTO cloud_provider_credentials 
       (user_id, provider_id, provider_name, account_alias, credentials_encrypted, is_active, 
        external_id, role_arn, connection_type, connection_status, aws_account_id, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)
       RETURNING id`,
      [
        userId,
        providerId,
        providerName,
        alias,
        encryptedCredentials,
        true,
        externalId,
        roleArn,
        connectionType,
        connectionStatus,
        awsAccountId,
      ]
    )
    return result.rows[0].id
  } finally {
    client.release()
  }
}

// Add automated AWS connection (pending state, before CloudFormation stack is created)
export const addAutomatedAWSConnection = async (
  userId,
  connectionName,
  awsAccountId,
  externalId,
  connectionType = 'billing'
) => {
  const client = await pool.connect()
  try {
    // Calculate role ARN (will be created by CloudFormation)
    const roleName = `CostraAccessRole-${connectionName}`
    const roleArn = `arn:aws:iam::${awsAccountId}:role/${roleName}`

    const result = await client.query(
      `INSERT INTO cloud_provider_credentials 
       (user_id, provider_id, provider_name, account_alias, credentials_encrypted, is_active,
        external_id, role_arn, connection_type, connection_status, aws_account_id, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)
       RETURNING id`,
      [
        userId,
        'aws',
        'AWS',
        connectionName,
        '{}', // Empty credentials for now, will be populated after verification
        true,
        externalId,
        roleArn,
        `automated-${connectionType}`,
        'pending',
        awsAccountId,
      ]
    )
    return {
      id: result.rows[0].id,
      roleArn,
      externalId,
    }
  } finally {
    client.release()
  }
}

// Update connection status and credentials after verification
export const updateAWSConnectionStatus = async (
  userId,
  accountId,
  status,
  credentials = null
) => {
  const client = await pool.connect()
  try {
    const updates = ['connection_status = $1', 'last_health_check = CURRENT_TIMESTAMP']
    const values = [status, accountId, userId]
    let paramIndex = 3

    if (credentials) {
      const { encrypt } = await import('./services/encryption.js')
      const credentialsJson = JSON.stringify(credentials)
      const encryptedCredentials = encrypt(credentialsJson)
      updates.push(`credentials_encrypted = $${paramIndex}`)
      values.push(encryptedCredentials)
      paramIndex++
    }

    updates.push('updated_at = CURRENT_TIMESTAMP')

    const result = await client.query(
      `UPDATE cloud_provider_credentials 
       SET ${updates.join(', ')}
       WHERE id = $2 AND user_id = $${paramIndex}
       RETURNING id, connection_status, last_health_check`,
      values
    )

    return result.rows[0] || null
  } finally {
    client.release()
  }
}

export const getUserCloudProviders = async (userId) => {
  const client = await pool.connect()
  try {
    const result = await client.query(
      `SELECT id, provider_id, provider_name, account_alias, is_active, last_sync_at, 
              connection_type, connection_status, aws_account_id, last_health_check,
              created_at, updated_at
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
      `SELECT id, provider_id, provider_name, account_alias, credentials_encrypted,
              external_id, role_arn, connection_type, connection_status, aws_account_id, last_health_check
       FROM cloud_provider_credentials
       WHERE user_id = $1 AND id = $2`,
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
      externalId: result.rows[0].external_id,
      roleArn: result.rows[0].role_arn,
      connectionType: result.rows[0].connection_type,
      connectionStatus: result.rows[0].connection_status,
      awsAccountId: result.rows[0].aws_account_id,
      lastHealthCheck: result.rows[0].last_health_check,
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

// Update account credentials
export const updateCloudProviderCredentials = async (userId, accountId, credentials) => {
  const client = await pool.connect()
  try {
    const { encrypt } = await import('./services/encryption.js')
    const credentialsJson = JSON.stringify(credentials)
    const encryptedCredentials = encrypt(credentialsJson)

    await client.query(
      `UPDATE cloud_provider_credentials
       SET credentials_encrypted = $1, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $2 AND id = $3`,
      [encryptedCredentials, userId, accountId]
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

// Clear cost explanations cache for a user (monthly and date range)
export const clearCostExplanationsCache = async (userId, providerId = null, accountId = null) => {
  const client = await pool.connect()
  try {
    let query = 'DELETE FROM cost_explanations WHERE user_id = $1'
    let params = [userId]
    let paramIndex = 2
    
    if (providerId) {
      query += ` AND provider_id = $${paramIndex}`
      params.push(providerId)
      paramIndex++
    }
    
    if (accountId) {
      query += ` AND account_id = $${paramIndex}`
      params.push(accountId)
      paramIndex++
    }
    
    const result1 = await client.query(query, params)
    
    // Also clear date range explanations
    let rangeQuery = 'DELETE FROM cost_explanations_range WHERE user_id = $1'
    let rangeParams = [userId]
    let rangeParamIndex = 2
    
    if (providerId) {
      rangeQuery += ` AND provider_id = $${rangeParamIndex}`
      rangeParams.push(providerId)
      rangeParamIndex++
    }
    
    if (accountId) {
      rangeQuery += ` AND account_id = $${rangeParamIndex}`
      rangeParams.push(accountId)
      rangeParamIndex++
    }
    
    const result2 = await client.query(rangeQuery, rangeParams)
    
    const totalCleared = result1.rowCount + result2.rowCount
    console.log(`[clearCostExplanationsCache] Cleared ${totalCleared} explanation cache entries for user ${userId}${providerId ? `, provider ${providerId}` : ''}${accountId ? `, account ${accountId}` : ''}`)
    return totalCleared
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
export const getAvailableDimensions = async (userId, providerId = null, accountId = null) => {
  const client = await pool.connect()
  try {
    let query = `
      SELECT DISTINCT rt.tag_key, rt.tag_value, COUNT(DISTINCT r.id) as resource_count
      FROM resource_tags rt
      JOIN resources r ON rt.resource_id = r.id
      WHERE r.user_id = $1
    `
    
    const params = [userId]
    let paramIndex = 2
    
    if (providerId) {
      query += ` AND r.provider_id = $${paramIndex}`
      params.push(providerId)
      paramIndex++
    }
    
    if (accountId) {
      query += ` AND r.account_id = $${paramIndex}`
      params.push(accountId)
      paramIndex++
    }
    
    query += `
      GROUP BY rt.tag_key, rt.tag_value
      ORDER BY rt.tag_key, rt.tag_value
    `
    
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
      ${accountId ? 'AND r.account_id = $4' : ''}
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
          ${accountId ? 'AND r.account_id = $5' : ''}
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
export const getUntaggedResources = async (userId, providerId = null, limit = 50, accountId = null) => {
  const client = await pool.connect()
  try {
    let query = `
      SELECT r.*, COALESCE(COUNT(rt.id), 0) as tag_count
      FROM resources r
      LEFT JOIN resource_tags rt ON r.id = rt.resource_id
      WHERE r.user_id = $1
    `
    
    const params = [userId]
    let paramIndex = 2
    
    if (providerId) {
      query += ` AND r.provider_id = $${paramIndex}`
      params.push(providerId)
      paramIndex++
    }
    
    if (accountId) {
      query += ` AND r.account_id = $${paramIndex}`
      params.push(accountId)
      paramIndex++
    }
    
    query += `
      GROUP BY r.id
      HAVING COALESCE(COUNT(rt.id), 0) = 0
      ORDER BY r.cost DESC, r.last_seen_date DESC
      LIMIT $${paramIndex}
    `
    params.push(limit)
    
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
        ${accountId ? 'AND account_id = $5' : ''}
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
    const startYear = startDateObj.getFullYear()
    const startMonth = startDateObj.getMonth() + 1
    const endYear = endDateObj.getFullYear()
    const endMonth = endDateObj.getMonth() + 1
    
    let fallbackQuery = `
      SELECT DISTINCT sc.service_name, SUM(sc.cost) as total_cost
      FROM service_costs sc
      JOIN cost_data cd ON sc.cost_data_id = cd.id
      WHERE cd.user_id = $1 AND cd.provider_id = $2
        ${accountId ? 'AND cd.account_id = $5' : ''}
        AND (
          (cd.year > $3) OR 
          (cd.year = $3 AND cd.month >= $4)
        )
        AND (
          (cd.year < $6) OR 
          (cd.year = $6 AND cd.month <= $7)
        )
      GROUP BY sc.service_name
      ORDER BY total_cost DESC
      LIMIT 50
    `
    
    const fallbackParams = accountId 
      ? [userId, providerId, startYear, startMonth, accountId, endYear, endMonth]
      : [userId, providerId, startYear, startMonth, endYear, endMonth]
    
    const fallbackResult = await client.query(fallbackQuery, fallbackParams)
    
    return fallbackResult.rows.map(row => ({
      serviceName: row.service_name,
      cost: parseFloat(row.total_cost) || 0,
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

/**
 * Generate cost explanation for a custom date range
 * Compares costs at start period vs end period and generates a narrative
 */
export const generateCustomDateRangeExplanation = async (userId, providerId, startDate, endDate, accountId = null) => {
  const client = await pool.connect()
  try {
    // Parse dates
    const start = new Date(startDate)
    const end = new Date(endDate)
    
    // Calculate period length to determine comparison windows
    const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24))
    
    // For comparison, use first 25% of period as "start" and last 25% as "end"
    // Or minimum 3 days each, maximum 14 days each
    const comparisonWindowDays = Math.max(3, Math.min(14, Math.floor(daysDiff * 0.25)))
    
    const startWindowEnd = new Date(start)
    startWindowEnd.setDate(startWindowEnd.getDate() + comparisonWindowDays)
    
    const endWindowStart = new Date(end)
    endWindowStart.setDate(endWindowStart.getDate() - comparisonWindowDays)
    
    // Ensure windows don't overlap
    if (startWindowEnd >= endWindowStart) {
      // If range is too short, compare first half vs second half
      const midPoint = new Date(start.getTime() + (end - start) / 2)
      startWindowEnd.setTime(midPoint.getTime())
      endWindowStart.setTime(midPoint.getTime() + 1)
    }
    
    // Get daily cost data for start period
    const startCostResult = await client.query(
      `SELECT 
         COALESCE(SUM(cost), 0) as total_cost,
         COUNT(DISTINCT date) as days_count
       FROM daily_cost_data
       WHERE user_id = $1 AND provider_id = $2 
         AND date >= $3::date AND date <= $4::date
         ${accountId ? 'AND account_id = $5' : ''}`,
      accountId 
        ? [userId, providerId, start.toISOString().split('T')[0], startWindowEnd.toISOString().split('T')[0], accountId]
        : [userId, providerId, start.toISOString().split('T')[0], startWindowEnd.toISOString().split('T')[0]]
    )
    
    // Get daily cost data for end period
    const endCostResult = await client.query(
      `SELECT 
         COALESCE(SUM(cost), 0) as total_cost,
         COUNT(DISTINCT date) as days_count
       FROM daily_cost_data
       WHERE user_id = $1 AND provider_id = $2 
         AND date >= $3::date AND date <= $4::date
         ${accountId ? 'AND account_id = $5' : ''}`,
      accountId 
        ? [userId, providerId, endWindowStart.toISOString().split('T')[0], end.toISOString().split('T')[0], accountId]
        : [userId, providerId, endWindowStart.toISOString().split('T')[0], end.toISOString().split('T')[0]]
    )
    
    // Get total cost for entire range
    const totalRangeResult = await client.query(
      `SELECT 
         COALESCE(SUM(cost), 0) as total_cost,
         COUNT(DISTINCT date) as days_count
       FROM daily_cost_data
       WHERE user_id = $1 AND provider_id = $2 
         AND date >= $3::date AND date <= $4::date
         ${accountId ? 'AND account_id = $5' : ''}`,
      accountId 
        ? [userId, providerId, start.toISOString().split('T')[0], end.toISOString().split('T')[0], accountId]
        : [userId, providerId, start.toISOString().split('T')[0], end.toISOString().split('T')[0]]
    )
    
    const startCost = parseFloat(startCostResult.rows[0]?.total_cost) || 0
    const startDays = parseInt(startCostResult.rows[0]?.days_count) || 0
    const startAvgDaily = startDays > 0 ? startCost / startDays : 0
    
    const endCost = parseFloat(endCostResult.rows[0]?.total_cost) || 0
    const endDays = parseInt(endCostResult.rows[0]?.days_count) || 0
    const endAvgDaily = endDays > 0 ? endCost / endDays : 0
    
    const totalRangeCost = parseFloat(totalRangeResult.rows[0]?.total_cost) || 0
    const totalRangeDays = parseInt(totalRangeResult.rows[0]?.days_count) || 0
    
    // If no data found, return a helpful message instead of null
    if (totalRangeDays === 0) {
      const formatDate = (date) => {
        return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      }
      return {
        explanation: `No cost data is available for the period from ${formatDate(start)} to ${formatDate(end)}. This could mean that no costs were incurred during this time, or the data hasn't been synced yet. Try syncing your cloud provider data to get the latest cost information.`,
        costChange: 0,
        contributingFactors: [],
        startDate: startDate,
        endDate: endDate,
        startCost: 0,
        endCost: 0,
        aiEnhanced: false
      }
    }
    
    // Calculate actual cost change (difference between start and end period totals)
    const actualCostChange = endCost - startCost
    const actualCostChangePercent = startCost > 0 ? (actualCostChange / startCost) * 100 : (endCost > 0 ? 100 : 0)
    
    // Also calculate change in average daily spending for context
    const avgDailyChange = endAvgDaily - startAvgDaily
    const avgDailyChangePercent = startAvgDaily > 0 ? (avgDailyChange / startAvgDaily) * 100 : (endAvgDaily > 0 ? 100 : 0)
    
    // Use actual cost change, not projected
    const totalChange = actualCostChange
    const changePercent = actualCostChangePercent
    
    // Get service-level breakdown for start period using service_usage_metrics or service_costs
    // First try service_usage_metrics (has date and service_name)
    let startServicesResult
    const startServiceParams = accountId 
      ? [userId, providerId, start.toISOString().split('T')[0], startWindowEnd.toISOString().split('T')[0], accountId]
      : [userId, providerId, start.toISOString().split('T')[0], startWindowEnd.toISOString().split('T')[0]]
    
    startServicesResult = await client.query(
      `SELECT 
         service_name,
         COALESCE(SUM(cost), 0) as total_cost,
         COUNT(DISTINCT date) as days_count
       FROM service_usage_metrics
       WHERE user_id = $1 AND provider_id = $2 
         AND date >= $3::date AND date <= $4::date
         ${accountId ? 'AND account_id = $5' : ''}
       GROUP BY service_name
       ORDER BY total_cost DESC
       LIMIT 20`,
      startServiceParams
    )
    
    // If no service_usage_metrics, fall back to using cost_data/service_costs for months in range
    if (startServicesResult.rows.length === 0) {
      // Get months that fall within the start period
      const startMonth = start.getMonth() + 1
      const startYear = start.getFullYear()
      const startWindowEndMonth = startWindowEnd.getMonth() + 1
      const startWindowEndYear = startWindowEnd.getFullYear()
      
      if (accountId) {
        startServicesResult = await client.query(
          `SELECT 
             sc.service_name,
             COALESCE(SUM(sc.cost), 0) as total_cost,
             COUNT(DISTINCT cd.id) as days_count
           FROM service_costs sc
           JOIN cost_data cd ON sc.cost_data_id = cd.id
           WHERE cd.user_id = $1 AND cd.provider_id = $2 AND cd.account_id = $3
             AND (
               (cd.year = $4 AND cd.month >= $5) OR
               (cd.year > $4 AND cd.year < $6) OR
               (cd.year = $6 AND cd.month <= $7)
             )
           GROUP BY sc.service_name
           ORDER BY total_cost DESC
           LIMIT 20`,
          [userId, providerId, accountId, startYear, startMonth, startWindowEndYear, startWindowEndMonth]
        )
      } else {
        startServicesResult = await client.query(
          `SELECT 
             sc.service_name,
             COALESCE(SUM(sc.cost), 0) as total_cost,
             COUNT(DISTINCT cd.id) as days_count
           FROM service_costs sc
           JOIN cost_data cd ON sc.cost_data_id = cd.id
           WHERE cd.user_id = $1 AND cd.provider_id = $2
             AND (
               (cd.year = $3 AND cd.month >= $4) OR
               (cd.year > $3 AND cd.year < $5) OR
               (cd.year = $5 AND cd.month <= $6)
             )
           GROUP BY sc.service_name
           ORDER BY total_cost DESC
           LIMIT 20`,
          [userId, providerId, startYear, startMonth, startWindowEndYear, startWindowEndMonth]
        )
      }
    }
    
    // Get service-level breakdown for end period
    let endServicesResult
    const endServiceParams = accountId 
      ? [userId, providerId, endWindowStart.toISOString().split('T')[0], end.toISOString().split('T')[0], accountId]
      : [userId, providerId, endWindowStart.toISOString().split('T')[0], end.toISOString().split('T')[0]]
    
    endServicesResult = await client.query(
      `SELECT 
         service_name,
         COALESCE(SUM(cost), 0) as total_cost,
         COUNT(DISTINCT date) as days_count
       FROM service_usage_metrics
       WHERE user_id = $1 AND provider_id = $2 
         AND date >= $3::date AND date <= $4::date
         ${accountId ? 'AND account_id = $5' : ''}
       GROUP BY service_name
       ORDER BY total_cost DESC
       LIMIT 20`,
      endServiceParams
    )
    
    // If no service_usage_metrics, fall back to using cost_data/service_costs for months in range
    if (endServicesResult.rows.length === 0) {
      // Get months that fall within the end period
      const endWindowStartMonth = endWindowStart.getMonth() + 1
      const endWindowStartYear = endWindowStart.getFullYear()
      const endMonth = end.getMonth() + 1
      const endYear = end.getFullYear()
      
      if (accountId) {
        endServicesResult = await client.query(
          `SELECT 
             sc.service_name,
             COALESCE(SUM(sc.cost), 0) as total_cost,
             COUNT(DISTINCT cd.id) as days_count
           FROM service_costs sc
           JOIN cost_data cd ON sc.cost_data_id = cd.id
           WHERE cd.user_id = $1 AND cd.provider_id = $2 AND cd.account_id = $3
             AND (
               (cd.year = $4 AND cd.month >= $5) OR
               (cd.year > $4 AND cd.year < $6) OR
               (cd.year = $6 AND cd.month <= $7)
             )
           GROUP BY sc.service_name
           ORDER BY total_cost DESC
           LIMIT 20`,
          [userId, providerId, accountId, endWindowStartYear, endWindowStartMonth, endYear, endMonth]
        )
      } else {
        endServicesResult = await client.query(
          `SELECT 
             sc.service_name,
             COALESCE(SUM(sc.cost), 0) as total_cost,
             COUNT(DISTINCT cd.id) as days_count
           FROM service_costs sc
           JOIN cost_data cd ON sc.cost_data_id = cd.id
           WHERE cd.user_id = $1 AND cd.provider_id = $2
             AND (
               (cd.year = $3 AND cd.month >= $4) OR
               (cd.year > $3 AND cd.year < $5) OR
               (cd.year = $5 AND cd.month <= $6)
             )
           GROUP BY sc.service_name
           ORDER BY total_cost DESC
           LIMIT 20`,
          [userId, providerId, endWindowStartYear, endWindowStartMonth, endYear, endMonth]
        )
      }
    }
    
    // Build service comparison map (using actual period costs, not projected)
    const startServicesMap = new Map()
    startServicesResult.rows.forEach(row => {
      const cost = parseFloat(row.total_cost) || 0
      startServicesMap.set(row.service_name, cost)
    })
    
    const endServicesMap = new Map()
    endServicesResult.rows.forEach(row => {
      const cost = parseFloat(row.total_cost) || 0
      endServicesMap.set(row.service_name, cost)
    })
    
    // Find services with biggest changes (using actual costs, not projected)
    const serviceChanges = []
    const allServices = new Set([...startServicesMap.keys(), ...endServicesMap.keys()])
    
    allServices.forEach(serviceName => {
      const startCost = startServicesMap.get(serviceName) || 0
      const endCost = endServicesMap.get(serviceName) || 0
      const change = endCost - startCost
      const changePercent = startCost > 0 ? (change / startCost) * 100 : (endCost > 0 ? 100 : 0)
      
      // Use actual costs for the comparison periods, not projected
      if (Math.abs(change) > 0.01 || Math.abs(startCost) > 0.01 || Math.abs(endCost) > 0.01) {
        serviceChanges.push({
          service: serviceName,
          startCost: startCost,
          endCost: endCost,
          change: change,
          changePercent
        })
      }
    })
    
    // Sort by absolute change
    serviceChanges.sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
    
    // Build explanation narrative
    const formatDate = (date) => {
      return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    }
    
    let explanation = `Over the period from ${formatDate(start)} to ${formatDate(end)} (${totalRangeDays} days), `
    explanation += `your ${providerId.toUpperCase()} cloud spending `
    
    // Calculate actual period costs for comparison
    const startPeriodCost = startCost
    const endPeriodCost = endCost
    
    if (totalChange > 0) {
      explanation += `increased by $${Math.abs(totalChange).toFixed(2)} `
      explanation += `(${Math.abs(changePercent).toFixed(1)}% increase). `
    } else if (totalChange < 0) {
      explanation += `decreased by $${Math.abs(totalChange).toFixed(2)} `
      explanation += `(${Math.abs(changePercent).toFixed(1)}% decrease). `
    } else {
      explanation += `remained relatively stable. `
    }
    
    explanation += `Total spending during this entire period was $${totalRangeCost.toFixed(2)}. `
    explanation += `In the beginning ${comparisonWindowDays}-day window, you spent $${startPeriodCost.toFixed(2)} (averaging $${startAvgDaily.toFixed(2)} per day), `
    explanation += `while in the ending ${comparisonWindowDays}-day window, you spent $${endPeriodCost.toFixed(2)} (averaging $${endAvgDaily.toFixed(2)} per day). `
    
    // Add detailed service-level insights with actual costs
    if (serviceChanges.length > 0) {
      const topIncrease = serviceChanges.filter(s => s.change > 0).slice(0, 5)
      const topDecrease = serviceChanges.filter(s => s.change < 0).slice(0, 5)
      
      if (topIncrease.length > 0) {
        explanation += `The services with the largest cost increases in the comparison periods were: `
        const top3 = topIncrease.slice(0, 3)
        explanation += top3.map(s => 
          `${s.service} ($${s.startCost.toFixed(2)} → $${s.endCost.toFixed(2)}, ${s.changePercent > 0 ? '+' : ''}${s.changePercent.toFixed(1)}%)`
        ).join('; ')
        if (topIncrease.length > 3) {
          explanation += `; and ${topIncrease.length - 3} other service${topIncrease.length - 3 > 1 ? 's' : ''} also increased. `
        } else {
          explanation += `. `
        }
      }
      
      if (topDecrease.length > 0) {
        explanation += `The services with the largest cost decreases in the comparison periods were: `
        const top3 = topDecrease.slice(0, 3)
        explanation += top3.map(s => 
          `${s.service} ($${s.startCost.toFixed(2)} → $${s.endCost.toFixed(2)}, ${s.changePercent.toFixed(1)}%)`
        ).join('; ')
        if (topDecrease.length > 3) {
          explanation += `; and ${topDecrease.length - 3} other service${topDecrease.length - 3 > 1 ? 's' : ''} also decreased. `
        } else {
          explanation += `. `
        }
      }
    }
    
    // Add notable shifts with specific numbers
    if (serviceChanges.length > 0) {
      const significantChanges = serviceChanges.filter(s => Math.abs(s.changePercent) > 20 || Math.abs(s.change) > 10)
      if (significantChanges.length > 0) {
        const topChange = significantChanges[0]
        explanation += `The most significant change was ${topChange.service}, which `
        explanation += `${topChange.changePercent > 0 ? 'increased' : 'decreased'} `
        explanation += `from $${topChange.startCost.toFixed(2)} to $${topChange.endCost.toFixed(2)} `
        explanation += `(${topChange.changePercent > 0 ? '+' : ''}${topChange.changePercent.toFixed(1)}%, $${Math.abs(topChange.change).toFixed(2)} change). `
      }
    }
    
    // Build contributing factors (use actual end period costs, not projected)
    const contributingFactors = serviceChanges.slice(0, 5).map(s => ({
      service: s.service,
      changePercent: s.changePercent,
      cost: s.endCost, // Actual cost in end period, not projected
      change: s.change // Include actual dollar change
    }))
    
    // Check if we have a cached explanation
    const cachedResult = await client.query(
      `SELECT explanation_text, cost_change, contributing_factors, ai_enhanced
       FROM cost_explanations_range
       WHERE user_id = $1 AND provider_id = $2 AND start_date = $3::date AND end_date = $4::date
         ${accountId ? 'AND account_id = $5' : 'AND account_id IS NULL'}
       ORDER BY updated_at DESC
       LIMIT 1`,
      accountId 
        ? [userId, providerId, startDate, endDate, accountId]
        : [userId, providerId, startDate, endDate]
    )
    
    if (cachedResult.rows.length > 0) {
      const cached = cachedResult.rows[0]
      return {
        explanation: cached.explanation_text,
        costChange: parseFloat(cached.cost_change) || 0,
        contributingFactors: cached.contributing_factors || [],
        startDate: startDate,
        endDate: endDate,
        startCost: startAvgDaily * totalRangeDays,
        endCost: endAvgDaily * totalRangeDays,
        aiEnhanced: cached.ai_enhanced || false
      }
    }
    
    // Enhance explanation with AI if available
    let enhancedExplanation = explanation
    let aiEnhanced = false
    try {
      // Try to use Anthropic AI if available
      if (process.env.ANTHROPIC_API_KEY) {
        const Anthropic = (await import('@anthropic-ai/sdk')).default
        const anthropicClient = new Anthropic({
          apiKey: process.env.ANTHROPIC_API_KEY,
        })
        
        const aiPrompt = `You are a cloud cost analyst. Take this cost explanation and make it more detailed, specific, and actionable. 

IMPORTANT REQUIREMENTS:
1. Keep ALL numbers and facts 100% accurate - do not change any dollar amounts, percentages, or dates
2. Provide SPECIFIC details about what changed - mention exact service names, dollar amounts, and percentages
3. Explain the IMPACT of the changes - what does this mean for the business?
4. Suggest ACTIONABLE insights - what should the user do about these changes?
5. Be CONVERSATIONAL but PROFESSIONAL - write like you're explaining to a colleague
6. Include CONTEXT - explain why these changes matter
7. Use SPECIFIC EXAMPLES from the service changes data below

Original explanation:
${explanation}

Detailed service changes data (use these specific numbers):
${JSON.stringify(serviceChanges.slice(0, 10), null, 2)}

Period details:
- Start period cost: $${startPeriodCost.toFixed(2)} (${comparisonWindowDays} days, avg $${startAvgDaily.toFixed(2)}/day)
- End period cost: $${endPeriodCost.toFixed(2)} (${comparisonWindowDays} days, avg $${endAvgDaily.toFixed(2)}/day)
- Total period cost: $${totalRangeCost.toFixed(2)} over ${totalRangeDays} days
- Actual cost change: $${totalChange.toFixed(2)} (${changePercent.toFixed(1)}%)

Return only the enhanced explanation text with all the specific details, numbers, and actionable insights. Make it comprehensive and detailed.`
        
        const aiResponse = await anthropicClient.messages.create({
          model: 'claude-3-haiku-20240307',
          max_tokens: 1024,
          messages: [{
            role: 'user',
            content: aiPrompt
          }]
        })
        
        const aiText = aiResponse.content[0]?.text
        if (aiText && aiText.trim().length > 0) {
          enhancedExplanation = aiText.trim()
          aiEnhanced = true
        }
      }
    } catch (aiError) {
      console.error('[generateCustomDateRangeExplanation] AI enhancement failed, using base explanation:', aiError)
      // Continue with base explanation if AI fails
    }
    
    // Save to cache
    await client.query(
      `INSERT INTO cost_explanations_range (
        user_id, account_id, provider_id, start_date, end_date,
        explanation_text, cost_change, contributing_factors, ai_enhanced, updated_at
      ) VALUES ($1, $2, $3, $4::date, $5::date, $6, $7, $8, $9, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id, provider_id, start_date, end_date, account_id)
      DO UPDATE SET
        explanation_text = EXCLUDED.explanation_text,
        cost_change = EXCLUDED.cost_change,
        contributing_factors = EXCLUDED.contributing_factors,
        ai_enhanced = EXCLUDED.ai_enhanced,
        updated_at = CURRENT_TIMESTAMP`,
      [
        userId, 
        accountId, 
        providerId, 
        startDate, 
        endDate, 
        enhancedExplanation, 
        totalChange, 
        JSON.stringify(contributingFactors),
        aiEnhanced
      ]
    )
    
    return {
      explanation: enhancedExplanation,
      costChange: totalChange,
      contributingFactors,
      startDate: startDate,
      endDate: endDate,
      startCost: startPeriodCost, // Actual start period cost
      endCost: endPeriodCost, // Actual end period cost
      aiEnhanced
    }
  } catch (error) {
    console.error('[generateCustomDateRangeExplanation] Error:', error)
    // If there's an error, try to return cached explanation if available
    try {
      const cachedResult = await client.query(
        `SELECT explanation_text, cost_change, contributing_factors
         FROM cost_explanations_range
         WHERE user_id = $1 AND provider_id = $2 AND start_date = $3::date AND end_date = $4::date
           ${accountId ? 'AND account_id = $5' : 'AND account_id IS NULL'}
         ORDER BY updated_at DESC
         LIMIT 1`,
        accountId 
          ? [userId, providerId, startDate, endDate, accountId]
          : [userId, providerId, startDate, endDate]
      )
      
      if (cachedResult.rows.length > 0) {
        const cached = cachedResult.rows[0]
        return {
          explanation: cached.explanation_text,
          costChange: parseFloat(cached.cost_change) || 0,
          contributingFactors: cached.contributing_factors || [],
          startDate: startDate,
          endDate: endDate
        }
      }
    } catch (cacheError) {
      console.error('[generateCustomDateRangeExplanation] Cache retrieval also failed:', cacheError)
    }
    
    throw error
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
      ${accountId ? `AND account_id = $${providerId ? 5 : 4}` : ''}
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

// ============================================================================
// Budget Operations
// ============================================================================

/**
 * Create a new budget
 */
export const createBudget = async (userId, budgetData) => {
  const client = await pool.connect()
  try {
    const { budgetName, providerId, accountId, budgetAmount, budgetPeriod, alertThreshold } = budgetData
    
    const result = await client.query(
      `INSERT INTO budgets (
        user_id, account_id, provider_id, budget_name, budget_amount,
        budget_period, alert_threshold, current_spend, status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 0, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *`,
      [userId, accountId || null, providerId || null, budgetName, budgetAmount, budgetPeriod, alertThreshold || 80]
    )
    
    return result.rows[0]
  } catch (error) {
    console.error('[createBudget] Error:', error)
    throw error
  } finally {
    client.release()
  }
}

/**
 * Get all budgets for a user
 */
export const getBudgets = async (userId, providerId = null, accountId = null) => {
  const client = await pool.connect()
  try {
    let query = `
      SELECT 
        b.*,
        CASE 
          WHEN b.budget_amount > 0 THEN (b.current_spend / b.budget_amount * 100)
          ELSE 0
        END as percentage
      FROM budgets b
      WHERE b.user_id = $1
    `
    const params = [userId]
    let paramIndex = 2
    
    if (providerId) {
      query += ` AND (b.provider_id = $${paramIndex} OR b.provider_id IS NULL)`
      params.push(providerId)
      paramIndex++
    }
    
    if (accountId) {
      query += ` AND (b.account_id = $${paramIndex} OR b.account_id IS NULL)`
      params.push(accountId)
      paramIndex++
    }
    
    query += ` ORDER BY b.created_at DESC`
    
    const result = await client.query(query, params)
    
    return result.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      accountId: row.account_id,
      providerId: row.provider_id,
      budgetName: row.budget_name,
      budgetAmount: parseFloat(row.budget_amount) || 0,
      budgetPeriod: row.budget_period,
      alertThreshold: parseInt(row.alert_threshold) || 80,
      currentSpend: parseFloat(row.current_spend) || 0,
      status: row.status,
      percentage: parseFloat(row.percentage) || 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }))
  } catch (error) {
    console.error('[getBudgets] Error:', error)
    return []
  } finally {
    client.release()
  }
}

/**
 * Get a specific budget by ID
 */
export const getBudget = async (userId, budgetId) => {
  const client = await pool.connect()
  try {
    const result = await client.query(
      `SELECT 
        b.*,
        CASE 
          WHEN b.budget_amount > 0 THEN (b.current_spend / b.budget_amount * 100)
          ELSE 0
        END as percentage
       FROM budgets b
       WHERE b.id = $1 AND b.user_id = $2`,
      [budgetId, userId]
    )
    
    if (result.rows.length === 0) {
      return null
    }
    
    const row = result.rows[0]
    return {
      id: row.id,
      userId: row.user_id,
      accountId: row.account_id,
      providerId: row.provider_id,
      budgetName: row.budget_name,
      budgetAmount: parseFloat(row.budget_amount) || 0,
      budgetPeriod: row.budget_period,
      alertThreshold: parseInt(row.alert_threshold) || 80,
      currentSpend: parseFloat(row.current_spend) || 0,
      status: row.status,
      percentage: parseFloat(row.percentage) || 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }
  } catch (error) {
    console.error('[getBudget] Error:', error)
    return null
  } finally {
    client.release()
  }
}

/**
 * Update a budget
 */
export const updateBudget = async (userId, budgetId, budgetData) => {
  const client = await pool.connect()
  try {
    const updates = []
    const params = []
    let paramIndex = 1
    
    if (budgetData.budgetName !== undefined) {
      updates.push(`budget_name = $${paramIndex}`)
      params.push(budgetData.budgetName)
      paramIndex++
    }
    if (budgetData.budgetAmount !== undefined) {
      updates.push(`budget_amount = $${paramIndex}`)
      params.push(budgetData.budgetAmount)
      paramIndex++
    }
    if (budgetData.budgetPeriod !== undefined) {
      updates.push(`budget_period = $${paramIndex}`)
      params.push(budgetData.budgetPeriod)
      paramIndex++
    }
    if (budgetData.alertThreshold !== undefined) {
      updates.push(`alert_threshold = $${paramIndex}`)
      params.push(budgetData.alertThreshold)
      paramIndex++
    }
    if (budgetData.status !== undefined) {
      updates.push(`status = $${paramIndex}`)
      params.push(budgetData.status)
      paramIndex++
    }
    
    if (updates.length === 0) {
      return await getBudget(userId, budgetId)
    }
    
    updates.push(`updated_at = CURRENT_TIMESTAMP`)
    params.push(budgetId, userId)
    
    const result = await client.query(
      `UPDATE budgets 
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
       RETURNING *`,
      params
    )
    
    if (result.rows.length === 0) {
      return null
    }
    
    const row = result.rows[0]
    return {
      id: row.id,
      userId: row.user_id,
      accountId: row.account_id,
      providerId: row.provider_id,
      budgetName: row.budget_name,
      budgetAmount: parseFloat(row.budget_amount) || 0,
      budgetPeriod: row.budget_period,
      alertThreshold: parseInt(row.alert_threshold) || 80,
      currentSpend: parseFloat(row.current_spend) || 0,
      status: row.status,
      percentage: row.budget_amount > 0 ? (row.current_spend / row.budget_amount * 100) : 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }
  } catch (error) {
    console.error('[updateBudget] Error:', error)
    throw error
  } finally {
    client.release()
  }
}

/**
 * Delete a budget
 */
export const deleteBudget = async (userId, budgetId) => {
  const client = await pool.connect()
  try {
    const result = await client.query(
      `DELETE FROM budgets 
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [budgetId, userId]
    )
    
    return result.rows.length > 0
  } catch (error) {
    console.error('[deleteBudget] Error:', error)
    throw error
  } finally {
    client.release()
  }
}

/**
 * Update budget current spend based on actual costs
 */
export const updateBudgetSpend = async (userId, budgetId) => {
  const client = await pool.connect()
  try {
    // Get budget details
    const budget = await getBudget(userId, budgetId)
    if (!budget) {
      return null
    }
    
    // Ensure budget has camelCase properties
    const budgetData = {
      id: budget.id,
      userId: budget.userId || budget.user_id,
      accountId: budget.accountId || budget.account_id,
      providerId: budget.providerId || budget.provider_id,
      budgetName: budget.budgetName || budget.budget_name,
      budgetAmount: budget.budgetAmount || parseFloat(budget.budget_amount) || 0,
      budgetPeriod: budget.budgetPeriod || budget.budget_period,
      alertThreshold: budget.alertThreshold || parseInt(budget.alert_threshold) || 80,
      currentSpend: budget.currentSpend || parseFloat(budget.current_spend) || 0,
      status: budget.status,
      percentage: budget.percentage || 0
    }
    
    // Calculate current spend based on budget period
    const now = new Date()
    let startDate, endDate
    
    if (budgetData.budgetPeriod === 'monthly') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1)
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    } else if (budgetData.budgetPeriod === 'quarterly') {
      const quarter = Math.floor(now.getMonth() / 3)
      startDate = new Date(now.getFullYear(), quarter * 3, 1)
      endDate = new Date(now.getFullYear(), (quarter + 1) * 3, 0)
    } else { // yearly
      startDate = new Date(now.getFullYear(), 0, 1)
      endDate = new Date(now.getFullYear(), 11, 31)
    }
    
    // Get actual costs for the period
    let costQuery = `
      SELECT SUM(cost) as total_cost
      FROM daily_cost_data
      WHERE user_id = $1
        AND date >= $2::date
        AND date <= $3::date
    `
    const costParams = [userId, startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]]
    
    if (budgetData.providerId) {
      costQuery += ` AND provider_id = $4`
      costParams.push(budgetData.providerId)
    }
    
    if (budgetData.accountId) {
      costQuery += ` AND account_id = $${budgetData.providerId ? 5 : 4}`
      costParams.push(budgetData.accountId)
    }
    
    const costResult = await client.query(costQuery, costParams)
    const currentSpend = parseFloat(costResult.rows[0]?.total_cost) || 0
    
    // Calculate percentage and status
    const percentage = budgetData.budgetAmount > 0 ? (currentSpend / budgetData.budgetAmount * 100) : 0
    let status = 'active'
    if (percentage >= 100) {
      status = 'exceeded'
    } else if (percentage >= budgetData.alertThreshold) {
      status = 'active' // Keep active but will show alert
    }
    
    // Update budget
    await client.query(
      `UPDATE budgets 
       SET current_spend = $1, status = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [currentSpend, status, budgetId]
    )
    
    // Check if we should create an alert
    if (percentage >= budgetData.alertThreshold) {
      const alertType = percentage >= 100 ? 'exceeded' : 'threshold'
      
      // Check if alert already exists for this budget today
      const existingAlert = await client.query(
        `SELECT id FROM budget_alerts 
         WHERE budget_id = $1 
           AND alert_type = $2 
           AND DATE(created_at) = CURRENT_DATE`,
        [budgetId, alertType]
      )
      
      if (existingAlert.rows.length === 0) {
        await client.query(
          `INSERT INTO budget_alerts (budget_id, alert_type, alert_percentage, created_at)
           VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
          [budgetId, alertType, Math.round(percentage)]
        )
        
        // Create notification
        const notificationType = percentage >= 100 ? 'warning' : 'budget'
        const title = percentage >= 100 
          ? `Budget Exceeded: ${budgetData.budgetName}`
          : `Budget Alert: ${budgetData.budgetName}`
        const message = percentage >= 100
          ? `Your budget has been exceeded by $${(currentSpend - budgetData.budgetAmount).toFixed(2)}`
          : `Your budget is at ${percentage.toFixed(1)}% of the limit`
        
        const link = budgetData.providerId 
          ? `/provider/${budgetData.providerId}`
          : '/budgets'
        
        try {
          await createNotification(userId, {
            type: notificationType,
            title,
            message,
            link,
            linkText: 'View Budget',
            metadata: {
              budgetId: budgetData.id,
              budgetName: budgetData.budgetName,
              percentage: Math.round(percentage),
              currentSpend,
              budgetAmount: budgetData.budgetAmount
            }
          })
          console.log(`[updateBudgetSpend] Created notification for budget ${budgetData.id}: ${title}`)
        } catch (notifError) {
          console.error(`[updateBudgetSpend] Failed to create notification for budget ${budgetData.id}:`, notifError)
          // Don't fail the budget update if notification fails
        }
      }
    }
    
    return {
      ...budgetData,
      currentSpend,
      percentage,
      status
    }
  } catch (error) {
    console.error('[updateBudgetSpend] Error:', error)
    throw error
  } finally {
    client.release()
  }
}

/**
 * Check all budgets for alerts
 */
export const checkBudgetAlerts = async (userId) => {
  const client = await pool.connect()
  try {
    const budgets = await getBudgets(userId)
    const alerts = []
    
    for (const budget of budgets) {
      if (budget.status === 'paused') continue
      
      // Update spend for this budget
      const updated = await updateBudgetSpend(userId, budget.id)
      if (!updated) continue
      
      // Check if alert should be triggered
      if (updated.percentage >= updated.alertThreshold) {
        alerts.push({
          budgetId: updated.id,
          budgetName: updated.budgetName,
          providerId: updated.providerId,
          accountId: updated.accountId,
          budgetAmount: updated.budgetAmount,
          currentSpend: updated.currentSpend,
          percentage: updated.percentage,
          alertThreshold: updated.alertThreshold,
          budgetPeriod: updated.budgetPeriod,
          status: updated.percentage >= 100 ? 'exceeded' : 'warning',
          message: updated.percentage >= 100 
            ? `Budget exceeded by $${(updated.currentSpend - updated.budgetAmount).toFixed(2)}`
            : `Budget at ${updated.percentage.toFixed(1)}% of limit`
        })
      }
    }
    
    return alerts
  } catch (error) {
    console.error('[checkBudgetAlerts] Error:', error)
    return []
  } finally {
    client.release()
  }
}

/**
 * Get budget alerts
 */
export const getBudgetAlerts = async (userId, limit = 10) => {
  const client = await pool.connect()
  try {
    const result = await client.query(
      `SELECT 
        ba.*,
        b.budget_name,
        b.provider_id,
        b.account_id,
        b.budget_amount,
        b.current_spend,
        b.budget_period
       FROM budget_alerts ba
       JOIN budgets b ON ba.budget_id = b.id
       WHERE b.user_id = $1
       ORDER BY ba.created_at DESC
       LIMIT $2`,
      [userId, limit]
    )
    
    return result.rows.map(row => ({
      id: row.id,
      budgetId: row.budget_id,
      budgetName: row.budget_name,
      providerId: row.provider_id,
      accountId: row.account_id,
      alertType: row.alert_type,
      alertPercentage: parseInt(row.alert_percentage) || 0,
      budgetAmount: parseFloat(row.budget_amount) || 0,
      currentSpend: parseFloat(row.current_spend) || 0,
      budgetPeriod: row.budget_period,
      createdAt: row.created_at
    }))
  } catch (error) {
    console.error('[getBudgetAlerts] Error:', error)
    return []
  } finally {
    client.release()
  }
}

/**
 * Get cost efficiency metrics (cost per unit of usage)
 */
export const getCostEfficiencyMetrics = async (userId, startDate, endDate, providerId = null, accountId = null) => {
  const client = await pool.connect()
  try {
    // Get cost and usage data from service_usage_metrics
    let query = `
      SELECT 
        service_name,
        usage_unit,
        usage_type,
        SUM(cost) as total_cost,
        SUM(usage_quantity) as total_usage,
        COUNT(DISTINCT date) as days_with_data
      FROM service_usage_metrics
      WHERE user_id = $1
        AND date >= $2::date
        AND date <= $3::date
      ${providerId ? 'AND provider_id = $4' : ''}
      ${accountId ? `AND account_id = $${providerId ? 5 : 4}` : ''}
      GROUP BY service_name, usage_unit, usage_type
      HAVING SUM(cost) > 0 AND SUM(usage_quantity) > 0
      ORDER BY SUM(cost) DESC
    `
    
    const params = [userId, startDate, endDate]
    if (providerId) params.push(providerId)
    if (accountId) params.push(accountId)
    
    const result = await client.query(query, params)
    
    // Get previous period for trend comparison
    const prevStartDate = new Date(startDate)
    const prevEndDate = new Date(endDate)
    const periodDays = Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24))
    prevStartDate.setDate(prevStartDate.getDate() - periodDays)
    prevEndDate.setDate(prevEndDate.getDate() - periodDays)
    
    const prevParams = [userId, prevStartDate.toISOString().split('T')[0], prevEndDate.toISOString().split('T')[0]]
    if (providerId) prevParams.push(providerId)
    if (accountId) prevParams.push(accountId)
    
    let prevQuery = `
      SELECT 
        service_name,
        usage_unit,
        usage_type,
        SUM(cost) as total_cost,
        SUM(usage_quantity) as total_usage
      FROM service_usage_metrics
      WHERE user_id = $1
        AND date >= $2::date
        AND date <= $3::date
      ${providerId ? 'AND provider_id = $4' : ''}
      ${accountId ? `AND account_id = $${providerId ? 5 : 4}` : ''}
      GROUP BY service_name, usage_unit, usage_type
      HAVING SUM(cost) > 0 AND SUM(usage_quantity) > 0
    `
    
    const prevResult = await client.query(prevQuery, prevParams)
    const prevMetrics = new Map()
    prevResult.rows.forEach(row => {
      const key = `${row.service_name}_${row.usage_unit}_${row.usage_type || ''}`
      const prevCost = parseFloat(row.total_cost) || 0
      const prevUsage = parseFloat(row.total_usage) || 0
      prevMetrics.set(key, prevUsage > 0 ? prevCost / prevUsage : null)
    })
    
    // Calculate efficiency metrics
    const efficiencyMetrics = result.rows.map(row => {
      const totalCost = parseFloat(row.total_cost) || 0
      const totalUsage = parseFloat(row.total_usage) || 0
      const efficiency = totalUsage > 0 ? totalCost / totalUsage : null
      
      const key = `${row.service_name}_${row.usage_unit}_${row.usage_type || ''}`
      const previousEfficiency = prevMetrics.get(key) || null
      
      let trend = 'stable'
      let efficiencyChange = null
      let efficiencyChangePercent = null
      
      if (efficiency !== null && previousEfficiency !== null && previousEfficiency > 0) {
        efficiencyChange = efficiency - previousEfficiency
        efficiencyChangePercent = (efficiencyChange / previousEfficiency) * 100
        
        if (efficiencyChangePercent < -5) {
          trend = 'improving'
        } else if (efficiencyChangePercent > 5) {
          trend = 'degrading'
        }
      }
      
      // Determine service type based on usage_unit
      let serviceType = 'other'
      const unit = (row.usage_unit || '').toLowerCase()
      if (unit.includes('gb') || unit.includes('byte')) {
        serviceType = 'storage'
      } else if (unit.includes('hour') || unit.includes('second')) {
        serviceType = 'compute'
      } else if (unit.includes('request') || unit.includes('call')) {
        serviceType = 'api'
      } else if (unit.includes('transaction')) {
        serviceType = 'transaction'
      }
      
      return {
        serviceName: row.service_name,
        serviceType: serviceType,
        totalCost: totalCost,
        totalUsage: totalUsage,
        unit: row.usage_unit || 'unit',
        efficiency: efficiency,
        previousEfficiency: previousEfficiency,
        trend: trend,
        efficiencyChange: efficiencyChange,
        efficiencyChangePercent: efficiencyChangePercent,
        daysWithData: parseInt(row.days_with_data) || 0
      }
    })
    
    return {
      efficiencyMetrics,
      period: { startDate, endDate }
    }
  } catch (error) {
    console.error('[getCostEfficiencyMetrics] Error:', error)
    return {
      efficiencyMetrics: [],
      period: { startDate, endDate }
    }
  } finally {
    client.release()
  }
}

/**
 * Get rightsizing recommendations based on resource utilization
 */
export const getRightsizingRecommendations = async (userId, providerId = null, accountId = null) => {
  const client = await pool.connect()
  try {
    // Get resources with cost and usage data
    let query = `
      SELECT 
        r.id,
        r.resource_id,
        r.resource_name,
        r.resource_type,
        r.service_name,
        r.region,
        r.cost,
        r.usage_quantity,
        r.usage_unit,
        r.usage_type,
        r.last_seen_date
      FROM resources r
      WHERE r.user_id = $1
        AND r.cost > 0
        AND r.usage_quantity IS NOT NULL
        AND r.usage_quantity > 0
      ${providerId ? 'AND r.provider_id = $2' : ''}
      ${accountId ? `AND r.account_id = $${providerId ? 3 : 2}` : ''}
      ORDER BY r.cost DESC
      LIMIT 100
    `
    
    const params = [userId]
    if (providerId) params.push(providerId)
    if (accountId) params.push(accountId)
    
    const result = await client.query(query, params)
    
    const recommendations = []
    
    // Analyze each resource for rightsizing opportunities
    for (const row of result.rows) {
      const resourceId = row.resource_id
      const resourceName = row.resource_name || resourceId
      const resourceType = row.resource_type
      const serviceName = row.service_name
      const currentCost = parseFloat(row.cost) || 0
      const usageQuantity = parseFloat(row.usage_quantity) || 0
      const usageUnit = row.usage_unit || ''
      const usageType = row.usage_type || ''
      
      // Skip if we don't have enough data
      if (currentCost <= 0 || usageQuantity <= 0) continue
      
      // Determine utilization based on resource type and usage patterns
      let utilization = null
      let recommendation = null
      let priority = 'low'
      let reason = ''
      
      // For compute resources (EC2, Compute Engine, etc.)
      if (serviceName.toLowerCase().includes('ec2') || 
          serviceName.toLowerCase().includes('compute') ||
          resourceType.toLowerCase().includes('instance')) {
        
        // Estimate utilization based on usage vs typical capacity
        // This is a simplified heuristic - in production, you'd use actual metrics
        // For now, we'll use cost efficiency as a proxy
        const costPerUnit = currentCost / usageQuantity
        
        // If cost per unit is very low relative to typical, might be over-provisioned
        // If cost per unit is very high, might be under-provisioned
        // For this implementation, we'll focus on resources with very low usage
        if (usageQuantity < 100 && currentCost > 10) {
          // Low usage but high cost suggests over-provisioning
          utilization = (usageQuantity / 1000) * 100 // Rough estimate
          if (utilization < 20) {
            recommendation = 'downsize'
            priority = 'high'
            reason = `Low utilization (estimated ${utilization.toFixed(1)}%) suggests this resource may be over-provisioned. Consider downsizing to a smaller instance type.`
          }
        }
      }
      
      // For storage resources (S3, EBS, etc.)
      else if (serviceName.toLowerCase().includes('s3') || 
               serviceName.toLowerCase().includes('storage') ||
               serviceName.toLowerCase().includes('ebs') ||
               usageUnit.toLowerCase().includes('gb')) {
        
        // Storage utilization is harder to estimate without capacity data
        // For now, we'll skip storage resources or use cost efficiency
        // In production, you'd compare usage vs allocated capacity
        continue
      }
      
      // For other resources, use cost efficiency heuristic
      else {
        // If usage is very low relative to cost, might be over-provisioned
        const efficiency = usageQuantity / currentCost
        if (efficiency < 1 && currentCost > 20) {
          utilization = (efficiency * 100) // Rough estimate
          if (utilization < 20) {
            recommendation = 'downsize'
            priority = 'medium'
            reason = `Low usage efficiency suggests this resource may be over-provisioned. Review resource sizing.`
          }
        }
      }
      
      // Only add recommendation if we have one
      if (recommendation && utilization !== null) {
        // Estimate potential savings (assume 30-50% savings for downsizing)
        const savingsPercent = recommendation === 'downsize' ? 40 : 0
        const potentialSavings = currentCost * (savingsPercent / 100)
        
        recommendations.push({
          resourceId: resourceId,
          resourceName: resourceName,
          serviceName: serviceName,
          resourceType: resourceType,
          region: row.region,
          currentCost: currentCost,
          utilization: {
            estimated: utilization,
            usageQuantity: usageQuantity,
            usageUnit: usageUnit
          },
          recommendation: recommendation,
          potentialSavings: potentialSavings,
          savingsPercent: savingsPercent,
          priority: priority,
          reason: reason
        })
      }
    }
    
    // Sort by potential savings (highest first)
    recommendations.sort((a, b) => b.potentialSavings - a.potentialSavings)
    
    // Calculate total potential savings
    const totalPotentialSavings = recommendations.reduce((sum, rec) => sum + rec.potentialSavings, 0)
    
    return {
      recommendations: recommendations.slice(0, 20), // Limit to top 20
      totalPotentialSavings: totalPotentialSavings,
      recommendationCount: recommendations.length
    }
  } catch (error) {
    console.error('[getRightsizingRecommendations] Error:', error)
    return {
      recommendations: [],
      totalPotentialSavings: 0,
      recommendationCount: 0
    }
  } finally {
    client.release()
  }
}

// ============================================================================
// Product/Team Cost Visibility
// ============================================================================

/**
 * Get costs grouped by product (tag_key = 'product' or 'Product')
 */
export const getCostByProduct = async (userId, startDate, endDate, providerId = null, accountId = null) => {
  const client = await pool.connect()
  try {
    let query = `
      SELECT 
        COALESCE(rt.tag_value, 'Untagged') as product_name,
        SUM(r.cost) as total_cost,
        COUNT(DISTINCT r.id) as resource_count,
        COUNT(DISTINCT r.service_name) as service_count,
        STRING_AGG(DISTINCT r.service_name, ', ') as services
      FROM resources r
      LEFT JOIN resource_tags rt ON r.id = rt.resource_id 
        AND (LOWER(rt.tag_key) = 'product' OR LOWER(rt.tag_key) = 'productname' OR LOWER(rt.tag_key) = 'product_name')
      WHERE r.user_id = $1
        AND r.last_seen_date >= $2::date
        AND r.last_seen_date <= $3::date
    `
    
    const params = [userId, startDate, endDate]
    let paramIndex = 4
    
    if (providerId) {
      query += ` AND r.provider_id = $${paramIndex}`
      params.push(providerId)
      paramIndex++
    }
    
    if (accountId) {
      query += ` AND r.account_id = $${paramIndex}`
      params.push(accountId)
      paramIndex++
    }
    
    query += `
      GROUP BY rt.tag_value
      ORDER BY total_cost DESC
    `
    
    const result = await client.query(query, params)
    
    return result.rows.map(row => ({
      productName: row.product_name || 'Untagged',
      totalCost: parseFloat(row.total_cost) || 0,
      resourceCount: parseInt(row.resource_count) || 0,
      serviceCount: parseInt(row.service_count) || 0,
      services: row.services ? row.services.split(', ') : []
    }))
  } catch (error) {
    console.error('[getCostByProduct] Error:', error)
    return []
  } finally {
    client.release()
  }
}

/**
 * Get costs grouped by team (tag_key = 'team' or 'Team')
 */
export const getCostByTeam = async (userId, startDate, endDate, providerId = null, accountId = null) => {
  const client = await pool.connect()
  try {
    let query = `
      SELECT 
        COALESCE(rt.tag_value, 'Untagged') as team_name,
        SUM(r.cost) as total_cost,
        COUNT(DISTINCT r.id) as resource_count,
        COUNT(DISTINCT r.service_name) as service_count,
        STRING_AGG(DISTINCT r.service_name, ', ') as services
      FROM resources r
      LEFT JOIN resource_tags rt ON r.id = rt.resource_id 
        AND (LOWER(rt.tag_key) = 'team' OR LOWER(rt.tag_key) = 'teamname' OR LOWER(rt.tag_key) = 'team_name' OR LOWER(rt.tag_key) = 'owner')
      WHERE r.user_id = $1
        AND r.last_seen_date >= $2::date
        AND r.last_seen_date <= $3::date
    `
    
    const params = [userId, startDate, endDate]
    let paramIndex = 4
    
    if (providerId) {
      query += ` AND r.provider_id = $${paramIndex}`
      params.push(providerId)
      paramIndex++
    }
    
    if (accountId) {
      query += ` AND r.account_id = $${paramIndex}`
      params.push(accountId)
      paramIndex++
    }
    
    query += `
      GROUP BY rt.tag_value
      ORDER BY total_cost DESC
    `
    
    const result = await client.query(query, params)
    
    return result.rows.map(row => ({
      teamName: row.team_name || 'Untagged',
      totalCost: parseFloat(row.total_cost) || 0,
      resourceCount: parseInt(row.resource_count) || 0,
      serviceCount: parseInt(row.service_count) || 0,
      services: row.services ? row.services.split(', ') : []
    }))
  } catch (error) {
    console.error('[getCostByTeam] Error:', error)
    return []
  } finally {
    client.release()
  }
}

/**
 * Get product cost trends over time
 */
export const getProductCostTrends = async (userId, productName, startDate, endDate, providerId = null, accountId = null) => {
  const client = await pool.connect()
  try {
    let query = `
      SELECT 
        DATE_TRUNC('month', r.last_seen_date) as month,
        SUM(r.cost) as total_cost,
        COUNT(DISTINCT r.id) as resource_count
      FROM resources r
      JOIN resource_tags rt ON r.id = rt.resource_id 
        AND (LOWER(rt.tag_key) = 'product' OR LOWER(rt.tag_key) = 'productname' OR LOWER(rt.tag_key) = 'product_name')
        AND rt.tag_value = $1
      WHERE r.user_id = $2
        AND r.last_seen_date >= $3::date
        AND r.last_seen_date <= $4::date
    `
    
    const params = [productName, userId, startDate, endDate]
    let paramIndex = 5
    
    if (providerId) {
      query += ` AND r.provider_id = $${paramIndex}`
      params.push(providerId)
      paramIndex++
    }
    
    if (accountId) {
      query += ` AND r.account_id = $${paramIndex}`
      params.push(accountId)
      paramIndex++
    }
    
    query += `
      GROUP BY DATE_TRUNC('month', r.last_seen_date)
      ORDER BY month ASC
    `
    
    const result = await client.query(query, params)
    
    return result.rows.map(row => ({
      month: row.month.toISOString().split('T')[0],
      totalCost: parseFloat(row.total_cost) || 0,
      resourceCount: parseInt(row.resource_count) || 0
    }))
  } catch (error) {
    console.error('[getProductCostTrends] Error:', error)
    return []
  } finally {
    client.release()
  }
}

/**
 * Get team cost trends over time
 */
export const getTeamCostTrends = async (userId, teamName, startDate, endDate, providerId = null, accountId = null) => {
  const client = await pool.connect()
  try {
    let query = `
      SELECT 
        DATE_TRUNC('month', r.last_seen_date) as month,
        SUM(r.cost) as total_cost,
        COUNT(DISTINCT r.id) as resource_count
      FROM resources r
      JOIN resource_tags rt ON r.id = rt.resource_id 
        AND (LOWER(rt.tag_key) = 'team' OR LOWER(rt.tag_key) = 'teamname' OR LOWER(rt.tag_key) = 'team_name' OR LOWER(rt.tag_key) = 'owner')
        AND rt.tag_value = $1
      WHERE r.user_id = $2
        AND r.last_seen_date >= $3::date
        AND r.last_seen_date <= $4::date
    `
    
    const params = [teamName, userId, startDate, endDate]
    let paramIndex = 5
    
    if (providerId) {
      query += ` AND r.provider_id = $${paramIndex}`
      params.push(providerId)
      paramIndex++
    }
    
    if (accountId) {
      query += ` AND r.account_id = $${paramIndex}`
      params.push(accountId)
      paramIndex++
    }
    
    query += `
      GROUP BY DATE_TRUNC('month', r.last_seen_date)
      ORDER BY month ASC
    `
    
    const result = await client.query(query, params)
    
    return result.rows.map(row => ({
      month: row.month.toISOString().split('T')[0],
      totalCost: parseFloat(row.total_cost) || 0,
      resourceCount: parseInt(row.resource_count) || 0
    }))
  } catch (error) {
    console.error('[getTeamCostTrends] Error:', error)
    return []
  } finally {
    client.release()
  }
}

/**
 * Get service breakdown for a product
 */
export const getProductServiceBreakdown = async (userId, productName, startDate, endDate, providerId = null, accountId = null) => {
  const client = await pool.connect()
  try {
    let query = `
      SELECT 
        r.service_name,
        SUM(r.cost) as total_cost,
        COUNT(DISTINCT r.id) as resource_count
      FROM resources r
      JOIN resource_tags rt ON r.id = rt.resource_id 
        AND (LOWER(rt.tag_key) = 'product' OR LOWER(rt.tag_key) = 'productname' OR LOWER(rt.tag_key) = 'product_name')
        AND rt.tag_value = $1
      WHERE r.user_id = $2
        AND r.last_seen_date >= $3::date
        AND r.last_seen_date <= $4::date
    `
    
    const params = [productName, userId, startDate, endDate]
    let paramIndex = 5
    
    if (providerId) {
      query += ` AND r.provider_id = $${paramIndex}`
      params.push(providerId)
      paramIndex++
    }
    
    if (accountId) {
      query += ` AND r.account_id = $${paramIndex}`
      params.push(accountId)
      paramIndex++
    }
    
    query += `
      GROUP BY r.service_name
      ORDER BY total_cost DESC
    `
    
    const result = await client.query(query, params)
    
    return result.rows.map(row => ({
      serviceName: row.service_name,
      cost: parseFloat(row.total_cost) || 0,
      resourceCount: parseInt(row.resource_count) || 0
    }))
  } catch (error) {
    console.error('[getProductServiceBreakdown] Error:', error)
    return []
  } finally {
    client.release()
  }
}

/**
 * Get service breakdown for a team
 */
export const getTeamServiceBreakdown = async (userId, teamName, startDate, endDate, providerId = null, accountId = null) => {
  const client = await pool.connect()
  try {
    let query = `
      SELECT 
        r.service_name,
        SUM(r.cost) as total_cost,
        COUNT(DISTINCT r.id) as resource_count
      FROM resources r
      JOIN resource_tags rt ON r.id = rt.resource_id 
        AND (LOWER(rt.tag_key) = 'team' OR LOWER(rt.tag_key) = 'teamname' OR LOWER(rt.tag_key) = 'team_name' OR LOWER(rt.tag_key) = 'owner')
        AND rt.tag_value = $1
      WHERE r.user_id = $2
        AND r.last_seen_date >= $3::date
        AND r.last_seen_date <= $4::date
    `
    
    const params = [teamName, userId, startDate, endDate]
    let paramIndex = 5
    
    if (providerId) {
      query += ` AND r.provider_id = $${paramIndex}`
      params.push(providerId)
      paramIndex++
    }
    
    if (accountId) {
      query += ` AND r.account_id = $${paramIndex}`
      params.push(accountId)
      paramIndex++
    }
    
    query += `
      GROUP BY r.service_name
      ORDER BY total_cost DESC
    `
    
    const result = await client.query(query, params)
    
    return result.rows.map(row => ({
      serviceName: row.service_name,
      cost: parseFloat(row.total_cost) || 0,
      resourceCount: parseInt(row.resource_count) || 0
    }))
  } catch (error) {
    console.error('[getTeamServiceBreakdown] Error:', error)
    return []
  } finally {
    client.release()
  }
}

// ============================================================================
// Report Generation
// ============================================================================

/**
 * Generate showback/chargeback report data
 */
export const generateReportData = async (userId, reportType, startDate, endDate, options = {}) => {
  const client = await pool.connect()
  try {
    const { providerId, accountId, teamName, productName } = options
    
    let costData = []
    let summary = {
      totalCost: 0,
      resourceCount: 0,
      serviceCount: 0,
      period: { startDate, endDate }
    }
    
    if (teamName) {
      // Get team costs
      const teams = await getCostByTeam(userId, startDate, endDate, providerId, accountId)
      const team = teams.find(t => t.teamName === teamName)
      if (team) {
        const services = await getTeamServiceBreakdown(userId, teamName, startDate, endDate, providerId, accountId)
        costData = services.map(s => ({
          serviceName: s.serviceName,
          cost: s.cost,
          resourceCount: s.resourceCount,
          category: 'Service'
        }))
        summary.totalCost = team.totalCost
        summary.resourceCount = team.resourceCount
        summary.serviceCount = team.serviceCount
      }
    } else if (productName) {
      // Get product costs
      const products = await getCostByProduct(userId, startDate, endDate, providerId, accountId)
      const product = products.find(p => p.productName === productName)
      if (product) {
        const services = await getProductServiceBreakdown(userId, productName, startDate, endDate, providerId, accountId)
        costData = services.map(s => ({
          serviceName: s.serviceName,
          cost: s.cost,
          resourceCount: s.resourceCount,
          category: 'Service'
        }))
        summary.totalCost = product.totalCost
        summary.resourceCount = product.resourceCount
        summary.serviceCount = product.serviceCount
      }
    } else {
      // Get all team/product costs
      const teams = await getCostByTeam(userId, startDate, endDate, providerId, accountId)
      const products = await getCostByProduct(userId, startDate, endDate, providerId, accountId)
      
      costData = [
        ...teams.map(t => ({
          name: t.teamName,
          cost: t.totalCost,
          resourceCount: t.resourceCount,
          serviceCount: t.serviceCount,
          category: 'Team'
        })),
        ...products.map(p => ({
          name: p.productName,
          cost: p.totalCost,
          resourceCount: p.resourceCount,
          serviceCount: p.serviceCount,
          category: 'Product'
        }))
      ]
      
      summary.totalCost = costData.reduce((sum, item) => sum + item.cost, 0)
      summary.resourceCount = costData.reduce((sum, item) => sum + item.resourceCount, 0)
      summary.serviceCount = new Set(costData.flatMap(item => item.services || [])).size
    }
    
    return {
      reportType,
      summary,
      costData,
      generatedAt: new Date().toISOString(),
      options
    }
  } catch (error) {
    console.error('[generateReportData] Error:', error)
    throw error
  } finally {
    client.release()
  }
}

/**
 * Save report record
 */
export const saveReport = async (userId, reportData) => {
  const client = await pool.connect()
  try {
    const {
      reportType,
      reportName,
      startDate,
      endDate,
      providerId,
      accountId,
      teamName,
      productName,
      reportData: data,
      filePath,
      fileFormat,
      status = 'pending'
    } = reportData
    
    const result = await client.query(
      `INSERT INTO reports (
        user_id, report_type, report_name, start_date, end_date,
        provider_id, account_id, team_name, product_name,
        report_data, file_path, file_format, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP)
      RETURNING *`,
      [
        userId, reportType, reportName, startDate, endDate,
        providerId || null, accountId || null, teamName || null, productName || null,
        JSON.stringify(data), filePath || null, fileFormat || null, status
      ]
    )
    
    return {
      id: result.rows[0].id,
      userId: result.rows[0].user_id,
      reportType: result.rows[0].report_type,
      reportName: result.rows[0].report_name,
      startDate: result.rows[0].start_date,
      endDate: result.rows[0].end_date,
      providerId: result.rows[0].provider_id,
      accountId: result.rows[0].account_id,
      teamName: result.rows[0].team_name,
      productName: result.rows[0].product_name,
      reportData: result.rows[0].report_data,
      filePath: result.rows[0].file_path,
      fileFormat: result.rows[0].file_format,
      status: result.rows[0].status,
      createdAt: result.rows[0].created_at,
      completedAt: result.rows[0].completed_at
    }
  } catch (error) {
    console.error('[saveReport] Error:', error)
    throw error
  } finally {
    client.release()
  }
}

/**
 * Get reports for a user
 */
export const getReports = async (userId, reportType = null, limit = 50) => {
  const client = await pool.connect()
  try {
    let query = `
      SELECT * FROM reports
      WHERE user_id = $1
    `
    const params = [userId]
    let paramIndex = 2
    
    if (reportType) {
      query += ` AND report_type = $${paramIndex}`
      params.push(reportType)
      paramIndex++
    }
    
    query += ` ORDER BY created_at DESC LIMIT $${paramIndex}`
    params.push(limit)
    
    const result = await client.query(query, params)
    
    return result.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      reportType: row.report_type,
      reportName: row.report_name,
      startDate: row.start_date,
      endDate: row.end_date,
      providerId: row.provider_id,
      accountId: row.account_id,
      teamName: row.team_name,
      productName: row.product_name,
      reportData: row.report_data,
      filePath: row.file_path,
      fileFormat: row.file_format,
      status: row.status,
      createdAt: row.created_at,
      completedAt: row.completed_at
    }))
  } catch (error) {
    console.error('[getReports] Error:', error)
    return []
  } finally {
    client.release()
  }
}

/**
 * Get a specific report
 */
export const getReport = async (userId, reportId) => {
  const client = await pool.connect()
  try {
    const result = await client.query(
      `SELECT * FROM reports
       WHERE id = $1 AND user_id = $2`,
      [reportId, userId]
    )
    
    if (result.rows.length === 0) {
      return null
    }
    
    const row = result.rows[0]
    return {
      id: row.id,
      userId: row.user_id,
      reportType: row.report_type,
      reportName: row.report_name,
      startDate: row.start_date,
      endDate: row.end_date,
      providerId: row.provider_id,
      accountId: row.account_id,
      teamName: row.team_name,
      productName: row.product_name,
      reportData: row.report_data,
      filePath: row.file_path,
      fileFormat: row.file_format,
      status: row.status,
      createdAt: row.created_at,
      completedAt: row.completed_at
    }
  } catch (error) {
    console.error('[getReport] Error:', error)
    return null
  } finally {
    client.release()
  }
}

/**
 * Update report status
 */
export const updateReportStatus = async (userId, reportId, status, filePath = null) => {
  const client = await pool.connect()
  try {
    // Get report details before updating (for notifications)
    const reportResult = await client.query(
      `SELECT report_name, report_type, file_format FROM reports WHERE id = $1 AND user_id = $2`,
      [reportId, userId]
    )
    
    const report = reportResult.rows[0]
    
    const updates = [`status = $1`]
    const params = [status]
    let paramIndex = 2
    
    if (filePath) {
      updates.push(`file_path = $${paramIndex}`)
      params.push(filePath)
      paramIndex++
    }
    
    if (status === 'completed') {
      updates.push(`completed_at = CURRENT_TIMESTAMP`)
    }
    
    params.push(reportId, userId)
    
    const result = await client.query(
      `UPDATE reports 
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
       RETURNING *`,
      params
    )
    
    if (result.rows.length === 0) {
      return null
    }
    
    const row = result.rows[0]
    return {
      id: row.id,
      status: row.status,
      filePath: row.file_path,
      completedAt: row.completed_at
    }
  } catch (error) {
    console.error('[updateReportStatus] Error:', error)
    throw error
  } finally {
    client.release()
  }
}

/**
 * Delete a report
 */
export const deleteReport = async (userId, reportId) => {
  const client = await pool.connect()
  try {
    const result = await client.query(
      `DELETE FROM reports 
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [reportId, userId]
    )
    
    return result.rows.length > 0
  } catch (error) {
    console.error('[deleteReport] Error:', error)
    throw error
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

// ============================================================================
// Notification Operations
// ============================================================================

/**
 * Create a notification
 */
export const createNotification = async (userId, notification) => {
  const client = await pool.connect()
  try {
    const result = await client.query(
      `INSERT INTO notifications (
        user_id, type, title, message, link, link_text, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, created_at`,
      [
        userId,
        notification.type,
        notification.title,
        notification.message || null,
        notification.link || null,
        notification.linkText || null,
        notification.metadata ? JSON.stringify(notification.metadata) : null
      ]
    )
    return result.rows[0]
  } finally {
    client.release()
  }
}

/**
 * Get notifications for a user
 */
export const getNotifications = async (userId, options = {}) => {
  const client = await pool.connect()
  try {
    const { unreadOnly = false, limit = 50, offset = 0, type = null } = options
    
    let query = `
      SELECT id, type, title, message, link, link_text, is_read, metadata, created_at, read_at
      FROM notifications
      WHERE user_id = $1
    `
    const params = [userId]
    let paramIndex = 2
    
    if (unreadOnly) {
      query += ` AND is_read = false`
    }
    
    if (type) {
      query += ` AND type = $${paramIndex}`
      params.push(type)
      paramIndex++
    }
    
    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`
    params.push(limit, offset)
    
    const result = await client.query(query, params)
    
    return result.rows.map(row => ({
      id: row.id,
      type: row.type,
      title: row.title,
      message: row.message,
      link: row.link,
      linkText: row.link_text,
      isRead: row.is_read,
      metadata: row.metadata ? (typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata) : null,
      createdAt: row.created_at,
      readAt: row.read_at
    }))
  } finally {
    client.release()
  }
}

/**
 * Get unread notification count
 */
export const getUnreadNotificationCount = async (userId) => {
  const client = await pool.connect()
  try {
    const result = await client.query(
      `SELECT COUNT(*) as count
       FROM notifications
       WHERE user_id = $1 AND is_read = false`,
      [userId]
    )
    return parseInt(result.rows[0].count, 10)
  } finally {
    client.release()
  }
}

/**
 * Mark notification as read
 */
export const markNotificationAsRead = async (userId, notificationId) => {
  const client = await pool.connect()
  try {
    await client.query(
      `UPDATE notifications
       SET is_read = true, read_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND user_id = $2`,
      [notificationId, userId]
    )
  } finally {
    client.release()
  }
}

/**
 * Mark all notifications as read for a user
 */
export const markAllNotificationsAsRead = async (userId) => {
  const client = await pool.connect()
  try {
    await client.query(
      `UPDATE notifications
       SET is_read = true, read_at = CURRENT_TIMESTAMP
       WHERE user_id = $1 AND is_read = false`,
      [userId]
    )
  } finally {
    client.release()
  }
}

/**
 * Delete a notification
 */
export const deleteNotification = async (userId, notificationId) => {
  const client = await pool.connect()
  try {
    await client.query(
      `DELETE FROM notifications
       WHERE id = $1 AND user_id = $2`,
      [notificationId, userId]
    )
  } finally {
    client.release()
  }
}

/**
 * Delete old read notifications (older than specified days)
 */
export const deleteOldNotifications = async (userId, daysOld = 30) => {
  const client = await pool.connect()
  try {
    const result = await client.query(
      `DELETE FROM notifications
       WHERE user_id = $1 
         AND is_read = true 
         AND created_at < CURRENT_TIMESTAMP - INTERVAL '${daysOld} days'`,
      [userId]
    )
    return result.rowCount
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

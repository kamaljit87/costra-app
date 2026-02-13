#!/usr/bin/env node
/**
 * Database migration script for production
 * Creates all tables, indexes, and schema updates. Idempotent - safe to run multiple times.
 *
 * Usage:
 *   DATABASE_URL=postgresql://user:pass@host:5432/costra node server/scripts/migrate.js
 *   cd server && npm run migrate
 *
 * Prerequisites:
 *   1. PostgreSQL database must exist (create via RDS/Cloud SQL console if using managed DB)
 *   2. DATABASE_URL must be set with connection string
 */

import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import { initDatabase } from '../database.js'
import logger from '../utils/logger.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load .env from server directory
dotenv.config({ path: path.join(__dirname, '../.env') })

async function migrate() {
  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl || !dbUrl.startsWith('postgresql://')) {
    console.error('ERROR: DATABASE_URL is required and must be a PostgreSQL connection string.')
    console.error('Example: postgresql://user:password@host:5432/costra')
    console.error('')
    console.error('For managed databases (RDS, Cloud SQL):')
    console.error('  1. Create the database instance in your cloud console')
    console.error('  2. Create a database named "costra" (or your preferred name)')
    console.error('  3. Set DATABASE_URL in your environment or .env file')
    process.exit(1)
  }

  // Mask password in logs
  const safeUrl = dbUrl.replace(/:([^:@]+)@/, ':****@')
  logger.info('Running database migration', { database: safeUrl })

  try {
    await initDatabase()
    logger.info('Migration completed successfully')
    console.log('')
    console.log('✓ Database schema is ready.')
    console.log('  You can now start the application.')
    process.exit(0)
  } catch (error) {
    logger.error('Migration failed', { error: error.message, stack: error.stack })
    console.error('')
    console.error('Migration failed:', error.message)
    console.error('')
    console.error('Common issues:')
    console.error('  - Database does not exist: Create it first (e.g. CREATE DATABASE costra;)')
    console.error('  - Connection refused: Check host, port, and network/security groups')
    console.error('  - Authentication failed: Verify username and password in DATABASE_URL')
    process.exit(1)
  }
}

migrate()

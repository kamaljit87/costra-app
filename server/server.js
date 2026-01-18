import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { initDatabase } from './database.js'
import authRoutes from './routes/auth.js'
import costDataRoutes from './routes/costData.js'
import savingsPlansRoutes from './routes/savingsPlans.js'
import cloudProvidersRoutes from './routes/cloudProviders.js'
import googleAuthRoutes from './routes/googleAuth.js'
import syncRoutes from './routes/sync.js'
import profileRoutes from './routes/profile.js'
import aiRoutes from './routes/ai.js'
import insightsRoutes from './routes/insights.js'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load .env file from server directory
dotenv.config({ path: path.join(__dirname, '.env') })

// Validate required environment variables
if (!process.env.JWT_SECRET) {
  console.error('ERROR: JWT_SECRET is not set in environment variables!')
  console.error('Please set JWT_SECRET in server/.env file')
  process.exit(1)
}

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.FRONTEND_URL 
    : ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://192.168.122.4:5173', 'http://192.168.18.29:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))
app.use(express.json())

// Initialize database
initDatabase().catch(console.error)

// Serve static files for uploaded avatars
app.use('/api/uploads', express.static(path.join(__dirname, 'uploads')))

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/auth/google', googleAuthRoutes)
app.use('/api/profile', profileRoutes)
app.use('/api/cost-data', costDataRoutes)
app.use('/api/savings-plans', savingsPlansRoutes)
app.use('/api/cloud-providers', cloudProvidersRoutes)
app.use('/api/sync', syncRoutes)
app.use('/api/ai', aiRoutes)
app.use('/api/insights', insightsRoutes)

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Costra API is running' })
})

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err)
  res.status(500).json({ error: 'Internal server error' })
})

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})

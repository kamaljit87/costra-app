import winston from 'winston'
import DailyRotateFile from 'winston-daily-rotate-file'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
}

// Define log colors
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
}

winston.addColors(colors)

// Define log format
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
)

// Console format (for development)
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => {
      const { timestamp, level, message, requestId, userId, ...meta } = info
      let log = `${timestamp} [${level}]: ${message}`
      
      if (requestId) log += ` [RequestId: ${requestId}]`
      if (userId) log += ` [UserId: ${userId}]`
      if (Object.keys(meta).length > 0) {
        log += ` ${JSON.stringify(meta)}`
      }
      
      return log
    }
  )
)

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '..', 'logs')

// Create transports
const transports = [
  // Console transport (for development)
  new winston.transports.Console({
    format: process.env.NODE_ENV === 'production' ? format : consoleFormat,
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  }),
  
  // Daily rotate file for errors
  new DailyRotateFile({
    filename: path.join(logsDir, 'error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    level: 'error',
    format: format,
    maxSize: '20m',
    maxFiles: '14d', // Keep 14 days of logs
    zippedArchive: true,
  }),
  
  // Daily rotate file for all logs
  new DailyRotateFile({
    filename: path.join(logsDir, 'combined-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    format: format,
    maxSize: '20m',
    maxFiles: '14d', // Keep 14 days of logs
    zippedArchive: true,
  }),
]

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  levels,
  format,
  transports,
  // Don't exit on handled exceptions
  exitOnError: false,
})

// Create a stream object for Morgan HTTP logging (if needed in future)
logger.stream = {
  write: (message) => {
    logger.http(message.trim())
  },
}

export default logger

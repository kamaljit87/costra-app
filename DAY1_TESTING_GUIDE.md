# Day 1: Error Handling & Logging - Testing Guide

## Prerequisites

1. Ensure all dependencies are installed:
   ```bash
   cd server
   npm install
   ```

2. Verify environment variables are set (check `server/.env`):
   - `JWT_SECRET` (required)
   - `DATABASE_URL` or database connection variables (required)
   - `SENTRY_DSN` (optional - for error tracking)
   - `NODE_ENV` (optional - defaults to development)
   - `LOG_LEVEL` (optional - defaults to 'debug' in dev, 'info' in production)

3. Ensure database is accessible and initialized

## Testing Steps

### 1. Test Server Startup and Logging Infrastructure

#### 1.1 Start the Server
```bash
cd server
npm start
```

**Expected Results:**
- ✅ Server starts without errors
- ✅ You see structured log output in console (colored in development)
- ✅ Log message format: `YYYY-MM-DD HH:mm:ss [LEVEL]: Message [RequestId: ...] [UserId: ...]`
- ✅ If Sentry DSN is set, you should see: "Sentry initialized" log
- ✅ If Sentry DSN is not set, you should see: "Sentry DSN not provided - error tracking disabled" warning

**Check Log Files:**
```bash
ls -la server/logs/
```

**Expected:**
- ✅ `logs/` directory created
- ✅ `combined-YYYY-MM-DD.log` file created (all logs)
- ✅ `error-YYYY-MM-DD.log` file created (errors only)

#### 1.2 Verify Log File Contents
```bash
tail -f server/logs/combined-$(date +%Y-%m-%d).log
```

**Expected:**
- ✅ JSON formatted log entries
- ✅ Each entry has: timestamp, level, message, requestId (if available)
- ✅ Structured data in log entries

### 2. Test Request ID Tracking

#### 2.1 Make a Simple API Request
```bash
curl -X GET http://localhost:3001/api/health \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "status": "ok",
  "message": "Costra API is running",
  "timestamp": "2025-01-XX...",
  "requestId": "uuid-here"
}
```

**Check:**
- ✅ Response includes `requestId` field
- ✅ Response includes `X-Request-ID` header
- ✅ Request ID is a valid UUID

#### 2.2 Verify Request ID in Logs
Check the log file or console output for the request:

**Expected:**
- ✅ Log entry includes `requestId` field
- ✅ Request ID matches the one in the response

### 3. Test Error Handling Middleware

#### 3.1 Test Invalid Endpoint (404)
```bash
curl -X GET http://localhost:3001/api/nonexistent \
  -H "Content-Type: application/json"
```

**Expected Response:**
- ✅ 404 status code
- ✅ Standard error format (if Express handles it, or custom format)

#### 3.2 Test Authentication Error (401)
```bash
curl -X GET http://localhost:3001/api/cost-data \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "error": "Unauthorized access",
  "code": "HTTP_401",
  "requestId": "uuid-here",
  "timestamp": "2025-01-XX..."
}
```

**Check:**
- ✅ Error response follows standardized format
- ✅ Includes `error`, `code`, `requestId`, `timestamp`
- ✅ User-friendly error message
- ✅ Error logged in `error-YYYY-MM-DD.log` file

#### 3.3 Test Database Error (Simulated)
Create a test endpoint that throws a database error, or use an invalid query:

**Expected:**
- ✅ Error caught by error handler middleware
- ✅ User-friendly error message returned
- ✅ Full error details logged (with stack trace)
- ✅ Error sent to Sentry (if configured)

### 4. Test Structured Logging in Routes

#### 4.1 Test Authentication Route Logging
```bash
# Test signup (should log info/debug)
curl -X POST http://localhost:3001/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "password": "testpassword123"
  }'
```

**Check Logs:**
```bash
tail -f server/logs/combined-$(date +%Y-%m-%d).log | grep -i signup
```

**Expected:**
- ✅ Structured log entries with context (userId, requestId)
- ✅ Info level for successful operations
- ✅ Error level for failures with full context

#### 4.2 Test Sync Route Logging
```bash
# First, get a valid token from login
TOKEN=$(curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "testpassword123"}' \
  | jq -r '.token')

# Test sync endpoint
curl -X POST http://localhost:3001/api/sync \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN"
```

**Check Logs:**
```bash
tail -f server/logs/combined-$(date +%Y-%m-%d).log | grep -i sync
```

**Expected:**
- ✅ Structured log entries with context (userId, accountId, providerId)
- ✅ Info level for sync operations
- ✅ Debug level for detailed operations
- ✅ Error level for failures with full context

### 5. Test Database Logging

#### 5.1 Check Database Connection Logs
When server starts, check for:

**Expected:**
- ✅ "Connected to PostgreSQL database" log entry
- ✅ Database initialization logs (if first run)

#### 5.2 Test Database Error Logging
Trigger a database operation that might fail (e.g., invalid query):

**Expected:**
- ✅ Error logged with structured format
- ✅ Includes userId, error message, stack trace
- ✅ User-friendly error message returned to client

### 6. Test Sentry Integration (If Configured)

#### 6.1 Verify Sentry Initialization
Check server startup logs:

**Expected:**
- ✅ "Sentry initialized" log (if SENTRY_DSN is set)
- ✅ DSN partially masked in logs (security)

#### 6.2 Trigger an Error
```bash
# Make a request that causes an error
curl -X GET http://localhost:3001/api/cost-data/invalid-id \
  -H "Authorization: Bearer $TOKEN"
```

**Check:**
- ✅ Error logged locally
- ✅ Error sent to Sentry (check Sentry dashboard)
- ✅ Error includes user context in Sentry

### 7. Test Log Rotation

#### 7.1 Verify Log Files
```bash
ls -la server/logs/
```

**Expected:**
- ✅ Daily log files: `combined-YYYY-MM-DD.log`
- ✅ Daily error files: `error-YYYY-MM-DD.log`
- ✅ Old files compressed (`.gz`) if older than current day

#### 7.2 Test Log Retention
Check that old log files are retained (up to 14 days):

**Expected:**
- ✅ Logs from past 14 days are present
- ✅ Logs older than 14 days are automatically deleted

### 8. Test Error Response Format Consistency

#### 8.1 Test Various Error Scenarios
```bash
# Invalid JSON
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d 'invalid json'

# Missing required fields
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'

# Database error (use invalid user ID)
curl -X GET http://localhost:3001/api/profile \
  -H "Authorization: Bearer $TOKEN"
```

**Expected for All Errors:**
- ✅ Consistent error response format:
  ```json
  {
    "error": "User-friendly message",
    "code": "ERROR_CODE",
    "requestId": "uuid",
    "timestamp": "ISO-8601"
  }
  ```
- ✅ Development mode includes `stack` and `details` fields
- ✅ Production mode hides internal details

### 9. Test Console Statement Replacement

#### 9.1 Verify No Console Statements in Completed Files
```bash
# Check completed files
grep -r "console\." server/server.js server/routes/auth.js server/routes/sync.js server/database.js
```

**Expected:**
- ✅ No console.log/error/warn/info statements found
- ✅ All replaced with logger calls

#### 9.2 Check Remaining Console Statements
```bash
# Count remaining console statements
grep -r "console\." server/ --include="*.js" | wc -l
```

**Expected:**
- ⚠️ Some console statements may remain in incomplete files
- ✅ Core infrastructure files are clean

### 10. Performance Testing

#### 10.1 Test Request ID Generation Performance
```bash
# Make multiple concurrent requests
for i in {1..100}; do
  curl -X GET http://localhost:3001/api/health &
done
wait
```

**Expected:**
- ✅ All requests complete successfully
- ✅ Each request has unique request ID
- ✅ No performance degradation

#### 10.2 Test Logging Performance
Monitor server performance during high load:

**Expected:**
- ✅ Logging doesn't significantly impact response times
- ✅ Log files are written efficiently
- ✅ No memory leaks from logging

## Verification Checklist

### Infrastructure ✅
- [ ] Winston logger installed and configured
- [ ] Log rotation working (daily files, 14-day retention)
- [ ] Request ID middleware working
- [ ] Error handler middleware working
- [ ] Sentry integrated (if DSN provided)

### Logging ✅
- [ ] Structured logging working (JSON format in files)
- [ ] Console output formatted (colored in development)
- [ ] Log levels working (error, warn, info, debug)
- [ ] Request IDs included in logs
- [ ] User IDs included in logs (when available)

### Error Handling ✅
- [ ] Standardized error response format
- [ ] Database errors mapped to user-friendly messages
- [ ] Errors logged with full context
- [ ] Stack traces included in development mode
- [ ] Internal details hidden in production mode

### Console Replacement 🔄
- [ ] server.js - Complete
- [ ] routes/auth.js - Complete
- [ ] routes/sync.js - Complete
- [ ] database.js - Complete
- [ ] services/cloudProviderIntegrations.js - In progress
- [ ] Other route files - Pending
- [ ] Other service files - Pending

## Troubleshooting

### Issue: Server won't start
**Check:**
- Dependencies installed: `npm install` in server directory
- Environment variables set correctly
- Database connection working
- Port 3001 not in use

### Issue: Logs not appearing
**Check:**
- `logs/` directory exists and is writable
- Check file permissions: `chmod 755 server/logs`
- Check disk space
- Verify LOG_LEVEL environment variable

### Issue: Request IDs not appearing
**Check:**
- Request ID middleware is before routes in server.js
- CORS headers include X-Request-ID
- Check middleware order in server.js

### Issue: Errors not in Sentry
**Check:**
- SENTRY_DSN environment variable is set
- Sentry initialization log appears on startup
- Check Sentry dashboard for errors
- Verify network connectivity to Sentry

### Issue: Log files too large
**Check:**
- Log rotation is working (check for daily files)
- Old files are being compressed/deleted
- Adjust maxSize in logger.js if needed

## Next Steps

After completing Day 1 testing:
1. Complete remaining console statement replacements
2. Re-run all tests to verify no regressions
3. Document any issues found
4. Proceed to Day 2: Security Hardening

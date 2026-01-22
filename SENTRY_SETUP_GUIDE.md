# Sentry Setup Guide

Sentry is already integrated into the Costra application. You just need to configure it with your DSN (Data Source Name).

## 📋 Prerequisites

- A Sentry account (free tier available at [sentry.io](https://sentry.io))
- Access to your server's `.env` file

## 🚀 Step-by-Step Setup

### Step 1: Create a Sentry Account (if you don't have one)

1. Go to [https://sentry.io/signup/](https://sentry.io/signup/)
2. Sign up with your email or GitHub/Google account
3. Choose the **Developer** plan (free tier) - perfect for getting started

### Step 2: Create a New Project

1. After signing up, you'll be prompted to create a project
2. Select **Node.js** as your platform
3. Give your project a name (e.g., "Costra" or "Costra Production")
4. Click **Create Project**

### Step 3: Get Your DSN

1. After creating the project, Sentry will show you a setup page
2. Look for the **DSN** (Data Source Name) - it looks like:
   ```
   https://xxxxx@xxxxx.ingest.sentry.io/xxxxx
   ```
3. **Copy this DSN** - you'll need it in the next step

   > 💡 **Tip**: You can also find your DSN later by going to:
   > **Settings** → **Projects** → **[Your Project]** → **Client Keys (DSN)**

### Step 4: Add DSN to Your Environment Variables

1. Navigate to your server directory:
   ```bash
   cd server
   ```

2. Open or create the `.env` file:
   ```bash
   nano .env
   # or
   vim .env
   ```

3. Add your Sentry DSN. Your `.env` file should include:
   ```env
   # Required
   JWT_SECRET=your-secret-key-change-this-in-production
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/costra
   
   # Optional - Server defaults
   PORT=3001
   NODE_ENV=development
   FRONTEND_URL=http://localhost:5173
   
   # Sentry Error Tracking (add this line)
   SENTRY_DSN=https://xxxxx@xxxxx.ingest.sentry.io/xxxxx
   ```

4. Save the file (Ctrl+X, then Y, then Enter for nano)

   > 💡 **Note**: If you don't have a `.env` file yet, create one with at minimum:
   > - `JWT_SECRET` (required)
   > - `DATABASE_URL` (required)
   > - `SENTRY_DSN` (optional, for error tracking)

### Step 5: Restart Your Server

Restart your server to load the new environment variable:

```bash
# If using PM2
pm2 restart costra-backend

# If running directly
# Stop the server (Ctrl+C) and restart:
npm start
# or
npm run dev
```

### Step 6: Verify Sentry is Working

1. **Check server logs** - You should see:
   ```
   Sentry initialized { dsn: 'https://xxxxx@xxxxx...' }
   ```

2. **Test error tracking** - You can trigger a test error:
   ```bash
   # Add a test endpoint temporarily to server.js:
   app.get('/api/test-sentry', (req, res) => {
     throw new Error('Test Sentry error!')
   })
   ```
   Then visit `http://localhost:3001/api/test-sentry` in your browser

3. **Check Sentry Dashboard**:
   - Go to [https://sentry.io](https://sentry.io)
   - Navigate to your project
   - You should see the test error appear within a few seconds

## ⚙️ Configuration Options

The current Sentry configuration in `server/server.js` includes:

```javascript
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  integrations: [
    new Sentry.Integrations.Http({ tracing: true }),
  ],
})
```

### Available Environment Variables

You can customize Sentry behavior by adding these to your `.env`:

```env
# Required
SENTRY_DSN=https://xxxxx@xxxxx.ingest.sentry.io/xxxxx

# Optional - Override environment (defaults to NODE_ENV)
SENTRY_ENVIRONMENT=production

# Optional - Adjust trace sampling (0.0 to 1.0)
# Production: 0.1 (10% of transactions)
# Development: 1.0 (100% of transactions)
SENTRY_TRACES_SAMPLE_RATE=0.1
```

## 📊 What Sentry Tracks

With the current setup, Sentry automatically tracks:

✅ **Unhandled exceptions** - All errors caught by the error handler  
✅ **Request context** - URL, method, headers, user info  
✅ **User context** - User ID from JWT token  
✅ **Request IDs** - For tracing errors across logs  
✅ **Stack traces** - Full error stack traces  
✅ **Performance traces** - HTTP request timing (if enabled)

## 🔍 Viewing Errors in Sentry

1. **Go to your Sentry dashboard**: [https://sentry.io](https://sentry.io)
2. **Select your project**
3. **View Issues** - See all errors grouped by type
4. **Click an issue** - See:
   - Error message and stack trace
   - Request details (URL, method, headers)
   - User information
   - Request ID (for log correlation)
   - Environment (development/production)
   - Timestamp

## 🎯 Best Practices

1. **Use different projects for different environments**:
   - Create separate Sentry projects for `development`, `staging`, and `production`
   - Use different DSNs in each environment's `.env` file

2. **Set up alerts** (optional):
   - In Sentry dashboard: **Settings** → **Alerts**
   - Configure email/Slack notifications for critical errors

3. **Filter out noise**:
   - Ignore known errors (e.g., 404s for favicon)
   - Set up release tracking for better error grouping

4. **Monitor performance**:
   - Sentry tracks slow transactions automatically
   - Review performance tab to find bottlenecks

## 🐛 Troubleshooting

### Issue: "Sentry DSN not provided" warning

**Solution**: Make sure `SENTRY_DSN` is set in your `.env` file and the server was restarted.

### Issue: Errors not appearing in Sentry

**Checklist**:
- ✅ `SENTRY_DSN` is set correctly in `.env`
- ✅ Server was restarted after adding DSN
- ✅ You see "Sentry initialized" in server logs
- ✅ Network connectivity to Sentry (check firewall)
- ✅ DSN is correct (no typos)

### Issue: Too many errors / Noise

**Solution**: 
- Filter errors in Sentry dashboard
- Adjust `tracesSampleRate` to reduce volume
- Use Sentry's "Ignore" feature for known issues

### Issue: Sensitive data in Sentry

**Solution**: 
- Configure data scrubbing in Sentry settings
- Add `beforeSend` hook to filter sensitive data:
  ```javascript
  Sentry.init({
    // ... other config
    beforeSend(event, hint) {
      // Remove sensitive data
      if (event.request) {
        delete event.request.cookies
        // Remove sensitive headers
        if (event.request.headers) {
          delete event.request.headers['authorization']
        }
      }
      return event
    },
  })
  ```

## 📚 Additional Resources

- [Sentry Node.js Documentation](https://docs.sentry.io/platforms/javascript/guides/node/)
- [Sentry Best Practices](https://docs.sentry.io/product/best-practices/)
- [Sentry Pricing](https://sentry.io/pricing/) - Free tier includes 5,000 events/month

## ✅ Verification Checklist

- [ ] Sentry account created
- [ ] Project created (Node.js platform)
- [ ] DSN copied
- [ ] `SENTRY_DSN` added to `server/.env`
- [ ] Server restarted
- [ ] "Sentry initialized" appears in logs
- [ ] Test error sent to Sentry
- [ ] Error visible in Sentry dashboard

---

**Need help?** Check the Sentry dashboard or review the server logs for initialization messages.

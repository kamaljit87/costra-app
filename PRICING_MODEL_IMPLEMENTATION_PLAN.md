# Pricing Model Implementation Plan

## 📋 Overview

This document outlines the plan to adapt Costra for the 7-day trial + 2-tier subscription model (Starter ₹850/$10, Pro ₹1,999/$24).

---

## 🎯 Pricing Tiers Summary

### 🟢 7-Day Free Trial
- **Price**: ₹0 / $0 for 7 days
- **Features**: Full access to verify accuracy
- **Restrictions**: Export disabled (optional), no credit card required initially

### 🔵 Starter Plan
- **Price**: ₹850/month or $10/month
- **Target**: Indie founders, small startups, casual DevOps
- **History**: Up to 6 months

### 🟣 Pro Plan
- **Price**: ₹1,999/month or $24/month
- **Target**: Active FinOps teams
- **History**: 12+ months

---

## ✅ Feature Mapping: Existing vs Required

### Features Already Implemented

| Feature | Trial | Starter | Pro | Status |
|---------|-------|---------|-----|--------|
| Connect all cloud providers | ✅ | ✅ | ✅ | ✅ Implemented |
| Correct credit handling | ✅ | ✅ | ✅ | ✅ Implemented |
| Cost vs usage | ✅ | ✅ | ✅ | ✅ Implemented |
| "What changed & why" (Cost Summary) | ✅ | ✅ | ✅ | ✅ Implemented |
| Untagged resources | ✅ | ✅ | ✅ | ✅ Implemented |
| Anomaly detection | ✅ | ✅ | ✅ | ✅ Implemented |
| Auto-sync (manual) | ✅ | ✅ | ✅ | ✅ Implemented |
| Custom date ranges | ✅ | ✅ | ✅ | ✅ Implemented |
| Monthly summaries | ✅ | ✅ | ✅ | ✅ Implemented (Cost Summary) |
| Unit economics | ✅ | ❌ | ✅ | ✅ Implemented (needs gating) |
| CSV exports | ❌ | ❌ | ✅ | ✅ Implemented (needs gating) |
| Historical data (12 months) | ✅ | ❌ | ✅ | ✅ Implemented (needs limiting) |
| Historical data (6 months) | ❌ | ✅ | ❌ | ✅ Implemented (needs limiting) |

### Features Missing / Needs Implementation

| Feature | Trial | Starter | Pro | Status |
|---------|-------|---------|-----|--------|
| **Subscription/Billing System** | ❌ | ❌ | ❌ | ❌ **MISSING** |
| **Trial period tracking** | ❌ | ❌ | ❌ | ❌ **MISSING** |
| **Feature gating middleware** | ❌ | ❌ | ❌ | ❌ **MISSING** |
| **Historical data limits** | ❌ | ❌ | ❌ | ❌ **MISSING** |
| **Email alerts** | ❌ | ❌ | ✅ | ⚠️ **PARTIAL** (in-app only) |
| **Scheduled auto-sync (daily)** | ❌ | ✅ | ✅ | ❌ **MISSING** |
| **Trial banner** | ❌ | ❌ | ❌ | ❌ **MISSING** |
| **Export restrictions** | ❌ | ❌ | ❌ | ❌ **MISSING** |

---

## 🏗️ Implementation Plan

### Phase 1: Database Schema & Subscription Management

#### 1.1 Database Schema Updates

**New Tables:**

```sql
-- Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE,
  plan_type TEXT NOT NULL CHECK (plan_type IN ('trial', 'starter', 'pro')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'past_due')),
  trial_start_date TIMESTAMP,
  trial_end_date TIMESTAMP,
  subscription_start_date TIMESTAMP,
  subscription_end_date TIMESTAMP,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  stripe_price_id TEXT,
  currency TEXT DEFAULT 'USD',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_trial_end ON subscriptions(trial_end_date);

-- Subscription usage tracking (for analytics)
CREATE TABLE IF NOT EXISTS subscription_usage (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  feature_name TEXT NOT NULL,
  usage_count INTEGER DEFAULT 1,
  usage_date DATE NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_subscription_usage_user_date ON subscription_usage(user_id, usage_date);
```

**Migration Script:**
- Add `subscription_id` to `users` table (optional, for easier queries)
- Set all existing users to `trial` plan with 7-day trial period
- Create subscription records for existing users

#### 1.2 Subscription Service

**File**: `server/services/subscriptionService.js`

**Functions:**
- `getUserSubscription(userId)` - Get current subscription
- `createTrialSubscription(userId)` - Create 7-day trial
- `upgradeSubscription(userId, planType, stripeData)` - Upgrade to paid plan
- `cancelSubscription(userId)` - Cancel subscription
- `checkTrialExpiry()` - Check and expire trials (cron job)
- `getSubscriptionFeatures(userId)` - Get available features for user
- `canAccessFeature(userId, featureName)` - Check feature access
- `getHistoricalDataLimit(userId)` - Get months of history allowed

**Feature Definitions:**
```javascript
const FEATURE_DEFINITIONS = {
  // Trial features
  trial: {
    historicalDataMonths: 12,
    features: [
      'connect_providers',
      'cost_vs_usage',
      'cost_summary',
      'untagged_resources',
      'anomaly_detection',
      'auto_sync',
      'custom_date_ranges',
      'monthly_summaries',
    ],
    restrictedFeatures: ['csv_export', 'email_alerts', 'scheduled_sync'],
  },
  // Starter features
  starter: {
    historicalDataMonths: 6,
    features: [
      'connect_providers',
      'cost_vs_usage',
      'cost_summary',
      'untagged_resources',
      'anomaly_detection',
      'auto_sync',
      'custom_date_ranges',
      'monthly_summaries',
      'scheduled_sync',
    ],
    restrictedFeatures: ['csv_export', 'email_alerts', 'unit_economics'],
  },
  // Pro features
  pro: {
    historicalDataMonths: 12,
    features: [
      'connect_providers',
      'cost_vs_usage',
      'cost_summary',
      'untagged_resources',
      'anomaly_detection',
      'auto_sync',
      'custom_date_ranges',
      'monthly_summaries',
      'scheduled_sync',
      'csv_export',
      'email_alerts',
      'unit_economics',
    ],
    restrictedFeatures: [],
  },
}
```

---

### Phase 2: Stripe Integration

#### 2.1 Stripe Setup

**Dependencies:**
```bash
npm install stripe
```

**Environment Variables:**
```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_STARTER_PRICE_ID=price_...  # ₹850/month
STRIPE_PRO_PRICE_ID=price_...      # ₹1,999/month
```

#### 2.2 Stripe Service

**File**: `server/services/stripeService.js`

**Functions:**
- `createCustomer(userId, email, name)` - Create Stripe customer
- `createCheckoutSession(userId, planType)` - Create checkout session
- `createPortalSession(userId)` - Create customer portal session
- `handleWebhook(event)` - Handle Stripe webhooks
- `cancelSubscription(stripeSubscriptionId)` - Cancel subscription
- `updateSubscription(stripeSubscriptionId, newPlanType)` - Upgrade/downgrade

#### 2.3 Webhook Endpoints

**File**: `server/routes/billing.js`

**Endpoints:**
- `POST /api/billing/create-checkout-session` - Create checkout
- `POST /api/billing/create-portal-session` - Customer portal
- `POST /api/billing/webhook` - Stripe webhook handler
- `GET /api/billing/subscription` - Get current subscription
- `POST /api/billing/cancel` - Cancel subscription

**Webhook Events to Handle:**
- `checkout.session.completed` - Subscription created
- `customer.subscription.updated` - Subscription updated
- `customer.subscription.deleted` - Subscription cancelled
- `invoice.payment_succeeded` - Payment succeeded
- `invoice.payment_failed` - Payment failed

---

### Phase 3: Feature Gating Middleware

#### 3.1 Feature Gate Middleware

**File**: `server/middleware/featureGate.js`

```javascript
import { canAccessFeature, getHistoricalDataLimit } from '../services/subscriptionService.js'

export const requireFeature = (featureName) => {
  return async (req, res, next) => {
    const userId = req.user.userId
    
    const hasAccess = await canAccessFeature(userId, featureName)
    
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Feature not available',
        message: `This feature requires a ${getRequiredPlan(featureName)} subscription`,
        feature: featureName,
        upgradeUrl: '/settings/billing',
      })
    }
    
    next()
  }
}

export const limitHistoricalData = async (req, res, next) => {
  const userId = req.user.userId
  const monthsLimit = await getHistoricalDataLimit(userId)
  
  // Attach limit to request for use in routes
  req.subscriptionDataLimit = monthsLimit
  
  next()
}
```

#### 3.2 Apply Feature Gates

**Routes to Update:**

1. **CSV Export** (`server/routes/costData.js`):
   ```javascript
   router.post('/:providerId/report', 
     authenticateToken,
     requireFeature('csv_export'), // Only for Pro
     async (req, res) => { ... }
   )
   ```

2. **Unit Economics** (`server/routes/insights.js`):
   ```javascript
   router.get('/unit-economics',
     authenticateToken,
     requireFeature('unit_economics'), // Only for Pro
     async (req, res) => { ... }
   )
   ```

3. **Historical Data** (All cost data routes):
   ```javascript
   router.get('/daily',
     authenticateToken,
     limitHistoricalData, // Apply months limit
     async (req, res) => {
       const monthsLimit = req.subscriptionDataLimit
       // Filter data to only return last N months
     }
   )
   ```

4. **Email Alerts** (`server/routes/notifications.js`):
   ```javascript
   router.post('/email',
     authenticateToken,
     requireFeature('email_alerts'), // Only for Pro
     async (req, res) => { ... }
   )
   ```

---

### Phase 4: Historical Data Limiting

#### 4.1 Update Database Queries

**File**: `server/database.js`

**Functions to Update:**
- `getDailyCostData()` - Add date range limit based on subscription
- `getCostDataForUser()` - Filter by subscription limit
- `getServiceCostsForDateRange()` - Apply date limit

**Implementation:**
```javascript
export const getDailyCostData = async (userId, providerId, startDate, endDate, accountId = null, monthsLimit = null) => {
  // If monthsLimit is provided, ensure we don't fetch beyond that
  if (monthsLimit) {
    const limitDate = new Date()
    limitDate.setMonth(limitDate.getMonth() - monthsLimit)
    const limitDateStr = limitDate.toISOString().split('T')[0]
    
    // Adjust startDate if it's before the limit
    if (startDate < limitDateStr) {
      startDate = limitDateStr
    }
  }
  
  // ... rest of query
}
```

#### 4.2 Frontend Date Range Restrictions

**File**: `src/services/costService.ts`

**Update:**
- Limit date picker options based on subscription
- Show warning when trying to select beyond limit
- Disable period options (e.g., "12 months" for Starter)

---

### Phase 5: Email Alerts (Pro Only)

#### 5.1 Email Service

**Dependencies:**
```bash
npm install nodemailer
# OR
npm install @sendgrid/mail
```

**File**: `server/services/emailService.js`

**Functions:**
- `sendEmail(to, subject, html, text)` - Send email
- `sendAnomalyAlert(userId, anomalyData)` - Send anomaly alert
- `sendBudgetAlert(userId, budgetData)` - Send budget alert
- `sendWeeklySummary(userId, summaryData)` - Send weekly summary

#### 5.2 Email Alert Routes

**File**: `server/routes/notifications.js`

**New Endpoints:**
- `POST /api/notifications/email/preferences` - Set email preferences
- `GET /api/notifications/email/preferences` - Get email preferences
- `POST /api/notifications/email/test` - Send test email

#### 5.3 Integrate with Existing Alerts

**Update:**
- `server/routes/sync.js` - Send email on anomaly detection (Pro only)
- `server/database.js` - `updateBudgetSpend()` - Send email on budget alerts (Pro only)

---

### Phase 6: Scheduled Auto-Sync (Starter & Pro)

#### 6.1 Cron Job Service

**Dependencies:**
```bash
npm install node-cron
```

**File**: `server/services/syncScheduler.js`

**Functions:**
- `scheduleDailySync(userId, accountIds)` - Schedule daily sync
- `cancelScheduledSync(userId)` - Cancel scheduled sync
- `runScheduledSyncs()` - Run all scheduled syncs (cron job)

#### 6.2 Cron Job Setup

**File**: `server/server.js`

```javascript
import cron from 'node-cron'
import { runScheduledSyncs } from './services/syncScheduler.js'

// Run daily syncs at 2 AM UTC
cron.schedule('0 2 * * *', async () => {
  logger.info('Running scheduled daily syncs')
  await runScheduledSyncs()
})
```

#### 6.3 Sync Preferences

**Database:**
```sql
ALTER TABLE cloud_provider_credentials
ADD COLUMN auto_sync_enabled BOOLEAN DEFAULT false,
ADD COLUMN auto_sync_time TIME DEFAULT '02:00:00';
```

**Routes:**
- `PUT /api/sync/preferences` - Update auto-sync preferences
- `GET /api/sync/preferences` - Get auto-sync preferences

---

### Phase 7: Trial Management & UI

#### 7.1 Trial Banner Component

**File**: `src/components/TrialBanner.tsx`

**Features:**
- Show "Trial ends in X days" banner
- Link to upgrade page
- Auto-hide when trial expires or user upgrades
- Show upgrade CTA button

#### 7.2 Subscription Status Component

**File**: `src/components/SubscriptionStatus.tsx`

**Features:**
- Show current plan (Trial/Starter/Pro)
- Show days remaining (for trial)
- Show next billing date (for paid plans)
- Link to billing settings

#### 7.3 Billing Settings Page

**File**: `src/pages/BillingPage.tsx`

**Features:**
- Current plan display
- Upgrade/downgrade options
- Payment method management (via Stripe portal)
- Billing history
- Cancel subscription option

#### 7.4 Feature Restriction UI

**Update Components:**
- Show upgrade prompts when feature is restricted
- Disable export buttons for non-Pro users
- Show "Pro feature" badges
- Limit date range pickers based on plan

**Example:**
```tsx
{subscription.plan === 'pro' ? (
  <ExportButton />
) : (
  <UpgradePrompt feature="CSV Export" plan="Pro" />
)}
```

---

### Phase 8: User Onboarding

#### 8.1 Trial Creation on Signup

**File**: `server/routes/auth.js`

**Update `POST /api/auth/signup`:**
```javascript
// After user creation
await createTrialSubscription(newUser.id)
```

#### 8.2 Welcome Email

**File**: `server/services/emailService.js`

**Function:**
- `sendWelcomeEmail(userId)` - Send welcome email with trial info

---

## 🔍 Feature Status Check

### ✅ Fully Implemented Features

1. **Connect all cloud providers** ✅
   - Location: `server/routes/cloudProviders.js`
   - Status: Complete

2. **Correct credit handling** ✅
   - Location: `server/services/cloudProviderIntegrations.js`
   - Status: Complete

3. **Cost vs usage** ✅
   - Location: `server/routes/insights.js` → `/api/insights/cost-vs-usage`
   - Status: Complete

4. **"What changed & why" (Cost Summary)** ✅
   - Location: `server/database.js` → `generateCostExplanation()`
   - Location: `src/components/CostSummary.tsx`
   - Status: Complete

5. **Untagged resources** ✅
   - Location: `server/routes/insights.js` → `/api/insights/untagged-resources`
   - Status: Complete

6. **Anomaly detection** ✅
   - Location: `server/database.js` → `getAnomalies()`
   - Location: `src/components/AnomalyDetection.tsx`
   - Status: Complete

7. **Auto-sync (manual)** ✅
   - Location: `server/routes/sync.js` → `POST /api/sync`
   - Status: Complete (manual only, scheduled missing)

8. **Custom date ranges** ✅
   - Location: All cost data routes support `startDate`/`endDate`
   - Status: Complete

9. **Monthly summaries** ✅
   - Location: `server/database.js` → `generateCostExplanation()` (monthly)
   - Location: `src/components/CostSummary.tsx`
   - Status: Complete

10. **Unit economics** ✅
    - Location: `server/routes/insights.js` → `/api/insights/unit-economics`
    - Location: `src/components/UnitEconomics.tsx`
    - Status: Complete (needs Pro-only gating)

11. **CSV exports** ✅
    - Location: `server/utils/reportGenerator.js` → `generateCSVReport()`
    - Location: `server/routes/costData.js` → `POST /api/cost-data/:providerId/report`
    - Status: Complete (needs Pro-only gating)

12. **Historical data (12 months)** ✅
    - Location: `server/database.js` → `getDailyCostData()`
    - Status: Complete (needs subscription-based limiting)

### ⚠️ Partially Implemented Features

1. **Email alerts** ⚠️
   - Status: In-app notifications exist, email sending missing
   - Location: `server/routes/notifications.js` (in-app only)
   - Needs: Email service integration

### ❌ Missing Features

1. **Subscription/Billing System** ❌
   - Status: Not implemented
   - Needs: Stripe integration, subscription management

2. **Trial period tracking** ❌
   - Status: Not implemented
   - Needs: Database schema, trial creation on signup

3. **Feature gating middleware** ❌
   - Status: Not implemented
   - Needs: Middleware to check subscription before feature access

4. **Historical data limits** ❌
   - Status: Not implemented
   - Needs: Date range filtering based on subscription

5. **Scheduled auto-sync (daily)** ❌
   - Status: Manual sync exists, scheduled missing
   - Needs: Cron job, sync scheduler service

6. **Trial banner** ❌
   - Status: Not implemented
   - Needs: React component, subscription status check

7. **Export restrictions** ❌
   - Status: Export exists but not restricted
   - Needs: Feature gate on export routes

---

## 📝 Implementation Checklist

### Phase 1: Foundation (Week 1)
- [ ] Create database schema for subscriptions
- [ ] Create subscription service
- [ ] Create trial subscription on user signup
- [ ] Add subscription status endpoint
- [ ] Create feature definitions

### Phase 2: Stripe Integration (Week 1-2)
- [ ] Install Stripe SDK
- [ ] Create Stripe service
- [ ] Create checkout session endpoint
- [ ] Create customer portal endpoint
- [ ] Implement webhook handler
- [ ] Test subscription flow

### Phase 3: Feature Gating (Week 2)
- [ ] Create feature gate middleware
- [ ] Apply gates to CSV export
- [ ] Apply gates to unit economics
- [ ] Apply gates to email alerts
- [ ] Apply historical data limits
- [ ] Test feature restrictions

### Phase 4: Historical Data Limiting (Week 2)
- [ ] Update database queries with date limits
- [ ] Update frontend date pickers
- [ ] Add limit warnings in UI
- [ ] Test data limiting for each plan

### Phase 5: Email Alerts (Week 3)
- [ ] Install email service (SendGrid/Nodemailer)
- [ ] Create email service
- [ ] Integrate with anomaly detection
- [ ] Integrate with budget alerts
- [ ] Add email preferences
- [ ] Test email sending

### Phase 6: Scheduled Sync (Week 3)
- [ ] Install node-cron
- [ ] Create sync scheduler service
- [ ] Add auto-sync preferences to database
- [ ] Create cron job for daily syncs
- [ ] Add UI for sync preferences
- [ ] Test scheduled syncs

### Phase 7: UI Components (Week 3-4)
- [ ] Create trial banner component
- [ ] Create subscription status component
- [ ] Create billing settings page
- [ ] Add upgrade prompts to restricted features
- [ ] Update navigation with subscription info
- [ ] Test UI flows

### Phase 8: Testing & Polish (Week 4)
- [ ] Test trial → Starter upgrade
- [ ] Test Starter → Pro upgrade
- [ ] Test subscription cancellation
- [ ] Test feature restrictions
- [ ] Test historical data limits
- [ ] Test email alerts
- [ ] Test scheduled syncs
- [ ] Update documentation

---

## 🎨 UI/UX Considerations

### Trial Banner
- **Location**: Top of dashboard, below navigation
- **Design**: Yellow/orange banner with countdown
- **Content**: "Your trial ends in X days. Upgrade to continue."
- **Action**: "Upgrade Now" button → Billing page

### Feature Upgrade Prompts
- **Design**: Modal or inline banner
- **Content**: "This feature is available in [Plan]. Upgrade to unlock."
- **Action**: "Upgrade to [Plan]" button

### Billing Page
- **Sections**:
  1. Current Plan (card with plan details)
  2. Available Plans (comparison table)
  3. Payment Method (via Stripe portal)
  4. Billing History
  5. Cancel Subscription

### Subscription Status in Navigation
- **Location**: User menu dropdown
- **Content**: Plan name + days remaining (trial) or next billing date (paid)

---

## 🔒 Security Considerations

1. **Webhook Verification**: Always verify Stripe webhook signatures
2. **Subscription Validation**: Validate subscription status on every feature access
3. **Trial Abuse Prevention**: 
   - Limit trial to one per email/IP
   - Require email verification for trial
4. **Payment Security**: Never store credit card info (use Stripe)
5. **Feature Bypass Prevention**: Validate subscription on backend, not just frontend

---

## 📊 Analytics & Tracking

### Metrics to Track
- Trial signups
- Trial → Paid conversion rate
- Starter → Pro upgrade rate
- Feature usage by plan
- Churn rate
- Average revenue per user (ARPU)

### Database Tables
- `subscription_usage` - Track feature usage
- Add analytics events for subscription events

---

## 🚀 Deployment Checklist

### Environment Variables
```env
# Stripe
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_STARTER_PRICE_ID=
STRIPE_PRO_PRICE_ID=

# Email (for Pro alerts)
SENDGRID_API_KEY=  # OR
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
```

### Database Migrations
- Run subscription schema migration
- Migrate existing users to trial
- Set up indexes

### Stripe Setup
- Create products in Stripe dashboard
- Create price IDs for Starter and Pro
- Set up webhook endpoint
- Test webhook locally with Stripe CLI

### Cron Jobs
- Set up cron job for daily syncs (or use process manager like PM2)
- Set up cron job for trial expiry checks

---

## 📚 Documentation Updates

1. **API Documentation**: Update Swagger with subscription endpoints
2. **User Guide**: Add billing and subscription info
3. **Developer Guide**: Document feature gating system
4. **Pricing Page**: Update landing page with pricing tiers

---

## 🎯 Success Metrics

### Week 1
- [ ] Subscription system functional
- [ ] Trial creation working
- [ ] Stripe integration complete

### Week 2
- [ ] Feature gating implemented
- [ ] Historical data limits working
- [ ] Export restrictions in place

### Week 3
- [ ] Email alerts functional
- [ ] Scheduled syncs working
- [ ] UI components complete

### Week 4
- [ ] All features tested
- [ ] Documentation updated
- [ ] Ready for production

---

## 🔄 Future Enhancements

1. **Annual Plans**: Add annual billing option (discount)
2. **Team Plans**: Multi-user subscriptions
3. **Usage-Based Pricing**: Pay per cloud account
4. **Enterprise Plans**: Custom pricing for large teams
5. **Referral Program**: Discounts for referrals
6. **Promo Codes**: Support for discount codes

---

*Last Updated: 2025-01-XX*

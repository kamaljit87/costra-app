# Pending Features Summary

## ✅ Features Already Implemented

All core features required by the pricing model are **already implemented**:

1. ✅ Connect all cloud providers
2. ✅ Full historical data (up to 12 months)
3. ✅ Correct credit handling
4. ✅ Cost vs usage
5. ✅ "What changed & why" (Cost Summary/Explanations)
6. ✅ Untagged resources
7. ✅ Anomaly detection
8. ✅ Auto-sync (manual)
9. ✅ Custom date ranges
10. ✅ Monthly summaries
11. ✅ Unit economics
12. ✅ CSV exports

## ❌ Missing Infrastructure (Not Features)

The following are **infrastructure components** needed to implement the pricing model:

### 1. Subscription & Billing System
- **Status**: ❌ Not implemented
- **Priority**: 🔴 Critical
- **What's needed**:
  - Database schema for subscriptions
  - Stripe integration
  - Subscription management service
  - Webhook handlers

### 2. Feature Gating
- **Status**: ❌ Not implemented
- **Priority**: 🔴 Critical
- **What's needed**:
  - Middleware to check subscription before feature access
  - Restrict CSV export to Pro only
  - Restrict unit economics to Pro only
  - Restrict email alerts to Pro only

### 3. Historical Data Limits
- **Status**: ❌ Not implemented
- **Priority**: 🔴 Critical
- **What's needed**:
  - Limit Starter to 6 months history
  - Limit Trial/Pro to 12 months history
  - Update date pickers in UI

### 4. Email Alerts (Pro Only)
- **Status**: ⚠️ Partially implemented
- **Priority**: 🟡 Medium
- **What's needed**:
  - Email service integration (SendGrid/Nodemailer)
  - Send emails for anomalies (currently in-app only)
  - Send emails for budget alerts (currently in-app only)

### 5. Scheduled Auto-Sync (Starter & Pro)
- **Status**: ❌ Not implemented
- **Priority**: 🟡 Medium
- **What's needed**:
  - Cron job for daily syncs
  - Sync scheduler service
  - UI for sync preferences

### 6. Trial Management
- **Status**: ❌ Not implemented
- **Priority**: 🟡 Medium
- **What's needed**:
  - Trial creation on signup
  - Trial expiry tracking
  - Trial banner component

### 7. Export Restrictions
- **Status**: ❌ Not implemented
- **Priority**: 🟡 Medium
- **What's needed**:
  - Disable CSV export for Trial/Starter
  - Show upgrade prompt when export attempted

## 📊 Feature Status by Pricing Tier

### 🟢 Trial (7 Days)
| Feature | Status | Notes |
|---------|--------|-------|
| All core features | ✅ | Full access during trial |
| CSV Export | ❌ | Disabled (needs implementation) |
| Email Alerts | ❌ | Disabled (needs implementation) |
| Scheduled Sync | ❌ | Disabled (needs implementation) |
| Unit Economics | ✅ | Available (needs Pro-only gating) |

### 🔵 Starter (₹850/$10)
| Feature | Status | Notes |
|---------|--------|-------|
| All core features | ✅ | Full access |
| 6 months history | ❌ | Needs limiting (currently 12 months) |
| CSV Export | ❌ | Disabled (needs Pro-only gating) |
| Email Alerts | ❌ | Disabled (needs Pro-only gating) |
| Scheduled Sync | ❌ | Needs implementation |
| Unit Economics | ❌ | Disabled (needs Pro-only gating) |

### 🟣 Pro (₹1,999/$24)
| Feature | Status | Notes |
|---------|--------|-------|
| All features | ✅ | Full access |
| 12+ months history | ✅ | Already available |
| CSV Export | ✅ | Available (needs Pro-only gating) |
| Email Alerts | ⚠️ | Partially (needs email service) |
| Scheduled Sync | ❌ | Needs implementation |
| Unit Economics | ✅ | Available (needs Pro-only gating) |

## 🎯 Implementation Priority

### Phase 1: Critical (Week 1)
1. Subscription & Billing System
2. Feature Gating
3. Historical Data Limits

### Phase 2: Important (Week 2-3)
4. Email Alerts
5. Scheduled Auto-Sync
6. Trial Management

### Phase 3: Polish (Week 4)
7. Export Restrictions
8. UI Components (banners, upgrade prompts)
9. Testing & Documentation

## 📝 Quick Reference

**All features exist** - we just need to:
1. Add subscription management
2. Gate features based on plan
3. Limit historical data by plan
4. Add email service for Pro alerts
5. Add scheduled syncs for Starter/Pro

**No new feature development needed** - only infrastructure and gating.

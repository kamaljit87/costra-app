# Amazon SES Integration Plan for Costra

## Overview

This document outlines how to integrate Amazon SES (Simple Email Service) into the Costra app, what emails will be sent, and the verification/approval flows for account deletion and other sensitive actions.

---

## 1. SES Setup & Configuration

### 1.1 AWS Prerequisites

1. **Create an SES identity** (verified domain or email address) in the AWS Console.
2. **Request production access** — new SES accounts start in sandbox mode (can only send to verified addresses). Submit a request to move out of sandbox.
3. **Create IAM credentials** — an IAM user or role with `ses:SendEmail` and `ses:SendRawEmail` permissions.
4. **Set up a MAIL FROM domain** (optional but recommended for deliverability).
5. **Configure SPF, DKIM, and DMARC** DNS records for the sending domain (e.g., `costra.dev`).

### 1.2 Environment Variables

Add to the backend `.env` / Docker environment:

```env
# Amazon SES
AWS_SES_REGION=us-east-1
AWS_SES_ACCESS_KEY_ID=AKIA...
AWS_SES_SECRET_ACCESS_KEY=...
SES_FROM_EMAIL=noreply@costra.dev
SES_FROM_NAME=Costra
```

### 1.3 Integration into emailService.js

The existing email service (`server/services/emailService.js`) already supports SendGrid and SMTP as transports. Add SES as a third transport option with highest priority:

```
Priority order:
1. Amazon SES  (AWS_SES_ACCESS_KEY_ID set)
2. SendGrid    (SENDGRID_API_KEY set)
3. SMTP        (SMTP_HOST set)
4. None        (log warning)
```

**Implementation approach:**

- Use the `@aws-sdk/client-ses` package (v3) or `nodemailer` with `nodemailer-ses-transport`.
- Wrap SES in the same `sendEmail(userId, { to, subject, html, text })` interface already used.
- Add retry logic with exponential backoff for SES throttling (SES has per-second send limits).
- Track bounce and complaint notifications via SES → SNS → webhook endpoint.

### 1.4 Bounce & Complaint Handling

Set up an SNS topic for SES feedback notifications:

1. Create SNS topics: `ses-bounces`, `ses-complaints`
2. Subscribe an HTTPS endpoint: `POST /api/ses/notifications`
3. On **hard bounce** → mark the email address as undeliverable in the database
4. On **complaint** → auto-unsubscribe the user from non-essential emails

---

## 2. Emails That Will Be Sent

### 2.1 Authentication & Security Emails

| Email | Trigger | Current Status | Priority |
|-------|---------|----------------|----------|
| **Email Verification** | User signs up | Not implemented | High |
| **Password Reset** | User clicks "Forgot Password" | Endpoint exists, no email sent | High |
| **Password Changed** | User changes password in settings | Notification created, no email | Medium |
| **Login from New Device/IP** | Suspicious login detected | Not implemented | Medium |
| **2FA Enabled/Disabled** | User toggles 2FA | Not implemented | Medium |

### 2.2 Account Management Emails

| Email | Trigger | Current Status | Priority |
|-------|---------|----------------|----------|
| **Account Deletion Request** | User requests account deletion via compliance endpoint | DB record created, no email | High |
| **Account Deletion Confirmation** | User confirms deletion (after email approval) | Endpoint exists, no email verification | High |
| **Account Deleted** | Account successfully deleted | Not implemented | Medium |
| **Profile Email Changed** | User updates email address | Not implemented | High |
| **Email Change Verification** | Verify new email before applying change | Not implemented | High |

### 2.3 Subscription & Billing Emails

| Email | Trigger | Priority |
|-------|---------|----------|
| **Welcome / Trial Started** | New signup (7-day free trial begins) | Medium |
| **Trial Expiring (3 days)** | 3 days before trial ends | Medium |
| **Trial Expired** | Trial period ended | Medium |
| **Subscription Upgraded** | User upgrades to Pro | Low |
| **Subscription Cancelled** | User cancels subscription | Low |

### 2.4 Product & Alert Emails (Pro Users Only)

| Email | Trigger | Current Status | Priority |
|-------|---------|----------------|----------|
| **Anomaly Alert** | Cost anomaly detected | `sendAnomalyAlert()` exists | Already built |
| **Budget Alert** | Budget threshold exceeded | `sendBudgetAlert()` exists | Already built |
| **Weekly Summary** | Scheduled (weekly cron) | Preference exists, not sent | Medium |

---

## 3. Email Verification Flow (Signup)

### Flow

```
User signs up
    │
    ▼
Account created with `email_verified = false`
    │
    ▼
SES sends verification email with a signed token link
    │
    ▼
User clicks link: GET /api/auth/verify-email?token=xxx
    │
    ▼
Backend verifies token (valid, not expired, matches user)
    │
    ▼
Set `email_verified = true`, redirect to app with success message
```

### Implementation Details

- **Token**: JWT with `{ userId, email, purpose: 'email_verification' }`, 24-hour expiry.
- **Link format**: `https://costra.dev/verify-email?token=<jwt>`
- **Database change**: Add `email_verified BOOLEAN DEFAULT false` column to `users` table.
- **Access restriction**: Unverified users can log in but see a banner prompting verification. They cannot access cloud provider connections or billing features until verified.
- **Resend**: Add `POST /api/auth/resend-verification` endpoint, rate-limited to 1 per minute.

---

## 4. Password Reset Flow

### Flow

```
User clicks "Forgot Password" → enters email
    │
    ▼
POST /api/auth/forgot-password
    │
    ▼
If email exists → generate reset token, send SES email
If email doesn't exist → return same generic success (prevent enumeration)
    │
    ▼
User clicks link: https://costra.dev/reset-password?token=xxx
    │
    ▼
Frontend shows "Set New Password" form
    │
    ▼
POST /api/auth/reset-password { token, newPassword }
    │
    ▼
Backend verifies token → updates password_hash → invalidates token
    │
    ▼
Send "Password Changed" confirmation email
```

### Implementation Details

- **Token**: JWT with `{ userId, purpose: 'password_reset' }`, 1-hour expiry.
- **One-time use**: Store token hash in DB, mark as used after reset.
- **Rate limit**: Max 3 reset requests per email per hour.

---

## 5. Account Deletion Flow (with Email Approval)

This is the most critical verification flow. Account deletion must be intentional and confirmed.

### Flow

```
User clicks "Delete Account" in Settings
    │
    ▼
Frontend shows confirmation dialog:
  - User enters reason (optional)
  - User types "DELETE" to confirm intent
  - User enters password (or 2FA code if enabled)
    │
    ▼
POST /api/compliance/delete-account { reason, password }
    │
    ▼
Backend:
  1. Verifies password / 2FA
  2. Creates deletion request (status: 'pending')
  3. Sends SES email with approval link + cancellation link
  4. Returns { requestId, message: "Check your email to confirm" }
    │
    ▼
User receives email with:
  ┌─────────────────────────────────────────────┐
  │  Subject: Confirm Account Deletion - Costra │
  │                                             │
  │  You requested to delete your account.      │
  │                                             │
  │  This will permanently delete:              │
  │  • All cloud provider connections           │
  │  • All cost data and recommendations        │
  │  • All settings and preferences             │
  │                                             │
  │  [Confirm Deletion]  ← single-use link      │
  │                                             │
  │  This link expires in 24 hours.             │
  │  If you didn't request this, click below:   │
  │                                             │
  │  [Cancel & Secure My Account]               │
  └─────────────────────────────────────────────┘
    │
    ├── User clicks "Confirm Deletion"
    │       │
    │       ▼
    │   GET /api/compliance/delete-account/:requestId/confirm?token=xxx
    │       │
    │       ▼
    │   Backend verifies token → sets status to 'confirmed'
    │       │
    │       ▼
    │   30-minute grace period begins (user can still cancel)
    │       │
    │       ▼
    │   After grace period: execute deletion (CASCADE)
    │       │
    │       ▼
    │   Send final "Account Deleted" email
    │       │
    │       ▼
    │   Optionally save as marketing lead if user opted in
    │
    └── User clicks "Cancel"
            │
            ▼
        GET /api/compliance/delete-account/:requestId/cancel?token=xxx
            │
            ▼
        Backend cancels request, sends "Account Secured" email
```

### Implementation Details

- **Confirmation token**: JWT with `{ requestId, userId, purpose: 'account_deletion' }`, 24-hour expiry.
- **Grace period**: 30 minutes between confirmation and actual deletion, during which the user can still cancel via the app.
- **Audit trail**: Log deletion with timestamp, IP, user-agent for compliance (GDPR Art. 17 / DPDPA).
- **Data export reminder**: Before deletion, prompt the user to export their data (`GET /api/compliance/export`).
- **Google OAuth users**: Skip password verification, require email confirmation only.

---

## 6. Email Change Verification Flow

When a user changes their email address, both the old and new email must be verified.

### Flow

```
User updates email in Settings
    │
    ▼
PUT /api/profile { email: "new@example.com" }
    │
    ▼
Backend:
  1. Does NOT update email immediately
  2. Stores pending email change: { userId, newEmail, token }
  3. Sends verification email to NEW address
  4. Sends notification to OLD address ("someone requested a change")
    │
    ▼
User clicks verification link in NEW email inbox
    │
    ▼
GET /api/profile/verify-email-change?token=xxx
    │
    ▼
Backend verifies token → updates email → clears pending change
    │
    ▼
Send confirmation to both old and new email addresses
```

### Implementation Details

- **Token expiry**: 24 hours.
- **Database change**: Add `pending_email` and `pending_email_token` columns, or use a separate `email_change_requests` table.
- **Security**: The notification to the old email contains a cancel link.

---

## 7. Other Verification Scenarios

### 7.1 Login from New Device/Location

```
User logs in from unrecognized IP/device
    │
    ▼
Send email: "New login detected from {location} on {device}"
    │
    ▼
Include "Not you? Secure your account" link → redirects to password change
```

### 7.2 API Key Created

```
User creates new API key
    │
    ▼
Send email: "New API key created: {key_name}"
    │
    ▼
Include "Revoke this key" link if unauthorized
```

---

## 8. Email Templates

All emails should follow a consistent template:

- **From**: `Costra <noreply@costra.dev>`
- **Reply-To**: `support@costra.dev`
- **Design**: Clean, minimal HTML with the Costra logo. Plain-text fallback for all emails.
- **Footer**: Unsubscribe link (for non-transactional), company address (CAN-SPAM compliance).
- **Categories**:
  - **Transactional** (always sent): verification, password reset, deletion confirmation, security alerts
  - **Non-transactional** (respect preferences): weekly summary, trial reminders, product updates

### Template Storage

Store templates in `server/templates/email/`:

```
server/templates/email/
├── base.html                  # Shared layout wrapper
├── verify-email.html
├── password-reset.html
├── password-changed.html
├── delete-account-confirm.html
├── delete-account-completed.html
├── email-change-verify.html
├── anomaly-alert.html
├── budget-alert.html
├── weekly-summary.html
├── trial-expiring.html
└── welcome.html
```

---

## 9. Database Changes Required

```sql
-- Add email verification to users
ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT false;

-- Email change requests
CREATE TABLE email_change_requests (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  new_email VARCHAR(255) NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Password reset tokens
CREATE TABLE password_reset_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  used BOOLEAN DEFAULT false,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Email delivery log (for debugging & compliance)
CREATE TABLE email_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  email_type VARCHAR(50) NOT NULL,
  recipient VARCHAR(255) NOT NULL,
  ses_message_id VARCHAR(255),
  status VARCHAR(20) DEFAULT 'sent',
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Bounced/complained emails
CREATE TABLE email_suppressions (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  reason VARCHAR(20) NOT NULL,  -- 'bounce' or 'complaint'
  ses_notification JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 10. Rate Limiting & Security

| Action | Limit |
|--------|-------|
| Verification email resend | 1 per minute, 5 per hour |
| Password reset request | 3 per email per hour |
| Account deletion request | 1 active request at a time |
| Email change request | 1 active request at a time |
| Total emails per user per day | 20 (excluding transactional security) |

---

## 11. Implementation Order

1. **Phase 1 — Foundation**
   - Integrate SES transport into `emailService.js`
   - Create base email template
   - Add `email_verified` column
   - Set up SNS bounce/complaint handling

2. **Phase 2 — Critical Auth Emails**
   - Email verification on signup
   - Password reset (complete the existing flow)
   - Account deletion email confirmation

3. **Phase 3 — Security Emails**
   - Password changed notification
   - Email change verification
   - 2FA enabled/disabled notification
   - New device login alert

4. **Phase 4 — Product Emails**
   - Welcome email with trial info
   - Trial expiring / expired reminders
   - Weekly cost summary (Pro)

---

## 12. Cost Estimate

SES pricing (us-east-1):
- **$0.10 per 1,000 emails** sent
- First 62,000 emails/month are free if sending from an EC2 instance
- SNS notifications for bounces/complaints: free tier covers most usage

For a small-to-medium user base (< 10,000 users), monthly SES cost will be under **$5/month**.

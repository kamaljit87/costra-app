/**
 * Email Templates
 * Reusable HTML email templates for all transactional and notification emails
 */

const FRONTEND_URL = () => process.env.FRONTEND_URL || 'http://localhost:5173'
const APP_URL = () => process.env.APP_URL || FRONTEND_URL()
const BRAND_COLOR = '#3F4ABF'

/** Escape user-supplied strings before interpolation into HTML */
function esc(str) {
  if (typeof str !== 'string') return String(str ?? '')
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

/**
 * Base email layout wrapper
 */
function baseLayout(title, bodyHtml) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f4f5f7; }
    .wrapper { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: ${BRAND_COLOR}; color: white; padding: 24px 30px; border-radius: 8px 8px 0 0; }
    .header h1 { margin: 0; font-size: 22px; font-weight: 600; }
    .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; }
    .footer { background: #f9fafb; padding: 20px 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; text-align: center; font-size: 12px; color: #9ca3af; }
    .btn { display: inline-block; padding: 14px 28px; background: ${BRAND_COLOR}; color: #ffffff !important; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 15px; }
    .btn-danger { background: #DC2626; }
    .btn-secondary { background: #6b7280; }
    .alert { padding: 14px 18px; border-radius: 6px; margin: 16px 0; font-size: 14px; }
    .alert-warning { background: #fef3c7; border-left: 4px solid #f59e0b; }
    .alert-danger { background: #fee2e2; border-left: 4px solid #DC2626; }
    .alert-info { background: #dbeafe; border-left: 4px solid #3b82f6; }
    .muted { color: #6b7280; font-size: 13px; }
    p { margin: 0 0 16px 0; }
    a { color: ${BRAND_COLOR}; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>${title}</h1>
    </div>
    <div class="content">
      ${bodyHtml}
    </div>
    <div class="footer">
      <p style="margin:0">&copy; ${new Date().getFullYear()} Costdoq. All rights reserved.</p>
      <p style="margin:4px 0 0">This is a transactional email from Costdoq.</p>
    </div>
  </div>
</body>
</html>`
}

/**
 * Email verification after signup
 */
export function verifyEmailTemplate(name, verifyUrl) {
  return baseLayout('Verify Your Email', `
    <p>Hi ${esc(name)},</p>
    <p>Welcome to Costdoq! Please verify your email address to get started.</p>
    <p style="text-align:center; margin: 28px 0;">
      <a href="${verifyUrl}" class="btn">Verify Email Address</a>
    </p>
    <p class="muted">This link expires in 24 hours. If you didn't create a Costdoq account, you can safely ignore this email.</p>
    <p class="muted" style="word-break:break-all;">Or copy and paste this URL into your browser:<br>${verifyUrl}</p>
  `)
}

/**
 * Password reset email
 */
export function passwordResetTemplate(name, resetUrl) {
  return baseLayout('Reset Your Password', `
    <p>Hi ${esc(name)},</p>
    <p>We received a request to reset your password. Click the button below to choose a new password.</p>
    <p style="text-align:center; margin: 28px 0;">
      <a href="${resetUrl}" class="btn">Reset Password</a>
    </p>
    <p class="muted">This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email — your password will remain unchanged.</p>
    <p class="muted" style="word-break:break-all;">Or copy and paste this URL into your browser:<br>${resetUrl}</p>
  `)
}

/**
 * Password changed confirmation
 */
export function passwordChangedTemplate(name) {
  return baseLayout('Password Changed', `
    <p>Hi ${esc(name)},</p>
    <div class="alert alert-warning">
      <strong>Your password was just changed.</strong>
    </div>
    <p>If you made this change, no further action is needed.</p>
    <p>If you did <strong>not</strong> change your password, your account may be compromised. Please reset your password immediately:</p>
    <p style="text-align:center; margin: 28px 0;">
      <a href="${APP_URL()}/forgot-password" class="btn btn-danger">Secure My Account</a>
    </p>
  `)
}

/**
 * Account deletion confirmation email
 */
export function deletionConfirmTemplate(name, confirmUrl, cancelUrl) {
  return baseLayout('Confirm Account Deletion', `
    <p>Hi ${esc(name)},</p>
    <p>You requested to delete your Costdoq account. This action is <strong>permanent and irreversible</strong>.</p>
    <div class="alert alert-danger">
      <strong>This will permanently delete:</strong>
      <ul style="margin: 8px 0 0; padding-left: 20px;">
        <li>All cloud provider connections</li>
        <li>All cost data and recommendations</li>
        <li>All budgets, reports, and settings</li>
        <li>Your account and profile</li>
      </ul>
    </div>
    <p>Before deleting, you can <a href="${APP_URL()}/settings">export your data</a> from Settings.</p>
    <p style="text-align:center; margin: 28px 0;">
      <a href="${confirmUrl}" class="btn btn-danger">Confirm Deletion</a>
    </p>
    <p style="text-align:center;">
      <a href="${cancelUrl}" class="btn-secondary btn">Cancel &mdash; Keep My Account</a>
    </p>
    <p class="muted">This link expires in 24 hours. If you didn't request this, click Cancel above or ignore this email.</p>
  `)
}

/**
 * Account deleted confirmation
 */
export function accountDeletedTemplate(name) {
  return baseLayout('Account Deleted', `
    <p>Hi ${esc(name)},</p>
    <p>Your Costdoq account and all associated data have been permanently deleted.</p>
    <p>We're sorry to see you go. If you ever want to come back, you're welcome to create a new account at <a href="${FRONTEND_URL()}">${FRONTEND_URL()}</a>.</p>
  `)
}

/**
 * Deletion cancelled / account secured
 */
export function deletionCancelledTemplate(name) {
  return baseLayout('Account Deletion Cancelled', `
    <p>Hi ${esc(name)},</p>
    <div class="alert alert-info">
      <strong>Your account deletion request has been cancelled.</strong> Your account is safe and no data was deleted.
    </div>
    <p>If you didn't request the deletion, we recommend changing your password as a precaution:</p>
    <p style="text-align:center; margin: 28px 0;">
      <a href="${APP_URL()}/settings" class="btn">Go to Settings</a>
    </p>
  `)
}

/**
 * Email change verification — sent to the NEW email
 */
export function emailChangeVerifyTemplate(name, newEmail, verifyUrl) {
  return baseLayout('Verify Your New Email', `
    <p>Hi ${esc(name)},</p>
    <p>You requested to change your Costdoq email to <strong>${esc(newEmail)}</strong>.</p>
    <p>Click below to verify this new email address:</p>
    <p style="text-align:center; margin: 28px 0;">
      <a href="${verifyUrl}" class="btn">Verify New Email</a>
    </p>
    <p class="muted">This link expires in 24 hours. If you didn't request this change, you can safely ignore this email.</p>
    <p class="muted" style="word-break:break-all;">Or copy and paste this URL:<br>${verifyUrl}</p>
  `)
}

/**
 * Email change notification — sent to the OLD email
 */
export function emailChangeNotifyTemplate(name, newEmail, cancelUrl) {
  return baseLayout('Email Change Requested', `
    <p>Hi ${esc(name)},</p>
    <div class="alert alert-warning">
      <strong>Someone requested to change your email address</strong> to <strong>${esc(newEmail)}</strong>.
    </div>
    <p>If this was you, no action is needed — verify the change from your new email inbox.</p>
    <p>If you did <strong>not</strong> request this change, click below to cancel it and secure your account:</p>
    <p style="text-align:center; margin: 28px 0;">
      <a href="${cancelUrl}" class="btn btn-danger">Cancel Email Change</a>
    </p>
  `)
}

/**
 * Email successfully changed confirmation — sent to both old and new
 */
export function emailChangedConfirmTemplate(name) {
  return baseLayout('Email Address Updated', `
    <p>Hi ${esc(name)},</p>
    <div class="alert alert-info">
      <strong>Your email address has been successfully updated.</strong>
    </div>
    <p>You can now sign in with your new email. If you didn't make this change, please contact support immediately.</p>
    <p style="text-align:center; margin: 28px 0;">
      <a href="${APP_URL()}/settings" class="btn">Go to Settings</a>
    </p>
  `)
}

/**
 * 2FA enabled notification
 */
export function twoFactorEnabledTemplate(name) {
  return baseLayout('Two-Factor Authentication Enabled', `
    <p>Hi ${esc(name)},</p>
    <div class="alert alert-info">
      <strong>Two-factor authentication has been enabled</strong> on your Costdoq account.
    </div>
    <p>You'll now need your authenticator app to sign in. Make sure you've saved your recovery codes in a safe place.</p>
    <p>If you didn't enable 2FA, your account may be compromised. Change your password immediately:</p>
    <p style="text-align:center; margin: 28px 0;">
      <a href="${APP_URL()}/forgot-password" class="btn btn-danger">Secure My Account</a>
    </p>
  `)
}

/**
 * 2FA disabled notification
 */
export function twoFactorDisabledTemplate(name) {
  return baseLayout('Two-Factor Authentication Disabled', `
    <p>Hi ${esc(name)},</p>
    <div class="alert alert-warning">
      <strong>Two-factor authentication has been disabled</strong> on your Costdoq account.
    </div>
    <p>Your account is now only protected by your password. We recommend keeping 2FA enabled for better security.</p>
    <p>If you didn't disable 2FA, your account may be compromised:</p>
    <p style="text-align:center; margin: 28px 0;">
      <a href="${APP_URL()}/forgot-password" class="btn btn-danger">Secure My Account</a>
    </p>
  `)
}

/**
 * Welcome email with trial info
 */
export function welcomeTemplate(name) {
  return baseLayout('Welcome to Costdoq!', `
    <p>Hi ${esc(name)},</p>
    <p>Thanks for joining Costdoq! Your <strong>7-day free trial</strong> has started.</p>
    <p>Here's how to get started:</p>
    <ol style="padding-left: 20px;">
      <li><strong>Connect your cloud provider</strong> — AWS, Azure, GCP, or others</li>
      <li><strong>View your dashboard</strong> — see your costs at a glance</li>
      <li><strong>Set up budgets</strong> — get alerted before you overspend</li>
    </ol>
    <p style="text-align:center; margin: 28px 0;">
      <a href="${APP_URL()}/dashboard" class="btn">Go to Dashboard</a>
    </p>
    <p class="muted">Need help? Reply to this email or visit our <a href="${APP_URL()}/docs">documentation</a>.</p>
  `)
}

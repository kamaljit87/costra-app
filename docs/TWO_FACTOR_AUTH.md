# Two-Factor Authentication (2FA)

Costra supports TOTP-based two-factor authentication so users can require a code from an authenticator app (e.g. Google Authenticator, Authy) when signing in with email/password.

## Behaviour

- **Who can use 2FA:** Any user who signs in with email/password. 2FA is optional and can be enabled in **Settings → Security**.
- **Google Sign-In:** 2FA does not apply to Google OAuth sign-in; only the email/password login flow prompts for a TOTP code when 2FA is enabled.
- **Flow:**
  1. User enables 2FA in Settings → Security: scans QR code (or enters secret) in an authenticator app, then enters a code to confirm.
  2. On subsequent email/password login, after the correct password the user is asked for the 6-digit code; after a valid code they receive the session token.

## Backend

- **DB:** `users` has `totp_secret`, `totp_enabled_at`, and `totp_secret_pending` (used during setup). Columns are created automatically on app init.
- **Endpoints:**
  - `GET /api/auth/2fa/status` – whether 2FA is enabled (requires auth).
  - `POST /api/auth/2fa/setup` – start setup; returns `secret` and `qrDataUrl` (requires auth).
  - `POST /api/auth/2fa/confirm` – body `{ code }`; confirms and enables 2FA (requires auth).
  - `POST /api/auth/2fa/disable` – body `{ password, code? }`; disables 2FA (requires auth).
  - `POST /api/auth/2fa/verify-login` – body `{ tempToken, code }`; exchanges a post-password temporary token + TOTP code for the full JWT (no auth header).

## Dependencies

- `speakeasy` – TOTP secret generation and verification.
- `qrcode` – QR code image for the authenticator app.

Install with: `npm install speakeasy qrcode`

## Security notes

- TOTP secrets are stored in the database; restrict DB access and use TLS in production.
- The temporary token used between password and 2FA verification is short-lived (5 minutes).
- Disabling 2FA requires the account password (and optionally the current TOTP code).

# Costra – User Features Documentation

*For Confluence: copy sections into Confluence pages or paste into a Confluence page (Markdown supported).*

---

## 1. Product overview

**Costra** is a multi-cloud cost management application.

| Capability | Description |
|------------|-------------|
| Multi-cloud | Connect AWS and other providers; view aggregated and per-provider cost. |
| Plans | Starter and Pro with different limits and features. |
| Demo mode | Explore with sample data before connecting real accounts. |

---

## 2. Getting started

- **Sign up / Login:** Email/password or Google. Forgot-password available.
- **Demo mode:** Use Dashboard with sample data without connecting a provider.

**Main navigation (sidebar):** Dashboard | Budgets | Reports | Compare

---

## 3. Dashboard (`/dashboard`)

- **Total bill summary:** Current month, last month, forecast, savings, tax.
- **Actions:** Add Provider, Sync Data, **Export CSV**, **Export PDF** (Pro when gated).
- **Spend goals:** Add goal (e.g. reduce by 10% this quarter vs last year), progress bar, delete.
- **By provider:** Cards per provider with cost, charts, savings plans; expand for details.
- **Optimization summary:** High-level insights.

---

## 4. Budgets (`/budgets`)

- Create budgets (per provider/account or global); period: monthly, quarterly, yearly.
- Alert threshold (e.g. 80%); option to create budget in cloud provider (e.g. AWS).
- List with current spend, percentage, status (active/exceeded); budget alerts; email (and optional Slack/webhook when configured).

---

## 5. Reports (`/reports`)

- **Types:** Showback, Chargeback.
- **Create:** Name, date range, optional provider/account/team/product, format CSV or PDF.
- Reports generated async; download when completed; delete.

---

## 6. Compare (`/compare`)

- Side-by-side: select two providers and months (e.g. last 12); view total and per-service cost and charts.

---

## 7. Recommendations (`/recommendations`)

- Optimization recommendations (idle resources, rightsizing, reserved instances, storage, etc.); categories and priorities; estimated savings.
- Refresh, dismiss, mark as implemented.

---

## 8. Provider detail (`/provider/:providerId`)

- Per-provider cost, service breakdown, charts, savings plans, budgets. Entry from Dashboard or search.

---

## 9. Products and teams

- Cost views by product or team dimension for showback/chargeback.

---

## 10. Notifications

- **Bell** in header: unread count; dropdown with list; mark read / mark all read; pagination.
- Types: budget alerts, anomaly alerts, digest.

---

## 11. Alerts and email

- **Settings → General → Email reports and alerts (Pro):**
  - Enable all email alerts, Weekly cost summary (Mondays), Budget alerts, Anomaly alerts.
- **Scheduled weekly summary:** Cron sends email to Pro users who enabled it (e.g. Mondays 09:00 UTC).

---

## 12. Exports

- **Dashboard:** Export CSV / Export PDF for current month (Pro when gated).
- **Reports page:** Download completed showback/chargeback reports (CSV/PDF).

---

## 13. Profile (`/profile`)

- **Account:** Name, email, avatar – view/edit.
- **Password:** Change (current + new + confirm).
- **Export my data:** JSON export of profile, providers, cost data, budgets, preferences.
- **Delete account:** Request deletion with reason and confirmation.

---

## 14. Settings (`/settings`)

### General
- **Appearance:** Light / Dark / System; also theme toggle (sun/moon) in header. Stored in `costra-theme` (localStorage).
- **Currency:** Display currency (USD, EUR, INR, etc.).
- **Email reports and alerts:** Pro only – weekly summary, budget alerts, anomaly alerts.

### Cloud providers
- Add, list, edit, remove cloud accounts (e.g. AWS).

### Security
- **2FA:** Enable (setup + confirm code), disable (with code).

### API
- **API keys:** Create key (full key shown once), list (prefix + name + date), revoke.
- Use `Authorization: Bearer <key>` for read-only API access; keys cannot manage account or other keys.

---

## 15. Billing (`/settings/billing`)

- **Plans:** Starter (e.g. 3 accounts, 6 months history), Pro (unlimited, 12+ months, email summaries, CSV exports, etc.).
- Upgrade, manage subscription (Stripe portal).

---

## 16. Appearance and UX

- **Dark mode:** Settings → General → Appearance or header toggle.
- **Saved views:** Where FilterBar exists – save/load named filter sets (service, credits, account); delete. Signed-in only.

---

## 17. Spend goals

- Dashboard → Spend goals: add target % reduction (e.g. 10% this quarter vs same period last year), view progress, delete.

---

## 18. User API keys

- Settings → API: create/revoke; Bearer token for read-only API; keys cannot manage account or keys.

---

## 19. Security and compliance

- 2FA, change password, data export, account deletion, Privacy/Terms, cookie consent.

---

## 20. Quick reference

| I want to… | Where |
|------------|--------|
| See total cost / by provider | Dashboard |
| Export month CSV/PDF | Dashboard → Export CSV / PDF |
| Set spend reduction goal | Dashboard → Spend goals |
| Create budget | Budgets |
| Optimization ideas | Recommendations |
| Showback/chargeback report | Reports |
| Compare providers/months | Compare |
| Currency | Settings → General |
| Dark mode | Settings → General → Appearance or header toggle |
| Save/load filters | FilterBar → Saved views |
| Email alerts / weekly summary | Settings → General → Email (Pro) |
| API key | Settings → API |
| Connect cloud account | Settings → Cloud Providers |
| 2FA | Settings → Security |
| Billing / plan | Settings → Billing |
| Export data / delete account | Profile |

---

*End of Costra user features documentation.*
or search.

---

## 9. Products and teams views

- **Products** – Cost view by product (e.g. product name dimension).
- **Teams** – Cost view by team (e.g. team dimension).

Used for showback/chargeback and reporting.

---

## 10. Notifications

### 10.1 In-app notifications

- **Bell icon** in the header shows **unread count**.
- **Dropdown** lists recent notifications (e.g. budget alerts, anomaly alerts, digest).
- **Mark as read** / **mark all as read**; optional **delete**.
- **Pagination** for long lists.

### 10.2 Types

- Budget threshold breached.
- Anomaly detected.
- Digest (e.g. “3 budgets at 80%+, 1 anomaly”) when enabled.

---

## 11. Alerts and email

### 11.1 Settings → General → Email reports and alerts

- **Pro only.** If not Pro, an upgrade message is shown.
- **Enable all email alerts** – Master switch.
- **Weekly cost summary (Mondays)** – Scheduled email with cost summary.
- **Budget alerts** – Email when a budget crosses its threshold.
- **Anomaly alerts** – Email when an anomaly is detected.

### 11.2 Scheduled email reports

- A **cron job** (e.g. Mondays 09:00 UTC) sends a **weekly cost summary** to users who have **Weekly cost summary** enabled and are on the **Pro** plan.
- Content includes last 7 days vs previous 7 days and top services.

### 11.3 Slack / webhook (future)

- Budget (and optionally anomaly) alerts can be sent to a **Slack channel** or **webhook URL** when configured (per budget or per user).

---

## 12. Exports

### 12.1 Export current view (Dashboard)

- **Export CSV** – Downloads cost data for the **current month** as CSV (all providers/services).
- **Export PDF** – Downloads cost data for the **current month** as PDF.
- Exports are **Pro**-gated when the feature flag `csv_export` is enforced.
- File names: e.g. `costra-cost-YYYY-MM.csv` / `.pdf`.

### 12.2 Reports (Reports page)

- Showback/chargeback reports are generated as **CSV** or **PDF** and downloaded from the Reports list when completed.

---

## 13. Profile

**Path:** `/profile`

### 13.1 Account info

- **Name** and **email** – View and edit (saved to account).
- **Avatar** – Upload/change/remove profile picture.

### 13.2 Password

- **Change password** – Current password + new password + confirm (for email/password accounts).

### 13.3 Data and privacy

- **Export my data** – Download a **JSON export** of profile, cloud providers, cost data, budgets, preferences.
- **Delete account** – Request account deletion (reason, optional “keep for marketing”); confirmation step; async processing.

---

## 14. Settings

**Path:** `/settings`

### 14.1 General

- **Appearance (theme)**  
  - **Light**, **Dark**, or **System** (follow OS preference).  
  - Stored in browser (`costra-theme`).  
  - A **theme toggle** (sun/moon) in the header also switches between light and dark.

- **Currency**  
  - Preferred **display currency** for all cost data (e.g. USD, EUR, INR).  
  - Stored in user preferences.

- **Email reports and alerts**  
  - See section **11. Alerts and email** (Pro only).

### 14.2 Cloud providers

- **Add** cloud provider accounts (e.g. AWS – manual or automated connection).
- **List** connected accounts with alias, provider, last sync.
- **Edit** (e.g. alias, credentials) and **remove** accounts.
- **Sync** can be triggered from Dashboard or provider detail.

### 14.3 Security

- **Two-factor authentication (2FA)**  
  - **Enable:** Setup (QR/secret), then confirm with 6-digit code.  
  - **Disable:** Requires current 6-digit code.  
  - Improves security for login.

### 14.4 API

- **API keys** for read-only access to cost/insights data (scripts, BI tools).
- **Create key** – Generates a new key; the **full key is shown once** (copy and store securely).
- **List keys** – Shows key prefix, optional name, created date (full key never shown again).
- **Revoke** – Delete a key; it stops working immediately.
- **Usage:** Send `Authorization: Bearer <your-api-key>` on API requests. Keys are **read-only** and cannot manage account or create/delete other keys.
- Key format: `costra_` followed by a long hex string.

---

## 15. Billing and subscription

**Path:** `/settings/billing` or **Billing & Subscription** in user menu

### 15.1 Plans

| Plan | Typical limits / features |
|------|---------------------------|
| **Starter** | Up to 3 cloud provider accounts, up to 6 months history, daily auto-sync, monthly “What changed & why”, custom date ranges. |
| **Pro** | Unlimited accounts, 12+ months history, cost vs usage, unit economics, anomaly detection, **email summaries**, **CSV exports**, and other advanced features. |

### 15.2 Subscription management

- **Current plan** and **trial** status (e.g. days remaining).
- **Upgrade** – Start Pro (checkout).
- **Manage subscription** – Open Stripe Customer Portal (update payment, cancel, etc.).

---

## 16. Appearance and UX

### 16.1 Dark mode

- **Settings → General → Appearance:** Light / Dark / System.
- **Header:** Sun/moon icon toggles between light and dark (overrides system until changed again).
- **Persistence:** Stored in `localStorage` as `costra-theme`.
- **Tailwind:** Uses `dark` class on `<html>`; components use `dark:` variants where needed.

### 16.2 Saved views (filters)

- Where **FilterBar** is used (e.g. reports, compare, provider-level views):
  - **Saved views** dropdown – Load a previously saved filter set (e.g. service, credits, account).
  - **Save current view** – Save current filters under a name (stored per user).
  - **Delete** – Remove a saved view.
- Requires **signed-in** user; data stored in **user_views** (name + filters JSON).

---

## 17. Spend goals

- **Dashboard → Spend goals** card.
- **Add goal** – Enter target (e.g. “10” for 10% reduction). Goal is “reduce spend by X% this quarter vs same period last year.”
- **Progress** – Shows current % change vs target and a progress bar (green when target met).
- **Delete** – Remove a goal.
- Backed by **user_goals** and daily cost data for current vs baseline period.

---

## 18. User API keys

- **Settings → API** (see **14.4 API**).
- Create/revoke keys; use `Authorization: Bearer <key>` for **read-only** API access.
- Keys **cannot** manage account, billing, or other API keys (JWT required for those).

---

## 19. Security and compliance

- **2FA** – Settings → Security.
- **Password** – Change from Profile.
- **Data export** – Profile → Export my data.
- **Account deletion** – Profile → Delete account (with confirmation and optional reason).
- **Privacy policy** and **Terms of service** – Linked from footer/login.
- **Cookie consent** – Banner for essential and optional cookies (e.g. Sentry).

---

## 20. Quick reference – Where to find what

| I want to… | Where to go |
|------------|-------------|
| See total cost and by provider | Dashboard |
| Export this month as CSV/PDF | Dashboard → Export CSV / Export PDF |
| Set a spend reduction goal | Dashboard → Spend goals → Add goal |
| Create a budget | Budgets → Create |
| Get optimization ideas | Recommendations |
| Create a showback/chargeback report | Reports → Create report |
| Compare two providers/months | Compare |
| Change currency | Settings → General → Currency |
| Turn on dark mode | Settings → General → Appearance or header sun/moon |
| Save/load filter presets | FilterBar → Saved views (on pages that use it) |
| Enable email alerts / weekly summary | Settings → General → Email reports and alerts (Pro) |
| Create an API key | Settings → API → Create key |
| Connect a cloud account | Settings → Cloud Providers |
| Enable 2FA | Settings → Security |
| Change plan / pay | Settings → Billing or Billing & Subscription |
| Export my data / delete account | Profile |

---

*End of Costra user features documentation. For technical implementation details, see the codebase and server README.*

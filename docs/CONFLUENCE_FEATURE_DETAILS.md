# Costra – Feature Details (Confluence)

*Supplementary detail for Confluence. Use with CONFLUENCE_USER_FEATURES.md.*

---

## Dashboard – Details

- **Total Bill Summary:** Single place for current month, last month, forecast, total savings, and optional tax breakdown. Forecast confidence can be shown.
- **Sync:** Clears cached cost data and pulls fresh data from all connected providers. May take a short time.
- **Export CSV/PDF:** Uses the current calendar month and all providers; file names include year-month. Pro feature when `csv_export` is gated.
- **Spend goals:** Baseline is “same period last year” (same month or same quarter). Progress = (baseline − current) / baseline × 100. Goal is “reduce by X%”; when percentChange ≥ targetPercent, the goal is met (green).

---

## Budgets – Details

- **Periods:** Monthly, quarterly, yearly. Amount is the cap for that period.
- **Alert threshold:** Default often 80%; alert when spend reaches this % of budget. Alerts can trigger in-app notification and email (and optionally Slack/webhook).
- **Create in cloud provider:** If supported (e.g. AWS), the budget can be created in the provider so native alerts apply there too.
- **Status:** active, paused, or exceeded depending on spend vs amount.

---

## Reports – Details

- **Showback:** Visibility of cost by team/product for internal reporting.
- **Chargeback:** Allocation of cost for billing/chargeback.
- **Filters:** By provider, account, team, product narrows the report scope.
- **Async:** Report goes to “generating”; when “completed”, download is available. “Failed” may require retry or support.

---

## Recommendations – Details

- **Categories:** Cost trends, idle resources, rightsizing, reserved instances, storage, data transfer, best practices, cross-provider.
- **Priorities:** Critical, high, medium, low.
- **Sort:** By savings, priority, or date.
- **Refresh:** Recomputes recommendations from current data.
- **Dismiss / Implemented:** Tracks that the user has seen or applied the recommendation.

---

## Notifications – Details

- **Unread count:** Shown on the bell; updates when notifications are read or new ones arrive.
- **Pagination:** Long lists are paged (e.g. 30 per page).
- **Types:** Can include budget_alert, anomaly, digest, or other system types. Filtering by type may be available via API.

---

## Email (Pro) – Details

- **Weekly summary:** Sent by a scheduled job (e.g. Mondays 09:00 UTC) to users with “Weekly cost summary” on and Pro plan. Includes last 7 days vs previous 7 days and top services.
- **Budget alerts:** Sent when a budget crosses its alert threshold (if “Budget alerts” is on).
- **Anomaly alerts:** Sent when an anomaly is detected (if “Anomaly alerts” is on).
- All require “Enable all email alerts” and Pro subscription.

---

## Saved views – Details

- **Stored:** In `user_views`: name + JSON filters (e.g. selectedService, showCreditsOnly, selectedAccountId).
- **Where available:** On pages that use the FilterBar component (e.g. reports, compare, provider-level views). Not on every page.
- **Load:** Picks the saved view and applies its filters to the current page.
- **Save:** Saves current filter state under a name; must be signed in.

---

## Spend goals – Details

- **Target type:** “Percent reduction” (e.g. reduce by 10%).
- **Baseline:** Same period last year (month or quarter).
- **Period:** Month or quarter; current period is the current month or current quarter.
- **Progress:** Fetched from daily cost data; displayed as “X% vs Y% target” and a bar. Green when target is met.

---

## API keys – Details

- **Format:** `costra_` + 64 hex characters. Stored as hash; only prefix shown in UI after creation.
- **Create:** One-time display of full key; user must copy and store it. Key cannot be retrieved again.
- **Use:** Send `Authorization: Bearer <full-key>` on requests. Same auth middleware as JWT; API keys get `req.user` with userId.
- **Scopes:** Read-only; they can access cost/insights endpoints that use `authenticateToken`. They cannot call key-management endpoints (list/create/delete keys); those require JWT (`requireJwt`).
- **Revoke:** Deleting a key invalidates it immediately.

---

## Plans (summary)

| Feature / limit | Starter | Pro |
|-----------------|---------|-----|
| Cloud provider accounts | e.g. up to 3 | Unlimited |
| History | e.g. 6 months | 12+ months |
| Email summaries / alerts | No | Yes |
| CSV/PDF export (Dashboard) | No (or gated) | Yes |
| Advanced insights (cost vs usage, unit economics, anomalies) | Limited | Yes |

*Exact limits and feature flags may vary by deployment; see Billing page and feature gates in the app.*

---

*End of feature details.*

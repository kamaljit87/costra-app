# Costra — User Documentation

## Introduction

**Costra** is a cloud cost dashboard that helps you see and manage spending across all your cloud providers in one place. Connect AWS, Azure, Google Cloud, and other supported providers to view current and historical costs, set budgets, compare months, and get recommendations to reduce waste. It’s built for founders, small teams, and anyone who wants clarity on cloud spend without heavy setup.

---

## Getting Started

### Creating an account

1. Open the Costra website and click **Sign up** (or go to the signup page if your organization uses a direct link).
2. Enter your **name**, **email**, and **password**, and accept the terms if required.
3. Click **Sign up**. You’ll be signed in and can go to the **Dashboard**.

**Note:** If your organization has disabled public signup, you won’t see a sign-up link; use the sign-in page with credentials provided by your admin.

<!-- Screenshot: Sign up page -->

### Signing in

1. Go to the **Login** page.
2. Enter your **email** and **password**.
3. Click **Sign in**. You’ll be taken to the **Dashboard**.

You can also sign in with **Google** if that option is available.

If you have **two-factor authentication (2FA)** enabled, after entering your password you’ll be asked for a code from your authenticator app. Enter it to complete sign-in.

<!-- Screenshot: Login page -->

### Forgot password

1. On the login page, click **Forgot password?**
2. Enter the **email address** associated with your account.
3. Click the button to send reset instructions.
4. Check your inbox (and spam folder). If an account exists for that email, you’ll receive instructions to reset your password.
5. Use the link in the email to set a new password, then sign in again.

If you don’t receive an email, confirm the address is correct and try again, or contact support.

<!-- Screenshot: Forgot password page -->

### Demo mode

If you use Costra without connecting any cloud accounts, you may see **Demo Mode**: sample data is shown so you can explore the dashboard, compare, and other features. To use your real data, sign up (or sign in) and connect at least one cloud provider in **Settings → Cloud Providers**.

### Onboarding flow (first-time setup)

1. **Create an account** (or sign in).
2. You land on the **Dashboard**. In demo mode you’ll see sample data; otherwise the dashboard may be empty until you connect a provider.
3. **Connect your first cloud provider:** go to **Settings → Cloud Providers**, click **Add provider**, choose a provider (e.g. AWS, Azure, GCP), and complete the steps (credentials or automated setup).
4. Back on the **Dashboard**, click **Sync Data** to pull the first cost data (or wait for auto-sync if enabled).
5. Optionally set **Budgets**, **Goals**, or explore **Compare** and **Reports** as needed.

<!-- Screenshot: Onboarding — first Dashboard after signup -->

---

## Core Features

### Dashboard

**What it does:** The Dashboard is your main view. It shows total spend across all connected cloud providers, current month vs last month, forecasts, savings, and a list of your connected providers with their costs. You can also see savings plans, optimization summaries, cost reduction goals, and trigger a data sync or export.

**Who it’s for:** Anyone who wants a single place to see “how much we’re spending in the cloud” and whether it’s going up or down.

**How to use it:**

1. After signing in, you land on **Dashboard** (or open **Dashboard** from the sidebar).
2. At the top you’ll see:
   - **Total bill summary** (current month, last month, forecast, and related metrics).
   - **Sync Data** — refreshes cost data from all connected providers (may take a minute).
   - **Add Provider** — shortcut to Settings to connect another cloud account.
   - **Export CSV** / **Export PDF** — download cost data (export may require a paid plan).
3. Scroll to see **provider cards**: each connected cloud account with current/last month cost and a link to that provider’s detail page.
4. Use **Savings plans** and **Optimization summary** sections to see committed savings and high-level optimization info.
5. **Goals**: add a target reduction (e.g. “10%”) to track progress; you can add or remove goals from the Dashboard.

**Limits and tips:**

- In **Demo Mode**, Sync and Export are not available; connect a real account to use them.
- If you see “No Providers Connected”, add at least one cloud provider under **Settings → Cloud Providers**.
- Export (CSV/PDF) may be limited to **Pro** plan; if export fails, the message may say you need to upgrade.
- Historical data (how many months you can see) depends on your plan (e.g. trial: 12 months, Starter: 6 months, Pro: 12+ months).

<!-- Screenshot: Dashboard Overview -->

---

### Cloud provider integrations

**What it does:** Costra pulls cost and usage data from your cloud accounts (e.g. AWS, Azure, Google Cloud, DigitalOcean, and others). You add and manage these connections in Settings. For AWS, you can use access keys or an automated (role-based) connection.

**Who it’s for:** Anyone who needs to track real spend; you must connect at least one provider to see real data (aside from Demo Mode).

**How to connect your first integration (overview):**

1. Open **Settings** (gear icon or **Settings** in the sidebar).
2. Go to the **Cloud Providers** tab.
3. Click **Add provider** (or equivalent).
4. Choose a provider (e.g. **Amazon Web Services**, **Microsoft Azure**, **Google Cloud Platform**).
5. Follow the on-screen steps:
   - **AWS (simple):** Enter an account alias (e.g. “Production”), Access Key ID, and Secret Access Key. Costra will verify and then start syncing.
   - **AWS (automated):** Use the “automated” flow: get a link/URL to create a stack in your AWS account, then authorize the role. Costra will detect when the connection is ready (you may need to click **Verify connection** if auto-detection times out).
   - **Other providers:** Enter the credentials or details shown for that provider (e.g. subscription/tenant IDs for Azure, project/key for GCP).
6. After a successful connection, the provider appears in the list and in the sidebar. Cost data will appear after the first sync (triggered automatically or via **Sync Data** on the Dashboard).

**Supported providers (as of this doc):** Amazon Web Services (AWS), Microsoft Azure, Google Cloud Platform (GCP), DigitalOcean, Linode (Akamai), Vultr, IBM Cloud, MongoDB Atlas.  
*TODO: Confirm with the team that all listed providers are fully supported in the current build.*

**Limits and pitfalls:**

- **Starter plan:** Up to 3 cloud provider accounts; **Pro:** unlimited.
- If **Sync** says “No Providers Connected”, add at least one provider in Settings.
- AWS automated connection: if auto-detection times out, the UI may say something like “Auto-detection timed out. If your stack is still creating, click Verify Connection below.” Click **Verify connection** once your AWS stack is ready.
- Removing a provider removes its data from Costra; historical data for that account may no longer be available.

<!-- Screenshot: Settings — Cloud Providers list -->

<!-- Screenshot: Add provider — choose provider -->

---

### Budgets

**What it does:** Budgets let you set a spending cap (e.g. $500/month) per provider or account and get alerts when you approach or exceed it. You can create budgets in Costra only, or (for supported clouds) also create them in the cloud provider.

**Who it’s for:** Teams and individuals who want to avoid overspend and get early warnings.

**How to use it:**

1. Open **Budgets** from the sidebar.
2. Click **Create budget** (or **Add budget**).
3. Fill in:
   - **Name** (e.g. “AWS Production”).
   - **Provider / account** (optional; leave blank for “all” or pick one).
   - **Amount** and **Period** (monthly, quarterly, or yearly).
   - **Alert threshold** (e.g. 80 = alert at 80% of budget).
   - Optionally choose to **create in cloud provider** if you want the budget in the cloud as well (e.g. AWS Budgets).
4. Save. The budget appears on the Budgets page and contributes to budget alerts (and email budget alerts if you’re on Pro and have enabled them in Settings).

**Limits and tips:**

- In **Demo Mode**, Budgets may show a message that you need to connect real accounts.
- Budget alerts (in-app and by email) depend on your plan and email preferences in **Settings → General**.

<!-- Screenshot: Budgets list -->

<!-- Screenshot: Create budget form -->

---

### Reports

**What it does:** Reports let you generate **visibility (showback)** or **allocation (chargeback)** reports for a date range, optionally filtered by provider, account, team, or product. Reports can be generated as PDF or CSV and downloaded when ready.

**Who it’s for:** Anyone who needs to share cost visibility with stakeholders or allocate costs to teams/products.

**How to use it:**

1. Open **Reports** from the sidebar.
2. Click **Create report** (or **Generate report**).
3. Choose **Report type**: **Visibility (showback)** or **Allocation (chargeback)**.
4. Enter a **Report name**, **Start date**, and **End date**.
5. Optionally filter by **Provider**, **Account**, **Team**, or **Product**.
6. Choose **Format**: PDF or CSV.
7. Start generation. The report appears in the list with status **Pending** → **Generating** → **Completed** (or **Failed**). The page may auto-refresh every few seconds while generating.
8. When status is **Completed**, use **Download** to get the file.

**Limits and tips:**

- Report generation can take a little time for large date ranges or many resources.
- If a report **fails**, check the status and try a shorter range or different filters; contact support if it keeps failing.
- *TODO: Confirm with the team whether report generation is gated by plan (e.g. Pro only).*

<!-- Screenshot: Reports list and statuses -->

<!-- Screenshot: Create report form -->

---

### Compare

**What it does:** Compare lets you put two or more “panels” side by side, each showing cost for a chosen provider and month. You can compare different months or different providers to see trends and differences.

**Who it’s for:** Anyone comparing spend across months or providers (e.g. “January vs February” or “AWS vs Azure this month”).

**How to use it:**

1. Open **Compare** from the sidebar.
2. Each **panel** has:
   - **Provider** (and optionally account).
   - **Month** (e.g. “January 2025”).
3. Use **Add panel** to add another provider/month.
4. Change provider or month from the dropdowns in each panel. Data loads automatically; if a month has no data, the UI may show “No data” for that panel.
5. If you see a **fetch error** for a month, that month may not be available (e.g. before you connected the account or outside your plan’s history). Try another month.

**Limits:**

- Historical months available depend on your **subscription** (e.g. 6 vs 12 months). The UI only offers months your plan allows.
- Some months might have no data yet (e.g. before first sync); the app shows “No data” instead of wrong numbers.

<!-- Screenshot: Compare — two panels -->

---

### Provider detail (per-account view)

**What it does:** When you click a provider (or an account under a provider) from the Dashboard or sidebar, you get a **Provider detail** page. It shows cost over time, cost by service, cost vs usage, untagged resources, anomaly detection, unit economics (if available), and product/team breakdowns for that account.

**Who it’s for:** People who need to drill into a single cloud account to see what’s driving cost and where to optimize.

**How to use it:**

1. From the **Dashboard**, click a provider card, or from the **sidebar** under **Cloud Providers** click an account (e.g. “Production” under AWS).
2. You’ll land on the **Overview** tab: period selector (e.g. last 1–12 months), date range, and charts (daily/monthly).
3. Use **Services** to see cost by service and sub-services; use filters (e.g. min/max cost, sort) to find the biggest line items.
4. Use **Analytics** for cost vs usage, untagged resources, anomalies, unit economics, and rightsizing suggestions (availability may depend on provider and plan).
5. Use **Products** and **Teams** to see cost grouped by product or team (when that data is configured).
6. Use **Download** (if available) to export data for that provider/period; this may require Pro.

**Limits:**

- **Historical period** (e.g. 12 months) is limited by your plan; the period dropdown only shows allowed ranges.
- Some sections (e.g. unit economics, anomaly detection) may be Pro-only or provider-specific; the UI may show upgrade or “not available” messages.

<!-- Screenshot: Provider detail — Overview -->

<!-- Screenshot: Provider detail — Services -->

---

### Recommendations

**What it does:** Recommendations are suggestions to reduce cost or improve usage (e.g. idle resources, rightsizing, reserved instances, storage, data transfer). You can filter by category and priority, mark items as dismissed or implemented, and see estimated savings.

**Who it’s for:** Anyone actively trying to cut cloud spend or improve efficiency.

**How to use it:**

1. Open **Recommendations** from the sidebar.
2. Use **tabs** (e.g. Active, Dismissed, Implemented) to switch between recommendation states.
3. Use **filters**: category (e.g. Idle Resources, Rightsizing), priority (Critical, High, Medium, Low), and sort (e.g. highest savings first).
4. Open a recommendation to read the suggestion and estimated savings; **dismiss** or **mark as implemented** as appropriate.
5. Use **Refresh** to pull the latest recommendations from the system.

**Limits:**

- Recommendations depend on connected providers and ingested data; they may take a short time to appear after the first sync.
- *TODO: Confirm with the team if recommendations are limited by plan (e.g. Pro only for some categories).*

<!-- Screenshot: Recommendations list -->

---

### Products and Teams views

**What it does:** **Products** and **Teams** are two separate pages that show cost grouped by product name or team name (based on tags or labels in your cloud). Useful for showback/chargeback and “cost by product/team.”

**Who it’s for:** Teams that tag resources by product or team and want to see cost per product or per team.

**How to use it:**

1. Open **Products** or **Teams** from the sidebar (or from the provider detail **Products** / **Teams** tabs).
2. Set **Start date** and **End date** (default is often last 30 days).
3. Optionally filter by **Provider** or **Account** using the URL or page filters if available.
4. Review the list of products or teams with total cost, resource count, and services. Click through to more detail if the app provides it.

**Limits:**

- Data depends on your cloud resources being tagged with the right product/team labels; untagged resources may appear under “Untagged” or similar.
- *TODO: Confirm with the team how product/team names are derived (e.g. which tags) for each provider.*

<!-- Screenshot: Products view -->

<!-- Screenshot: Teams view -->

---

## Settings

**What it does:** Settings is where you manage appearance, currency, email alerts, cloud providers, security (2FA), and API keys.

**How to use it:**

1. Open **Settings** from the sidebar or header.
2. **General:**
   - **Appearance:** Light, Dark, or System (match your device).
   - **Currency:** Choose the currency for all cost displays.
   - **Email reports and alerts:** Enable or disable email alerts, weekly summary, budget alerts, and anomaly alerts. These options are **Pro only**; on lower plans you may see “Upgrade to Pro to enable email reports and alerts.”
3. **Cloud Providers:** Add, edit, or remove cloud accounts (see “Cloud provider integrations” above).
4. **Security:**
   - **Two-factor authentication (2FA):** Enable 2FA with an authenticator app (scan QR code, enter backup code to confirm). You’ll need the app code each time you sign in. You can disable 2FA with a confirmation code.
5. **API:** Create and manage **API keys** for programmatic access. Create a key, copy it once (it may not be shown again), and revoke keys you no longer need.

**Limits:**

- Email alerts and some export/report features require a **Pro** subscription.
- API keys are sensitive; don’t share them. Revoke any key that might be exposed.

<!-- Screenshot: Settings — General -->

<!-- Screenshot: Settings — Security (2FA) -->

---

## Billing and subscription

**What it does:** The **Billing** page (often under **Settings → Billing** or a direct **Billing** link) shows your current plan, trial status, renewal date, and history limit (e.g. 6 or 12 months). You can upgrade or manage payment (e.g. via Stripe).

**Plans (as implemented in the app; confirm with product):**

- **Free trial:** 7 days; full feature set with some restrictions (e.g. no CSV export, no email alerts, no scheduled sync, no unit economics).
- **Starter:** Paid; e.g. up to 3 cloud provider accounts, up to 6 months history, daily auto-sync; no CSV export, no email alerts, no unit economics.
- **Pro:** Paid; unlimited accounts, 12+ months history, CSV export, email summaries, unit economics, anomaly detection, etc.

**How to use it:**

1. Open **Billing** (or **Settings → Billing**).
2. View **Current plan**, **Billing cycle** (monthly/annual), **Next billing** or **Trial ends in**, and **History** (months of data).
3. To **upgrade:** Choose Starter or Pro, monthly or annual, and complete checkout (you may be redirected to a payment provider).
4. To **manage payment method or subscription:** Use **Manage billing** (or similar) to open the customer portal (e.g. Stripe), where you can update card or cancel.

**Common messages:**

- **“Failed to load subscription”** — Check your connection; try again. If it persists, contact support.
- **“Failed to create checkout session”** / **“No checkout URL received”** — Payment provider may be misconfigured; contact support.
- **“Failed to open billing portal”** — Same; try again or contact support.

<!-- Screenshot: Billing — Current plan -->

---

## Profile

**What it does:** The **Profile** page lets you update your name, email, profile picture, and password. You can also export your data or request account deletion (with optional reason and marketing preference).

**How to use it:**

1. Open **Profile** from the sidebar or account menu.
2. **Name / email:** Edit and save; you may need to confirm email changes.
3. **Profile picture:** Upload an image; crop/save if the app offers it.
4. **Password:** Enter current password and new password (twice), then save.
5. **Data export:** Use **Export my data** (or similar) to request a copy of your data; you may receive a download or email when it’s ready.
6. **Delete account:** Use **Delete account**, provide a reason if asked, choose whether to stay on marketing communications, confirm. Deletion may be processed as a request; check the message on screen.

**Limits:**

- Password rules (length, complexity) follow what’s shown on the form.
- Data export and deletion handling may be asynchronous; the UI will explain next steps.

<!-- Screenshot: Profile — overview -->

---

## Advanced features (overview)

- **Cost reduction goals (Dashboard):** Set a target % reduction (e.g. 10%) and track progress; goals are shown on the Dashboard.
- **Savings plans (Dashboard):** View committed savings from AWS (or other) savings plans.
- **Anomaly detection (Provider detail):** Highlights unusual cost changes; availability may be Pro or provider-specific.
- **Unit economics (Provider detail):** Cost per unit of usage; may be Pro-only.
- **API keys (Settings → API):** For integrating Costra with your own tools or scripts.
- **Admin / Debug:** If you have an admin or debug route (e.g. **/admin/tickets**, **/debug**), these are for internal or support use; normal users typically don’t need them.

---

## Troubleshooting and FAQs

### I can’t sign in

- Check email and password; use **Forgot password?** if needed.
- If 2FA is enabled, use a current code from your authenticator app (not an old one).
- Clear cache/cookies or try another browser; if the problem continues, contact support.

### Dashboard shows “No Providers Connected” or no data

- Add at least one cloud provider under **Settings → Cloud Providers** and complete the connection.
- Click **Sync Data** on the Dashboard; wait a minute and refresh. If sync fails, check the error message (e.g. invalid credentials, permission issues in the cloud).

### Sync fails or shows errors

- **“No Providers Connected”** — Add a provider in Settings.
- **“Sync Completed with Errors”** — The message usually lists which provider/account failed. Check that credentials and permissions (e.g. AWS cost/billing access, Azure cost reader) are correct in the cloud; update credentials in Settings if needed.
- **“Sync Failed”** — Check your internet and try again; if it persists, contact support with the exact message.

### Export (CSV/PDF) doesn’t work

- Export may require a **Pro** plan. If you see “Could not export. You may need a Pro plan,” upgrade in Billing.
- In **Demo Mode**, export is disabled; connect a real account and sign in.

### Compare shows “No data” for a month

- That month may be before you connected the account or outside your plan’s historical range. Pick a month that’s within your subscription’s history and after your first successful sync.
- If you see a **fetch error**, the server couldn’t return that month; try another month or contact support.

### Report generation fails or stays “Generating”

- Try a shorter date range or fewer filters.
- Refresh the Reports page; if status stays “Generating” for a long time or moves to “Failed,” note the report name and contact support.

### I don’t see email alerts / weekly summary

- Email alerts and weekly summary are **Pro** features. Upgrade in Billing.
- In **Settings → General**, ensure “Email reports and alerts” and the specific options (e.g. weekly summary, budget alerts) are enabled.

### Two-factor (2FA) setup fails or I lost my device

- During setup, save the backup codes in a safe place. Use a backup code to sign in if you lose the device, then disable 2FA or set it up again on a new device.
- If you can’t sign in and don’t have backup codes, contact support to recover access.

### Billing / subscription errors

- **“Failed to load subscription”** — Temporary server or network issue; try again.
- **“Failed to create checkout session”** / **“No checkout URL received”**** / **“Failed to open billing portal”** — Payment provider issue; try again or contact support with the exact message.

---

## Support and contact

- **Contact form:** Use the **Contact** page (often linked in the footer or sidebar as “Contact us”). Choose a category (e.g. Bug report, Help, Feature request), enter your name, email, subject, and message, then submit. You’ll see a confirmation when the message is sent.
- **In-app contact:** From the sidebar, **Contact us** (or similar) may open the contact page or your email client.
- For account, billing, or technical issues, include your email and a short description so support can help quickly.

---

*This documentation is based on the current Costra application. If something doesn’t match what you see in the app, the product may have changed; we recommend checking in-app help or contacting support. Items marked “TODO” are for the team to verify (e.g. plan limits, provider support, and feature availability).*

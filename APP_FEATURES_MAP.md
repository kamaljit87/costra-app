# Costra App - Complete Features & UI Mapping

## Application Overview
**Costra** is a multi-cloud cost management platform that helps teams track, optimize, and manage cloud spending across AWS, Azure, GCP, DigitalOcean, IBM Cloud, Linode, and Vultr. The app supports global currency conversion and provides FinOps capabilities including cost allocation, anomaly detection, unit economics, and cost optimization insights.

---

## User Flows

### 1. **Public/Unauthenticated Flows**

#### 1.1 Landing Page Flow
- **Route:** `/`
- **Components:** `LandingPage.tsx`
- **Features:**
  - Hero section with value proposition
  - Currency support highlight section
  - Feature showcase (Cost Optimization, Security, Real-Time Insights)
  - Call-to-action sections
  - Navigation to Sign In / Sign Up
- **User Actions:**
  - Click "Get Started" → Navigate to `/signup`
  - Click "Sign In" → Navigate to `/login`
  - Click "Try Demo" → Navigate to `/login` (demo mode)

#### 1.2 Authentication Flows

**Login Flow**
- **Route:** `/login`
- **Components:** `LoginPage.tsx`, `GoogleSignInButton.tsx`
- **Features:**
  - Email/password login form
  - Google OAuth sign-in
  - Demo mode access
  - Link to signup page
- **User Actions:**
  - Enter credentials → Submit → Navigate to `/dashboard`
  - Click "Try Demo Mode" → Auto-login → Navigate to `/dashboard`
  - Click "Sign up" link → Navigate to `/signup`

**Signup Flow**
- **Route:** `/signup`
- **Components:** `SignupPage.tsx`, `GoogleSignInButton.tsx`
- **Features:**
  - Registration form (name, email, password, confirm password)
  - Password validation (min 8 characters)
  - Google OAuth sign-up
  - Demo mode access
  - Link to login page
- **User Actions:**
  - Fill form → Submit → Navigate to `/dashboard`
  - Click "Try Demo Mode" → Auto-login → Navigate to `/dashboard`
  - Click "Sign in" link → Navigate to `/login`

---

### 2. **Authenticated Flows**

#### 2.1 Dashboard Flow
- **Route:** `/dashboard`
- **Components:** 
  - `Dashboard.tsx`
  - `Layout.tsx` (wraps all authenticated pages)
  - `TopNav.tsx` (desktop navigation)
  - `Sidebar.tsx` (mobile navigation)
  - `Breadcrumbs.tsx`
  - `TotalBillSummary.tsx`
  - `ProviderSection.tsx`
  - `ProviderCostChart.tsx`
  - `SavingsPlansList.tsx`
  - `UntaggedResources.tsx`
  - `AnomalyDetection.tsx`
  - `CostByDimension.tsx`
  - `UnitEconomics.tsx`
- **Features:**
  - **Total Bill Summary:** Aggregated costs across all providers (Current Month, Last Month, Forecast, Credits, Savings)
  - **Untagged Resources:** Actionable list of resources without tags (FinOps best practice)
  - **Anomaly Detection:** Cost anomalies with threshold-based alerts (default 20%)
  - **Cost Allocation by Dimension:** Cost breakdown by tags/dimensions (e.g., Environment, Team, Project)
  - **Unit Economics:** Cost per business metric (cost per customer, per API call, per transaction)
  - **Provider Sections:** Individual provider cards with:
    - Current month cost
    - Last month comparison
    - Forecast
    - Credits
    - Savings
    - Cost trend charts (1M, 2M, 3M, 4M, 6M, 12M views)
  - **Savings Plans:** List of active savings plans and commitments
  - **Sync Data Button:** Refresh all provider data (clears cache)
  - **Demo Mode Banner:** Visible when in demo mode
- **User Actions:**
  - View aggregated cost overview
  - Click provider card → Navigate to `/provider/:providerId`
  - Click "Sync Data" → Refresh all provider costs
  - Filter/view by different time periods (via provider cards)
  - Review untagged resources and take action
  - Review cost anomalies
  - Explore cost allocation by dimensions
  - View unit economics metrics

#### 2.2 Provider Detail Page Flow
- **Route:** `/provider/:providerId` (optional `?account=accountId` for multi-account)
- **Components:**
  - `ProviderDetailPage.tsx`
  - `ProviderCostChart.tsx`
  - `CostVsUsage.tsx`
  - `CostSummary.tsx`
  - `Breadcrumbs.tsx`
  - `FilterBar.tsx` (inline filter bar)
- **Features:**
  - **Provider Header:**
    - Provider icon and name
    - Credits badge (if applicable)
    - Sync button
  - **Summary Cards (4 cards):**
    - Current Month cost with % change vs last month
    - Forecast
    - Credits (if applicable)
    - Savings
  - **Inline Filter Bar:**
    - **Period Pills:** 1M, 2M, 3M, 4M, 6M, 12M, Custom date range
    - **Service Filter:** Dropdown to filter by service (e.g., EC2, S3, Lambda)
    - **Advanced Filters (Collapsible):**
      - Service search
      - Min/Max cost filters
      - Cost change filter (all/increase/decrease)
      - Sort options (cost/name/change, asc/desc)
      - Show/hide credits toggle
  - **Cost Trends Section:**
    - Line/Bar chart toggle (daily/monthly view)
    - Interactive cost chart with tooltips
    - Period selector (integrated in filter bar)
  - **Service Breakdown Section:**
    - Pie chart showing cost distribution by service
    - Service cost table with:
      - Service name
      - Cost amount
      - Percentage of total
      - Change vs previous period
      - Expandable rows for sub-service details
    - Sub-service details include:
      - Category (Compute, Storage, Data Transfer, etc.)
      - Usage type
      - Cost breakdown
  - **Cost vs Usage Section:**
    - Cost per unit metrics (cost per GB, per hour, etc.)
    - Usage efficiency indicators
    - Comparison charts
  - **Plain-English Cost Summary:**
    - AI-generated cost explanation
    - Key insights and recommendations
- **User Actions:**
  - Select time period (pills or custom range)
  - Filter by service
  - Apply advanced filters
  - Toggle chart view (daily/monthly)
  - Expand service rows for sub-details
  - Click "Sync Data" → Refresh provider costs
  - Navigate back to dashboard via breadcrumbs

#### 2.3 Settings Flow
- **Route:** `/settings`
- **Components:**
  - `SettingsPage.tsx`
  - `Breadcrumbs.tsx`
  - `CurrencySelector.tsx`
  - `CloudProviderManager.tsx`
- **Features:**
  - **Tabs:**
    - **General Tab:**
      - Currency preferences selector
      - Currency conversion settings
    - **Cloud Providers Tab:**
      - Add/remove cloud providers
      - Configure provider credentials
      - Manage multiple accounts per provider
      - View sync status
      - Account aliases
- **User Actions:**
  - Change currency preference
  - Add new cloud provider
  - Configure provider credentials (API keys, access tokens)
  - Remove provider
  - Edit account aliases
  - View last sync time

#### 2.4 Profile Flow
- **Route:** `/profile`
- **Components:**
  - `ProfilePage.tsx`
  - `Breadcrumbs.tsx`
- **Features:**
  - **Profile Picture Section:**
    - Avatar upload/remove
    - Image preview
    - File validation (max 5MB, image types only)
  - **Basic Information Section:**
    - Name (editable)
    - Email (editable)
    - Edit/Save/Cancel buttons
  - **Security Section:**
    - Change password form
    - Current password field
    - New password field with strength indicator
    - Confirm password field
    - Password visibility toggles
    - Password strength meter (Weak/Fair/Good/Strong)
  - **Account Information:**
    - Account ID (read-only)
    - Account Type (read-only)
    - Member Since (read-only)
- **User Actions:**
  - Upload/change profile picture
  - Edit name and email
  - Change password
  - View account information

#### 2.5 Debug Page Flow (Development)
- **Route:** `/debug`
- **Components:** `DebugPage.tsx`
- **Features:**
  - API endpoint testing
  - Debug information
  - Development tools

---

## Navigation Structure

### Top Navigation (Desktop - `TopNav.tsx`)
- **Logo:** Clickable, navigates to `/dashboard`
- **Nav Items:**
  - **Dashboard:** Link to `/dashboard`
  - **Providers:** Dropdown menu with:
    - Grouped by provider (AWS first, then alphabetical)
    - Provider name header
    - Account list under each provider
    - Direct links to `/provider/:providerId` or `/provider/:providerId?account=accountId`
    - Empty state if no providers configured
- **User Menu (Dropdown):**
  - User avatar/icon
  - User name and email
  - Profile link → `/profile`
  - Settings link → `/settings`
  - Logout button

### Sidebar (Mobile - `Sidebar.tsx`)
- **Logo:** Clickable, navigates to `/dashboard`
- **Nav Items:**
  - Dashboard link
  - Cloud Accounts section (collapsible):
    - Grouped by provider
    - Expandable provider groups
    - Account links
  - User menu (collapsible):
    - Profile
    - Billing
    - API Debug
    - Settings
  - Logout button (always visible at bottom)

### Breadcrumbs (`Breadcrumbs.tsx`)
- **Dashboard:** `Home > Dashboard`
- **Provider Detail:** `Home > Dashboard > [Provider Name]` (shows selected period if applicable)
- **Settings:** `Home > Settings`
- **Profile:** `Home > Profile`

---

## Main UI Components

### Layout Components

1. **Layout.tsx**
   - Wraps all authenticated pages
   - Includes TopNav (desktop) and Sidebar (mobile)
   - Responsive layout structure

2. **TopNav.tsx**
   - Desktop navigation bar
   - Logo, nav items, user menu
   - Providers dropdown menu
   - Sticky header

3. **Sidebar.tsx**
   - Mobile navigation drawer
   - Collapsible sections
   - User menu
   - Logout button

4. **Breadcrumbs.tsx**
   - Navigation breadcrumb trail
   - Shows current page context
   - Clickable navigation

### Cost Display Components

5. **TotalBillSummary.tsx**
   - Aggregated cost summary cards
   - Current month, last month, forecast, credits, savings
   - Used on Dashboard

6. **ProviderCostCard.tsx**
   - Individual provider cost card
   - Quick cost overview
   - Provider icon and name

7. **ProviderSection.tsx**
   - Detailed provider section on Dashboard
   - Cost metrics and charts
   - Link to provider detail page

8. **ProviderCostChart.tsx**
   - Interactive cost trend chart
   - Line/Bar chart options
   - Daily/Monthly view toggle
   - Tooltips and legends

9. **CostOverview.tsx**
   - Cost overview display
   - Summary statistics

10. **CreditsSavingsCard.tsx**
    - Credits and savings display
    - Highlighted card design

### FinOps Components

11. **CostVsUsage.tsx**
    - Cost per unit analysis
    - Usage efficiency metrics
    - Cost per GB, per hour calculations
    - Comparison charts

12. **CostSummary.tsx**
    - AI-generated plain-English cost summary
    - Key insights and recommendations
    - Natural language explanations

13. **AnomalyDetection.tsx**
    - Cost anomaly detection
    - Threshold-based alerts (default 20%)
    - Anomaly list with details
    - Date range filtering

14. **UntaggedResources.tsx**
    - List of resources without tags
    - Tagging enforcement insights
    - Actionable recommendations
    - Resource count and cost impact

15. **CostByDimension.tsx**
    - Cost allocation by dimension (tags)
    - Dimension selector dropdown
    - Dimension value filter
    - Cost breakdown table
    - Expandable rows for service details
    - Percentage and cost displays

16. **UnitEconomics.tsx**
    - Unit cost analysis
    - Business metrics integration
    - Cost per customer, per API call, per transaction
    - Summary cards (top 3 metrics)
    - Detailed table with all metrics
    - Efficiency indicators (high cost vs efficient)
    - Empty state with guidance

### Filter & Control Components

17. **FilterBar.tsx**
    - Service filter dropdown
    - Credits filter toggle
    - Active filter tags
    - Clear filters button

18. **CurrencySelector.tsx**
    - Currency selection dropdown
    - Supported currencies: USD, EUR, GBP, INR, JPY, CNY, AUD, CAD, CHF, SGD, etc.
    - Real-time conversion display

### Provider Management Components

19. **CloudProviderManager.tsx**
    - Add/remove cloud providers
    - Provider configuration forms
    - Account management
    - Sync status display
    - Provider list with actions

20. **CloudProviderIcons.tsx**
    - Provider icon components
    - Provider color utilities
    - Icon rendering for AWS, Azure, GCP, etc.

### Savings Components

21. **SavingsPlansList.tsx**
    - List of active savings plans
    - Reserved instances display
    - Commitment plans
    - Savings breakdown

### Authentication Components

22. **GoogleSignInButton.tsx**
    - Google OAuth sign-in/sign-up button
    - Handles OAuth flow

### Utility Components

23. **Notification.tsx**
    - Toast notifications
    - Success/error/warning messages
    - Auto-dismiss functionality

24. **AIChat.tsx**
    - AI chat interface (if implemented)
    - Cost-related queries

---

## Key Features by Category

### Cost Tracking
- Multi-provider cost aggregation
- Daily and monthly cost trends
- Historical cost data (1M, 2M, 3M, 4M, 6M, 12M)
- Custom date range selection
- Service-level cost breakdown
- Sub-service cost details
- Cost forecasting
- Credits tracking
- Savings tracking

### Cost Analysis
- Cost vs Usage metrics
- Cost allocation by dimension (tags)
- Unit economics (cost per business metric)
- Cost anomaly detection
- Plain-English cost summaries
- Cost trend visualization
- Service cost distribution (pie charts)
- Cost change indicators (% change vs previous period)

### Cost Optimization
- Untagged resources identification
- Savings plans tracking
- Reserved instances display
- Cost efficiency indicators
- Anomaly alerts

### Multi-Cloud Support
- AWS integration
- Azure integration
- GCP integration
- DigitalOcean integration
- IBM Cloud integration
- Linode integration
- Vultr integration
- Multi-account support per provider

### Currency & Localization
- Multi-currency support (USD, EUR, GBP, INR, JPY, CNY, AUD, CAD, CHF, SGD, etc.)
- Real-time currency conversion
- Currency selector
- Localized cost displays

### Data Management
- Manual sync functionality
- Cache management
- Data refresh controls
- Last sync time display

### User Management
- User authentication (email/password)
- Google OAuth
- Demo mode
- Profile management
- Password management
- Avatar upload

---

## UI Patterns & Design Elements

### Color Scheme
- Primary: Blue tones (primary-500, primary-600)
- Accent: Complementary colors
- Success: Green (for credits, savings)
- Warning: Amber/Orange
- Error: Red
- Provider-specific colors (AWS orange, Azure blue, GCP colors, etc.)

### Typography
- Headings: Bold, large sizes (text-3xl, text-5xl)
- Body: Regular weight, readable sizes
- Labels: Medium weight, smaller sizes

### Layout Patterns
- **Centered Layout:** Max-width containers (1600px, 1920px) with `mx-auto`
- **Card-based Design:** Rounded cards with shadows
- **Grid Layouts:** Responsive grids for cost cards
- **Spacious Padding:** Generous whitespace (px-8, px-12, px-16, py-12)
- **Centered Content:** Text-center for headers and key sections

### Interactive Elements
- **Pill Buttons:** Rounded pill-style period selectors
- **Dropdown Menus:** Service filters, provider menus
- **Toggle Switches:** View mode toggles, filter toggles
- **Expandable Rows:** Service details, sub-services
- **Collapsible Sections:** Advanced filters, provider groups
- **Hover States:** Interactive feedback on buttons and links
- **Loading States:** Spinners, skeleton screens
- **Empty States:** Helpful messages when no data

### Data Visualization
- **Line Charts:** Cost trends over time
- **Bar Charts:** Monthly aggregations
- **Pie Charts:** Service cost distribution
- **Tooltips:** Interactive chart tooltips
- **Legends:** Chart legends with colors
- **Responsive Charts:** Adapt to container size

### Responsive Design
- **Desktop:** TopNav visible, Sidebar hidden
- **Mobile:** Sidebar drawer, TopNav simplified
- **Breakpoints:** sm, md, lg, xl
- **Flexible Grids:** Responsive grid columns

---

## State Management

### Contexts
- **AuthContext:** User authentication, demo mode
- **CurrencyContext:** Currency selection, conversion
- **FilterContext:** Global filter state
- **NotificationContext:** Toast notifications

### Local State
- Component-level state for:
  - Loading states
  - Form inputs
  - UI toggles (dropdowns, modals)
  - Selected filters
  - Chart data
  - Expanded/collapsed states

---

## API Integration

### Endpoints Used
- `/api/auth/*` - Authentication
- `/api/cloud-providers/*` - Provider management
- `/api/cost-data/*` - Cost data retrieval
- `/api/insights/*` - FinOps insights:
  - `/api/insights/anomalies` - Anomaly detection
  - `/api/insights/cost-vs-usage` - Cost vs usage
  - `/api/insights/cost-summary` - AI cost summary
  - `/api/insights/untagged-resources` - Untagged resources
  - `/api/insights/dimensions` - Available dimensions
  - `/api/insights/cost-by-dimension` - Cost by dimension
  - `/api/insights/business-metrics` - Business metrics (POST/GET)
  - `/api/insights/unit-economics` - Unit economics
- `/api/sync/*` - Data synchronization
- `/api/profile/*` - User profile management

---

## File Structure Summary

```
src/
├── pages/
│   ├── LandingPage.tsx
│   ├── LoginPage.tsx
│   ├── SignupPage.tsx
│   ├── Dashboard.tsx
│   ├── ProviderDetailPage.tsx
│   ├── SettingsPage.tsx
│   ├── ProfilePage.tsx
│   └── DebugPage.tsx
├── components/
│   ├── Layout.tsx
│   ├── TopNav.tsx
│   ├── Sidebar.tsx
│   ├── Breadcrumbs.tsx
│   ├── TotalBillSummary.tsx
│   ├── ProviderSection.tsx
│   ├── ProviderCostChart.tsx
│   ├── CostVsUsage.tsx
│   ├── CostSummary.tsx
│   ├── AnomalyDetection.tsx
│   ├── UntaggedResources.tsx
│   ├── CostByDimension.tsx
│   ├── UnitEconomics.tsx
│   ├── FilterBar.tsx
│   ├── CurrencySelector.tsx
│   ├── CloudProviderManager.tsx
│   ├── SavingsPlansList.tsx
│   └── ... (other components)
├── contexts/
│   ├── AuthContext.tsx
│   ├── CurrencyContext.tsx
│   ├── FilterContext.tsx
│   └── NotificationContext.tsx
└── services/
    ├── api.ts
    └── costService.ts
```

---

## Design Notes for Redesign

### Current Strengths
- Clean, modern card-based design
- Good use of whitespace
- Centered layout approach
- Responsive design
- Clear visual hierarchy
- Consistent color scheme

### Areas for Enhancement
- More consistent spacing system
- Enhanced visual hierarchy
- Improved data visualization consistency
- Better mobile experience
- More intuitive navigation
- Enhanced filter UX
- Better empty states
- More engaging animations/transitions

---

This document provides a comprehensive overview of all features, screens, user flows, and UI components in the Costra application. Use this as a reference for UI/UX redesign planning.

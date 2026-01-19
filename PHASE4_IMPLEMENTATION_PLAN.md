# Phase 4: Enterprise Features Implementation Plan

## Overview
Phase 4 focuses on enterprise-level features that enable cost control, team accountability, and organizational cost management.

## Features to Implement

### 1. Cost Budgets & Alerts ✅ **HIGHEST PRIORITY**
**Goal**: Enable users to set budgets and receive alerts when approaching or exceeding limits

**Implementation Details:**

#### Backend:
- **Database Schema**: Create `budgets` table
  ```sql
  CREATE TABLE budgets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    account_id INTEGER,
    provider_id TEXT,
    budget_name TEXT NOT NULL,
    budget_amount DECIMAL(15, 2) NOT NULL,
    budget_period TEXT NOT NULL, -- 'monthly', 'quarterly', 'yearly'
    alert_threshold INTEGER DEFAULT 80, -- Alert at 80% of budget
    current_spend DECIMAL(15, 2) DEFAULT 0,
    status TEXT DEFAULT 'active', -- 'active', 'paused', 'exceeded'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (account_id) REFERENCES cloud_provider_credentials(id) ON DELETE CASCADE
  )
  ```

- **Database Functions**:
  - `createBudget(userId, budgetData)` - Create new budget
  - `updateBudget(userId, budgetId, budgetData)` - Update existing budget
  - `deleteBudget(userId, budgetId)` - Delete budget
  - `getBudgets(userId, providerId, accountId)` - Get all budgets
  - `checkBudgetAlerts(userId)` - Check if budgets are approaching/exceeded
  - `updateBudgetSpend(userId, providerId, accountId, period)` - Update current spend

- **API Endpoints**:
  - `POST /api/budgets` - Create budget
  - `GET /api/budgets` - List all budgets
  - `GET /api/budgets/:budgetId` - Get specific budget
  - `PATCH /api/budgets/:budgetId` - Update budget
  - `DELETE /api/budgets/:budgetId` - Delete budget
  - `GET /api/budgets/alerts` - Get budget alerts
  - `POST /api/budgets/:budgetId/check` - Manually check budget status

#### Frontend:
- **Components**:
  - `BudgetsPage.tsx` - Main budget management page
  - `BudgetCard.tsx` - Individual budget card component
  - `BudgetForm.tsx` - Create/edit budget form
  - `BudgetAlerts.tsx` - Alert display component
  - `BudgetWidget.tsx` - Dashboard widget showing budget status

- **Features**:
  - Create budgets for provider/account/service
  - Set monthly/quarterly/yearly budgets
  - Configure alert thresholds (default 80%)
  - View current spend vs budget
  - Visual indicators (progress bars, color coding)
  - Alert notifications
  - Budget history/trends

**Data Sources:**
- `cost_data` table (for current spend)
- `daily_cost_data` table (for period calculations)
- `budgets` table (for budget definitions)

**Example UI:**
```
Budget: AWS Production - $5,000/month
Current Spend: $4,200 (84%)
Progress: [████████████████░░░░] 84%
Status: ⚠️ Alert (exceeded 80% threshold)
```

---

### 2. Product/Team-Level Cost Visibility ✅ **HIGH PRIORITY**
**Goal**: Aggregate and display costs by product line or team using tags

**Implementation Details:**

#### Backend:
- **Database**: Use existing `resource_tags` table (filter by `product` or `team` tag)
- **Database Functions**:
  - `getCostByProduct(userId, startDate, endDate, providerId, accountId)` - Aggregate by product tag
  - `getCostByTeam(userId, startDate, endDate, providerId, accountId)` - Aggregate by team tag
  - `getProductCostTrends(userId, productName, startDate, endDate)` - Historical product costs
  - `getTeamCostTrends(userId, teamName, startDate, endDate)` - Historical team costs

- **API Endpoints**:
  - `GET /api/insights/cost-by-product` - Get costs grouped by product
  - `GET /api/insights/cost-by-team` - Get costs grouped by team
  - `GET /api/insights/product/:productName/trends` - Product cost trends
  - `GET /api/insights/team/:teamName/trends` - Team cost trends

#### Frontend:
- **Components**:
  - `ProductCostView.tsx` - Product-level cost dashboard
  - `TeamCostView.tsx` - Team-level cost dashboard
  - `ProductCostCard.tsx` - Product cost summary card
  - `TeamCostCard.tsx` - Team cost summary card

- **Features**:
  - Product/team cost aggregation
  - Cost trends over time
  - Service breakdown by product/team
  - Drill-down capabilities
  - Product/team filters in main dashboard
  - Cost comparison between products/teams

**Data Sources:**
- `resources` table (resource costs)
- `resource_tags` table (product/team tags)
- `cost_data` table (aggregated costs)

**Example UI:**
```
Product: Mobile App
Total Cost: $1,250/month
Services: EC2 ($800), S3 ($300), Lambda ($150)
Trend: ↗️ +15% vs last month
```

---

### 3. Showback/Chargeback Reports ⚠️ **MEDIUM PRIORITY**
**Goal**: Generate downloadable reports showing costs allocated to teams/products

**Implementation Details:**

#### Backend:
- **Database Functions**:
  - `generateShowbackReport(userId, startDate, endDate, teamId)` - Generate showback report
  - `generateChargebackReport(userId, startDate, endDate, teamId)` - Generate chargeback report

- **API Endpoints**:
  - `POST /api/reports/showback` - Generate showback report (returns PDF/CSV)
  - `POST /api/reports/chargeback` - Generate chargeback report (returns PDF/CSV)
  - `GET /api/reports/:reportId` - Get generated report

- **Report Generation**:
  - PDF generation (using `pdfkit` or `puppeteer`)
  - CSV export
  - Report templates
  - Include: Monthly summaries, resource breakdown, cost trends

#### Frontend:
- **Components**:
  - `ReportsPage.tsx` - Report generation UI
  - `ReportPreview.tsx` - Report preview component
  - `ReportHistory.tsx` - Previously generated reports

- **Features**:
  - Select date range
  - Choose report type (showback/chargeback)
  - Select teams/products to include
  - Preview before download
  - Download PDF or CSV
  - Report history

**Estimated Effort**: 8-10 hours (can be deferred if needed)

---

## Implementation Order

### Priority 1: Cost Budgets & Alerts (Start Here)
1. Create database schema for budgets
2. Implement backend CRUD operations
3. Implement budget alert checking logic
4. Create API endpoints
5. Build BudgetsPage component
6. Build BudgetAlerts component
7. Add budget widgets to Dashboard
8. Test budget creation and alerts

### Priority 2: Product/Team-Level Cost Visibility
1. Implement backend aggregation functions
2. Create API endpoints
3. Build ProductCostView component
4. Build TeamCostView component
5. Add product/team filters to Dashboard
6. Test with tagged resources

### Priority 3: Showback/Chargeback Reports (Optional)
1. Implement report generation backend
2. Add PDF/CSV export functionality
3. Create ReportsPage component
4. Test report generation

---

## Database Schema

### Budgets Table
```sql
CREATE TABLE budgets (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  account_id INTEGER,
  provider_id TEXT,
  budget_name TEXT NOT NULL,
  budget_amount DECIMAL(15, 2) NOT NULL,
  budget_period TEXT NOT NULL CHECK (budget_period IN ('monthly', 'quarterly', 'yearly')),
  alert_threshold INTEGER DEFAULT 80 CHECK (alert_threshold >= 0 AND alert_threshold <= 100),
  current_spend DECIMAL(15, 2) DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'exceeded')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (account_id) REFERENCES cloud_provider_credentials(id) ON DELETE CASCADE
);

CREATE INDEX idx_budgets_user ON budgets(user_id);
CREATE INDEX idx_budgets_provider ON budgets(user_id, provider_id);
CREATE INDEX idx_budgets_account ON budgets(user_id, account_id);
```

### Budget Alerts Table (Optional - for alert history)
```sql
CREATE TABLE budget_alerts (
  id SERIAL PRIMARY KEY,
  budget_id INTEGER NOT NULL,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('threshold', 'exceeded')),
  alert_percentage INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (budget_id) REFERENCES budgets(id) ON DELETE CASCADE
);

CREATE INDEX idx_budget_alerts_budget ON budget_alerts(budget_id);
```

---

## API Endpoints

### Budgets API

#### Create Budget
```
POST /api/budgets
Body: {
  "budgetName": "AWS Production Budget",
  "providerId": "aws",
  "accountId": 1,
  "budgetAmount": 5000.00,
  "budgetPeriod": "monthly",
  "alertThreshold": 80
}
Response: { "budget": {...}, "message": "Budget created successfully" }
```

#### List Budgets
```
GET /api/budgets?providerId=aws&accountId=1
Response: { "budgets": [...] }
```

#### Get Budget
```
GET /api/budgets/:budgetId
Response: { "budget": {...} }
```

#### Update Budget
```
PATCH /api/budgets/:budgetId
Body: { "budgetAmount": 6000.00, "alertThreshold": 85 }
Response: { "budget": {...}, "message": "Budget updated successfully" }
```

#### Delete Budget
```
DELETE /api/budgets/:budgetId
Response: { "message": "Budget deleted successfully" }
```

#### Get Budget Alerts
```
GET /api/budgets/alerts
Response: { "alerts": [...] }
```

#### Check Budget Status
```
POST /api/budgets/:budgetId/check
Response: { "budget": {...}, "status": "ok|warning|exceeded", "percentage": 84 }
```

### Product/Team Cost API

#### Get Costs by Product
```
GET /api/insights/cost-by-product?startDate=2025-01-01&endDate=2025-01-31&providerId=aws
Response: {
  "products": [
    {
      "productName": "Mobile App",
      "totalCost": 1250.00,
      "serviceCount": 5,
      "services": [...]
    }
  ]
}
```

#### Get Costs by Team
```
GET /api/insights/cost-by-team?startDate=2025-01-01&endDate=2025-01-31
Response: {
  "teams": [
    {
      "teamName": "Backend",
      "totalCost": 3500.00,
      "serviceCount": 8,
      "services": [...]
    }
  ]
}
```

---

## Component Structure

### BudgetsPage.tsx
```typescript
interface Budget {
  id: number
  budgetName: string
  providerId?: string
  accountId?: number
  budgetAmount: number
  budgetPeriod: 'monthly' | 'quarterly' | 'yearly'
  alertThreshold: number
  currentSpend: number
  status: 'active' | 'paused' | 'exceeded'
  percentage: number
}

interface BudgetsPageProps {
  // No props needed - uses context/route
}
```

### ProductCostView.tsx
```typescript
interface ProductCost {
  productName: string
  totalCost: number
  serviceCount: number
  services: Array<{
    serviceName: string
    cost: number
  }>
  trend?: {
    change: number
    changePercent: number
  }
}

interface ProductCostViewProps {
  startDate?: string
  endDate?: string
  providerId?: string
  accountId?: number
}
```

### TeamCostView.tsx
```typescript
interface TeamCost {
  teamName: string
  totalCost: number
  serviceCount: number
  services: Array<{
    serviceName: string
    cost: number
  }>
  trend?: {
    change: number
    changePercent: number
  }
}

interface TeamCostViewProps {
  startDate?: string
  endDate?: string
  providerId?: string
  accountId?: number
}
```

---

## Integration Points

### Dashboard.tsx
- Add budget summary widget
- Show active budgets and their status
- Display budget alerts
- Quick access to budget management

### ProviderDetailPage.tsx
- Show budget status for current provider
- Budget progress indicator
- Link to budget management

### Navigation
- Add "Budgets" to main navigation
- Add "Products" and "Teams" views (optional tabs or pages)

---

## Styling Guidelines

- Use frozen-water theme consistently
- Budget progress bars with color coding:
  - Green: 0-80% (within threshold)
  - Yellow: 80-100% (approaching limit)
  - Red: >100% (exceeded)
- Alert indicators (badges, icons)
- Responsive design for mobile/tablet

---

## Testing Considerations

1. **Budgets**:
   - Test budget creation with different periods
   - Test alert threshold calculations
   - Test budget status updates
   - Test budget deletion
   - Test with multiple providers/accounts

2. **Product/Team Costs**:
   - Test with tagged resources
   - Test without tags (graceful fallback)
   - Test aggregation accuracy
   - Test date range filtering
   - Test with multiple products/teams

---

## Success Criteria

✅ **Cost Budgets & Alerts:**
- [ ] Budget CRUD operations work correctly
- [ ] Budget alerts trigger at correct thresholds
- [ ] Budget status updates automatically
- [ ] UI displays budget progress clearly
- [ ] Alerts are visible and actionable
- [ ] Frozen-water theme applied

✅ **Product/Team-Level Cost Visibility:**
- [ ] Costs aggregate correctly by product/team tags
- [ ] Trends are calculated and displayed
- [ ] Drill-down functionality works
- [ ] Filters work correctly
- [ ] Empty states are handled gracefully
- [ ] Frozen-water theme applied

---

## Timeline Estimate

- **Cost Budgets & Alerts**: 6-8 hours
- **Product/Team-Level Cost Visibility**: 4-6 hours
- **Showback/Chargeback Reports**: 8-10 hours (optional)
- **Total**: 10-14 hours (without reports), 18-24 hours (with reports)

---

## Next Steps

1. ✅ Create implementation plan (this document)
2. Start with Cost Budgets & Alerts (highest priority)
3. Implement database schema
4. Build backend functions
5. Create API endpoints
6. Build frontend components
7. Integrate into Dashboard
8. Test thoroughly
9. Move to Product/Team Visibility
10. Update implementation status

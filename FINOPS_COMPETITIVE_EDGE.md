# Costra FinOps — Competitive Edge Strategy

**Audience:** Founders, product and engineering leads
**Date:** February 2026
**Scope:** Full codebase analysis (UI, backend, DB schema, billing, integrations, docs)

---

## Executive Summary

Costra is a multi-cloud cost management platform with a solid foundation: 8 cloud provider integrations (AWS with CUR 2.0, Azure, GCP, DigitalOcean, IBM, Linode, Vultr, MongoDB Atlas), AI-powered cost explanations via Claude, anomaly detection, budgets, showback/chargeback reports, unit economics, and a 3-tier subscription model (Trial/Starter/Pro). The product covers the core FinOps "crawl" phase well.

However, the FinOps market has shifted. Competitors like CloudZero, Kubecost, Harness, and Vantage are winning on **real-time granularity**, **container-native cost allocation**, **automated policy enforcement**, and **developer-facing workflows**. Costra's current gaps are primarily in the "run" and "optimize" phases of FinOps maturity.

This document identifies 16 high-impact features across 6 categories, prioritized into a 90-day sprint plan and 6–12 month vision.

**Top 5 features to build next:**
1. Team/Org RBAC hierarchy (unblocks enterprise adoption)
2. ML anomaly detection with Claude root-cause analysis (unique differentiator)
3. Cost policies & guardrails (move from passive alerts to active governance)
4. Forecast scenario modeling (high demo value, planning use case)
5. Kubernetes cost allocation (table-stakes for container-heavy orgs)

---

## 1. Current Product Capabilities

### Visibility
| Feature | Status | Implementation |
|---------|--------|----------------|
| Multi-cloud cost aggregation | **Strong** | 8 providers; `cost_data` + `daily_cost_data` + `service_costs` tables; per-account sync |
| Monthly/daily cost trends | **Strong** | Daily granularity, month-over-month comparison via `CostComparePage` |
| Service-level breakdown | **Strong** | `service_costs` table with change percentages; `CostByDimension` component |
| Resource-level tracking | **Partial** | `resources` + `resource_tags` tables exist but limited UI exposure |
| Tag-based cost allocation | **Partial** | Tags stored and queryable; depends on provider tag quality |
| Untagged resource discovery | **Present** | `UntaggedResources` component, ranked by cost |
| Cost by product/team | **Present** | Dedicated pages and API endpoints; tag-derived |
| Multi-currency support | **Present** | `CurrencyContext` with formatting |
| CSV/PDF export | **Present** | CSV (Starter+), PDF export |
| Saved views/filters | **Present** | User-defined filter templates in `user_views` |

### Optimization
| Feature | Status | Implementation |
|---------|--------|----------------|
| AI cost explanations | **Strong** | Claude-powered monthly change explanations with contributing factors; custom date ranges |
| Optimization engine | **Present** | Rule-based: idle resources, trends, RI opportunities, storage, data transfer, best practices, cross-provider; AI enrichment via Claude |
| Rightsizing recommendations | **Present** | AWS Cost Explorer rightsizing data surfaced |
| Anomaly detection | **Basic** | 30-day rolling baseline in `anomaly_baselines`; static threshold; no ML, no root cause |
| Cost forecasting | **Basic** | Weighted trend extrapolation from daily data; current month only |
| Unit economics | **Present** | Manual business metric entry; cost-per-customer/API-call/transaction; Pro-only |
| Savings plans tracking | **Basic** | CRUD in `savings_plans` table; no utilization analysis |
| Cost efficiency metrics | **Present** | ROI, utilization, efficiency scores via `getCostEfficiencyMetrics` |

### Governance
| Feature | Status | Implementation |
|---------|--------|----------------|
| Budgets with alerts | **Present** | Monthly/quarterly/yearly; threshold alerts; email notifications (Pro) |
| Showback/chargeback reports | **Present** | CSV and PDF generation; team/product/provider filtering |
| Spend goals | **Basic** | Target % reduction with baseline and progress tracking |
| GDPR/DPDPA compliance | **Strong** | Data export, deletion, consent records, grievances |

### Automation
| Feature | Status | Implementation |
|---------|--------|----------------|
| Scheduled sync | **Present** | Configurable per account; parallel multi-provider sync |
| Budget threshold emails | **Present** | Pro tier with email preferences |
| Anomaly email alerts | **Present** | Pro tier, basic threshold trigger |
| Optimization runs | **Present** | Post-sync recommendation generation with Redis locking |

### Integrations
| Feature | Status | Implementation |
|---------|--------|----------------|
| AWS (Cost Explorer + CUR 2.0) | **Strong** | CloudFormation auto-connect, cross-account IAM, S3 Parquet ingestion |
| Azure | **Basic** | Cost Management API only |
| GCP | **Basic** | Cloud Billing API only |
| 5 additional providers | **Basic** | API-based cost fetching (DO, IBM, Linode, Vultr, MongoDB) |
| Slack | **Minimal** | Webhook mention but no deep integration |
| AI (Claude) | **Strong** | Chat, explanations, recommendation enhancement |
| Payments | **Present** | Stripe (legacy) + Dodo Payments (primary) |

### Admin & Platform
| Feature | Status | Implementation |
|---------|--------|----------------|
| Auth | **Strong** | Email/password + Google OAuth + TOTP 2FA |
| RBAC | **Minimal** | Only user/admin roles via `is_admin` flag |
| API keys | **Present** | Read-only key generation |
| Subscription management | **Present** | Trial → Starter → Pro; Stripe + Dodo |
| Support tickets | **Present** | Contact form with admin ticket management |
| Monitoring | **Present** | Prometheus metrics, Sentry, Winston logging, health checks |

### Pricing Logic
| | Trial | Starter | Pro |
|---|-------|---------|-----|
| Duration | 7 days | Monthly/Annual | Monthly/Annual |
| Historical Data | 12 months | 6 months | 12 months |
| Max Accounts | Unlimited | 3 | Unlimited |
| CSV Export | No | Yes | Yes |
| Email Alerts | No | No | Yes |
| Unit Economics | No | No | Yes |
| Scheduled Sync | No | Yes | Yes |

---

## 2. Market & Competitor Feature Map

| Capability | Costra | CloudZero | Vantage | Kubecost | Harness CCM | CloudHealth |
|------------|--------|-----------|---------|----------|-------------|-------------|
| Multi-cloud visibility | ✓ (8) | ✓ (3) | ✓ (6+) | K8s only | ✓ (3) | ✓ (3) |
| Kubernetes cost allocation | — | ✓ | ✓ | **Core** | ✓✓ | ✓ |
| Container cost per microservice | — | ✓✓ | — | ✓✓ | ✓ | — |
| ML anomaly detection | — | ✓ | ✓ | — | ✓ | ✓ |
| Cost policies / guardrails | — | — | ✓ | — | ✓✓ | ✓ |
| Forecast scenario modeling | — | — | ✓ | — | ✓ | ✓ |
| Unit economics (automated) | Partial | ✓✓ | — | — | — | — |
| RI/SP utilization analysis | — | ✓ | ✓ | — | ✓ | ✓✓ |
| Team/org hierarchy RBAC | — | ✓ | ✓ | — | ✓✓ | ✓✓ |
| Approval workflows | — | — | — | — | ✓ | ✓ |
| Terraform/IaC cost estimation | — | — | ✓ | — | — | — |
| SaaS spend management | — | — | ✓ | — | — | — |
| Slack/Teams deep integration | — | ✓ | ✓ | — | ✓ | ✓ |
| AI-powered insights | **✓ (Claude)** | — | — | — | ✓ | — |
| Natural language queries | — | — | — | — | — | — |
| Open API | Partial | ✓ | ✓ | ✓ | ✓ | ✓ |

**Key insight**: Costra's Claude AI integration and broad provider coverage (8 providers) are genuine differentiators. The biggest gaps are Kubernetes, policy enforcement, advanced anomaly detection, RBAC, and team workflows.

---

## 3. Gap Analysis

### Critical Gaps (blocking enterprise/team adoption)

1. **No team/org RBAC hierarchy** — Only user/admin roles. Engineering managers can't see only their team's costs. Finance can't get org-wide rollups without full admin. This blocks any company with >5 engineers from adopting Costra seriously.

2. **No Kubernetes / container cost allocation** — K8s is where most cloud spend growth happens. Without namespace/pod/label cost attribution, Costra is invisible to platform engineering teams. This is a deal-breaker in evaluations against Kubecost or Harness.

3. **No cost policies or automated guardrails** — Budgets exist but are passive (alert-only). No way to enforce spend limits, require approval for provisioning, or flag policy violations. Competitors like Harness and CloudHealth offer this.

### High-Impact Gaps (competitive disadvantage)

4. **Anomaly detection is primitive** — Static threshold on 30-day rolling average. No seasonality adjustment, no ML scoring, no root-cause analysis. Competitors flag the *why* alongside the spike. Costra's Claude integration could make root-cause analysis a unique strength.

5. **Forecasting is single-month linear** — No scenario modeling ("what if we add 3 instances?"), no multi-month projection, no confidence intervals. This limits planning use cases.

6. **RI/SP utilization tracking is absent** — `savings_plans` table stores plans but doesn't track utilization rates, coverage gaps, or expiration risk. This is low-hanging fruit with high value.

7. **Unit economics requires manual entry** — CloudZero auto-correlates costs to business telemetry. Costra requires users to manually type in customer counts monthly. High friction.

### Moderate Gaps (differentiation opportunities)

8. **No Terraform/IaC cost estimation** — Vantage offers pre-deployment cost previews. Shift-left FinOps is emerging.

9. **No SaaS spend tracking** — Datadog, Snowflake costs are invisible.

10. **Slack/Teams integration is shallow** — No interactive bot, slash commands, or daily digests.

11. **No cost allocation rules engine** — Can't split shared costs (e.g., 60/40 between teams).

---

## 4. Proposed Features for Competitive Advantage

### Category: Governance

#### 4.1 Team/Org Hierarchy & Scoped RBAC [P0]
- **Problem**: Only user/admin roles. Can't give an engineering manager visibility into only their team's spend, or let finance see org-wide without admin powers.
- **Persona**: Engineering managers, finance, FinOps practitioners, any company >5 people.
- **Competitive advantage**: Essential for multi-user adoption. Without this, Costra is limited to single-user setups. Every competitor has this.
- **Implementation**:
  - New tables: `organizations` (id, name, slug), `teams` (id, org_id, name), `team_members` (team_id, user_id, role: viewer/editor/admin)
  - Scope all cost queries by org → team membership
  - Org-level admin sees all teams; team admin sees only their team; viewer is read-only
  - Invite flow: email-based team invitations with existing email service
  - Migrate existing users to a default org/team
  - Attach subscription to org (not user)

#### 4.2 Cost Policies & Guardrails [P0]
- **Problem**: Budgets alert after overspend. No way to prevent waste proactively or enforce tagging/spend rules.
- **Persona**: FinOps practitioners, engineering managers, finance.
- **Competitive advantage**: Policy-as-code is emerging but most tools (except Harness) don't do it simply. Costra can make it accessible.
- **Implementation**:
  - New `cost_policies` table: condition (service/tag/amount threshold), action (alert/block/require-approval), scope (account/team/org)
  - Policy engine evaluates on each sync: flag violations, create notifications
  - Example policies: "Alert if any single service exceeds $500/day", "Flag untagged resources over $50/month", "Notify when account spend exceeds 120% of last month"
  - Frontend: policy builder with condition/action UI, violation log dashboard
  - Start with alert-only actions; add webhook-based blocking later

#### 4.3 FinOps Review Workflows [P1]
- **Problem**: No structured process for reviewing cost changes, approving optimizations, or tracking who acknowledged an anomaly.
- **Persona**: FinOps practitioners, engineering managers in teams.
- **Competitive advantage**: Turns Costra from a dashboard into a workflow tool — increases stickiness and daily usage.
- **Implementation**:
  - New `workflow_items` table: type (anomaly_review/optimization_approval/budget_review), status (open/in_review/approved/rejected), assignee, comments
  - When anomaly detected → create review item assigned to account owner
  - When optimization recommended → create approval item
  - Weekly cost review digest: auto-generated summary of changes, open items, pending actions
  - Frontend: `/reviews` page with inbox-style UI, comment threads, status transitions

---

### Category: Optimization

#### 4.4 ML Anomaly Detection with Claude Root-Cause Analysis [P0]
- **Problem**: Current anomaly detection uses a flat 30-day average. It misses seasonal patterns, flags expected spikes (month-end batch jobs), and doesn't explain *why* costs spiked.
- **Persona**: FinOps practitioners, engineering managers, SREs.
- **Competitive advantage**: Claude integration gives Costra a unique ability to generate natural-language root cause analysis that no competitor can match. This is Costra's strongest differentiator.
- **Implementation**:
  - Replace static baseline with time-series decomposition (Holt-Winters or STL in JS — no heavy ML library needed) to handle seasonality and trends
  - When anomaly detected: query service-level breakdown for that day, identify which services/resources drove the spike
  - Feed anomaly context to Claude: "EC2 costs spiked 40% because 12 new c5.xlarge instances launched in us-east-1, likely related to deployment X"
  - New `anomaly_events` table with severity, root cause text, affected services, resolution status
  - Slack/email alert with one-click "acknowledge" or "investigate" links
  - Reuse existing `anomaly_baselines` table for backward compatibility

#### 4.5 Forecast Scenario Modeling [P0]
- **Problem**: Linear single-month forecasting doesn't answer "what if we scale to 2x users?" or "what if we migrate to Fargate?"
- **Persona**: Engineering leads, finance, founders planning budgets.
- **Competitive advantage**: Most competitors offer basic forecasting. Scenario modeling + Claude narrative is unique.
- **Implementation**:
  - Extend `calculateForecastFromTrend` to produce 3–12 month projections with confidence intervals
  - Scenario parameters: growth rate override, add/remove services, pricing changes
  - Claude generates narrative: "At 15% monthly growth, you'll hit $50K/month by Q3. Switching RDS to Aurora Serverless could save $2,100/month"
  - Frontend: interactive sliders for growth rate, toggle services on/off, overlay scenario curves
  - New API: `GET /api/cost-data/forecast?months=6&scenario_id=X`
  - Save/compare scenarios in `forecast_scenarios` table

#### 4.6 RI/SP Coverage & Utilization Dashboard [P1]
- **Problem**: Teams buy Reserved Instances or Savings Plans but don't track utilization. Unused commitments are wasted money.
- **Persona**: FinOps practitioners, cloud architects.
- **Competitive advantage**: Connects RI/SP data with actual usage to surface waste.
- **Implementation**:
  - For AWS: fetch via `GetSavingsPlansUtilization` and `GetReservationUtilization` Cost Explorer APIs
  - Extend `savings_plans` table: add `utilization_percent`, `coverage_percent`, `unused_value`, `expiration_alert_days`
  - Frontend: utilization gauge, coverage heatmap by service, expiration timeline
  - Alert when utilization drops below threshold or plan expires within 30 days

#### 4.7 Automated Unit Economics via Integrations [P1]
- **Problem**: Manual metric entry is high friction. Nobody remembers to update customer counts monthly.
- **Persona**: Founders, product managers, finance.
- **Competitive advantage**: CloudZero requires complex instrumentation. Costra can offer simple webhook/API integrations.
- **Implementation**:
  - Webhook endpoint: `POST /api/business-metrics/ingest` (accepts metric_type, value, date)
  - Pre-built integrations: Stripe (customer count, MRR via API), custom metric polling
  - Auto-calculate cost-per-customer, cost-per-transaction without manual entry
  - Trend charts: unit cost trajectory over time with anomaly flagging
  - Reuse existing `business_metrics` table and `getUnitEconomics` logic

---

### Category: Visibility

#### 4.8 Kubernetes Cost Allocation [P0]
- **Problem**: Platform teams can't attribute K8s cluster costs to namespaces, deployments, or labels. Shared clusters make cost accountability impossible.
- **Persona**: Platform engineers, FinOps practitioners, engineering managers.
- **Competitive advantage**: Combines Costra's multi-cloud breadth with K8s depth — most tools do one or the other.
- **Implementation**:
  - Lightweight agent (DaemonSet) that reads Prometheus metrics (CPU/memory requests vs actual usage per pod/namespace)
  - New tables: `k8s_clusters`, `k8s_namespace_costs`, `k8s_workload_costs`
  - Agent pushes metrics to Costra API via existing API key auth
  - Backend correlates K8s node costs (from cloud bill) with pod-level resource consumption
  - Frontend: `/kubernetes` page with namespace breakdown, idle pod detection, right-sizing at pod level
  - Alternative v1: integrate with Kubecost API for orgs that already run it

#### 4.9 Cost Allocation Rules Engine [P1]
- **Problem**: Shared resources (load balancers, databases, networking) can't be fairly split between teams or products.
- **Persona**: FinOps practitioners, finance teams.
- **Competitive advantage**: Makes showback/chargeback reports accurate for shared infrastructure.
- **Implementation**:
  - New `cost_allocation_rules` table: source filter (service/tag/resource), split method (even/proportional/fixed %), target teams/products
  - Apply rules during report generation and cost-by-team/product calculations
  - Frontend: rules editor in Settings with preview of allocation impact

---

### Category: Automation

#### 4.10 Slack/Teams Bot with Interactive Actions [P1]
- **Problem**: Engineers live in Slack. Switching to a dashboard breaks workflow.
- **Persona**: Engineers, SREs, engineering managers.
- **Competitive advantage**: Interactive bot (not just webhooks) with slash commands and action buttons.
- **Implementation**:
  - Slack app with OAuth installation flow
  - Commands: `/costra summary` (today's spend), `/costra anomalies` (open anomalies), `/costra budget [name]`
  - Interactive messages: "Cost spike on EC2 (+$340/day). [Investigate] [Acknowledge] [Mute]"
  - Daily/weekly digest to configured channel
  - Store Slack tokens in `slack_integrations` table

#### 4.11 Scheduled Report Delivery [P1]
- **Problem**: Reports must be manually generated. Finance wants weekly PDFs in their inbox.
- **Persona**: Finance teams, engineering managers.
- **Competitive advantage**: Low effort, high perceived value. Currently missing table-stakes feature.
- **Implementation**:
  - New `report_schedules` table: report_type, frequency (daily/weekly/monthly), recipients, filters
  - Cron job generates reports on schedule, emails via existing email service
  - Frontend: "Schedule this report" button on reports page

---

### Category: Integrations

#### 4.12 Terraform Plan Cost Estimation [P2]
- **Problem**: Engineers don't know what infrastructure changes will cost until after deployment.
- **Persona**: DevOps engineers, platform teams.
- **Competitive advantage**: Shift-left FinOps. Only Vantage and Infracost offer this today.
- **Implementation**:
  - CLI tool or GitHub Action that parses `terraform plan -json` output
  - Maps resource types to pricing (AWS/Azure/GCP pricing APIs or static pricing tables)
  - Posts cost estimate as PR comment: "This change adds 3x c5.xlarge → estimated +$450/month"
  - API endpoint: `POST /api/terraform/estimate` accepts plan JSON
  - Start with AWS EC2/RDS/S3 pricing, expand incrementally

#### 4.13 SaaS Spend Tracking [P2]
- **Problem**: Datadog, Snowflake, GitHub are significant cost centers invisible to FinOps.
- **Persona**: Finance, engineering managers.
- **Competitive advantage**: Vantage is the only competitor doing this well. Large unmet need.
- **Implementation**:
  - New provider type: `saas` with manual invoice upload (CSV) or API integrations
  - Priority integrations: Datadog API, Snowflake usage API, GitHub billing API
  - New table `saas_costs`: provider, service, date, cost, usage_quantity
  - Include SaaS costs in total spend views, reports, and forecasts

---

### Category: AI & Intelligence

#### 4.14 Enhanced AI Cost Advisor [P1]
- **Problem**: AI chat answers questions but doesn't proactively surface insights or connect patterns.
- **Persona**: All users.
- **Competitive advantage**: Costra already has Claude — no competitor has this depth of AI. Push it further.
- **Implementation**:
  - Weekly AI-generated "Cost Intelligence Brief": top 3 insights, risks, opportunities
  - Proactive alerts: "Your EC2 pattern suggests a Compute Savings Plan would save $2,400/year"
  - Connect anomaly → root cause → recommendation in one narrative
  - Store user feedback on recommendations (thumbs up/down) to improve relevance
  - Extend existing `/api/ai/chat` and `/api/ai/insights` endpoints

#### 4.15 Natural Language Cost Queries [P1]
- **Problem**: Users navigate multiple pages to answer "How much did Team Alpha spend on RDS last quarter?"
- **Persona**: Engineering managers, finance, non-technical stakeholders.
- **Competitive advantage**: Nobody else offers natural language querying of cost data. Claude makes this uniquely feasible for Costra.
- **Implementation**:
  - Extend `/api/ai/chat` to translate natural language → database queries
  - Claude generates query plan, executes against cost data, returns formatted answer
  - Support: "Compare this month vs last for EC2", "Which team has fastest growing spend?", "Show untagged resources over $100/month"
  - Frontend: prominent search bar on dashboard with conversational UI

---

## 5. 90-Day Roadmap

### Weeks 1–3: Multi-User Foundation [P0]
| Week | Deliverable | Rationale |
|------|-------------|-----------|
| 1 | `organizations`, `teams`, `team_members` tables + migration | Unblocks all team features, RBAC, scoped views |
| 2 | Team invitation flow + scoped cost queries in all APIs | Minimum viable multi-user |
| 3 | Cost policies engine (alert-only mode) | Quick win — reuses budget alert infrastructure, adds `cost_policies` table |

### Weeks 4–6: Intelligent Anomalies & Forecasting [P0]
| Week | Deliverable | Rationale |
|------|-------------|-----------|
| 4 | Holt-Winters anomaly detection replacing static baseline | Dramatically reduces false positives, handles seasonality |
| 5 | Claude root-cause analysis for anomalies + `anomaly_events` table | Differentiating feature — turns cost spikes into explanations |
| 6 | Multi-month forecast + scenario modeling (growth slider + Claude narrative) | High demo value, founder/finance-facing |

### Weeks 7–9: Kubernetes MVP [P0]
| Week | Deliverable | Rationale |
|------|-------------|-----------|
| 7 | K8s agent (DaemonSet) + metrics ingestion API endpoint | Data collection foundation |
| 8 | Namespace cost allocation algorithm + idle pod detection | Core K8s visibility |
| 9 | `/kubernetes` dashboard page integrated with existing cost views | User-facing value delivery |

### Weeks 10–12: Polish & Quick Wins [P1]
| Week | Deliverable | Rationale |
|------|-------------|-----------|
| 10 | RI/SP utilization dashboard (AWS) using existing integration | Low effort — uses existing AWS Cost Explorer connection |
| 11 | Slack bot MVP (daily digest + anomaly alerts with action buttons) | Increases engagement and daily active usage |
| 12 | Scheduled report delivery + review workflows v1 | Enterprise readiness signal |

**Exit criteria**: After 90 days, Costra supports multi-team organizations, catches anomalies intelligently with root-cause narratives, forecasts with scenarios, and has basic K8s cost allocation. This moves the product from FinOps "crawl" to "walk/run" maturity.

---

## 6. Long-Term Vision (6–12 Months)

### Months 4–6: Platform Maturity
- Automated unit economics via Stripe/webhook integrations (eliminate manual metric entry)
- Cost allocation rules engine for shared resource splitting
- Enhanced RBAC: custom roles, SSO/SAML for enterprise buyers
- Natural language cost queries powered by Claude
- Webhook platform: let users build automations on cost events

### Months 7–9: Market Expansion
- Terraform cost estimation CLI + GitHub Action
- SaaS spend tracking (Datadog, Snowflake, GitHub integrations)
- Weekly AI Cost Intelligence Brief (auto-generated, emailed)
- Cost anomaly → ticket integrations (Jira, Linear, PagerDuty)
- Mobile PWA for on-the-go cost monitoring

### Months 10–12: Enterprise & Scale
- Multi-org support (MSP/reseller model)
- Custom dashboards (drag-and-drop cost widgets)
- Real-time cost streaming via CloudWatch billing metrics
- Compliance reporting (SOC 2 cost controls, audit trails)
- Community marketplace: shared cost policies and allocation rules

### North Star Metric
**Cost savings identified and acted upon per user per month.** Every feature should either help users *find* savings or *act* on them faster.

---

## Appendix: Priority Matrix

| # | Feature | Priority | Effort | Impact | Category |
|---|---------|----------|--------|--------|----------|
| 1 | Team/Org RBAC | P0 | High | Critical | Governance |
| 2 | ML Anomaly Detection + Root Cause | P0 | Medium | High | Optimization |
| 3 | Cost Policies & Guardrails | P0 | Medium | High | Governance |
| 4 | Forecast Scenario Modeling | P0 | Medium | High | Optimization |
| 5 | Kubernetes Cost Allocation | P0 | High | Critical | Visibility |
| 6 | RI/SP Utilization Dashboard | P1 | Low | Medium | Optimization |
| 7 | Automated Unit Economics | P1 | Medium | High | Optimization |
| 8 | Cost Allocation Rules Engine | P1 | Medium | Medium | Visibility |
| 9 | Slack/Teams Bot | P1 | Medium | Medium | Automation |
| 10 | Scheduled Report Delivery | P1 | Low | Medium | Automation |
| 11 | Enhanced AI Cost Advisor | P1 | Medium | High | AI |
| 12 | Natural Language Cost Queries | P1 | Medium | High | AI |
| 13 | FinOps Review Workflows | P1 | Medium | Medium | Governance |
| 14 | Terraform Cost Estimation | P2 | High | Medium | Integrations |
| 15 | SaaS Spend Tracking | P2 | Medium | Medium | Integrations |

---

*Generated from full codebase analysis (136 API endpoints, 34 database tables, 8 provider integrations). Revisit quarterly.*

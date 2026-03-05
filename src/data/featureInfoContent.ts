export interface FeatureInfoSection {
  title: string
  subtitle: string
  description: string
  keyFeatures: string[]
  howToUse: string[]
  tips?: string[]
  relatedPages?: { label: string; path: string }[]
}

export const featureInfoContent: Record<string, FeatureInfoSection> = {
  dashboard: {
    title: 'Dashboard',
    subtitle: 'Your multi-cloud cost overview',
    description:
      'The Dashboard provides a centralized view of cloud spending across all connected providers. It shows month-to-date costs, trends, provider breakdowns, and service-level detail at a glance.',
    keyFeatures: [
      'Real-time cost aggregation across AWS, Azure, GCP, and other providers',
      'Month-to-date spending with trend indicators and direction arrows',
      'Provider-level drill-down with service and account breakdowns',
      'Cost reduction goal tracking',
      'One-click sync to refresh data from all providers',
      'CSV and PDF export of cost data',
    ],
    howToUse: [
      'Connect at least one cloud provider from Settings',
      'Click "Sync" to pull the latest billing data',
      'Expand provider cards to see service-level breakdowns',
      'Click a provider name to see detailed cost analytics',
    ],
    tips: [
      'Data syncs automatically every 6 hours — use manual sync for real-time checks',
      'Use the currency selector in the top nav to view costs in your preferred currency',
    ],
    relatedPages: [
      { label: 'Budgets', path: '/budgets' },
      { label: 'Reports', path: '/reports' },
      { label: 'Anomalies', path: '/anomalies' },
    ],
  },

  'custom-dashboards': {
    title: 'Custom Dashboards',
    subtitle: 'Build your own cost views',
    description:
      'Custom Dashboards let you create personalized views of your cloud costs. Add widgets, filters, and groupings to focus on the metrics that matter most to your team.',
    keyFeatures: [
      'Drag-and-drop widget layout',
      'Filter by provider, account, service, or tag',
      'Multiple chart types: bar, line, pie, and table',
      'Save and share dashboards with team members',
      'Auto-refresh to keep data current',
    ],
    howToUse: [
      'Click "New Dashboard" to create a blank dashboard',
      'Add widgets using the "+" button',
      'Configure each widget with the data source, filters, and chart type',
      'Drag widgets to rearrange the layout',
      'Save the dashboard with a descriptive name',
    ],
    tips: [
      'Create separate dashboards for different teams or cost centres',
      'Use the date range picker to compare periods side by side',
    ],
    relatedPages: [
      { label: 'Dashboard', path: '/dashboard' },
      { label: 'Reports', path: '/reports' },
    ],
  },

  budgets: {
    title: 'Budgets',
    subtitle: 'Set and monitor cloud spending limits',
    description:
      'Budgets help you track cloud spending against defined limits. Set monthly budgets for specific providers, accounts, or across your entire organization, and receive alerts when spending approaches or exceeds your thresholds.',
    keyFeatures: [
      'Monthly budget limits per provider, account, or organization-wide',
      'Configurable alert thresholds (default: 80%)',
      'Visual progress bars showing budget utilisation',
      'Historical budget vs. actual tracking',
      'Email alerts when thresholds are breached',
    ],
    howToUse: [
      'Click "Create Budget" to define a new budget',
      'Set the monthly limit and choose which providers or accounts to track',
      'Configure the alert threshold percentage',
      'Monitor the budget cards to track spending against your limits',
    ],
    tips: [
      'Start with a conservative budget and adjust after a month of data',
      'Set different budgets for production and development accounts',
    ],
    relatedPages: [
      { label: 'Dashboard', path: '/dashboard' },
      { label: 'Forecasts', path: '/forecasts' },
      { label: 'Policies', path: '/policies' },
    ],
  },

  reports: {
    title: 'Reports',
    subtitle: 'Generate cost visibility and allocation reports',
    description:
      'Reports let you generate detailed breakdowns of cloud spending for stakeholders, finance teams, or internal tracking. Schedule recurring reports or create one-off exports.',
    keyFeatures: [
      'On-demand and scheduled report generation',
      'Breakdown by provider, service, account, or tag',
      'CSV and PDF export formats',
      'Email delivery to stakeholders',
      'Custom date ranges and comparison periods',
      'Cost allocation by team or department',
    ],
    howToUse: [
      'Click "New Report" to configure a report',
      'Select the date range, providers, and grouping dimensions',
      'Choose the output format (CSV or PDF)',
      'Optionally schedule recurring delivery via email',
      'Click "Generate" to create the report immediately',
    ],
    tips: [
      'Schedule weekly reports for engineering leads to stay on top of cost trends',
      'Use tag-based grouping to attribute costs to specific projects or teams',
    ],
    relatedPages: [
      { label: 'Dashboard', path: '/dashboard' },
      { label: 'Allocations', path: '/allocations' },
    ],
  },

  anomalies: {
    title: 'Cost Anomalies',
    subtitle: 'ML-powered anomaly detection with AI root cause analysis',
    description:
      'Anomaly detection uses statistical models to identify unexpected cost spikes or drops across your cloud accounts. When an anomaly is detected, AI provides a root cause analysis to help you understand what changed.',
    keyFeatures: [
      'Automatic detection of unusual cost patterns',
      'AI-powered root cause analysis for each anomaly',
      'Severity scoring (low, medium, high, critical)',
      'Historical anomaly timeline',
      'Filter by provider, service, or severity',
      'Email and Slack notifications for new anomalies',
    ],
    howToUse: [
      'Anomalies are detected automatically after connecting a cloud provider',
      'Review the anomaly feed to see recent detections',
      'Click an anomaly to view the AI root cause analysis',
      'Mark anomalies as acknowledged or resolved',
    ],
    tips: [
      'High-severity anomalies often indicate resource misconfigurations or runaway processes',
      'Check anomalies after deploying new infrastructure to catch unexpected cost impacts early',
    ],
    relatedPages: [
      { label: 'Dashboard', path: '/dashboard' },
      { label: 'Policies', path: '/policies' },
      { label: 'Budgets', path: '/budgets' },
    ],
  },

  workflows: {
    title: 'FinOps Reviews',
    subtitle: 'Collaborative cost review workflows',
    description:
      'FinOps Reviews help your team stay on top of cloud spending through structured review workflows. Create review cycles, assign reviewers, and track action items to drive cost optimisation.',
    keyFeatures: [
      'Scheduled review cycles (weekly, monthly, quarterly)',
      'Assign reviewers and approvers',
      'Action item tracking with due dates',
      'Integration with cost data for context-rich reviews',
      'Comment threads for discussion',
      'Status tracking (open, in review, approved, closed)',
    ],
    howToUse: [
      'Click "New Review" to start a review cycle',
      'Select the scope (provider, account, or cost centre)',
      'Assign team members as reviewers',
      'Add findings and action items during the review',
      'Track progress until all items are resolved',
    ],
    tips: [
      'Schedule monthly reviews to catch cost creep before it becomes a budget issue',
      'Use action items to assign owners for specific optimisation tasks',
    ],
    relatedPages: [
      { label: 'Anomalies', path: '/anomalies' },
      { label: 'Policies', path: '/policies' },
    ],
  },

  forecasts: {
    title: 'Forecast & Scenarios',
    subtitle: 'Predict future cloud costs',
    description:
      'Forecasting uses historical spending patterns to project future costs. Model different scenarios — such as scaling up infrastructure or purchasing reserved instances — to understand their financial impact before committing.',
    keyFeatures: [
      'Linear and exponential forecasting models',
      'Scenario modelling for "what-if" analysis',
      'Confidence intervals for cost projections',
      'Forecast by provider, service, or account',
      'Visual comparison of forecast vs. budget',
      'Exportable forecast data',
    ],
    howToUse: [
      'Navigate to the Forecasts page to see automatic projections',
      'Select a provider or service to forecast specific cost lines',
      'Use the scenario builder to model changes (e.g., +20% compute)',
      'Compare forecast results against your budgets',
    ],
    tips: [
      'Forecasts become more accurate with at least 3 months of historical data',
      'Model reserved instance purchases as scenarios to see projected savings',
    ],
    relatedPages: [
      { label: 'Budgets', path: '/budgets' },
      { label: 'Savings Plans', path: '/savings-plans' },
    ],
  },

  policies: {
    title: 'Cost Policies',
    subtitle: 'Governance rules for cloud spending',
    description:
      'Cost Policies let you define and enforce spending rules across your cloud accounts. Set guardrails on resource types, spending limits, or tagging requirements to prevent cost overruns before they happen.',
    keyFeatures: [
      'Rule-based spending constraints',
      'Tagging compliance enforcement',
      'Resource type restrictions',
      'Automatic violation detection',
      'Alert notifications for policy breaches',
      'Audit log of all policy actions',
    ],
    howToUse: [
      'Click "Create Policy" to define a new rule',
      'Choose the policy type (spending limit, tagging, resource restriction)',
      'Set the conditions and thresholds',
      'Assign the policy to specific accounts or organisation-wide',
      'Monitor the violations dashboard for breaches',
    ],
    tips: [
      'Start with tagging policies — they make cost allocation much easier downstream',
      'Use spending limit policies on dev/test accounts to prevent accidental overruns',
    ],
    relatedPages: [
      { label: 'Budgets', path: '/budgets' },
      { label: 'Anomalies', path: '/anomalies' },
    ],
  },

  'savings-plans': {
    title: 'RI/SP Utilisation',
    subtitle: 'Track reserved instance and savings plan usage',
    description:
      'Monitor the utilisation and coverage of your Reserved Instances (RIs) and Savings Plans (SPs). Identify underused commitments, expiring plans, and opportunities to purchase new commitments for maximum savings.',
    keyFeatures: [
      'Utilisation tracking for RIs and Savings Plans',
      'Coverage analysis showing on-demand vs. committed spend',
      'Expiration alerts for upcoming commitment renewals',
      'Purchase recommendations based on usage patterns',
      'Savings summary showing commitment value vs. on-demand cost',
      'Support for 1-year and 3-year commitment terms',
    ],
    howToUse: [
      'View the overview cards for utilisation and coverage percentages',
      'Check the expiration timeline for commitments ending soon',
      'Review purchase recommendations to identify new savings opportunities',
      'Click individual plans to see detailed usage breakdowns',
    ],
    tips: [
      'Aim for 80%+ utilisation on all active commitments',
      'Review expiring plans 30 days in advance to decide on renewals',
    ],
    relatedPages: [
      { label: 'Forecasts', path: '/forecasts' },
      { label: 'Dashboard', path: '/dashboard' },
    ],
  },

  allocations: {
    title: 'Cost Allocation Rules',
    subtitle: 'Distribute shared costs across teams and projects',
    description:
      'Allocation Rules let you split shared cloud costs (like networking, support charges, or shared infrastructure) across teams, projects, or cost centres using configurable distribution methods.',
    keyFeatures: [
      'Proportional, fixed, or even-split allocation methods',
      'Tag-based cost attribution',
      'Shared cost distribution (networking, support, data transfer)',
      'Allocation rules per provider or across all providers',
      'Audit trail for allocation changes',
      'Export allocated costs for chargeback reporting',
    ],
    howToUse: [
      'Click "New Rule" to define an allocation rule',
      'Select the cost pool to allocate (e.g., shared networking)',
      'Choose the distribution method (proportional, fixed, or even split)',
      'Define the target teams or cost centres',
      'Activate the rule to apply it to current and future data',
    ],
    tips: [
      'Use proportional allocation for shared infrastructure costs',
      'Combine with tagging policies to improve allocation accuracy',
    ],
    relatedPages: [
      { label: 'Reports', path: '/reports' },
      { label: 'Policies', path: '/policies' },
    ],
  },

  kubernetes: {
    title: 'Kubernetes Costs',
    subtitle: 'Container-level cost visibility',
    description:
      'Kubernetes cost tracking provides granular visibility into the costs of your Kubernetes clusters, namespaces, deployments, and pods. Understand where container spend is going and identify idle or over-provisioned resources.',
    keyFeatures: [
      'Cluster, namespace, and pod-level cost breakdowns',
      'Idle resource detection (unused CPU/memory)',
      'Cost per deployment and service',
      'Right-sizing recommendations for pod resource requests',
      'Multi-cluster support',
      'Integration with cloud provider billing data',
    ],
    howToUse: [
      'Navigate to Kubernetes from the sidebar under Infrastructure',
      'View cost breakdowns by cluster, namespace, or deployment',
      'Check the efficiency scores to find over-provisioned workloads',
      'Apply right-sizing recommendations to reduce waste',
    ],
    tips: [
      'Focus on namespaces with low efficiency scores first for quick wins',
      'Idle resources are the easiest costs to eliminate — review them weekly',
    ],
    relatedPages: [
      { label: 'Dashboard', path: '/dashboard' },
      { label: 'Allocations', path: '/allocations' },
    ],
  },

  terraform: {
    title: 'Terraform Cost Estimation',
    subtitle: 'Predict costs before you deploy',
    description:
      'Terraform Cost Estimation analyses your Terraform plans and state files to estimate the monthly cost of infrastructure changes before they are applied. Catch expensive changes in planning, not in your bill.',
    keyFeatures: [
      'Pre-deployment cost estimation from Terraform plans',
      'Cost diff showing impact of infrastructure changes',
      'Support for major resource types across AWS, Azure, and GCP',
      'State file analysis for current infrastructure costs',
      'Integration with CI/CD pipelines for automated cost checks',
    ],
    howToUse: [
      'Upload a Terraform plan file or paste the JSON output',
      'Review the estimated monthly cost for each resource',
      'Compare before and after costs for infrastructure changes',
      'Set cost thresholds to flag expensive changes in CI/CD',
    ],
    tips: [
      'Integrate cost estimation into your PR review process to catch surprises early',
      'Use the cost diff view to focus on the highest-impact changes',
    ],
    relatedPages: [
      { label: 'Forecasts', path: '/forecasts' },
      { label: 'Policies', path: '/policies' },
    ],
  },

  saas: {
    title: 'SaaS Spend',
    subtitle: 'Track software subscription costs',
    description:
      'SaaS Spend tracking gives you visibility into your organisation\'s software subscriptions. Monitor recurring costs, identify unused licences, and consolidate overlapping tools to reduce waste.',
    keyFeatures: [
      'Centralised view of all SaaS subscriptions',
      'Monthly and annual cost tracking',
      'Licence utilisation monitoring',
      'Renewal date tracking and alerts',
      'Duplicate and overlapping tool detection',
      'Cost per user and per team breakdowns',
    ],
    howToUse: [
      'Add SaaS subscriptions manually or via integration',
      'Set the cost, billing cycle, and renewal date for each tool',
      'Monitor the overview for total SaaS spend trends',
      'Review underutilised licences and cancel unused seats',
    ],
    tips: [
      'Audit SaaS spend quarterly — unused licences add up fast',
      'Negotiate annual pricing for tools with high monthly costs',
    ],
    relatedPages: [
      { label: 'Dashboard', path: '/dashboard' },
      { label: 'Budgets', path: '/budgets' },
    ],
  },

  compare: {
    title: 'Cost Comparison',
    subtitle: 'Compare costs across providers and time periods',
    description:
      'The Cost Comparison view lets you place cost data side by side — compare providers against each other, compare the same provider across months, or benchmark teams and accounts to identify outliers.',
    keyFeatures: [
      'Side-by-side provider cost comparison',
      'Month-over-month and period-over-period views',
      'Account and service-level comparisons',
      'Visual charts with percentage change indicators',
      'Export comparison data as CSV',
    ],
    howToUse: [
      'Select two or more items to compare (providers, accounts, or periods)',
      'Choose the comparison dimension (cost, usage, or efficiency)',
      'Review the side-by-side charts and summary tables',
      'Export the comparison for presentations or reporting',
    ],
    tips: [
      'Compare development and production accounts to spot cost anomalies',
      'Use month-over-month comparison to track the impact of optimisation efforts',
    ],
    relatedPages: [
      { label: 'Dashboard', path: '/dashboard' },
      { label: 'Reports', path: '/reports' },
    ],
  },
}

import { X, Copy, Check, ExternalLink, FileText, Shield, Key, Zap, Database, DollarSign } from 'lucide-react'
import { useState } from 'react'

interface IAMPolicyDialogProps {
  isOpen: boolean
  onClose: () => void
  providerId: string
  providerName: string
}

interface PolicyTemplate {
  title: string
  description: string
  steps: string[]
  policy?: string
  roles?: string[]
  permissions?: string[]
  links?: Array<{ label: string; url: string }>
  rightsizing?: { note: string; extraSteps?: string[] }
}

export default function IAMPolicyDialog({ isOpen, onClose, providerId, providerName }: IAMPolicyDialogProps) {
  const [copied, setCopied] = useState<string | null>(null)
  const [awsConnectionType, setAwsConnectionType] = useState<'simple' | 'automated'>('simple')

  if (!isOpen) return null

  const getPolicyTemplate = (providerId: string): PolicyTemplate | null => {
    switch (providerId) {
      case 'aws':
        // AWS has two connection types, return null and handle separately
        return null
      case 'azure':
        return {
          title: 'Azure Service Principal Setup',
          description: 'Create a service principal with Cost Management Reader permissions.',
          steps: [
            'Log in to Azure Portal and navigate to Azure Active Directory',
            'Go to App registrations → New registration',
            'Name your app (e.g., "Costra") and click Register',
            'Note the Application (client) ID and Directory (tenant) ID',
            'Go to Certificates & secrets → New client secret',
            'Create a secret and copy the value (you\'ll only see it once)',
            'Go to Subscriptions → Your subscription → Access control (IAM)',
            'Click "Add" → "Add role assignment"',
            'Select role "Cost Management Reader" and assign to your app',
            'Use the Application ID, Tenant ID, Client Secret, and Subscription ID in Costra'
          ],
          roles: [
            'Cost Management Reader (required for cost data)',
            'Reader or Advisor Reader (required for rightsizing VM recommendations)'
          ],
          permissions: [
            'Microsoft.CostManagement/*/read',
            'Microsoft.Billing/*/read'
          ],
          links: [
            { label: 'Azure Portal', url: 'https://portal.azure.com/' },
            { label: 'App Registrations', url: 'https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade' }
          ],
          rightsizing: {
            note: 'For rightsizing recommendations (VM resize, shutdown underutilized), add Reader or Advisor Reader role on the subscription.',
            extraSteps: ['Go to Subscriptions → Your subscription → Access control (IAM)', 'Add role assignment → Reader or Advisor Reader → Assign to your app']
          }
        }
      case 'gcp':
        return {
          title: 'GCP Service Account Setup',
          description: 'Create a service account with Billing Account Viewer and Cost Viewer roles.',
          steps: [
            'Log in to Google Cloud Console',
            'Navigate to IAM & Admin → Service Accounts',
            'Click "Create Service Account"',
            'Enter a name (e.g., "costra-reader") and description',
            'Click "Create and Continue"',
            'In "Grant this service account access to project", skip for now',
            'Click "Done" to create the service account',
            'Click on the created service account → "KEYS" tab',
            'Click "Add Key" → "Create new key" → Select "JSON"',
            'Download the JSON key file',
            'Go to Billing → Account Management → Select your billing account',
            'Click "Manage permissions" → "Add principal"',
            'Add your service account email and grant "Billing Account Costs Viewer" role',
            'Paste the entire JSON key content into Costra\'s Service Account Key field'
          ],
          roles: [
            'Billing Account Costs Viewer (billing.accounts.getCosts)',
            'Billing Account Viewer (billing.accounts.get)',
            'Cloud Billing Viewer (cloudbilling.billingAccounts.get)',
            'Recommender Viewer (for VM rightsizing recommendations)'
          ],
          links: [
            { label: 'GCP Console', url: 'https://console.cloud.google.com/' },
            { label: 'Service Accounts', url: 'https://console.cloud.google.com/iam-admin/serviceaccounts' },
            { label: 'Billing Accounts', url: 'https://console.cloud.google.com/billing' }
          ],
          rightsizing: {
            note: 'For rightsizing recommendations (VM machine type suggestions), add Recommender Viewer role to your service account.',
            extraSteps: ['Go to IAM & Admin → IAM', 'Find your service account → Edit', 'Add role "Recommender Viewer" (or roles/recommender.viewer)', 'Save']
          }
        }
      case 'digitalocean':
        return {
          title: 'DigitalOcean API Token Setup',
          description: 'Generate a read-only API token for accessing billing and usage data.',
          steps: [
            'Log in to DigitalOcean Control Panel',
            'Navigate to API → Tokens/Keys',
            'Click "Generate New Token"',
            'Enter a name (e.g., "Costra")',
            'Select "Read" scope (or "Read/Write" if you need more features)',
            'Click "Generate Token"',
            'Copy the token immediately (you won\'t see it again)',
            'Paste the token into Costra\'s API Token field'
          ],
          links: [
            { label: 'DigitalOcean API Tokens', url: 'https://cloud.digitalocean.com/account/api/tokens' }
          ],
          rightsizing: {
            note: 'DigitalOcean does not have a native rightsizing API. Rightsizing recommendations use database heuristics when resource data is available.'
          }
        }
      case 'linode':
        return {
          title: 'Linode API Token Setup',
          description: 'Create a Personal Access Token with read permissions for billing data.',
          steps: [
            'Log in to Linode Cloud Manager',
            'Navigate to Profile → API Tokens',
            'Click "Create a Personal Access Token"',
            'Enter a label (e.g., "Costra")',
            'Set expiration (optional, recommended: 1 year)',
            'Select scopes: "Account:Read Only" and "Billing:Read Only"',
            'Click "Create Token"',
            'Copy the token immediately (you won\'t see it again)',
            'Paste the token into Costra\'s API Token field'
          ],
          links: [
            { label: 'Linode API Tokens', url: 'https://cloud.linode.com/profile/tokens' }
          ],
          rightsizing: {
            note: 'Linode does not have a native rightsizing API. Rightsizing recommendations use database heuristics when resource data is available.'
          }
        }
      case 'vultr':
        return {
          title: 'Vultr API Key Setup',
          description: 'Generate an API key with read permissions for billing information.',
          steps: [
            'Log in to Vultr Customer Portal',
            'Navigate to Settings → API',
            'Click "Enable API" if not already enabled',
            'Click "Add API Key"',
            'Enter a description (e.g., "Costra")',
            'Select permissions: "Read" (minimum required)',
            'Click "Add API Key"',
            'Copy the API key immediately',
            'Paste the API key into Costra\'s API Key field'
          ],
          links: [
            { label: 'Vultr API Settings', url: 'https://my.vultr.com/settings/#settingsapi' }
          ],
          rightsizing: {
            note: 'Vultr does not have a native rightsizing API. Rightsizing recommendations use database heuristics when resource data is available.'
          }
        }
      case 'ibm':
        return {
          title: 'IBM Cloud API Key Setup',
          description: 'Create an API key and service ID with billing viewer permissions.',
          steps: [
            'Log in to IBM Cloud Console',
            'Navigate to Manage → Access (IAM) → Service IDs',
            'Click "Create" to create a new Service ID',
            'Enter a name (e.g., "costra-reader") and description',
            'Click "Create"',
            'Go to the Service ID → API Keys tab',
            'Click "Create" to generate an API key',
            'Copy the API key and save it securely',
            'Go to Access Groups → Create or select a group',
            'Add the Service ID to the group',
            'Assign "Billing Viewer" role to the access group',
            'Use the API Key and Account ID in Costra'
          ],
          roles: [
            'Billing Viewer (required for cost data)',
            'Account Viewer (optional, for account information)'
          ],
          links: [
            { label: 'IBM Cloud IAM', url: 'https://cloud.ibm.com/iam/users' },
            { label: 'Service IDs', url: 'https://cloud.ibm.com/iam/serviceids' }
          ],
          rightsizing: {
            note: 'IBM Cloud does not have a native rightsizing API. Rightsizing recommendations use database heuristics when resource data is available.'
          }
        }
      case 'mongodb':
        return {
          title: 'MongoDB Atlas API Key Setup',
          description: 'Create a programmatic API key with billing read access for your MongoDB Atlas organization.',
          steps: [
            'Log in to MongoDB Atlas (cloud.mongodb.com)',
            'Click your organization name in the top-left, then select "Organization Settings"',
            'Note your Organization ID (shown in the URL or Settings page)',
            'Go to "Access Manager" in the left sidebar, then click "API Keys"',
            'Click "Create API Key"',
            'Enter a description (e.g., "Costra Billing Reader")',
            'Select the "Organization Billing Viewer" role',
            'Click "Next"',
            'Copy the Public Key and Private Key — the private key is shown only once',
            'Add your server\'s IP address to the API key\'s Access List (or use 0.0.0.0/0 for any IP)',
            'Click "Done"',
            'Enter the Public Key, Private Key, and Organization ID in Costra'
          ],
          roles: [
            'Organization Billing Viewer (required for invoice and cost data)',
            'Organization Read Only (optional, for organization metadata)'
          ],
          links: [
            { label: 'MongoDB Atlas', url: 'https://cloud.mongodb.com' },
            { label: 'API Key Docs', url: 'https://www.mongodb.com/docs/atlas/configure-api-access/' }
          ],
          rightsizing: {
            note: 'MongoDB Atlas does not have a native rightsizing API. Recommendations are generated from billing data patterns (data transfer costs, backup spend, etc.).'
          }
        }
      default:
        return {
          title: 'Provider Setup',
          description: 'Please refer to your cloud provider\'s documentation for API key setup.',
          steps: []
        }
    }
  }

  const template = getPolicyTemplate(providerId)

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  // AWS-specific content with two connection types
  const renderAWSContent = () => {
    const simplePolicy = JSON.stringify({
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Action: [
            'ce:GetCostAndUsage',
            'ce:GetDimensionValues',
            'ce:GetReservationCoverage',
            'ce:GetReservationPurchaseRecommendation',
            'ce:GetReservationUtilization',
            'ce:GetRightsizingRecommendation',
            'ce:GetSavingsPlansUtilization',
            'ce:ListCostCategoryDefinitions',
            'ce:GetUsageReport',
            'ce:GetCostForecast',
            'ce:GetAnomalies',
            'ce:GetAnomalyMonitors',
            'ce:GetAnomalySubscriptions',
            'pricing:GetProducts',
            'pricing:DescribeServices'
          ],
          Resource: '*'
        }
      ]
    }, null, 2)

    return (
      <div className="space-y-6">
        {/* Connection Type Tabs */}
        <div className="flex gap-2 border-b border-surface-200">
          <button
            onClick={() => setAwsConnectionType('simple')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              awsConnectionType === 'simple'
                ? 'border-accent-500 text-accent-500'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            <Zap className="h-4 w-4 inline mr-2" />
            Simple (API Keys)
          </button>
          <button
            onClick={() => setAwsConnectionType('automated')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              awsConnectionType === 'automated'
                ? 'border-accent-500 text-accent-500'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            <Database className="h-4 w-4 inline mr-2" />
            Automated + CUR (Recommended)
          </button>
        </div>

        {/* Simple (API Keys) Content */}
        {awsConnectionType === 'simple' && (
          <div className="space-y-6">
            <div className="bg-accent-50 border border-accent-100 rounded-xl p-4">
              <p className="text-sm text-gray-900 font-medium mb-2">✨ Recommended for most users</p>
              <p className="text-sm text-gray-900">
                Use AWS Cost Explorer API with simple API keys. No S3 bucket or CUR setup required. 
                Perfect for getting started quickly with month-to-date costs and service breakdowns.
              </p>
            </div>

            <div>
              <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <FileText className="h-5 w-5 text-accent-500" />
                Step-by-Step Instructions
              </h4>
              <ol className="space-y-2 list-decimal list-inside">
                <li className="text-sm text-gray-500 pl-2">Log in to AWS Console and navigate to <strong>IAM → Users</strong></li>
                <li className="text-sm text-gray-500 pl-2">Click <strong>"Add users"</strong> and create a new user (e.g., "costra-readonly")</li>
                <li className="text-sm text-gray-500 pl-2">Select <strong>"Attach policies directly"</strong> and click <strong>"Create policy"</strong></li>
                <li className="text-sm text-gray-500 pl-2">Switch to the <strong>JSON tab</strong> and paste the policy below</li>
                <li className="text-sm text-gray-500 pl-2">Name the policy (e.g., "CostraReadOnlyAccess") and create it</li>
                <li className="text-sm text-gray-500 pl-2">Attach the policy to your IAM user</li>
                <li className="text-sm text-gray-500 pl-2">Go to <strong>Security credentials</strong> tab and create an <strong>Access Key</strong></li>
                <li className="text-sm text-gray-500 pl-2">Copy the <strong>Access Key ID</strong> and <strong>Secret Access Key</strong> to use in Costra</li>
              </ol>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Key className="h-5 w-5 text-accent-500" />
                  IAM Policy JSON
                </h4>
                <button
                  onClick={() => handleCopy(simplePolicy, 'simple-policy')}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-accent-500 hover:bg-accent-50 rounded-lg transition-colors"
                >
                  {copied === 'simple-policy' ? (
                    <>
                      <Check className="h-4 w-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copy Policy
                    </>
                  )}
                </button>
              </div>
              <pre className="bg-surface-50 border border-surface-200 rounded-xl p-4 text-xs overflow-x-auto">
                <code>{simplePolicy}</code>
              </pre>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <h4 className="text-lg font-semibold text-green-800 mb-2">📊 Rightsizing Recommendations</h4>
              <p className="text-sm text-green-700">
                The policy above includes <code className="bg-white/60 px-1 rounded">ce:GetRightsizingRecommendation</code> for VM rightsizing.
                Costra uses CPU/RAM utilization from CloudWatch to suggest downsizing or terminating underutilized EC2 instances.
              </p>
            </div>

            <div>
              <h4 className="text-lg font-semibold text-gray-900 mb-3">Helpful Links</h4>
              <div className="space-y-2">
                <a
                  href="https://console.aws.amazon.com/iam/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-accent-500 hover:text-accent-700 hover:underline"
                >
                  <ExternalLink className="h-4 w-4" />
                  AWS IAM Console
                </a>
                <a
                  href="https://console.aws.amazon.com/cost-management/home"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-accent-500 hover:text-accent-700 hover:underline"
                >
                  <ExternalLink className="h-4 w-4" />
                  AWS Cost Explorer
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Automated + CUR Content */}
        {awsConnectionType === 'automated' && (
          <div className="space-y-6">
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <p className="text-sm text-green-900 font-medium mb-2">Recommended for penny-perfect accuracy</p>
              <p className="text-sm text-green-800">
                One-click CloudFormation setup that automatically creates a cross-account IAM role,
                an S3 bucket, and configures Cost & Usage Reports (CUR). CUR provides the exact billing
                data that appears on your AWS invoice — down to the penny.
              </p>
            </div>

            {/* How it works */}
            <div>
              <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <FileText className="h-5 w-5 text-accent-500" />
                How It Works
              </h4>
              <div className="bg-surface-50 border border-surface-200 rounded-xl p-4">
                <ol className="space-y-3 list-decimal list-inside text-sm text-gray-600">
                  <li className="pl-2">You provide a <strong>connection name</strong> and your <strong>12-digit AWS Account ID</strong></li>
                  <li className="pl-2">Costra generates a <strong>CloudFormation Quick Create URL</strong> with pre-filled parameters</li>
                  <li className="pl-2">You click the link to open the AWS CloudFormation Console and create the stack</li>
                  <li className="pl-2">CloudFormation automatically provisions:
                    <ul className="list-disc list-inside ml-4 mt-1 space-y-1 text-gray-500">
                      <li>A cross-account <strong>IAM role</strong> with read-only billing permissions</li>
                      <li>An <strong>S3 bucket</strong> for Cost & Usage Report delivery (encrypted, private)</li>
                      <li>A <strong>bucket policy</strong> allowing AWS to write CUR data and Costra to read it</li>
                    </ul>
                  </li>
                  <li className="pl-2">You return to Costra and click <strong>"Verify Connection"</strong></li>
                  <li className="pl-2">Costra automatically creates a <strong>CUR Data Export</strong> via the BCM Data Exports API</li>
                  <li className="pl-2">AWS delivers the first CUR data within <strong>~24 hours</strong> as Parquet files to S3</li>
                  <li className="pl-2">Costra polls every 6 hours, ingests new CUR data, and replaces approximate Cost Explorer data with penny-perfect totals</li>
                </ol>
              </div>
            </div>

            {/* What gets created */}
            <div>
              <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Shield className="h-5 w-5 text-accent-500" />
                What Gets Created in Your AWS Account
              </h4>
              <div className="space-y-3">
                <div className="bg-surface-50 border border-surface-200 rounded-xl p-4">
                  <p className="text-sm font-medium text-gray-900 mb-2">IAM Role</p>
                  <p className="text-sm text-gray-500 mb-2">
                    Read-only cross-account role that Costra assumes via STS. Permissions include:
                  </p>
                  <ul className="text-xs text-gray-500 space-y-1 list-disc list-inside ml-2">
                    <li>Cost Explorer read access (<code className="bg-white px-1 rounded">ce:GetCostAndUsage</code>, <code className="bg-white px-1 rounded">ce:GetRightsizingRecommendation</code>, etc.)</li>
                    <li>CUR / BCM Data Exports management (<code className="bg-white px-1 rounded">bcm-data-exports:*</code>)</li>
                    <li>S3 read access scoped to the CUR bucket only</li>
                    <li>Organizations read access (for multi-account visibility)</li>
                    <li>CloudWatch metrics (for CPU/RAM in rightsizing)</li>
                    <li>AWS managed <code className="bg-white px-1 rounded">Billing</code> policy</li>
                  </ul>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 mt-3">
                  <h4 className="text-sm font-semibold text-green-800 mb-2">📊 Rightsizing Recommendations</h4>
                  <p className="text-sm text-green-700">
                    The CloudFormation role includes <code className="bg-white/60 px-1 rounded">ce:GetRightsizingRecommendation</code> and CloudWatch read access.
                    Costra uses CPU/RAM utilization to suggest downsizing or terminating underutilized EC2 instances.
                  </p>
                </div>
                <div className="bg-surface-50 border border-surface-200 rounded-xl p-4">
                  <p className="text-sm font-medium text-gray-900 mb-2">S3 Bucket</p>
                  <p className="text-sm text-gray-500 mb-2">
                    Private, encrypted bucket for CUR delivery:
                  </p>
                  <ul className="text-xs text-gray-500 space-y-1 list-disc list-inside ml-2">
                    <li>Name format: <code className="bg-white px-1 rounded">costra-cur-{'<account-id>'}-{'<connection-name>'}</code></li>
                    <li>AES-256 server-side encryption</li>
                    <li>All public access blocked</li>
                    <li>400-day lifecycle policy (old reports auto-expire)</li>
                    <li>Retained on stack deletion (your data is never lost)</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Data accuracy */}
            <div>
              <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-accent-500" />
                Data Accuracy
              </h4>
              <div className="bg-surface-50 border border-surface-200 rounded-xl p-4">
                <div className="space-y-3 text-sm text-gray-600">
                  <div className="flex items-start gap-3">
                    <span className="text-green-600 font-bold mt-0.5">Historical months</span>
                    <span>CUR data (penny-perfect, matches your AWS invoice exactly)</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-blue-600 font-bold mt-0.5">Current month</span>
                    <span>Cost Explorer MONTHLY granularity (real-time, accurate for in-progress billing)</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Once CUR data is ingested for a finalized month, it permanently replaces the Cost Explorer estimate.
                    Daily sync will never overwrite CUR data with approximate values.
                  </p>
                </div>
              </div>
            </div>

            {/* Cost impact */}
            <div className="bg-[#EFF6FF] border border-[#DBEAFE] rounded-xl p-4">
              <div className="flex items-start gap-2">
                <DollarSign className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-900">
                  <p className="font-medium mb-1">Cost Impact</p>
                  <p className="text-blue-800">
                    Expected additional AWS cost is usually <strong>well under $5/month</strong> for most accounts,
                    and often just a few cents. Only compressed Parquet billing files are stored in S3 with a 400-day
                    expiry. There is no extra charge for the IAM role or CloudFormation stack.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-surface-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent-50 flex items-center justify-center">
              <Shield className="h-5 w-5 text-accent-500" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-900">
                {providerId === 'aws' ? 'AWS Connection Setup' : template?.title || 'Provider Setup'}
              </h3>
              <p className="text-sm text-gray-500">{providerName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-900 hover:bg-surface-50 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {providerId === 'aws' ? (
            renderAWSContent()
          ) : template ? (
            <>
              {/* Description */}
              <div className="bg-accent-50 border border-accent-100 rounded-xl p-4">
                <p className="text-sm text-gray-900">{template.description}</p>
              </div>

          {/* Steps */}
          {template.steps.length > 0 && (
            <div>
              <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <FileText className="h-5 w-5 text-accent-500" />
                Step-by-Step Instructions
              </h4>
              <ol className="space-y-2 list-decimal list-inside">
                {template.steps.map((step, index) => (
                  <li key={index} className="text-sm text-gray-500 pl-2">
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Policy JSON */}
          {template.policy && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Key className="h-5 w-5 text-accent-500" />
                  IAM Policy JSON
                </h4>
                <button
                  onClick={() => handleCopy(template.policy!, 'policy')}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-accent-500 hover:bg-accent-50 rounded-lg transition-colors"
                >
                  {copied === 'policy' ? (
                    <>
                      <Check className="h-4 w-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copy Policy
                    </>
                  )}
                </button>
              </div>
              <pre className="bg-surface-50 border border-surface-200 rounded-xl p-4 text-xs overflow-x-auto">
                <code>{template.policy}</code>
              </pre>
            </div>
          )}

          {/* Roles */}
          {template.roles && template.roles.length > 0 && (
            <div>
              <h4 className="text-lg font-semibold text-gray-900 mb-3">Required Roles</h4>
              <ul className="space-y-2">
                {template.roles.map((role, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-gray-500">
                    <span className="text-accent-500 mt-1">•</span>
                    <span>{role}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Permissions */}
          {template.permissions && template.permissions.length > 0 && (
            <div>
              <h4 className="text-lg font-semibold text-gray-900 mb-3">Required Permissions</h4>
              <ul className="space-y-2">
                {template.permissions.map((permission, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-gray-500">
                    <span className="text-accent-500 mt-1">•</span>
                    <code className="bg-surface-50 px-2 py-1 rounded text-xs">{permission}</code>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Links */}
          {template.links && template.links.length > 0 && (
            <div>
              <h4 className="text-lg font-semibold text-gray-900 mb-3">Helpful Links</h4>
              <div className="space-y-2">
                {template.links.map((link, index) => (
                  <a
                    key={index}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-accent-500 hover:text-accent-700 hover:underline"
                  >
                    <ExternalLink className="h-4 w-4" />
                    {link.label}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Rightsizing Recommendations */}
          {template.rightsizing && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <h4 className="text-lg font-semibold text-green-800 mb-2">📊 Rightsizing Recommendations</h4>
              <p className="text-sm text-green-700 mb-2">{template.rightsizing.note}</p>
              {template.rightsizing.extraSteps && template.rightsizing.extraSteps.length > 0 && (
                <ol className="text-sm text-green-700 list-decimal list-inside space-y-1">
                  {template.rightsizing.extraSteps.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
              )}
            </div>
          )}

              {/* Security Note */}
              <div className="bg-[#FEF3C7] border border-[#FDE68A] rounded-xl p-4">
                <p className="text-sm text-[#92400E] font-medium mb-1">🔒 Security Best Practices</p>
                <ul className="text-xs text-[#92400E] space-y-1 list-disc list-inside">
                  <li>Use the principle of least privilege - only grant necessary permissions</li>
                  <li>Regularly rotate API keys and access credentials</li>
                  <li>Never share credentials or commit them to version control</li>
                  <li>Monitor API key usage and revoke unused keys</li>
                  <li>Use separate credentials for different environments (dev/prod)</li>
                </ul>
              </div>
            </>
          ) : null}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-surface-200 px-6 py-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-primary-800 text-white rounded-xl hover:bg-[#1a2f4d] transition-colors font-medium"
          >
            Got it, thanks!
          </button>
        </div>
      </div>
    </div>
  )
}

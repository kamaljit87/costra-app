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
}

export default function IAMPolicyDialog({ isOpen, onClose, providerId, providerName }: IAMPolicyDialogProps) {
  const [copied, setCopied] = useState<string | null>(null)
  const [awsConnectionType, setAwsConnectionType] = useState<'simple' | 'advanced'>('simple')

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
            'Reader (optional, for resource metadata)'
          ],
          permissions: [
            'Microsoft.CostManagement/*/read',
            'Microsoft.Billing/*/read'
          ],
          links: [
            { label: 'Azure Portal', url: 'https://portal.azure.com/' },
            { label: 'App Registrations', url: 'https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade' }
          ]
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
            'Cloud Billing Viewer (cloudbilling.billingAccounts.get)'
          ],
          links: [
            { label: 'GCP Console', url: 'https://console.cloud.google.com/' },
            { label: 'Service Accounts', url: 'https://console.cloud.google.com/iam-admin/serviceaccounts' },
            { label: 'Billing Accounts', url: 'https://console.cloud.google.com/billing' }
          ]
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
          ]
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
          ]
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
          ]
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
          ]
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
    const costraAccountId = '061190967865'
    const costraExternalId = 'GPZAuIfia9uhu0hHNxGaP3NJ9sCqT3ZO'
    
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

    const generateCURPolicy = (bucketName: string) => JSON.stringify({
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Action: [
            's3:GetObject',
            's3:ListBucket'
          ],
          Resource: [
            `arn:aws:s3:::${bucketName}`,
            `arn:aws:s3:::${bucketName}/*`
          ]
        }
      ]
    }, null, 2)

    return (
      <div className="space-y-6">
        {/* Connection Type Tabs */}
        <div className="flex gap-2 border-b border-[#E2E8F0]">
          <button
            onClick={() => setAwsConnectionType('simple')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              awsConnectionType === 'simple'
                ? 'border-[#22B8A0] text-[#22B8A0]'
                : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            <Zap className="h-4 w-4 inline mr-2" />
            Simple (API Keys)
          </button>
          <button
            onClick={() => setAwsConnectionType('advanced')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              awsConnectionType === 'advanced'
                ? 'border-[#22B8A0] text-[#22B8A0]'
                : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            <Database className="h-4 w-4 inline mr-2" />
            Advanced (CUR + IAM Role)
          </button>
        </div>

        {/* Simple (API Keys) Content */}
        {awsConnectionType === 'simple' && (
          <div className="space-y-6">
            <div className="bg-[#F0FDFA] border border-[#CCFBF1] rounded-xl p-4">
              <p className="text-sm text-[#0F172A] font-medium mb-2">✨ Recommended for most users</p>
              <p className="text-sm text-[#0F172A]">
                Use AWS Cost Explorer API with simple API keys. No S3 bucket or CUR setup required. 
                Perfect for getting started quickly with month-to-date costs and service breakdowns.
              </p>
            </div>

            <div>
              <h4 className="text-lg font-semibold text-[#0F172A] mb-3 flex items-center gap-2">
                <FileText className="h-5 w-5 text-[#22B8A0]" />
                Step-by-Step Instructions
              </h4>
              <ol className="space-y-2 list-decimal list-inside">
                <li className="text-sm text-[#64748B] pl-2">Log in to AWS Console and navigate to <strong>IAM → Users</strong></li>
                <li className="text-sm text-[#64748B] pl-2">Click <strong>"Add users"</strong> and create a new user (e.g., "costra-readonly")</li>
                <li className="text-sm text-[#64748B] pl-2">Select <strong>"Attach policies directly"</strong> and click <strong>"Create policy"</strong></li>
                <li className="text-sm text-[#64748B] pl-2">Switch to the <strong>JSON tab</strong> and paste the policy below</li>
                <li className="text-sm text-[#64748B] pl-2">Name the policy (e.g., "CostraReadOnlyAccess") and create it</li>
                <li className="text-sm text-[#64748B] pl-2">Attach the policy to your IAM user</li>
                <li className="text-sm text-[#64748B] pl-2">Go to <strong>Security credentials</strong> tab and create an <strong>Access Key</strong></li>
                <li className="text-sm text-[#64748B] pl-2">Copy the <strong>Access Key ID</strong> and <strong>Secret Access Key</strong> to use in Costra</li>
              </ol>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-lg font-semibold text-[#0F172A] flex items-center gap-2">
                  <Key className="h-5 w-5 text-[#22B8A0]" />
                  IAM Policy JSON
                </h4>
                <button
                  onClick={() => handleCopy(simplePolicy, 'simple-policy')}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-[#22B8A0] hover:bg-[#F0FDFA] rounded-lg transition-colors"
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
              <pre className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 text-xs overflow-x-auto">
                <code>{simplePolicy}</code>
              </pre>
            </div>

            <div>
              <h4 className="text-lg font-semibold text-[#0F172A] mb-3">Helpful Links</h4>
              <div className="space-y-2">
                <a
                  href="https://console.aws.amazon.com/iam/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-[#22B8A0] hover:text-[#1F3A5F] hover:underline"
                >
                  <ExternalLink className="h-4 w-4" />
                  AWS IAM Console
                </a>
                <a
                  href="https://console.aws.amazon.com/cost-management/home"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-[#22B8A0] hover:text-[#1F3A5F] hover:underline"
                >
                  <ExternalLink className="h-4 w-4" />
                  AWS Cost Explorer
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Advanced (CUR + IAM Role) Content */}
        {awsConnectionType === 'advanced' && (
          <div className="space-y-6">
            <div className="bg-[#EFF6FF] border border-[#DBEAFE] rounded-xl p-4">
              <p className="text-sm text-[#0F172A] font-medium mb-2">💼 For enterprise users with existing CUR setup</p>
              <p className="text-sm text-[#0F172A] mb-3">
                Use AWS Cost & Usage Reports (CUR) stored in S3 for more detailed billing data. 
                Requires setting up a CUR report and cross-account IAM role.
              </p>
              <div className="bg-white rounded-lg p-3 mt-3 border border-[#DBEAFE]">
                <div className="flex items-start gap-2">
                  <DollarSign className="h-4 w-4 text-[#1F3A5F] mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-[#64748B]">
                    <p className="font-medium text-[#0F172A] mb-1">Cost Impact:</p>
                    <p>Expected additional AWS cost is usually <strong>well under $5/month</strong> for most accounts, and often just a few cents. Only compressed billing files are stored in S3. There is no extra charge for the IAM role or CloudFormation stack.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 1: Enable CUR */}
            <div>
              <h4 className="text-lg font-semibold text-[#0F172A] mb-3">Step 1: Enable Cost & Usage Reports</h4>
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 space-y-3">
                <ol className="space-y-2 list-decimal list-inside text-sm text-[#64748B]">
                  <li className="pl-2">Log into your <strong>payer account</strong> via AWS Console</li>
                  <li className="pl-2">Open <a href="https://console.aws.amazon.com/billing/home?#/reports" target="_blank" rel="noopener noreferrer" className="text-[#22B8A0] hover:underline">Billing → Cost & Usage Reports</a></li>
                  <li className="pl-2">Click <strong>"Create report"</strong> or reconfigure an existing one</li>
                  <li className="pl-2">Use these settings:
                    <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                      <li><strong>S3 bucket name:</strong> <code className="bg-white px-1 rounded">your-company-billing</code> (create a dedicated bucket)</li>
                      <li><strong>Time granularity:</strong> Hourly</li>
                      <li><strong>Report versioning:</strong> Create New Report Version</li>
                      <li><strong>Compression:</strong> GZIP</li>
                      <li><strong>Include resource IDs:</strong> ON</li>
                      <li><strong>Data Refresh settings:</strong> AUTOMATIC</li>
                      <li><strong>Split Cost Allocation Data:</strong> OFF</li>
                    </ul>
                  </li>
                  <li className="pl-2">Save the report and wait for AWS to start delivering data (can take a few hours)</li>
                </ol>
                <a
                  href="https://console.aws.amazon.com/billing/home?#/reports"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#1F3A5F] text-white rounded-lg hover:bg-[#1a2f4d] transition-colors text-sm font-medium mt-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open AWS Billing Console
                </a>
              </div>
            </div>

            {/* Step 2: Create Cross-Account Role */}
            <div>
              <h4 className="text-lg font-semibold text-[#0F172A] mb-3">Step 2: Create Cross-Account IAM Role</h4>
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 space-y-4">
                <ol className="space-y-2 list-decimal list-inside text-sm text-[#64748B]">
                  <li className="pl-2">In AWS IAM, go to <strong>Roles → Create role</strong></li>
                  <li className="pl-2">Select <strong>"Another AWS account"</strong></li>
                  <li className="pl-2">Enter Costra Account ID:
                    <div className="mt-2 flex items-center gap-2">
                      <code className="bg-white px-3 py-1.5 rounded border border-[#E2E8F0] text-[#0F172A] font-mono text-sm">{costraAccountId}</code>
                      <button
                        onClick={() => handleCopy(costraAccountId, 'account-id')}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-[#22B8A0] hover:bg-[#F0FDFA] rounded transition-colors"
                      >
                        {copied === 'account-id' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        Copy
                      </button>
                    </div>
                  </li>
                  <li className="pl-2">Check <strong>"Require external ID"</strong> and enter:
                    <div className="mt-2 flex items-center gap-2">
                      <code className="bg-white px-3 py-1.5 rounded border border-[#E2E8F0] text-[#0F172A] font-mono text-sm">{costraExternalId}</code>
                      <button
                        onClick={() => handleCopy(costraExternalId, 'external-id')}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-[#22B8A0] hover:bg-[#F0FDFA] rounded transition-colors"
                      >
                        {copied === 'external-id' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        Copy
                      </button>
                    </div>
                  </li>
                  <li className="pl-2">Attach these managed policies:
                    <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                      <li><code className="bg-white px-1 rounded text-xs">AWSBillingReadOnlyAccess</code></li>
                      <li><code className="bg-white px-1 rounded text-xs">ViewOnlyAccess</code></li>
                      <li><code className="bg-white px-1 rounded text-xs">ComputeOptimizerReadOnlyAccess</code></li>
                    </ul>
                  </li>
                  <li className="pl-2">Attach a custom policy for S3 access (see below)</li>
                  <li className="pl-2">Name the role (e.g., <code className="bg-white px-1 rounded text-xs">CostraReadOnlyRole</code>) and create it</li>
                  <li className="pl-2">Copy the <strong>Role ARN</strong> (looks like <code className="bg-white px-1 rounded text-xs">arn:aws:iam::123456789012:role/CostraReadOnlyRole</code>)</li>
                </ol>
                <a
                  href="https://console.aws.amazon.com/iam/home#/roles"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#1F3A5F] text-white rounded-lg hover:bg-[#1a2f4d] transition-colors text-sm font-medium mt-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open IAM Console
                </a>
              </div>
            </div>

            {/* Step 3: Custom S3 Policy */}
            <div>
              <h4 className="text-lg font-semibold text-[#0F172A] mb-3">Step 3: Generate S3 Access Policy</h4>
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 space-y-3">
                <p className="text-sm text-[#64748B]">
                  Enter your S3 billing bucket name to generate the custom IAM policy:
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    id="bucket-name"
                    placeholder="your-company-billing"
                    className="flex-1 px-3 py-2 border border-[#E2E8F0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#22B8A0]"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const bucketName = (e.target as HTMLInputElement).value.trim()
                        if (bucketName) {
                          const policy = generateCURPolicy(bucketName)
                          handleCopy(policy, 'cur-policy')
                        }
                      }
                    }}
                  />
                  <button
                    onClick={() => {
                      const bucketName = (document.getElementById('bucket-name') as HTMLInputElement)?.value.trim()
                      if (bucketName) {
                        const policy = generateCURPolicy(bucketName)
                        handleCopy(policy, 'cur-policy')
                      } else {
                        alert('Please enter your S3 bucket name first')
                      }
                    }}
                    className="px-4 py-2 bg-[#22B8A0] text-white rounded-lg hover:bg-[#1ea088] transition-colors text-sm font-medium"
                  >
                    Generate & Copy Policy
                  </button>
                </div>
                <p className="text-xs text-[#64748B]">
                  This policy grants read-only access to your CUR files in S3. Paste it as a custom policy when creating the IAM role.
                </p>
              </div>
            </div>

            {/* Step 4: Connect in Costra */}
            <div>
              <h4 className="text-lg font-semibold text-[#0F172A] mb-3">Step 4: Connect in Costra</h4>
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4">
                <p className="text-sm text-[#64748B] mb-3">
                  When adding your AWS account in Costra, you'll need to provide:
                </p>
                <ul className="space-y-2 text-sm text-[#64748B]">
                  <li className="flex items-start gap-2">
                    <span className="text-[#22B8A0] mt-1">•</span>
                    <span><strong>Connection name:</strong> A friendly name to identify this account (e.g., "Production AWS")</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#22B8A0] mt-1">•</span>
                    <span><strong>S3 billing bucket name:</strong> The bucket where your CUR files are stored</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#22B8A0] mt-1">•</span>
                    <span><strong>Cost & Usage Report name:</strong> The name of your CUR report (found in AWS Billing Console)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#22B8A0] mt-1">•</span>
                    <span><strong>Cross-account Role ARN:</strong> The ARN of the role you created in Step 2</span>
                  </li>
                </ul>
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
        <div className="sticky top-0 bg-white border-b border-[#E2E8F0] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#F0FDFA] flex items-center justify-center">
              <Shield className="h-5 w-5 text-[#22B8A0]" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-[#0F172A]">
                {providerId === 'aws' ? 'AWS Connection Setup' : template?.title || 'Provider Setup'}
              </h3>
              <p className="text-sm text-[#64748B]">{providerName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC] rounded-lg transition-colors"
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
              <div className="bg-[#F0FDFA] border border-[#CCFBF1] rounded-xl p-4">
                <p className="text-sm text-[#0F172A]">{template.description}</p>
              </div>

          {/* Steps */}
          {template.steps.length > 0 && (
            <div>
              <h4 className="text-lg font-semibold text-[#0F172A] mb-3 flex items-center gap-2">
                <FileText className="h-5 w-5 text-[#22B8A0]" />
                Step-by-Step Instructions
              </h4>
              <ol className="space-y-2 list-decimal list-inside">
                {template.steps.map((step, index) => (
                  <li key={index} className="text-sm text-[#64748B] pl-2">
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
                <h4 className="text-lg font-semibold text-[#0F172A] flex items-center gap-2">
                  <Key className="h-5 w-5 text-[#22B8A0]" />
                  IAM Policy JSON
                </h4>
                <button
                  onClick={() => handleCopy(template.policy!, 'policy')}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-[#22B8A0] hover:bg-[#F0FDFA] rounded-lg transition-colors"
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
              <pre className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 text-xs overflow-x-auto">
                <code>{template.policy}</code>
              </pre>
            </div>
          )}

          {/* Roles */}
          {template.roles && template.roles.length > 0 && (
            <div>
              <h4 className="text-lg font-semibold text-[#0F172A] mb-3">Required Roles</h4>
              <ul className="space-y-2">
                {template.roles.map((role, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-[#64748B]">
                    <span className="text-[#22B8A0] mt-1">•</span>
                    <span>{role}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Permissions */}
          {template.permissions && template.permissions.length > 0 && (
            <div>
              <h4 className="text-lg font-semibold text-[#0F172A] mb-3">Required Permissions</h4>
              <ul className="space-y-2">
                {template.permissions.map((permission, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-[#64748B]">
                    <span className="text-[#22B8A0] mt-1">•</span>
                    <code className="bg-[#F8FAFC] px-2 py-1 rounded text-xs">{permission}</code>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Links */}
          {template.links && template.links.length > 0 && (
            <div>
              <h4 className="text-lg font-semibold text-[#0F172A] mb-3">Helpful Links</h4>
              <div className="space-y-2">
                {template.links.map((link, index) => (
                  <a
                    key={index}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-[#22B8A0] hover:text-[#1F3A5F] hover:underline"
                  >
                    <ExternalLink className="h-4 w-4" />
                    {link.label}
                  </a>
                ))}
              </div>
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

        <div className="sticky bottom-0 bg-white border-t border-[#E2E8F0] px-6 py-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-[#1F3A5F] text-white rounded-xl hover:bg-[#1a2f4d] transition-colors font-medium"
          >
            Got it, thanks!
          </button>
        </div>
      </div>
    </div>
  )
}

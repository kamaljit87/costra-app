# Rightsizing Recommendations – Required Permissions

Rightsizing recommendations use provider-native APIs when available. Below are the permissions needed per provider.

## AWS
- **API:** Cost Explorer `GetRightsizingRecommendation`
- **IAM:** `ce:GetRightsizingRecommendation` (included in the standard Cost Explorer policy)
- **Data:** Uses CloudWatch CPU/RAM metrics and instance usage patterns

## Azure
- **API:** Advisor Recommendations
- **Permissions:** Service principal needs access to Advisor API
  - Add **Reader** or **Advisor Reader** role on the subscription
  - Or ensure the app registration has `https://management.azure.com/.default` scope (already used for Cost Management)
- **Filter:** Cost category recommendations (VM resize, shutdown underutilized)

## GCP
- **API:** Recommender API – `google.compute.instance.MachineTypeRecommender`
- **Permissions:** Service account needs:
  - `recommender.computeInstanceMachineTypeRecommendations.list`
  - Or `roles/recommender.admin` / `roles/recommender.viewer`
- **Scope:** `https://www.googleapis.com/auth/cloud-platform` (included in token)

## DigitalOcean, Linode, Vultr, IBM Cloud
- **API:** None (no native rightsizing APIs)
- **Fallback:** Database-based heuristics using the `resources` table
- **Note:** Recommendations appear when resource-level data is synced (e.g. via CUR for AWS; other providers may have limited or no resource data)

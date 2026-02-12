# Costra Future Roadmap

This document captures planned enhancements and future work. **Current implementation stays as-is** until these items are prioritized and scheduled.

---

## Current State (As-Is)

| Area | Status |
|------|--------|
| **Rightsizing** | AWS (CE), Azure (Advisor), GCP (Recommender) — native APIs. DO, Linode, Vultr, IBM use DB fallback (empty unless CUR/resources populated). |
| **Cost data** | All providers pull from billing/cost APIs. Tax-inclusive display where supported. |
| **IAM** | Permissions documented in IAMPolicyDialog; CloudFormation updated with CE actions. |

---

## Future Work

### 1. Rightsizing for DigitalOcean, Linode, Vultr, IBM Cloud

**Options considered:**

| Option | Description | Effort |
|--------|-------------|--------|
| **A. Resource ingestion** | Sync instances/volumes from provider APIs into `resources` table; reuse existing DB-based rightsizing logic. | Medium |
| **B. Heuristic-based** | List instances from APIs, apply cost-based heuristics (e.g. CPU/RAM usage patterns from monitoring if available). | Medium |
| **C. Defer** | Keep current behavior (no recommendations for these providers until they have native APIs or resource ingestion). | None |

**Recommendation:** Option A when prioritizing these providers; Option C until then.

---

### 2. Infracost-Style IaC Cost Estimation (Optional)

Infracost estimates costs from Terraform/Pulumi **before** deployment using a pricing catalog and no cloud credentials.

**If Costra adds this in future:**

- Parse IaC for cost-relevant parameters (instance types, disk sizes, regions).
- Use a pricing catalog (build own or integrate Infracost Cloud Pricing API).
- Show estimates in UI alongside actual billing data.
- Useful for: AWS, Azure, GCP (Infracost covers these); DO, Linode, Vultr, IBM would need custom pricing logic.

**Effort:** High. Separate feature track.

---

### 3. Cost Accuracy (Per Existing Plan)

Per `docs/CLOUD_PROVIDER_COST_ACCURACY_PLAN.md`:

- DigitalOcean: Balance API for accrued usage
- Vultr: Field fallbacks for pending charges
- IBM Cloud: Alternate field names, unbilled handling
- GCP: Documented limitation (BigQuery required)

---

### 4. Other Potential Enhancements

- **Budget alerts** across providers
- **Resource tagging** improvements and untagged cost reporting
- **Savings Plans / Reserved Instances** recommendations (AWS)
- **Anomaly detection** improvements
- **Multi-currency** handling across providers

---

## Implementation Order (When Ready)

1. Cost accuracy fixes (per CLOUD_PROVIDER_COST_ACCURACY_PLAN.md)
2. Rightsizing for DO/Linode/Vultr/IBM (resource ingestion)
3. IaC cost estimation (if desired)
4. Other enhancements as prioritized

---

*Last updated: Feb 2025*

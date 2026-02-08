# Costra Regulatory Compliance Audit Report

**Application:** Costra — Multi-Cloud Cost Management SaaS Platform
**Audit Date:** 2026-02-07
**Payment Provider:** Dodo Payments (Merchant of Record)
**Frameworks Audited:** EU GDPR, India DPDPA (2023), EU VAT Regulations, ePrivacy Directive

---

## Executive Summary

Costra has **significant compliance gaps** across GDPR, DPDPA, and ePrivacy requirements. While the application has solid security engineering (AES-256-GCM encryption, parameterized queries, JWT auth, Helmet headers), it is **missing nearly all legal/regulatory infrastructure** required for a commercial SaaS serving EU and Indian users.

The pricing page shows INR and USD pricing and targets global users, making compliance mandatory.

**Payment/VAT Note:** Costra uses **Dodo Payments as a Merchant of Record (MoR)**, which handles VAT/GST calculation, collection, invoicing, and remittance. This significantly reduces the EU VAT compliance burden on Costra directly, but does not eliminate obligations around pricing transparency and record-keeping.

**Overall Risk Level: HIGH**

---

## 1. GDPR COMPLIANCE (EU General Data Protection Regulation)

### 1.1 CRITICAL — No Lawful Basis for Processing (Art. 6)

**Finding:** The signup flow (`src/pages/SignupPage.tsx`, `server/routes/auth.js`) collects name, email, and password without establishing a lawful basis for processing. There is:

- No consent checkbox at signup
- No reference to Terms of Service or Privacy Policy
- No record of consent given
- No `consent_given_at` or `consent_version` field in the `users` database table (`server/database.js:58–68`)

**Risk:** Processing personal data without lawful basis is a direct GDPR violation (fines up to 4% of global revenue / EUR 20M).

**Remediation:**
- Add a mandatory consent checkbox at signup linking to Privacy Policy and ToS
- Record consent timestamp, IP, and policy version in the database
- Add a `consent_records` table with: `user_id`, `consent_type`, `version`, `given_at`, `ip_address`, `withdrawn_at`

---

### 1.2 CRITICAL — No Right to Erasure / Account Deletion (Art. 17)

**Finding:** A `deleteUser` function exists in `server/database.js` but is only used in test utilities (`server/tests/utils.js:41`). There is **no API endpoint** for users to delete their account. The profile routes (`server/routes/profile.js`) only support GET, PUT (update), POST (avatar), DELETE (avatar only).

**Risk:** Users have no mechanism to exercise their "right to be forgotten."

**Remediation:**
- Create `DELETE /api/auth/account` endpoint with cascading data deletion
- The schema already uses `ON DELETE CASCADE` on all foreign keys
- Add confirmation step and grace period (30 days)
- Send confirmation email upon deletion request

---

### 1.3 CRITICAL — No Right to Data Portability / Export (Art. 20)

**Finding:** No endpoint exists for users to export their personal data in a machine-readable format. The reports feature generates cost reports, not personal data exports.

**Risk:** GDPR Art. 20 requires data subjects to receive their data in a "structured, commonly used, machine-readable format."

**Remediation:**
- Create `GET /api/profile/export` endpoint
- Gather all user data (profile, preferences, cost data, credentials metadata, budgets, reports) into a downloadable JSON file

---

### 1.4 CRITICAL — No Privacy Policy (Art. 13, 14)

**Finding:** The landing page (`src/pages/LandingPage.tsx`) has no link to a Privacy Policy. The footer only contains a copyright notice. No `/privacy` route exists in `src/App.tsx`.

**Risk:** GDPR requires transparent disclosure of: what data is collected, why, legal basis, retention periods, third-party sharing, data subject rights, DPO contact, and cross-border transfers.

**Remediation:**
- Draft and publish a comprehensive Privacy Policy
- Link it from the footer, signup page, and login page
- Create a `/privacy` route

---

### 1.5 CRITICAL — No Cookie Consent Mechanism

**Finding:** No cookie banner or consent management exists. The application uses `localStorage` for auth tokens (`src/contexts/AuthContext.tsx:34–35`). Sentry is initialized unconditionally (`server/server.js:42–54`).

**Risk:** Under the ePrivacy Directive, EU users must consent to non-essential cookies/tracking before they are set.

**Remediation:**
- Implement a cookie consent banner
- Gate Sentry, analytics, and non-essential tracking behind consent
- Categorize cookies: strictly necessary, analytics, functional

---

### 1.6 HIGH — Third-Party Data Sharing Without Disclosure

**Finding:** User data is sent to multiple third parties without disclosure or consent:

| Third Party | Data Sent | File Reference |
|-------------|-----------|----------------|
| Anthropic (Claude AI) | User cost data | `server/routes/ai.js:67–72` |
| Dodo Payments | User email, name, payment data | Billing integration |
| Sentry | Error data, request metadata | `server/server.js:42–54` |
| SendGrid | Email addresses | `server/services/emailService.js` |
| Google | OAuth profile data | `server/routes/googleAuth.js` |
| AWS/Azure/GCP | Cloud credentials | `server/services/cloudProviderIntegrations.js` |

**Risk:** GDPR Art. 13(1)(e) requires disclosure of all data recipients.

**Remediation:**
- List all third-party processors in the Privacy Policy
- Ensure Data Processing Agreements (DPAs) are in place with each processor
- Disclose that cost data is sent to Anthropic for AI features

---

### 1.7 HIGH — No Data Retention Policy

**Finding:** Log retention is 14 days (`server/utils/logger.js:75`), but user data in the database persists indefinitely. No defined retention periods for cost data, reports, notifications, or user accounts.

**Risk:** GDPR Art. 5(1)(e) requires data to be kept "no longer than necessary."

**Remediation:**
- Define retention periods for each data category
- Implement automated data cleanup
- Document retention periods in the Privacy Policy

---

### 1.8 MEDIUM — No Data Processing Records (Art. 30)

**Finding:** No Records of Processing Activities (ROPA) exist.

**Remediation:** Maintain a ROPA covering: categories of data, purposes, recipients, transfers, retention periods, and security measures.

---

### 1.9 MEDIUM — No Breach Notification Process (Art. 33, 34)

**Finding:** No process for detecting, assessing, and reporting personal data breaches to supervisory authorities within 72 hours.

**Remediation:**
- Establish a data breach response procedure
- Implement breach detection logging/alerting
- Prepare breach notification templates

---

## 2. INDIA DPDPA (Digital Personal Data Protection Act, 2023)

### 2.1 CRITICAL — No Notice Before Data Collection (Sec. 5, 6)

**Finding:** DPDPA requires a clear notice to data principals before collecting personal data. The signup flow provides no such notice. The landing page targets Indian users explicitly (INR pricing: `src/pages/LandingPage.tsx:9`).

**Remediation:**
- Provide a clear notice before data collection
- The notice must state the purpose and describe user rights

---

### 2.2 CRITICAL — No Consent Management (Sec. 6, 7)

**Finding:** No consent mechanism exists. DPDPA requires "free, specific, informed, unconditional, and unambiguous" consent.

**Remediation:** Same as GDPR 1.1 — implement consent recording at signup with withdrawal mechanism.

---

### 2.3 CRITICAL — No Grievance Redressal Mechanism (Sec. 13)

**Finding:** No mechanism for data principals to lodge grievances. No Data Protection Officer contact information provided.

**Remediation:**
- Appoint a grievance officer
- Provide contact details in the Privacy Policy and app settings
- Implement a grievance submission mechanism

---

### 2.4 HIGH — No Data Principal Rights Implementation (Sec. 11–14)

**Finding:** DPDPA grants rights to access, correction, and erasure — none are implemented as user-facing features.

**Remediation:** Implement data access, correction, and erasure endpoints.

---

### 2.5 MEDIUM — No Age Verification

**Finding:** No age verification at signup. DPDPA Sec. 9 prohibits processing children's (under 18) data without verifiable parental consent.

**Remediation:** Add age declaration at signup or explicitly state in Terms that the service is for users 18+.

---

## 3. EU VAT REGULATION COMPLIANCE

### 3.1 MITIGATED — VAT Collection and Remittance

**Status:** Dodo Payments, as the Merchant of Record, **handles VAT/GST calculation, collection, invoicing, and remittance** automatically for all transactions. This covers:

- VAT rate determination by customer location
- Tax collection at checkout
- VAT invoice generation
- Tax filing and remittance across jurisdictions
- EU One-Stop Shop (OSS) compliance

**Remaining Obligations for Costra:**
- Ensure pricing pages clearly indicate whether prices include or exclude tax
- Maintain records of transactions for audit purposes
- Cooperate with Dodo Payments for any tax authority inquiries

---

### 3.2 LOW — Pricing Transparency

**Finding:** Prices on the landing page (`src/pages/LandingPage.tsx`) and billing page (`src/pages/BillingPage.tsx`) show flat USD/INR amounts with no mention of applicable taxes.

**Remediation:**
- Add a note like "Prices exclude applicable taxes" or "Tax calculated at checkout"
- EU consumer protection regulations prefer prices inclusive of VAT for B2C

---

## 4. CROSS-BORDER DATA TRANSFER COMPLIANCE

### 4.1 HIGH — No Transfer Mechanism for EU-to-Third-Country Transfers

**Finding:** Personal data is transferred to US-based processors (Anthropic, Sentry, SendGrid, Dodo Payments, AWS). Under GDPR Art. 44–49, transfers require an adequacy decision, SCCs, or the EU-US Data Privacy Framework.

**Remediation:**
- Verify that each US processor is certified under the EU-US Data Privacy Framework
- If not, execute Standard Contractual Clauses (SCCs)
- Document all international transfers in the Privacy Policy

---

### 4.2 HIGH — DPDPA Cross-Border Transfers (Sec. 16)

**Finding:** Indian user data may be stored on US-based infrastructure (AWS us-east-1). DPDPA Sec. 16 allows the Indian government to restrict transfers to specific countries.

**Remediation:**
- Monitor Indian government notifications on restricted countries
- Consider offering an India region deployment option
- Document transfer destinations in the privacy notice

---

## 5. TRANSPARENCY AND TERMS

### 5.1 CRITICAL — No Terms of Service

**Finding:** No Terms of Service exist. Users are not agreeing to any terms at signup.

**Remediation:** Draft comprehensive Terms covering: service description, acceptable use, payment terms, liability, governing law, dispute resolution.

---

### 5.2 HIGH — No Refund/Cancellation Policy

**Finding:** No published refund or cancellation policy. EU consumers have a 14-day cooling-off period under the Consumer Rights Directive.

**Note:** Dodo Payments as MoR may handle refund processing, but Costra should still publish a clear policy.

**Remediation:** Publish a clear refund and cancellation policy.

---

### 5.3 MEDIUM — Outdated Copyright Year

**Finding:** Footer shows "© 2024" (`src/pages/LandingPage.tsx:352`).

**Remediation:** Update to current year or use dynamic year.

---

## 6. SECURITY-RELATED COMPLIANCE CONCERNS

### 6.1 HIGH — Weak Default Encryption Key

**Finding:** `server/services/encryption.js:5` uses a hardcoded fallback: `'costra-default-key-change-in-production'`. If `ENCRYPTION_KEY` is not set in production, all cloud provider credentials are encrypted with a publicly known key.

**Remediation:** Remove the fallback; fail startup if `ENCRYPTION_KEY` is not configured in production.

---

### 6.2 MEDIUM — Auth Rate Limiting Disabled

**Finding:** `server/routes/auth.js:13` shows rate limiting was intentionally removed. This enables brute-force attacks.

**Remediation:** Re-enable rate limiting on auth endpoints (relevant to GDPR Art. 32 — security of processing).

---

### 6.3 MEDIUM — JWT Token in localStorage

**Finding:** Auth tokens stored in `localStorage` (`src/contexts/AuthContext.tsx:56`), vulnerable to XSS.

**Remediation:** Consider migrating to `httpOnly` secure cookies.

---

## Summary of Findings

| # | Issue | Framework | Severity | Status |
|---|-------|-----------|----------|--------|
| 1 | No lawful basis / consent at signup | GDPR, DPDPA | **CRITICAL** | Missing |
| 2 | No right to erasure / account deletion | GDPR, DPDPA | **CRITICAL** | Missing |
| 3 | No right to data portability / export | GDPR, DPDPA | **CRITICAL** | Missing |
| 4 | No Privacy Policy | GDPR, DPDPA | **CRITICAL** | Missing |
| 5 | No cookie consent mechanism | GDPR/ePrivacy | **CRITICAL** | Missing |
| 6 | No Terms of Service | General | **CRITICAL** | Missing |
| 7 | No DPDPA notice before collection | DPDPA | **CRITICAL** | Missing |
| 8 | No grievance redressal mechanism | DPDPA | **CRITICAL** | Missing |
| 9 | Third-party data sharing undisclosed | GDPR, DPDPA | HIGH | Missing |
| 10 | No data retention policy | GDPR | HIGH | Missing |
| 11 | No cross-border transfer safeguards | GDPR, DPDPA | HIGH | Missing |
| 12 | No refund/cancellation policy | EU Consumer Law | HIGH | Missing |
| 13 | Weak default encryption fallback | GDPR Art. 32 | HIGH | Risk |
| 14 | Auth rate limiting disabled | GDPR Art. 32 | MEDIUM | Risk |
| 15 | No breach notification process | GDPR | MEDIUM | Missing |
| 16 | No ROPA (Records of Processing) | GDPR | MEDIUM | Missing |
| 17 | No age verification | DPDPA | MEDIUM | Missing |
| 18 | VAT collection/invoicing | EU VAT | **MITIGATED** | Dodo Payments MoR |
| 19 | Pricing transparency (excl. tax note) | EU Consumer | LOW | Missing |
| 20 | Outdated copyright year | General | LOW | Cosmetic |

---

## Recommended Priority Actions

### Phase 1 — Immediate (Block Before Launch)

1. Draft and publish **Privacy Policy** and **Terms of Service**
2. Add **consent checkbox + recording** at signup
3. Build **account deletion** endpoint (`DELETE /api/auth/account`)
4. Build **data export** endpoint (`GET /api/profile/export`)
5. Implement **cookie consent banner**
6. Add **grievance redressal** mechanism
7. Remove **hardcoded fallback encryption key** in production

### Phase 2 — Short-Term

8. Document all **third-party data processors**; execute DPAs
9. Implement **data retention policies** and automated cleanup
10. Verify **EU-US Data Privacy Framework** certifications for processors
11. **Re-enable auth rate limiting**
12. Publish **refund/cancellation policy**
13. Add **"prices exclude tax"** note to pricing pages

### Phase 3 — Ongoing

14. Maintain **Records of Processing Activities** (ROPA)
15. Establish **data breach response** procedure
16. Conduct periodic **privacy impact assessments**
17. Monitor **DPDPA notifications** on cross-border transfer restrictions

---

*Report generated on 2026-02-07. This audit covers code-level compliance only. Legal review by qualified counsel is recommended before production deployment.*

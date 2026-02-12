# Cloud Provider Cost Accuracy Plan

This document outlines potential mismatches between provider billing dashboards and Costra's displayed costs, and the planned fixes for each provider. The Linode fix (accrued/uninvoiced balance) serves as the template.

---

## Summary Table

| Provider | Current Source | Accrued/Unbilled Support | Risk | Planned Fix |
|----------|----------------|--------------------------|------|-------------|
| **Linode** | Invoice items + account fallback | ✅ Fixed | Resolved | balance_uninvoiced, unit_price×quantity |
| **Vultr** | pending_charges | ✅ Fixed | Low | Field fallbacks (pending_charges_amount) |
| **DigitalOcean** | Invoices + balance | ✅ Fixed | Resolved | Balance API (MonthToDateUsage) |
| **IBM Cloud** | Account summary | ✅ Fixed | Resolved | Unbilled + alternate field names |
| **GCP** | BigQuery or 0 | N/A | **High** | Document limitation; optional: Budget API |
| **Azure** | Cost Management API | N/A | Low | Already uses actual costs |
| **AWS** | Cost Explorer | N/A | Low | Already uses actual costs |

---

## 1. Linode (Akamai) — ✅ DONE

**Issue:** App showed $0.00 when Linode billing showed accrued charges (e.g. $0.47).

**Root cause:** 
- Current invoice items API may use different field names (`amount` vs `total`, or `unit_price` × `quantity`)
- Account's accrued balance (`balance_uninvoiced` / `uninvoiced_balance`) was not used as fallback

**Fix applied:**
- Try `unit_price × quantity` when `total`/`amount` are 0
- Use `accountData.balance_uninvoiced ?? accountData.uninvoiced_balance ?? accountData.accrued` when invoice items sum to 0

---

## 2. Vultr — Low Risk

**Current implementation:** Uses `account.pending_charges` for current month.

**Potential issues:**
- API may use `pending_charges_amount` or `balance` instead
- Vultr has separate "List Pending Charges" endpoint for more detail

**Planned fix:**
- Add fallback: `account.pending_charges ?? account.pending_charges_amount ?? 0`
- Optional: fetch `/v2/billing/pending` for itemized accrued charges if account balance is 0

---

## 3. DigitalOcean — High Risk

**Current implementation:** Uses **invoices only**. No balance/accrued API.

**Issue:** New accounts or mid-cycle usage shows $0 until the first invoice is generated.

**API available:** `GET /v2/customers/my/balance` returns:
- `MonthToDateBalance` — balance + month-to-date usage
- `MonthToDateUsage` — usage in current billing period
- `AccountBalance` — overall balance

**Planned fix:**
1. Add `GET /v2/customers/my/balance` call
2. When invoices for current month sum to 0, use `MonthToDateUsage` (or `MonthToDateBalance` if more appropriate) as `currentMonth`
3. Map invoice response fields: `amount`, `total`, `invoice_items[].amount`

---

## 4. IBM Cloud — Medium Risk

**Current implementation:** Uses account summary `billable_cost` and usage `resources[].billable_cost`.

**Potential issues:**
- API may return `total_cost`, `unbilled_cost`, or different structure
- Summary is per-month; may not include same-day unbilled usage

**Planned fix:**
1. Add alternate field names: `billable_cost ?? total_cost ?? cost`
2. Check Usage Reports API for unbilled costs endpoint
3. Add logging for account summary keys to validate response shape

---

## 5. GCP — High Risk (Architectural) — DOCUMENTED

**Current implementation:** 
- With BigQuery: full cost data
- Without BigQuery: returns 0 for everything

**Issue:** GCP Cloud Billing API does not provide detailed cost breakdown without BigQuery export. Getting current month spend programmatically without BigQuery is not supported.

**Implemented:**
1. Plan updated — GCP requires BigQuery billing export for cost data
2. See `server/CLOUD_PROVIDER_API_GUIDE.md` — add note there if editing GCP section
3. No code fix for $0 without BigQuery — it's a platform limitation

---

## 6. Azure — Low Risk

**Current implementation:** Uses Cost Management API with `ActualCost` and daily granularity.

**Status:** Azure Cost Management returns actual incurred costs. May have 24–48h delay. No separate "accrued" vs "invoiced" in typical usage — the API is the source of truth.

**Planned action:** None unless users report issues.

---

## 7. AWS — Low Risk

**Current implementation:** Uses Cost Explorer API with UnblendedCost/ActualCost.

**Status:** Cost Explorer is authoritative. Unbilled charges may appear with ~24h delay but are typically included in daily rollups.

**Planned action:** None unless users report issues.

---

## Implementation Order

1. **DigitalOcean** — Add balance API (highest impact, similar to Linode)
2. **Vultr** — Add field fallbacks (quick win)
3. **IBM Cloud** — Add alternate field names and unbilled handling
4. **GCP** — Documentation only (no API alternative)
5. **Azure / AWS** — Monitor; no changes unless needed

---

## Testing Checklist

For each provider after changes:
- [ ] New account with usage but no invoice yet
- [ ] Mid-cycle sync (accrued charges visible on provider dashboard)
- [ ] After invoice generated (historical data)
- [ ] Compare Costra total vs provider billing page for same period

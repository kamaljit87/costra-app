# Costra FinOps Transformation - Implementation Plan

## Overview
Transforming Costra from "pretty dashboards" to clear, actionable cost understanding with:
1. Cost vs Usage (Side-by-Side)
2. Tagging Enforcement & Ownership
3. Low-Noise Anomaly Detection
4. Plain-English Cost Summary

## Progress

### ✅ Completed
1. **Database Schema Extension**
   - Added `resources` table for resource-level cost and metadata
   - Added `resource_tags` table for tag storage
   - Added `service_usage_metrics` table for usage alongside costs
   - Added `anomaly_baselines` table for 30-day rolling averages
   - Added `cost_explanations` table for plain-English summaries

### 🚧 In Progress
2. **Database Helper Functions** (Next step)
   - Functions to save/retrieve resources and tags
   - Functions to save/retrieve usage metrics
   - Functions to calculate and store anomaly baselines
   - Functions to generate and store cost explanations

3. **Cloud Provider Integration Enhancement**
   - Fetch resource-level data with tags from APIs
   - Extract usage metrics (GB, requests, hours) alongside costs
   - Store resource metadata (region, type, creation date)

4. **API Endpoints**
   - `/api/cost-vs-usage` - Get cost and usage side-by-side
   - `/api/untagged-resources` - Get untagged resources ranked by cost
   - `/api/anomalies` - Get cost anomalies vs 30-day baseline
   - `/api/cost-summary/:month/:year` - Plain-English cost explanation

5. **Frontend Components**
   - Cost vs Usage view component
   - Untagged Resources section
   - Anomaly detection inline display
   - Monthly cost summary component

## Next Steps

### Phase 1: Database Helpers (Current)
- Implement resource save/retrieve functions
- Implement tag management functions
- Implement usage metrics functions
- Implement anomaly baseline calculation

### Phase 2: Data Collection
- Enhance AWS integration to fetch resource tags
- Enhance Azure/GCP integrations similarly
- Store usage metrics during sync

### Phase 3: Core Features
- Cost vs Usage API and UI
- Untagged resources detection and display
- Anomaly detection and inline alerts
- Cost summary generation

## Implementation Notes

- All features should work with existing data where possible
- Tagging features will be progressive (some providers have better tag support)
- Anomaly detection uses 30-day rolling average (self-relative baseline)
- Cost explanations are rule-based initially (no ML claims)

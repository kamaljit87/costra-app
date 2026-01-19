# Phase 3 Testing Guide

## Overview
This guide helps you test the Phase 3 features: **Cost Efficiency Metrics** and **Rightsizing Recommendations**.

## Prerequisites
1. ✅ Backend server running (`pm2 status` should show `costra-backend` as online)
2. ✅ Frontend server running (`pm2 status` should show `costra-frontend` as online)
3. ✅ User logged in to the application
4. ✅ Cost data synced for at least one cloud provider

## Testing Cost Efficiency Metrics

### 1. Access the Feature
1. Navigate to any cloud provider detail page (e.g., `/provider/aws`)
2. Click on the **"Analytics"** tab
3. Scroll down to find the **"Cost Efficiency Metrics"** section

### 2. Expected Behavior

#### When Data is Available:
- ✅ Component displays a table with efficiency metrics
- ✅ Shows service name, total cost, total usage, efficiency (cost/unit), and trend
- ✅ Trend indicators show:
  - 🟢 **Improving** (green) - efficiency getting better
  - 🔴 **Degrading** (red) - efficiency getting worse
  - ⚪ **Stable** (gray) - no significant change
- ✅ Service type icons (Storage, Compute, API, Transaction)
- ✅ Info button (ℹ️) opens explanatory dialog

#### When No Data is Available:
- ✅ Shows empty state with message: "No efficiency data available"
- ✅ Explains that efficiency metrics require usage data
- ✅ Info button still available

### 3. Test Scenarios

#### Test 1: Basic Display
- [ ] Component loads without errors
- [ ] Table headers are visible (Service, Total Cost, Total Usage, Efficiency, Trend)
- [ ] Frozen-water theme colors are applied

#### Test 2: Period Selection
- [ ] Change period filter (1M, 2M, 3M, etc.)
- [ ] Component updates with new date range
- [ ] Efficiency metrics recalculate for selected period

#### Test 3: Info Dialog
- [ ] Click info button (ℹ️)
- [ ] Dialog opens with explanation
- [ ] Dialog can be closed by clicking outside or "Got it" button

#### Test 4: Trend Indicators
- [ ] Services with improving efficiency show green trending down icon
- [ ] Services with degrading efficiency show red trending up icon
- [ ] Percentage change is displayed correctly

### 4. API Testing (Optional)
```bash
# Test endpoint (requires authentication token)
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3001/api/insights/cost-efficiency?startDate=2025-01-01&endDate=2025-01-31&providerId=aws"
```

Expected response:
```json
{
  "data": {
    "efficiencyMetrics": [
      {
        "serviceName": "S3",
        "serviceType": "storage",
        "totalCost": 450.00,
        "totalUsage": 19500,
        "unit": "GB",
        "efficiency": 0.023,
        "trend": "improving",
        ...
      }
    ],
    "period": {
      "startDate": "2025-01-01",
      "endDate": "2025-01-31"
    }
  }
}
```

---

## Testing Rightsizing Recommendations

### 1. Access the Feature
1. Navigate to any cloud provider detail page (e.g., `/provider/aws`)
2. Click on the **"Analytics"** tab
3. Scroll down to find the **"Rightsizing Recommendations"** section

### 2. Expected Behavior

#### When Recommendations are Available:
- ✅ Displays cards for each recommendation
- ✅ Shows resource name, service, region
- ✅ Displays current cost, utilization, potential savings
- ✅ Priority indicators (High/Medium/Low) with color coding:
  - 🔴 **High** - Red background
  - 🟡 **Medium** - Yellow background
  - 🔵 **Low** - Blue background
- ✅ "Dismiss" button to hide recommendations
- ✅ Total potential savings summary at bottom
- ✅ Info button (ℹ️) opens explanatory dialog

#### When No Recommendations are Available:
- ✅ Shows empty state with checkmark icon
- ✅ Message: "No optimization opportunities found"
- ✅ Explains that all resources appear appropriately sized
- ✅ Info button still available

### 3. Test Scenarios

#### Test 1: Basic Display
- [ ] Component loads without errors
- [ ] Recommendation cards are visible
- [ ] Priority colors are correct (red/yellow/blue)
- [ ] Frozen-water theme is applied

#### Test 2: Recommendation Details
- [ ] Each card shows:
  - Resource name/ID
  - Service name and type
  - Region (if available)
  - Current monthly cost
  - Estimated utilization percentage
  - Potential monthly savings
  - Savings percentage
  - Priority level
  - Reason for recommendation

#### Test 3: Dismiss Functionality
- [ ] Click "Dismiss" on a recommendation
- [ ] Recommendation disappears from view
- [ ] Total savings updates accordingly
- [ ] Recommendation stays dismissed on refresh (if implemented)

#### Test 4: Info Dialog
- [ ] Click info button (ℹ️)
- [ ] Dialog opens with explanation
- [ ] Shows best practices and important notes
- [ ] Dialog can be closed

#### Test 5: Multiple Recommendations
- [ ] If multiple recommendations exist, they're sorted by savings
- [ ] Total potential savings is calculated correctly
- [ ] Recommendation count is accurate

### 4. API Testing (Optional)
```bash
# Test endpoint (requires authentication token)
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3001/api/insights/rightsizing-recommendations?providerId=aws"
```

Expected response:
```json
{
  "data": {
    "recommendations": [
      {
        "resourceId": "i-1234567890",
        "resourceName": "web-server-1",
        "serviceName": "EC2",
        "currentCost": 75.00,
        "utilization": {
          "estimated": 15.0,
          "usageQuantity": 100,
          "usageUnit": "hours"
        },
        "recommendation": "downsize",
        "potentialSavings": 37.50,
        "savingsPercent": 50.0,
        "priority": "high",
        "reason": "Low utilization suggests downsizing opportunity"
      }
    ],
    "totalPotentialSavings": 125.50,
    "recommendationCount": 3
  }
}
```

---

## Integration Testing

### Test 1: Analytics Tab Integration
- [ ] Both components appear in Analytics tab
- [ ] Components are in correct order:
  1. Cost vs Usage
  2. Untagged Resources
  3. Cost by Dimension
  4. Cost Anomalies
  5. Unit Economics
  6. **Cost Efficiency Metrics** (NEW)
  7. **Rightsizing Recommendations** (NEW)
- [ ] Components don't overlap or cause layout issues
- [ ] Responsive design works on mobile/tablet

### Test 2: Account Filtering
- [ ] If multiple accounts exist, components filter by selected account
- [ ] Data updates when account selection changes
- [ ] Empty states show appropriate messages

### Test 3: Period Filtering (Cost Efficiency Only)
- [ ] Cost Efficiency Metrics respects period selection
- [ ] Date range updates correctly
- [ ] Efficiency calculations use correct period

---

## Browser Console Testing

### Check for Errors
1. Open browser DevTools (F12)
2. Go to Console tab
3. Navigate to Analytics tab
4. Check for any errors:
   - ❌ Red errors should not appear
   - ⚠️ Yellow warnings are acceptable if they're React dev warnings

### Check Network Requests
1. Open browser DevTools (F12)
2. Go to Network tab
3. Navigate to Analytics tab
4. Look for API calls:
   - `GET /api/insights/cost-efficiency?startDate=...&endDate=...`
   - `GET /api/insights/rightsizing-recommendations?providerId=...`
5. Verify responses:
   - Status should be 200 (OK)
   - Response should contain `data` object

---

## Common Issues & Solutions

### Issue: "No efficiency data available"
**Cause**: No usage metrics in database
**Solution**: 
- Sync cost data (this should populate usage metrics)
- Check `service_usage_metrics` table has data

### Issue: "No optimization opportunities found"
**Cause**: No resources with low utilization detected
**Solution**: 
- This is expected if all resources are properly sized
- Check `resources` table has data with usage quantities

### Issue: Component not appearing
**Cause**: Component not imported or integrated
**Solution**:
- Check `ProviderDetailPage.tsx` imports both components
- Verify components are in Analytics tab section
- Check browser console for import errors

### Issue: API returns 401 (Unauthorized)
**Cause**: Not logged in or token expired
**Solution**:
- Log in to the application
- Check `localStorage.getItem('authToken')` exists

### Issue: API returns 404 (Not Found)
**Cause**: Routes not registered
**Solution**:
- Restart backend: `pm2 restart costra-backend`
- Check `server/routes/insights.js` has the new routes
- Verify routes are exported: `export default router`

---

## Success Criteria

✅ **Cost Efficiency Metrics:**
- [ ] Component displays correctly
- [ ] Efficiency calculations are accurate
- [ ] Trends are calculated and displayed
- [ ] Info dialog works
- [ ] Period filtering works
- [ ] Frozen-water theme applied

✅ **Rightsizing Recommendations:**
- [ ] Component displays correctly
- [ ] Recommendations are prioritized correctly
- [ ] Savings calculations are accurate
- [ ] Dismiss functionality works
- [ ] Info dialog works
- [ ] Frozen-water theme applied

✅ **Integration:**
- [ ] Both components appear in Analytics tab
- [ ] No layout issues
- [ ] No console errors
- [ ] API endpoints respond correctly

---

## Manual Testing Checklist

### Cost Efficiency Metrics
- [ ] Navigate to provider detail page
- [ ] Click Analytics tab
- [ ] Find Cost Efficiency Metrics section
- [ ] Verify table displays (or empty state)
- [ ] Click info button and verify dialog
- [ ] Change period and verify data updates
- [ ] Check browser console for errors

### Rightsizing Recommendations
- [ ] Navigate to provider detail page
- [ ] Click Analytics tab
- [ ] Find Rightsizing Recommendations section
- [ ] Verify recommendations display (or empty state)
- [ ] Click info button and verify dialog
- [ ] Test dismiss functionality (if recommendations exist)
- [ ] Check browser console for errors

### Integration
- [ ] Verify both components appear in correct order
- [ ] Test responsive design (resize browser)
- [ ] Test with different providers
- [ ] Test with different accounts (if multiple exist)
- [ ] Verify no layout breaking

---

## Next Steps After Testing

If all tests pass:
1. ✅ Phase 3 is complete and working
2. ✅ Ready for production use
3. ✅ Can proceed to Phase 4 (Enterprise Features)

If issues are found:
1. Check error logs: `pm2 logs costra-backend`
2. Check browser console for frontend errors
3. Verify database has required data
4. Review implementation for any missing pieces

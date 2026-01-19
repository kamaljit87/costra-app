#!/usr/bin/env node

/**
 * Phase 3 Testing Script
 * Tests Cost Efficiency Metrics and Rightsizing Recommendations endpoints
 */

import http from 'http';

const API_BASE = 'http://localhost:3001/api';

// Test configuration
const TEST_USER_ID = 1; // Assuming user ID 1 exists
const TEST_TOKEN = process.env.TEST_TOKEN || ''; // Set TEST_TOKEN env var if needed

// Helper function to make API requests
function makeRequest(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE);
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (TEST_TOKEN) {
      options.headers['Authorization'] = `Bearer ${TEST_TOKEN}`;
    }

    if (body) {
      options.body = JSON.stringify(body);
    }

    const req = http.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

// Test functions
async function testCostEfficiency() {
  console.log('\n📊 Testing Cost Efficiency Metrics API...');
  
  const startDate = '2025-01-01';
  const endDate = '2025-01-31';
  const providerId = 'aws';
  
  try {
    const response = await makeRequest(
      `/insights/cost-efficiency?startDate=${startDate}&endDate=${endDate}&providerId=${providerId}`
    );
    
    console.log(`   Status: ${response.status}`);
    
    if (response.status === 401) {
      console.log('   ⚠️  Authentication required (expected if no token)');
      return false;
    }
    
    if (response.status === 200) {
      console.log('   ✅ Endpoint is accessible');
      if (response.data && response.data.data) {
        const metrics = response.data.data.efficiencyMetrics || [];
        console.log(`   📈 Found ${metrics.length} efficiency metrics`);
        if (metrics.length > 0) {
          console.log(`   Example: ${metrics[0].serviceName} - ${metrics[0].efficiency} ${metrics[0].unit}`);
        }
      }
      return true;
    }
    
    if (response.status === 400) {
      console.log('   ⚠️  Bad request (check parameters)');
      console.log('   Response:', response.data);
      return false;
    }
    
    console.log('   ❌ Unexpected status:', response.status);
    console.log('   Response:', response.data);
    return false;
  } catch (error) {
    console.log('   ❌ Error:', error.message);
    return false;
  }
}

async function testRightsizingRecommendations() {
  console.log('\n⚡ Testing Rightsizing Recommendations API...');
  
  const providerId = 'aws';
  
  try {
    const response = await makeRequest(
      `/insights/rightsizing-recommendations?providerId=${providerId}`
    );
    
    console.log(`   Status: ${response.status}`);
    
    if (response.status === 401) {
      console.log('   ⚠️  Authentication required (expected if no token)');
      return false;
    }
    
    if (response.status === 200) {
      console.log('   ✅ Endpoint is accessible');
      if (response.data && response.data.data) {
        const recommendations = response.data.data.recommendations || [];
        const totalSavings = response.data.data.totalPotentialSavings || 0;
        console.log(`   📋 Found ${recommendations.length} recommendations`);
        console.log(`   💰 Total potential savings: $${totalSavings.toFixed(2)}/month`);
        if (recommendations.length > 0) {
          const rec = recommendations[0];
          console.log(`   Example: ${rec.resourceName} - ${rec.priority} priority, $${rec.potentialSavings.toFixed(2)}/mo savings`);
        }
      }
      return true;
    }
    
    if (response.status === 400) {
      console.log('   ⚠️  Bad request (check parameters)');
      console.log('   Response:', response.data);
      return false;
    }
    
    console.log('   ❌ Unexpected status:', response.status);
    console.log('   Response:', response.data);
    return false;
  } catch (error) {
    console.log('   ❌ Error:', error.message);
    return false;
  }
}

async function testHealth() {
  console.log('\n🏥 Testing API Health...');
  
  try {
    const response = await makeRequest('/health');
    
    if (response.status === 200) {
      console.log('   ✅ API is healthy');
      console.log('   Response:', response.data);
      return true;
    }
    
    console.log('   ⚠️  Unexpected status:', response.status);
    return false;
  } catch (error) {
    console.log('   ❌ Error:', error.message);
    return false;
  }
}

// Main test runner
async function runTests() {
  console.log('🧪 Phase 3 Feature Testing');
  console.log('='.repeat(50));
  
  const results = {
    health: false,
    costEfficiency: false,
    rightsizing: false,
  };
  
  // Test health first
  results.health = await testHealth();
  
  // Test Phase 3 endpoints
  results.costEfficiency = await testCostEfficiency();
  results.rightsizing = await testRightsizingRecommendations();
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 Test Summary:');
  console.log(`   Health Check: ${results.health ? '✅' : '❌'}`);
  console.log(`   Cost Efficiency: ${results.costEfficiency ? '✅' : '❌'}`);
  console.log(`   Rightsizing: ${results.rightsizing ? '✅' : '❌'}`);
  
  const allPassed = Object.values(results).every(r => r);
  console.log(`\n${allPassed ? '✅' : '⚠️'} Overall: ${allPassed ? 'All tests passed' : 'Some tests need authentication or data'}`);
  
  if (!allPassed) {
    console.log('\n💡 Note: Some tests may require:');
    console.log('   - Valid authentication token (set TEST_TOKEN env var)');
    console.log('   - Cost data in the database');
    console.log('   - Usage metrics data for efficiency calculations');
  }
}

// Run tests
runTests().catch(console.error);

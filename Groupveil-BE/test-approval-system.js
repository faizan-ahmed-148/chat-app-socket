const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:5001/api';

async function testApprovalSystem() {
  console.log('🧪 Testing Approval System...\n');

  try {
    // Test 1: Check health endpoint
    console.log('1. Testing health endpoint...');
    const health = await fetch(`${BASE_URL}/health`);
    const healthData = await health.json();
    console.log('✅ Health check:', healthData.status);

    // Test 2: Check admin stats
    console.log('\n2. Testing admin stats...');
    const stats = await fetch(`${BASE_URL}/admin/stats`);
    const statsData = await stats.json();
    console.log('✅ Admin stats:', {
      totalUsers: statsData.totalUsers,
      totalGroups: statsData.totalGroups,
      pendingGroups: statsData.pendingGroups,
      approvedGroups: statsData.approvedGroups
    });

    // Test 3: Check pending groups
    console.log('\n3. Testing pending groups...');
    const pendingGroups = await fetch(`${BASE_URL}/admin/pending-groups`);
    const pendingData = await pendingGroups.json();
    console.log('✅ Pending groups:', pendingData.length);

    // Test 4: Check all groups
    console.log('\n4. Testing all groups...');
    const allGroups = await fetch(`${BASE_URL}/admin/all-groups`);
    const allGroupsData = await allGroups.json();
    console.log('✅ All groups:', allGroupsData.length);

    // Test 5: Check users
    console.log('\n5. Testing users...');
    const users = await fetch(`${BASE_URL}/admin/users`);
    const usersData = await users.json();
    console.log('✅ Users:', usersData.length);

    console.log('\n🎉 All API endpoints are working!');
    console.log('\n📋 Next steps:');
    console.log('1. Open http://localhost:5173 (main app)');
    console.log('2. Register a new user and create a group');
    console.log('3. Open http://localhost:5174 (admin panel)');
    console.log('4. Go to "Pending Groups" and approve the group');
    console.log('5. Go back to main app and verify group is active');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testApprovalSystem(); 
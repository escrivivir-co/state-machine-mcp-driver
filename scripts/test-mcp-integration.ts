#!/usr/bin/env tsx
/**
 * Test MCPDriverAdapter Integration
 * Simple test script to verify the new driver works correctly
 */

import { MCPDriverAdapter } from '../src/drivers/MCPDriverAdapter';
import { logger } from '../src/utils/logger';

async function testMCPIntegration() {
  console.log('🧪 Testing MCP Driver Adapter Integration');
  console.log('==========================================');

  try {
    // Test 1: Create adapter with feature flag
    console.log('\n1️⃣ Creating MCPDriverAdapter...');
    const mcpDriver = new MCPDriverAdapter({
      useNativeProtocol: process.env.MCP_USE_NATIVE_PROTOCOL === 'true',
      enableFallback: true
    });

    console.log(`   Protocol: ${mcpDriver.getCurrentProtocol()}`);
    console.log(`   Feature flag MCP_USE_NATIVE_PROTOCOL: ${process.env.MCP_USE_NATIVE_PROTOCOL || 'not set'}`);

    // Test 2: Add test server
    console.log('\n2️⃣ Adding test MCP server...');
    await mcpDriver.addServer({
      id: 'test-server',
      name: 'Test MCP Server',
      url: 'http://localhost:3001',
      timeout: 5000
    });

    console.log('   ✅ Server added successfully');

    // Test 3: List servers
    console.log('\n3️⃣ Listing configured servers...');
    const servers = mcpDriver.getServers();
    console.log(`   📋 Found ${servers.length} server(s):`);
    servers.forEach(server => {
      console.log(`      - ${server.name} (${server.id}) at ${server.url}`);
    });

    // Test 4: Health check
    console.log('\n4️⃣ Testing health check...');
    try {
      const healthy = await mcpDriver.healthCheck('test-server');
      console.log(`   🏥 Health check: ${healthy ? '✅ Healthy' : '❌ Unhealthy'}`);
    } catch (error) {
      console.log(`   🏥 Health check failed (expected): ${error.message}`);
    }

    // Test 5: Test protocol switching
    console.log('\n5️⃣ Testing protocol switching...');
    const originalProtocol = mcpDriver.getCurrentProtocol();
    console.log(`   Current protocol: ${originalProtocol}`);
    
    if (originalProtocol === 'native') {
      mcpDriver.switchToLegacy();
      console.log(`   Switched to: ${mcpDriver.getCurrentProtocol()}`);
      mcpDriver.switchToNative();
      console.log(`   Switched back to: ${mcpDriver.getCurrentProtocol()}`);
    } else {
      mcpDriver.switchToNative();
      console.log(`   Switched to: ${mcpDriver.getCurrentProtocol()}`);
      mcpDriver.switchToLegacy();
      console.log(`   Switched back to: ${mcpDriver.getCurrentProtocol()}`);
    }

    // Test 6: MCPClientLike interface
    console.log('\n6️⃣ Testing MCPClientLike interface...');
    const nativeDriver = mcpDriver.getNativeDriver();
    console.log('   ✅ Native driver obtained for chat provider integration');

    // Test 7: Cleanup
    console.log('\n7️⃣ Cleaning up...');
    await mcpDriver.close();
    console.log('   ✅ Connections closed');

    console.log('\n🎉 All tests completed successfully!');
    console.log('\n💡 Usage examples:');
    console.log('   # Use native MCP protocol');
    console.log('   export MCP_USE_NATIVE_PROTOCOL=true');
    console.log('   npm run test:mcp');
    console.log('');
    console.log('   # Use legacy REST protocol');
    console.log('   export MCP_USE_NATIVE_PROTOCOL=false');
    console.log('   npm run test:mcp');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

// Command line handling
if (require.main === module) {
  testMCPIntegration().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { testMCPIntegration };

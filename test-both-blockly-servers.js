#!/usr/bin/env node

/**
 * Test script to verify both Blockly environments work correctly
 */

const { MultiUIGameManager } = require('./src/ui/MultiUIGameManager');
const { Runtime } = require('./src/runtime/Runtime');
const { MCPDriverAdapter } = require('./src/drivers/MCPDriverAdapter');

async function testBlocklyServers() {
  console.log('🧪 Testing Blockly AlephScript SDK Integration...');
  console.log('==================================================');
  
  try {
    // Mock runtime and driver for testing
    const mockRuntime = new Runtime();
    const mockDriver = new MCPDriverAdapter();
    
    // Test configuration for both UIs
    const testConfig = {
      game: {
        id: 'blockly-test',
        name: 'Blockly Test',
        description: 'Testing both Design and Runtime environments'
      },
      uiInstances: [
        {
          id: 'design-env',
          name: 'Blockly Design Environment',
          type: 'blockly-gamify-ui',
          enabled: true,
          config: {
            gameTitle: 'Blockly Design Test',
            port: 9094,
            staticDir: './public_templates/blockly-gamify-ui',
            provideTemplate: true,
            autoOpenBrowser: false, // Don't auto-open during test
            debugMode: true
          }
        },
        {
          id: 'runtime-env',
          name: 'Blockly Runtime Environment', 
          type: 'blockly-runtime-gamify-ui',
          enabled: true,
          config: {
            gameTitle: 'Blockly Runtime Test',
            port: 9099,
            staticDir: './public_templates/blockly-runtime-gamify-ui',
            provideTemplate: true,
            autoOpenBrowser: false, // Don't auto-open during test
            debugMode: true
          }
        }
      ]
    };
    
    console.log('🔧 Initializing MultiUIGameManager...');
    const manager = new MultiUIGameManager(mockRuntime, mockDriver, testConfig);
    
    console.log('🚀 Starting both Blockly environments...');
    await manager.start();
    
    // Wait a moment for servers to fully start
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Get status of all UIs
    const status = manager.getUIStatus();
    
    console.log('\n📊 Server Status Report:');
    console.log('========================');
    
    status.forEach(ui => {
      const emoji = ui.running ? '✅' : '❌';
      console.log(`${emoji} ${ui.name}:`);
      console.log(`   Type: ${ui.type}`);
      console.log(`   Port: ${ui.port}`);
      console.log(`   URL: ${ui.url}`);
      console.log(`   Running: ${ui.running}`);
      console.log('');
    });
    
    // Test basic endpoints
    console.log('🔍 Testing API endpoints...');
    const http = require('http');
    
    // Test Design Environment
    await testEndpoint('localhost', 9094, 'Design Environment');
    
    // Test Runtime Environment  
    await testEndpoint('localhost', 9099, 'Runtime Environment');
    
    console.log('\n🎉 Test completed successfully!');
    console.log('🌐 Access URLs:');
    console.log('   Design Environment: http://localhost:9094');
    console.log('   Runtime Environment: http://localhost:9099');
    console.log('\n⚠️  Remember to stop the servers when done testing.');
    
    // Keep servers running for manual testing
    console.log('\nServers are running... Press Ctrl+C to stop.');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

function testEndpoint(host, port, name) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: host,
      port: port,
      path: '/',
      method: 'GET',
      timeout: 5000
    }, (res) => {
      console.log(`✅ ${name} responding (${res.statusCode})`);
      resolve();
    });
    
    req.on('error', (error) => {
      console.log(`❌ ${name} not responding: ${error.message}`);
      reject(error);
    });
    
    req.on('timeout', () => {
      console.log(`⏱️  ${name} timeout`);
      req.destroy();
      reject(new Error('Timeout'));
    });
    
    req.end();
  });
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down servers...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down servers...');
  process.exit(0);
});

// Run the test
if (require.main === module) {
  testBlocklyServers().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { testBlocklyServers };

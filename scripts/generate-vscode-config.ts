#!/usr/bin/env tsx
/**
 * VS Code MCP Configuration Generator
 * 
 * Standalone script to generate .vscode/mcp.json configuration
 * for connecting VS Code to running MCP servers
 */

import { MCPDriverAdapter } from '../src/drivers/MCPDriverAdapter';
import { logger } from '../src/utils/logger';

interface GenerateConfigOptions {
  outputPath?: string;
  includeDescription?: boolean;
  check?: boolean;
}

/**
 * Generate VS Code MCP configuration
 */
async function generateVSCodeConfig(options: GenerateConfigOptions = {}) {
  const {
    outputPath = '.vscode/mcp.json',
    includeDescription = true,
    check = false
  } = options;

  console.log('🔧 VS Code MCP Configuration Generator');
  console.log('=====================================');

  try {
    // Initialize MCP Driver
    console.log('📡 Connecting to MCP Service Launcher...');
    const mcpDriver = new MCPDriverAdapter();
    
    // Add service launcher server
    await mcpDriver.addServer({
      id: 'mcp-service-launcher',
      name: 'MCP Service Launcher',
      url: 'http://localhost:3000'
    });

    if (check) {
      // Just check status
      console.log('\n📊 Checking MCP servers status...');
      const statusResult = await mcpDriver.executeTool(
        'mcp-service-launcher',
        'get_server_status',
        {}
      );

      if (statusResult.success) {
        console.log('✅ Server status retrieved successfully');
        console.log(JSON.stringify(statusResult, null, 2));
      } else {
        console.error('❌ Failed to get server status');
      }
      return;
    }

    // Generate configuration
    console.log(`\n🛠️  Generating VS Code MCP configuration...`);
    const configResult = await mcpDriver.executeTool(
      'mcp-service-launcher',
      'generate_vscode_mcp_config',
      {
        includeDescription,
        outputPath
      }
    );

    if (configResult.success) {
      console.log(`✅ Configuration generated successfully!`);
      console.log(`📁 Saved to: ${configResult.outputPath}`);
      
      // Show setup instructions
      if (configResult.instructions) {
        console.log('\n' + '='.repeat(50));
        console.log('🎯 VS Code Setup Instructions');
        console.log('='.repeat(50));
        
        console.log('\n📋 Quick Setup:');
        configResult.instructions.quickCommands?.forEach((cmd: string) => {
          console.log(`   • ${cmd}`);
        });

        console.log('\n💡 Next Steps:');
        console.log('   1. Open VS Code in this workspace');
        console.log('   2. Install Model Context Protocol extension');
        console.log('   3. Use Ctrl+Shift+P → "MCP: Connect to Server"');
        console.log('   4. Select from available servers');
        console.log('   5. Start using MCP tools!');
        
        console.log('\n📄 Configuration preview:');
        console.log(JSON.stringify(configResult.configFile, null, 2));
      }
    } else {
      console.error('❌ Failed to generate configuration:', configResult.error);
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Error:', error);
    console.log('\n💡 Make sure the MCP Service Launcher is running:');
    console.log('   npm run launcher:x-plus-1');
    process.exit(1);
  }
}

/**
 * Parse command line arguments
 */
function parseArgs(): GenerateConfigOptions {
  const args = process.argv.slice(2);
  const options: GenerateConfigOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--output':
      case '-o':
        options.outputPath = args[++i];
        break;
      case '--no-description':
        options.includeDescription = false;
        break;
      case '--check':
      case '-c':
        options.check = true;
        break;
      case '--help':
      case '-h':
        showHelp();
        process.exit(0);
        break;
      default:
        console.error(`Unknown argument: ${arg}`);
        showHelp();
        process.exit(1);
    }
  }

  return options;
}

/**
 * Show help information
 */
function showHelp() {
  console.log(`
🔧 VS Code MCP Configuration Generator

Usage: npx tsx scripts/generate-vscode-config.ts [options]

Options:
  -o, --output <path>     Output path for mcp.json (default: .vscode/mcp.json)
  --no-description        Don't include descriptions in config
  -c, --check             Just check server status, don't generate config
  -h, --help              Show this help

Examples:
  # Generate default configuration
  npx tsx scripts/generate-vscode-config.ts

  # Generate to custom path
  npx tsx scripts/generate-vscode-config.ts -o my-config/mcp.json

  # Check server status only
  npx tsx scripts/generate-vscode-config.ts --check

Note: Make sure MCP servers are running before generating configuration.
`);
}

/**
 * Main entry point
 */
async function main() {
  try {
    const options = parseArgs();
    await generateVSCodeConfig(options);
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

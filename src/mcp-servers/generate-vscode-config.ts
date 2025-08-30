#!/usr/bin/env tsx
/**
 * VS Code MCP Configuration Generator
 *
 * Standalone script to generate .vscode/mcp.json configuration
 * for connecting VS Code to running MCP servers
 */

import { MCPDriverAdapter } from "../drivers/MCPDriverAdapter";
import { logger } from "../utils/logger";

interface GenerateConfigOptions {
    outputPath?: string;
    includeDescription?: boolean;
    check?: boolean;
}

/**
 * Generate VS Code MCP configuration
 */
export async function generateVSCodeConfig(
    mcpDriver: MCPDriverAdapter,
    options: GenerateConfigOptions = {}
) {
    const {
        outputPath = ".vscode/mcp.json",
        includeDescription = true,
        check = false,
    } = options;

    console.log("\n🔧 VS Code MCP Configuration Generator");
    logger.info("=====================================");

    try {
        // Initialize MCP Driver
        logger.info("📡 Connecting to MCP Service Launcher...");

        if (check) {
            // Just check status
            logger.info("\n📊 Checking MCP servers status...");
            const statusResult = await mcpDriver.executeTool(
                "mcp-service-launcher",
                "get_server_status",
                {}
            );

            if (statusResult.success) {
                logger.info("✅ Server status retrieved successfully");
                logger.info(JSON.stringify(statusResult, null, 2));
            } else {
                logger.error("❌ Failed to get server status");
            }
            return;
        }

        // Generate configuration
        logger.info(`\n🛠️  Generating VS Code MCP configuration...`);
        const toolResult: any = await mcpDriver.executeTool(
            "mcp-service-launcher",
            "generate_vscode_mcp_config",
            {
                includeDescription,
                outputPath,
            }
        );

        let configElement = toolResult && Array.isArray(toolResult) ? toolResult.pop() : null;

        if (!configElement) {
            configElement = { success: false };
        }

        configElement = JSON.parse(configElement.text);
        if (configElement?.success) {
            logger.info(`✅ Configuration generated successfully!`);
            logger.info(`📁 Saved to: ${configElement.outputPath}`);

            // Show setup instructions
            if (configElement.instructions) {
                logger.info("\n" + "=".repeat(50));
                logger.info("🎯 VS Code Setup Instructions");
                logger.info("=".repeat(50));

                logger.info("\n📋 Quick Setup:");
                configElement.instructions.quickCommands?.forEach(
                    (cmd: string) => {
                        logger.info(`   • ${cmd}`);
                    }
                );

                logger.info("\n💡 Next Steps:");
                logger.info("   1. Open VS Code in this workspace");
                logger.info("   2. Install Model Context Protocol extension");
                logger.info(
                    '   3. Use Ctrl+Shift+P → "MCP: Connect to Server"'
                );
                logger.info("   4. Select from available servers");
                logger.info("   5. Start using MCP tools!");

                logger.info("\n📄 Configuration preview:");
                logger.info(JSON.stringify(configElement.configFile, null, 2));
            }
        } else {
            logger.error("❌ Failed to generate configuration:");
            logger.debug("SCODEconfigResult", configElement.error);
            console.log("SCODEconfigResult", configElement);
            process.exit(1);
        }
    } catch (error) {
        logger.error("❌ Error:", error);
        logger.info("\n💡 Make sure the MCP Service Launcher is running:");
        logger.info("   npm run launcher:x-plus-1");
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
            case "--output":
            case "-o":
                options.outputPath = args[++i];
                break;
            case "--no-description":
                options.includeDescription = false;
                break;
            case "--check":
            case "-c":
                options.check = true;
                break;
            case "--help":
            case "-h":
                showHelp();
                process.exit(0);
                break;
            default:
                logger.error(`Unknown argument: ${arg}`);
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
    logger.info(`
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
        await generateVSCodeConfig(new MCPDriverAdapter(), options);
    } catch (error) {
        logger.error("❌ Script failed:", error);
        process.exit(1);
    }
}

// Run if executed directly
if (require.main === module) {
    main();
}

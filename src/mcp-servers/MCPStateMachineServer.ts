import { Logger } from "@/utils";
import DEPRECATED_OLD_STATE_MACHINE_SERVER, { MCPStateMachineServer } from "./MCPStateMachineServerImpl";

/**
 * CLI entry point - run as standalone MCP server
 */
async function main() {

    try {
        const server = new MCPStateMachineServer();
		Logger.info("MCPBasicStateMachineServer Server instance created, starting... with bot support. 1");
        await server.start();

        // Keep process alive
        process.on("SIGINT", () => {
            console.log("\n🔄 Shutting down X+1 MCP Machine...");
            server.shutdown().then(() => {
                process.exit(0);
            });
        });

        process.on("SIGTERM", () => {
            console.log("\n🔄 Shutting down X+1 MCP Machine...");
            server.shutdown().then(() => {
                process.exit(0);
            });
        });
    } catch (error) {
        console.error("❌ Failed to start X+1 MCP Machine:", error);
        process.exit(1);
    }
}

// Run if this file is executed directly
if (require.main === module) {
    main();
}

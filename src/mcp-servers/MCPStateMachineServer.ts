import { Logger } from "@/utils";
import MCPBasicStateMachineServer from "./MCPStateMachineServerImpl";

/**
 * CLI entry point - run as standalone MCP server
 */
async function main() {

    try {
        const server = new MCPBasicStateMachineServer();
		Logger.info("MCPBasicStateMachineServer Server instance created, starting...");
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

import MCPWikiBrowserServer from "./MCPWikiBrowserServerImpl";

/**
 * CLI entry point - run as standalone MCP server
 */
async function main() {

    try {
        const server = new MCPWikiBrowserServer();
		console.log(`🌍 Starting Wikipedia MCP Browser on port 3002`);
        await server.start();

        // Keep process alive
        process.on("SIGINT", () => {
            console.log("\n🔄 Shutting down Wikipedia MCP Browser...");
            server.shutdown().then(() => {
                process.exit(0);
            });
        });

        process.on("SIGTERM", () => {
            console.log("\n🔄 Shutting down Wikipedia MCP Browser...");
            server.shutdown().then(() => {
                process.exit(0);
            });
        });
    } catch (error) {
        console.error("❌ Failed to start Wikipedia MCP Browser:", error);
        process.exit(1);
    }
}

// Run if this file is executed directly
if (require.main === module) {
    main();
}

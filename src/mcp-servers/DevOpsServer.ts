/**
 * DevOps MCP Server
 * Provides DevOps automation tools, resources, and prompts management
 * Includes CRUD operations for prompts and resources
 * NEW: Plugin system for modular functionality
 */

import { Logger } from "@/utils";
import { DevOpsServer } from "./DevOpsServerImpl";

// Enable standalone execution
if (require.main === module) {

    const server = new DevOpsServer();
    Logger.info("DevOpsServer Server instance created, starting...");
    server.start()
        .then(() => {
            console.log("Server started successfully");
        })
        .catch((error) => {
            console.error("Error starting server:", error);
            process.exit(1);
        });
}

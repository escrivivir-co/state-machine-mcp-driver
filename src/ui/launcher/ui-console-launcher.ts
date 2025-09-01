/**
 * Independent Console Launcher
 * Utility to launch processes in separate console windows across different operating systems
 */

import { spawn, ChildProcess } from "child_process";
import * as path from "path";
import * as os from "os";
import { Logger } from "../../utils/logger";

export interface ConsoleOptions {
    title?: string;
    workingDirectory?: string;
    keepOpen?: boolean;
    minimized?: boolean;
    env?: Record<string, string>;
}

export interface LaunchedConsole {
    process: ChildProcess;
    pid: number;
    platform: string;
    command: string;
    close: () => void;
}

/**
 * Cross-platform console launcher
 */
export class IndependentConsoleLauncher {
    private static activeConsoles: Map<string, LaunchedConsole> = new Map();

    /**
     * Launch a Node.js script in an independent console window
     */
    static async launchNodeScript(
        scriptPath: string,
        args: string[] = [],
        options: ConsoleOptions = {}
    ): Promise<LaunchedConsole> {
        const platform = os.platform();
        let nodeCommand = process.execPath; // Path to current Node.js executable
        const fullScriptPath = path.resolve(scriptPath);

        // Check if this is a TypeScript file and if tsx is available
        const isTypeScript = this.isTypeScriptFile(fullScriptPath);
        let scriptArgs = [fullScriptPath, ...args];

        if (isTypeScript) {
            try {
                // Try to use tsx for TypeScript execution
                const tsxPath = require.resolve("tsx/cli");
                scriptArgs = [tsxPath, fullScriptPath, ...args];
                Logger.info(
                    "Using tsx for TypeScript execution in independent console"
                );
            } catch (tsxError) {
                try {
                    // Fallback to ts-node
                    const tsNodePath = require.resolve("ts-node/dist/bin");
                    scriptArgs = [tsNodePath, fullScriptPath, ...args];
                    Logger.info(
                        "Using ts-node for TypeScript execution in independent console"
                    );
                } catch (tsNodeError) {
                    Logger.warn(
                        "Neither tsx nor ts-node available, using plain Node.js for TypeScript file"
                    );
                    // Keep original script args
                }
            }
        }

        Logger.info(
            `Launching Node.js script in independent console: ${fullScriptPath}`
        );
        Logger.info(`Platform: ${platform}, Node: ${nodeCommand}`);
        Logger.info(`Script args: ${scriptArgs.join(" ")}`);

        // Prepare command and arguments
        let consoleProcess: ChildProcess;
        let commandDescription: string;

        try {
            switch (platform) {
                case "win32":
                    consoleProcess = await this.launchWindowsConsole(
                        nodeCommand,
                        scriptArgs,
                        options
                    );
                    commandDescription = `Windows cmd: ${nodeCommand} ${scriptArgs.join(
                        " "
                    )}`;
                    break;

                case "darwin": // macOS
                    consoleProcess = await this.launchMacOSConsole(
                        nodeCommand,
                        scriptArgs,
                        options
                    );
                    commandDescription = `macOS Terminal: ${nodeCommand} ${scriptArgs.join(
                        " "
                    )}`;
                    break;

                case "linux":
                    consoleProcess = await this.launchLinuxConsole(
                        nodeCommand,
                        scriptArgs,
                        options
                    );
                    commandDescription = `Linux terminal: ${nodeCommand} ${scriptArgs.join(
                        " "
                    )}`;
                    break;

                default:
                    throw new Error(`Unsupported platform: ${platform}`);
            }

            const launchedConsole: LaunchedConsole = {
                process: consoleProcess,
                pid: consoleProcess.pid!,
                platform,
                command: commandDescription,
                close: () => this.closeConsole(consoleProcess, platform),
            };

            // Track the console
            const consoleId = `${platform}_${Date.now()}_${consoleProcess.pid}`;
            this.activeConsoles.set(consoleId, launchedConsole);

            // Handle process events
            consoleProcess.on("error", (error) => {
                Logger.error(
                    `Console process error (PID: ${consoleProcess.pid})`,
                    error
                );
                this.activeConsoles.delete(consoleId);
            });

            consoleProcess.on("exit", (code, signal) => {
                Logger.info(
                    `Console process exited (PID: ${consoleProcess.pid}, Code: ${code}, Signal: ${signal})`
                );
                this.activeConsoles.delete(consoleId);
            });

            Logger.info(
                `Successfully launched console process (PID: ${consoleProcess.pid})`
            );
            return launchedConsole;
        } catch (error) {
            Logger.error(
                "Failed to launch independent console",
                error as Error
            );
            throw error;
        }
    }

    /**
     * Launch console on Windows
     */
    private static async launchWindowsConsole(
        nodeCommand: string,
        scriptArgs: string[],
        options: ConsoleOptions
    ): Promise<ChildProcess> {
        // CRITICAL FIX for Windows "cannot find Interface" error
        // The issue: Windows start command interprets the first quoted parameter as:
        // - Window title if followed by another parameter
        // - Command to execute if it's the only quoted parameter
        
        // Create a safe, simple title without ANY special characters
        const originalTitle = options.title || "CustomUI";
        const title = "GameUI_" + Date.now().toString().slice(-6); // Safe title: GameUI_123456
        const workingDir = options.workingDirectory || process.cwd();
        const keepOpen = options.keepOpen !== false; // Default to true

        // Build the command string with proper Windows cmd escaping
        const cmdArgs = [nodeCommand, ...scriptArgs]
            .map((arg) => {
                // Escape arguments that contain spaces or special characters
                if (arg.includes(' ') || arg.includes('&') || arg.includes('^') || arg.includes('%')) {
                    return `"${arg.replace(/"/g, '""')}"`;
                }
                return arg;
            })
            .join(" ");
        
        const fullCommand = keepOpen
            ? `${cmdArgs} & echo. & echo Process completed. Press any key to close... & pause > nul`
            : cmdArgs;

        Logger.info(`Launching Windows console with safe title: ${title} (original: ${originalTitle})`);
        Logger.mcpVerbose(`Full command: ${fullCommand}`);

        // SOLUTION: Use a completely different approach
        // Instead of relying on the complex start command syntax, create a batch file
        const tempBatchContent = `@echo off
title ${originalTitle}
cd /d "${workingDir}"
${fullCommand}`;

        const os = require('os');
        const path = require('path');
        const fs = require('fs');
        
        const tempBatchPath = path.join(os.tmpdir(), `launcher_${Date.now()}.bat`);
        fs.writeFileSync(tempBatchPath, tempBatchContent, 'utf8');

        Logger.mcpVerbose(`Created temporary batch file: ${tempBatchPath}`);

        // Launch the batch file in a new console window - much more reliable
        const startArgs = [
            "/c",
            "start",
            `"${title}"`, // Simple safe title
            tempBatchPath
        ];

        Logger.mcpVerbose(`Simplified Windows start args: ${JSON.stringify(startArgs)}`);

        const consoleProcess = spawn("cmd.exe", startArgs, {
            detached: true,
            stdio: "ignore",
            cwd: workingDir,
            env: { ...process.env, ...options.env },
            shell: false,
        });

        if (!consoleProcess.pid) {
            // Clean up temp batch file if process failed
            try {
                fs.unlinkSync(tempBatchPath);
            } catch {}
            throw new Error("Failed to spawn Windows console process");
        }

        // Clean up temp batch file after a delay (process should have started by then)
        setTimeout(() => {
            try {
                fs.unlinkSync(tempBatchPath);
                Logger.mcpVerbose(`Cleaned up temporary batch file: ${tempBatchPath}`);
            } catch (error) {
                Logger.mcpVerbose(`Could not clean up batch file: ${error}`);
            }
        }, 5000);

        consoleProcess.unref();
        
        Logger.info(`Windows console launched with PID: ${consoleProcess.pid}`);
        return consoleProcess;
    }

    /**
     * Launch console on macOS
     */
    private static async launchMacOSConsole(
        nodeCommand: string,
        scriptArgs: string[],
        options: ConsoleOptions
    ): Promise<ChildProcess> {
        const title = options.title || "Custom UI Console";
        const workingDir = options.workingDirectory || process.cwd();
        const keepOpen = options.keepOpen !== false;

        // Escape arguments for shell
        const escapedArgs = [nodeCommand, ...scriptArgs].map(
            (arg) => `'${arg.replace(/'/g, "'\"'\"'")}'`
        );
        const command = escapedArgs.join(" ");

        // Build AppleScript to open Terminal with the command
        const keepOpenCmd = keepOpen
            ? "; echo ''; echo 'Process completed. Press any key to close...'; read -n 1"
            : "";

        const appleScript = `
            tell application "Terminal"
                activate
                do script "cd '${workingDir}' && ${command}${keepOpenCmd}"
                set custom title of front window to "${title}"
            end tell
        `;

        const consoleProcess = spawn("osascript", ["-e", appleScript], {
            detached: true,
            stdio: "ignore",
            cwd: workingDir,
            env: { ...process.env, ...options.env },
        });

        consoleProcess.unref();
        return consoleProcess;
    }

    /**
     * Launch console on Linux
     */
    private static async launchLinuxConsole(
        nodeCommand: string,
        scriptArgs: string[],
        options: ConsoleOptions
    ): Promise<ChildProcess> {
        const title = options.title || "Custom UI Console";
        const workingDir = options.workingDirectory || process.cwd();
        const keepOpen = options.keepOpen !== false;

        // Escape arguments for shell
        const escapedArgs = [nodeCommand, ...scriptArgs].map(
            (arg) => `'${arg.replace(/'/g, "'\"'\"'")}'`
        );
        const command = escapedArgs.join(" ");

        const keepOpenCmd = keepOpen
            ? "; echo ''; echo 'Process completed. Press any key to close...'; read -n 1"
            : "";

        // Try different terminal emulators in order of preference
        const terminals = [
            {
                cmd: "gnome-terminal",
                args: [
                    "--title",
                    title,
                    "--working-directory",
                    workingDir,
                    "--",
                    "bash",
                    "-c",
                    `${command}${keepOpenCmd}`,
                ],
            },
            {
                cmd: "konsole",
                args: [
                    "--title",
                    title,
                    "--workdir",
                    workingDir,
                    "-e",
                    "bash",
                    "-c",
                    `${command}${keepOpenCmd}`,
                ],
            },
            {
                cmd: "xfce4-terminal",
                args: [
                    "--title",
                    title,
                    "--working-directory",
                    workingDir,
                    "--command",
                    `bash -c "${command}${keepOpenCmd}"`,
                ],
            },
            {
                cmd: "lxterminal",
                args: [
                    "--title",
                    title,
                    "--working-directory",
                    workingDir,
                    "--command",
                    `bash -c "${command}${keepOpenCmd}"`,
                ],
            },
            {
                cmd: "mate-terminal",
                args: [
                    "--title",
                    title,
                    "--working-directory",
                    workingDir,
                    "--command",
                    `bash -c "${command}${keepOpenCmd}"`,
                ],
            },
            {
                cmd: "xterm",
                args: [
                    "-title",
                    title,
                    "-e",
                    "bash",
                    "-c",
                    `cd '${workingDir}' && ${command}${keepOpenCmd}`,
                ],
            },
        ];

        for (const terminal of terminals) {
            try {
                const consoleProcess = spawn(terminal.cmd, terminal.args, {
                    detached: true,
                    stdio: "ignore",
                    cwd: workingDir,
                    env: { ...process.env, ...options.env },
                });

                consoleProcess.unref();
                Logger.info(`Launched using ${terminal.cmd}`);
                return consoleProcess;
            } catch (error) {
                // Try next terminal
                continue;
            }
        }

        throw new Error(
            "No suitable terminal emulator found on this Linux system"
        );
    }

    /**
     * Close a console process
     */
    private static closeConsole(process: ChildProcess, platform: string): void {
        try {
            if (platform === "win32") {
                // On Windows, kill the process tree
                spawn(
                    "taskkill",
                    ["/pid", process.pid!.toString(), "/T", "/F"],
                    {
                        stdio: "ignore",
                    }
                );
            } else {
                // On Unix-like systems
                process.kill("SIGTERM");
            }
        } catch (error) {
            Logger.error(
                `Failed to close console process (PID: ${process.pid})`,
                error as Error
            );
        }
    }

    /**
     * Get information about active consoles
     */
    static getActiveConsoles(): LaunchedConsole[] {
        return Array.from(this.activeConsoles.values());
    }

    /**
     * Close all active consoles
     */
    static closeAllConsoles(): void {
        for (const console of this.activeConsoles.values()) {
            console.close();
        }
        this.activeConsoles.clear();
    }

    /**
     * Resolve TypeScript alias paths to absolute paths
     */
    private static resolveCustomClassPath(customClassPath: string): string {
        const originalCwd = process.cwd();
        const fs = require("fs");

        Logger.info(`🔍 Resolving custom class path: ${customClassPath}`);
        Logger.info(`📁 Working directory: ${originalCwd}`);

        // Handle different path formats
        if (path.isAbsolute(customClassPath)) {
            // If absolute path, check with extensions
            const possibleAbsolutePaths = [
                customClassPath,
                customClassPath + ".js",
                customClassPath + ".ts",
                customClassPath + ".mjs",
                customClassPath + ".cjs",
            ];

            for (const possiblePath of possibleAbsolutePaths) {
                if (fs.existsSync(possiblePath)) {
                    Logger.info(`✅ Found absolute path: ${possiblePath}`);
                    return possiblePath;
                }
            }
            Logger.warn(
                `⚠️  Absolute path not found, using as-is: ${customClassPath}`
            );
            return customClassPath;
        }

        let resolvedBasePath = "";

        // Handle TypeScript aliases
        if (customClassPath.startsWith("@ui/")) {
            // @ui/* maps to src/ui/*
            resolvedBasePath = customClassPath.replace("@ui/", "src/ui/");
        } else if (customClassPath.startsWith("@/")) {
            // @/* maps to src/*
            resolvedBasePath = customClassPath.replace("@/", "src/");
        } else if (customClassPath.startsWith("@models/")) {
            resolvedBasePath = customClassPath.replace(
                "@models/",
                "src/models/"
            );
        } else if (customClassPath.startsWith("@drivers/")) {
            resolvedBasePath = customClassPath.replace(
                "@drivers/",
                "src/drivers/"
            );
        } else if (customClassPath.startsWith("@runtime/")) {
            resolvedBasePath = customClassPath.replace(
                "@runtime/",
                "src/runtime/"
            );
        } else if (customClassPath.startsWith("@utils/")) {
            resolvedBasePath = customClassPath.replace("@utils/", "src/utils/");
        } else if (customClassPath.startsWith("@examples/")) {
            resolvedBasePath = customClassPath.replace(
                "@examples/",
                "examples/"
            );
        } else if (
            customClassPath.startsWith("./") ||
            customClassPath.startsWith("../")
        ) {
            // Handle relative paths
            resolvedBasePath = customClassPath;
        } else {
            // Handle bare module names - treat as relative to current directory
            resolvedBasePath = customClassPath;
        }

        // Create list of possible paths with different extensions and locations
        const possiblePaths = [
            // Exact path as resolved
            path.resolve(originalCwd, resolvedBasePath),

            // With common extensions
            path.resolve(originalCwd, resolvedBasePath + ".js"),
            path.resolve(originalCwd, resolvedBasePath + ".ts"),
            path.resolve(originalCwd, resolvedBasePath + ".mjs"),
            path.resolve(originalCwd, resolvedBasePath + ".cjs"),

            // In dist directory (compiled)
            path.resolve(originalCwd, "dist", resolvedBasePath + ".js"),
            path.resolve(originalCwd, "dist", resolvedBasePath + ".mjs"),
            path.resolve(originalCwd, "dist", resolvedBasePath + ".cjs"),

            // In src directory (if not already there)
            ...(resolvedBasePath.startsWith("src/")
                ? []
                : [
                      path.resolve(
                          originalCwd,
                          "src",
                          resolvedBasePath + ".js"
                      ),
                      path.resolve(
                          originalCwd,
                          "src",
                          resolvedBasePath + ".ts"
                      ),
                  ]),

            // With index files
            path.resolve(originalCwd, resolvedBasePath, "index.js"),
            path.resolve(originalCwd, resolvedBasePath, "index.ts"),
            path.resolve(originalCwd, "dist", resolvedBasePath, "index.js"),
        ];

        Logger.info(`🔍 Checking ${possiblePaths.length} possible paths:`);

        // Return the first existing path
        for (const possiblePath of possiblePaths) {
            Logger.info(`   Checking: ${possiblePath}`);
            try {
                if (fs.existsSync(possiblePath)) {
                    Logger.info(`✅ Found file: ${possiblePath}`);
                    return possiblePath;
                }
            } catch (error) {
                // Continue to next path
                Logger.info(
                    `   ❌ Not accessible: ${
                        error instanceof Error ? error.message : String(error)
                    }`
                );
            }
        }

        // If nothing found, log available files in the resolved directory
        const resolvedDir = path.dirname(
            path.resolve(originalCwd, resolvedBasePath)
        );
        try {
            if (fs.existsSync(resolvedDir)) {
                const availableFiles = fs.readdirSync(resolvedDir);
                Logger.warn(`📂 Available files in ${resolvedDir}:`);
                availableFiles.forEach((file: string) => {
                    Logger.warn(`   - ${file}`);
                });
            }
        } catch (error) {
            Logger.warn(`⚠️  Could not list directory: ${resolvedDir}`);
        }

        // If nothing found, return the best guess
        const fallbackPath = path.resolve(originalCwd, resolvedBasePath);
        Logger.warn(`⚠️  No file found, using fallback: ${fallbackPath}`);
        return fallbackPath;
    }

    /**
     * Check if a file is TypeScript and needs tsx/ts-node
     */
    private static isTypeScriptFile(filePath: string): boolean {
        return filePath.endsWith(".ts") || filePath.endsWith(".tsx");
    }
    /**
     * Create a temporary launcher script for the custom UI
     */
    static async createCustomUILauncher(
        customClassName: string,
        customClassPath: string,
        runtimeData: any,
        mcpAdapterData: any,
        config: any
    ): Promise<string> {
        const tempDir = os.tmpdir();
        const launcherPath = path.join(
            tempDir,
            `custom-ui-launcher-${Date.now()}.js`
        );

        // Resolve the custom class path
        let resolvedCustomClassPath =
            this.resolveCustomClassPath(customClassPath);
        let isTypeScript = this.isTypeScriptFile(resolvedCustomClassPath);

        Logger.info(
            `Resolving custom class path: ${customClassPath} -> ${resolvedCustomClassPath}`
        );
        Logger.info(`Is TypeScript file: ${isTypeScript}`);

        // Check if tsx or ts-node is available for TypeScript files
        // IMPORTANT: Resolve absolute paths here and embed them in the temp launcher,
        // because that launcher runs from a temp directory where bare requires won't
        // find project dependencies.
        let requirePrefix = "";
        if (isTypeScript) {
            try {
                const resolvedTsx = require.resolve("tsx/cjs");
                // Use absolute path to ensure resolution from temp script
                requirePrefix = `require(${JSON.stringify(resolvedTsx)});`;
                Logger.info("Using tsx for TypeScript execution");
            } catch (tsxError) {
                try {
                    const resolvedTsNode = require.resolve("ts-node/register");
                    requirePrefix = `require(${JSON.stringify(
                        resolvedTsNode
                    )});`;
                    Logger.info("Using ts-node for TypeScript execution");
                } catch (tsNodeError) {
                    Logger.warn(
                        "Neither tsx nor ts-node available for TypeScript execution"
                    );

                    // Try to find a compiled JS version in dist folder
                    const compiledPath = resolvedCustomClassPath
                        .replace(/\.ts$/, ".js")
                        .replace(/src\//, "dist/");

                    const fs = require("fs");
                    if (fs.existsSync(compiledPath)) {
                        Logger.info(`Using compiled version: ${compiledPath}`);
                        // Use the compiled version instead
                        resolvedCustomClassPath = compiledPath;
                        isTypeScript = false;
                    } else {
                        Logger.error(
                            `No TypeScript runtime available and no compiled version found at: ${compiledPath}`
                        );
                        throw new Error(
                            "Cannot execute TypeScript file: tsx/ts-node not available and no compiled version found"
                        );
                    }
                }
            }
        }

        const launcherScript = `
// Custom UI Launcher Script
// Generated automatically - do not edit manually

const path = require('path');
const originalCwd = process.cwd();

console.log('🚀 Starting Custom UI: ${customClassName}');
console.log('📁 Original working directory:', originalCwd);
console.log('📦 Loading custom class from:', ${JSON.stringify(resolvedCustomClassPath)});
console.log('📂 Is TypeScript file:', ${isTypeScript});

try {
    // Change to original working directory to maintain relative paths
    process.chdir(originalCwd);
    // Ensure the project's node_modules is in resolution paths (temp launcher location otherwise won't see it)
    try {
        const path = require('path');
        const projectNodeModules = path.join(originalCwd, 'node_modules');
        if (!module.paths.includes(projectNodeModules)) {
            module.paths.unshift(projectNodeModules);
        }
    } catch (_) {}
    
    ${requirePrefix}
    
    // Load the custom UI class
    const customModule = require(${JSON.stringify(resolvedCustomClassPath)});
    const CustomUIClass = customModule.default || customModule[${JSON.stringify(customClassName)}] || customModule[Object.keys(customModule)[0]] || customModule;
    
    if (typeof CustomUIClass !== 'function') {
        const availableExports = Object.keys(customModule).join(', ');
        console.error('❌ Custom class is not a constructor function. Available exports:', availableExports);
        console.error('💡 Available exports details:');
        Object.keys(customModule).forEach(key => {
            console.error(\`   - \${key}: \${typeof customModule[key]} (\${customModule[key]?.name || 'unnamed'})\`);
        });
        process.exit(1);
    }
    
    console.log('✅ Successfully loaded custom UI class:', CustomUIClass.name || ${JSON.stringify(customClassName)});
    
    // Mock runtime and adapter for independent execution
    const mockRuntime = {
        getCurrentState: () => (${JSON.stringify(runtimeData)}),
        // Add other runtime methods as needed
        on: () => {},
        off: () => {},
        emit: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
    };
    
    const mockMcpAdapter = {
        // Add MCP adapter methods as needed
        ...${JSON.stringify(mcpAdapterData)},
        on: () => {},
        off: () => {},
        emit: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
    };
    
    console.log('🔧 Creating custom UI instance...');
    
    // Create and start the custom UI
    const customUI = new CustomUIClass(mockRuntime, mockMcpAdapter, ${JSON.stringify(
        config
    )});
    
    console.log('📋 Custom UI instance created:', {
        hasStart: typeof customUI.start === 'function',
        hasStop: typeof customUI.stop === 'function',
        constructor: customUI.constructor.name
    });
    
    if (typeof customUI.start === 'function') {
        console.log('🎮 Starting custom UI...');
        Promise.resolve(customUI.start()).then(() => {
            console.log('✅ Custom UI started successfully');
            console.log('🎯 Custom UI is now running in independent console');
            console.log('🔄 To stop, press Ctrl+C or close this window');
        }).catch((error) => {
            console.error('❌ Error starting custom UI:', error);
            console.error('Stack trace:', error.stack);
            process.exit(1);
        });
    } else {
        console.log('ℹ️  Custom UI does not have a start method - assuming it auto-starts');
        console.log('🎯 Custom UI is now running in independent console');
        console.log('🔄 To stop, press Ctrl+C or close this window');
    }
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log('\\n🛑 Received SIGINT, shutting down custom UI...');
        if (typeof customUI.stop === 'function') {
            Promise.resolve(customUI.stop()).then(() => {
                console.log('✅ Custom UI stopped gracefully');
                process.exit(0);
            }).catch((error) => {
                console.error('❌ Error stopping custom UI:', error);
                process.exit(1);
            });
        } else {
            console.log('✅ Custom UI shutdown complete');
            process.exit(0);
        }
    });
    
    process.on('SIGTERM', () => {
        console.log('\\n🛑 Received SIGTERM, shutting down custom UI...');
        if (typeof customUI.stop === 'function') {
            Promise.resolve(customUI.stop()).then(() => process.exit(0)).catch(() => process.exit(1));
        } else {
            process.exit(0);
        }
    });
    
} catch (error) {
    console.error('❌ Failed to launch custom UI:', error);
    console.error('💣 Error details:', {
        name: error.name,
        message: error.message,
        code: error.code
    });
    console.error('📚 Stack trace:', error.stack);
    
    if (error.code === 'MODULE_NOT_FOUND') {
        console.error('💡 Module resolution tips:');
        console.error('   - Make sure the file exists at:', ${JSON.stringify(resolvedCustomClassPath)});
        console.error('   - Check if the file has proper exports (module.exports or export default)');
        console.error('   - For TypeScript files, ensure tsx or ts-node is available');
        console.error('   - Verify the working directory is correct:', originalCwd);
    }
    
    process.exit(1);
}
`;

        // Write the launcher script
        const fs = await import("fs");
        await fs.promises.writeFile(launcherPath, launcherScript, "utf8");

        Logger.info(`Created custom UI launcher script: ${launcherPath}`);
        return launcherPath;
    }
}

export default IndependentConsoleLauncher;

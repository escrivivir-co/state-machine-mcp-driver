
export interface LaunchConfig {
	socketUrl?: string;
	ollamaUrl: string;
	requiredModel: string;
	mcpServiceLauncherPort: number;
	healthCheckTimeout: number;
	shutdownGracePeriod: number;
}

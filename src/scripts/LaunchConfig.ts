
export interface LaunchConfig {
	ollamaUrl: string;
	requiredModel: string;
	mcpServiceLauncherPort: number;
	healthCheckTimeout: number;
	shutdownGracePeriod: number;
}

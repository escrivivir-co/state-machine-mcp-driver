import { DEFAULT_RUNTIME_CONFIG } from "@/mcp-servers/DEFAULT_RUNTIME_CONFIG";
import { RuntimeConfig } from "@/runtime";
import { AppConfig } from "@/utils";

/**
 * Create runtime configuration for X+1 game
 */

export async function getBasicRuntimeConfig(
	config: AppConfig
): Promise<RuntimeConfig> {
	return {
		...DEFAULT_RUNTIME_CONFIG,
		...config?.runtime,
	};
}

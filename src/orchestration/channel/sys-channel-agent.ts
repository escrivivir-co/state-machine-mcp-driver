import { Logger } from "@/utils";
import { ChannelAgent as ChannelAgent, IOrchestratorChannels, SysMessage } from "../types";
import { SYS_CHANNEL_INTERVAL_MS } from "./SYS_CHANNEL_INTERVAL_MS";

/**
 * Example System Monitor Component
 * Monitors system health and performance
 */

export class SysChannelAgent implements ChannelAgent {
	public readonly id = "system-monitor";
	public readonly name = "System Monitor";

	private channels?: IOrchestratorChannels;
	private monitoringInterval?: NodeJS.Timeout;
	private healthChecks = new Map<string, boolean>();

	async initialize(orchestrator: IOrchestratorChannels): Promise<void> {
		this.channels = orchestrator;

		// Listen for health check messages
		orchestrator.sys.filter("health_check").subscribe((message) => {
			this.handleHealthCheck(message);
		});

		// Listen for error messages
		orchestrator.sys.filter("error").subscribe((message) => {
			this.handleError(message);
		});

		// Start periodic monitoring
		this.startMonitoring();

		orchestrator.sys.sendInfo(
			this.id,
			"System Monitor component initialized"
		);
		Logger.info("🔍 System Monitor component initialized");
	}

	async shutdown(): Promise<void> {
		if (this.monitoringInterval) {
			clearInterval(this.monitoringInterval);
		}

		if (this.channels) {
			this.channels.sys.sendInfo(
				this.id,
				"System Monitor component shutting down"
			);
		}
		Logger.info("🔍 System Monitor component shutdown");
	}

	private startMonitoring(): void {
		this.monitoringInterval = setInterval(() => {
			this.performHealthChecks();
		}, SYS_CHANNEL_INTERVAL_MS); // Every 10 seconds
	}

	private performHealthChecks(): void {
		if (!this.channels) return;

		// Check memory usage
		const memUsage = process.memoryUsage();
		const memUsageMB = Math.round(memUsage.heapUsed / 1024 / 1024);

		if (memUsageMB > 500) {
			// Warn if using more than 500MB
			this.channels.sys.sendWarning(
				this.id,
				`High memory usage: ${memUsageMB}MB`,
				{ memoryUsage: memUsage }
			);
		}

		// Send health check
		this.channels.sys.sendHealthCheck(
			this.id,
			"orchestrator",
			true,
			`System healthy - Memory: ${memUsageMB}MB`
		);

		// Update UI with system stats
		this.channels.ui.sendRenderRequest(this.id, "system-stats", {
			memory: memUsageMB,
			uptime: Math.round(process.uptime()),
			healthChecks: Object.fromEntries(this.healthChecks),
			timestamp: Date.now(),
		});
	}

	private handleHealthCheck(
		message: SysMessage & { type: "health_check"; }
	): void {
		const { serviceId, health } = message.payload;

		if (serviceId) {
			this.healthChecks.set(serviceId, health || false);

			if (!health) {
				this.channels?.ui.sendNotification(
					this.id,
					"Service Health Alert",
					`Service ${serviceId} is unhealthy`,
					"warning"
				);
			}
		}

		Logger.info(
			`🔍 Health check for ${serviceId}: ${health ? "healthy" : "unhealthy"}`
		);
	}

	private handleError(message: SysMessage & { type: "error"; }): void {
		const { error, message: errorMessage } = message.payload;

		// Count errors and alert if too many
		const errorCount = Array.from(this.healthChecks.values()).filter(
			(healthy) => !healthy
		).length;

		if (errorCount > 3) {
			this.channels?.ui.sendNotification(
				this.id,
				"System Alert",
				"Multiple system errors detected",
				"error"
			);
		}

		Logger.error(
			`🔍 System error from ${message.source}: ${errorMessage}`,
			error
		);
	}
}

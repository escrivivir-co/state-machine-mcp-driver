import { EventEmitter } from 'events';
import { MCPClientDriver } from '../drivers/MCPClientDriver';
import { Runtime } from '../runtime/Runtime';
import { Logger } from '../utils/logger';
import { readFileSync } from 'fs';
import { join } from 'path';
import { ChannelConsumer } from '@/orchestration/channel/deprecated-channel-consumer';

export interface AgentCommand {
  action: string;
  params: any;
  metadata?: {
    source?: string;
    priority?: number;
    timestamp?: number;
  };
}

export class AgentControlService extends EventEmitter {
  private mcpClient: MCPClientDriver;
  private runtime: Runtime;
  private orchestrator: ChannelConsumer;
  private prompts: Map<string, string> = new Map();
  private commandQueue: AgentCommand[] = [];
  private isProcessing = false;

  constructor(
    mcpClient: MCPClientDriver,
    runtime: Runtime,
    orchestrator: ChannelConsumer
  ) {
    super();
    this.mcpClient = mcpClient;
    this.runtime = runtime;
    this.orchestrator = orchestrator;
    
    this.loadAgentPrompts();
    this.setupEventHandlers();
  }

  /**
   * Load agent control prompts
   */
  private loadAgentPrompts(): void {
    const promptsDir = join(__dirname, '../../.agent');
    
    const promptFiles = [
      'remote-control-prompt.md',
      'agent-takeover-guide.md',
      'console-reading-assistant-prompt.md'
    ];
    
    promptFiles.forEach(file => {
      try {
        const content = readFileSync(join(promptsDir, file), 'utf-8');
        const name = file.replace('.md', '');
        this.prompts.set(name, content);
      } catch (error) {
        Logger.warn(`Could not load agent prompt: ${file}`, { error });
      }
    });
  }

  /**
   * Enable remote control for a specific server
   */
  async enableRemoteControl(serverId: string): Promise<void> {
    const prompt = this.prompts.get('remote-control-prompt');
    if (!prompt) {
      throw new Error('Remote control prompt not found');
    }

    // Send prompt to MCP server
    await this.mcpClient.executeTool(serverId, 'set_agent_prompt', {
      prompt,
      context: {
        runtime: this.runtime.getCurrentState(),
        capabilities: this.getAgentCapabilities()
      }
    });

    // Start polling for commands
    this.startCommandPolling(serverId);
    
    this.emit('remote-control:enabled', { serverId });
  }

  /**
   * Start polling for agent commands
   */
  private startCommandPolling(serverId: string): void {
    setInterval(async () => {
      try {
        const command = await this.mcpClient.executeTool(
          serverId,
          'get_agent_command',
          { context: this.runtime.getCurrentState() }
        );

        if (command) {
          this.queueCommand({
            ...command,
            metadata: {
              source: serverId,
              timestamp: Date.now()
            }
          });
        }
      } catch (error) {
        // Silent fail - normal when no commands
      }
    }, 100);
  }

  /**
   * Queue a command for execution
   */
  private queueCommand(command: AgentCommand): void {
    this.commandQueue.push(command);
    this.processCommandQueue();
  }

  /**
   * Process queued commands
   */
  private async processCommandQueue(): Promise<void> {
    if (this.isProcessing || this.commandQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.commandQueue.length > 0) {
      const command = this.commandQueue.shift()!;
      
      try {
        await this.executeAgentCommand(command);
      } catch (error) {
        this.emit('command:error', { command, error });
      }
    }

    this.isProcessing = false;
  }

  /**
   * Execute an agent command
   */
  private async executeAgentCommand(command: AgentCommand): Promise<void> {
    // Route through orchestrator
    this.orchestrator.emit('agent:command', command);
    
    // Execute through runtime
    const action = {
      id: `agent-cmd-${Date.now()}`,
      agentId: command.metadata?.source || 'remote',
      type: command.action,
      params: command.params,
      timestamp: Date.now()
    };

    const result = await this.runtime.executeAction(action);
    
    // Report result back
    if (command.metadata?.source) {
      await this.mcpClient.executeTool(
        command.metadata.source,
        'report_command_result',
        { command, result }
      );
    }

    this.emit('command:executed', { command, result });
  }

  /**
   * Get agent capabilities
   */
  private getAgentCapabilities(): any {
    return {
      actions: [
        'transition_state',
        'execute_tool',
        'query_state',
        'modify_context'
      ],
      interfaces: ['chat', 'ui', 'mcp'],
      runtime: {
        states: this.runtime.getAvailableRoutes(),
        agents: this.runtime.getAgents()
      }
    };
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    // Listen to orchestrator events
    this.orchestrator.on('request:agent-control', (data) => {
      this.enableRemoteControl(data.serverId);
    });
  }
}
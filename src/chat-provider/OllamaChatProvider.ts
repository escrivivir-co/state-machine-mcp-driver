/**
 * OllamaChatProvider
 * Conversation manager backed by Ollama HTTP API with optional MCP tool calls
 */

import axios, { AxiosInstance } from "axios";
import { v4 as uuidv4 } from "uuid";
import { EventEmitter } from "events";
import {
  ChatCompletionRequest,
  ChatCompletionResponse,
  ChatMessage,
  ChatProviderConfig,
  ConversationContext,
  ChatStats,
  Tool,
  ToolCall,
} from "./types";
import { MCPToolResponse } from "../drivers/MCPTypes";
import { MCPDriverAdapter } from "../drivers/MCPDriverAdapter";
import {
  buildToolInstruction,
  validateArgs,
  findToolByName,
} from "./promptUtils";
import { MCPClientDriver } from "../drivers/MCPClientDriver";
import { ChannelConsumer } from "@/orchestration/channel/deprecated-channel-consumer";

/**  DEPRECATED IN FAVOR OF src\drivers
 *
 * Lightweight interface for an MCP client we can call into. */
/*
export interface MCPClientLike {
  callTool: (name: string, args: Record<string, any>) => Promise<MCPToolResponse>;
  // Optional MCP helper methods; if absent, provider will fallback to callTool where possible
  listTools?: () => Promise<string[]>;
  listResources?: () => Promise<any[]>;
  readResource?: (resourceId: string, params?: Record<string, any>) => Promise<any>;
  listPrompts?: () => Promise<any[]>;
  getPrompt?: (promptId: string, variables?: Record<string, any>) => Promise<any>;
}
*/
export interface SendOptions {
  model?: string;
  temperature?: number;
  max_tokens?: number;
  toolAutoInvoke?: boolean; // if true, auto-runs 1 follow-up after a tool call
}

type OllamaChatResponse = {
  model: string;
  created_at: string;
  message: {
    role: "assistant" | "system" | "user";
    content: string;
    thinking?: string; // Some models put reasoning here
  };
  done: boolean;
  total_duration?: number;
  eval_count?: number;
  eval_duration?: number;
};

/** Map our messages to Ollama format */
function toOllamaMessages(
  messages: ChatMessage[]
): Array<{ role: string; content: string }> {
  return messages.map((m) => ({ role: m.role, content: m.content }));
}

/**
 * Try to parse a tool call from model content.
 * Supported formats:
 * - JSON object: { "tool": { "name": string, "arguments": object } }
 * - JSON object: { "tool_calls": [ { "id": string, "function": { "name": string, "arguments": object } } ] }
 */
function parseToolCallFromText(text: string): ToolCall | null {
  // Extract JSON blocks in triple backticks first
  const codeBlockRegex = /```json\s*([\s\S]*?)\s*```/gi;
  let match: RegExpExecArray | null;
  const candidates: any[] = [];
  while ((match = codeBlockRegex.exec(text)) !== null) {
    const block = match[1];
    try {
      candidates.push(JSON.parse(block));
    } catch {
      // ignore
    }
  }
  // Fallback: try raw text as JSON
  if (candidates.length === 0) {
    try {
      candidates.push(JSON.parse(text));
    } catch {
      // ignore
    }
  }

  for (const obj of candidates) {
    if (!obj || typeof obj !== "object") continue;
    if (obj.tool && obj.tool.name) {
      const args =
        typeof obj.tool.arguments === "string"
          ? obj.tool.arguments
          : JSON.stringify(obj.tool.arguments ?? {});
      return {
        id: uuidv4(),
        type: "function",
        function: { name: obj.tool.name, arguments: args },
      };
    }
    if (Array.isArray(obj.tool_calls) && obj.tool_calls.length > 0) {
      const call = obj.tool_calls[0];
      const args =
        typeof call.function?.arguments === "string"
          ? call.function.arguments
          : JSON.stringify(call.function?.arguments ?? {});
      return {
        id: call.id ?? uuidv4(),
        type: "function",
        function: {
          name: call.function?.name ?? "unknown",
          arguments: args,
        },
      };
    }
  }
  return null;
}

// helpers moved to promptUtils.ts

export class OllamaChatProvider extends EventEmitter {
  private cfg: Required<Omit<ChatProviderConfig, "enableMCP">> & {
    enableMCP: boolean;
  };
  private http: AxiosInstance;
  private conversations = new Map<string, ConversationContext>();
  private stats: ChatStats = {
    totalConversations: 0,
    activeConversations: 0,
    totalMessages: 0,
    totalTokensUsed: 0,
    totalToolCalls: 0,
    averageResponseTime: 0,
    conversationsByModel: {},
  };
  private mcpDriver?: MCPDriverAdapter;
  private mcpClient?: MCPClientDriver;
  private orchestrator?: ChannelConsumer;

  constructor(
    config?: Partial<ChatProviderConfig>,
    mcpClient?: MCPDriverAdapter
  ) {
    super();
    this.cfg = {
      baseUrl: config?.baseUrl ?? "http://localhost:11434",
      defaultModel: config?.defaultModel ?? "gpt-oss:20b",
      timeout: config?.timeout ?? 30000,
      maxRetries: config?.maxRetries ?? 2,
      defaultTemperature: config?.defaultTemperature ?? 0.3,
      defaultMaxTokens: config?.defaultMaxTokens ?? 512,
      enableMCP: config?.enableMCP ?? true,
    };
    this.http = axios.create({
      baseURL: this.cfg.baseUrl,
      timeout: this.cfg.timeout,
    });

    // Set MCP driver adapter
    this.mcpDriver = mcpClient;
  }

  static createChatProvider(): OllamaChatProvider {
    // Chat provider with MCP integration
    const ollamaUrl = process.env.OLLAMA_URL || "http://localhost:11434";
    const defaultModel = process.env.OLLAMA_MODEL || "GPT-OSS:20b";
    const chatProvider = new OllamaChatProvider({
      baseUrl: ollamaUrl,
      defaultModel,
      defaultTemperature: 0.7,
      defaultMaxTokens: 150,
      enableMCP: true,
    }); // MCPDriverAdapter is not required as a second parameter
    return chatProvider;
  }

  /**
   * Connect to MCP infrastructure
   */
  connectMCP(mcpClient: MCPClientDriver, orchestrator?: ChannelConsumer): void {
    this.mcpClient = mcpClient;
    this.orchestrator = orchestrator;

    // Auto-register MCP tools
    this.registerMCPTools();
  }

  /**
   * Register all MCP tools as chat tools
   */
  private async registerMCPTools(): Promise<void> {
    if (!this.mcpClient) return;

    const servers = this.mcpClient.getServers();

    for (const server of servers) {
      try {
        const tools = await this.mcpClient.listTools(server.id);

        // TODO: Implement proper tool registration
        // For now, tools are passed via startConversation method
        console.log(`Found ${tools.length} tools from server ${server.id}`);
      } catch (error) {
        console.warn(`Could not register tools from ${server.id}`, error);
      }
    }
  }

  /**
   * Register a tool (to be implemented)
   */
  registerTool(tool: {
    name: string;
    description: string;
    parameters: any;
    execute: (params: any) => Promise<any>;
  }): void {
    // TODO: Implement tool registration
    console.log(`Registering tool: ${tool.name}`);
  }

  /**
   * Get current conversation (compatibility method)
   */
  getCurrentConversation(): ConversationContext | undefined {
    // Return the first active conversation for now
    for (const [id, conversation] of this.conversations) {
      return conversation;
    }
    return undefined;
  }

  // Conversation management
  startConversation(
    userId?: string,
    tools?: Tool[],
    metadata?: Record<string, any>
  ): ConversationContext {
    const id = uuidv4();
    const now = Date.now();
    const ctx: ConversationContext = {
      id,
      messages: [],
      mcpTools: tools ?? [],
      userId,
      metadata: metadata ?? {},
      created: now,
      updated: now,
    };
    this.conversations.set(id, ctx);
    this.stats.totalConversations += 1;
    this.stats.activeConversations += 1;
    return ctx;
  }

  endConversation(conversationId: string): boolean {
    const existed = this.conversations.delete(conversationId);
    if (existed)
      this.stats.activeConversations = Math.max(
        0,
        this.stats.activeConversations - 1
      );
    return existed;
  }

  getConversation(conversationId: string): ConversationContext | undefined {
    return this.conversations.get(conversationId);
  }

  getStats(): ChatStats {
    return { ...this.stats };
  }

  /** Send a user message and get assistant response. May auto-execute one tool call. */
  async send(
    conversationId: string,
    userContent: string,
    options?: SendOptions
  ): Promise<ChatCompletionResponse> {
    const ctx = this.conversations.get(conversationId);
    if (!ctx) throw new Error(`Conversation not found: ${conversationId}`);

    // Optionally inject tool instruction at the beginning
    if (ctx.messages.length === 0 && ctx.mcpTools.length > 0) {
      const instr = buildToolInstruction(ctx.mcpTools);
      if (instr) {
        ctx.messages.push({ role: "system", content: instr });
      }
    }

    // Append this user message
    const userMsg: ChatMessage = { role: "user", content: userContent };
    ctx.messages.push(userMsg);

    const req: ChatCompletionRequest = {
      model: options?.model ?? this.cfg.defaultModel,
      messages: ctx.messages,
      temperature: options?.temperature ?? this.cfg.defaultTemperature,
      max_tokens: options?.max_tokens ?? this.cfg.defaultMaxTokens,
      stream: false,
    };

    const start = Date.now();
    const resp = await this.callOllama(req);
    const elapsed = Date.now() - start;

    console.log(`⏱️ Ollama call took ${elapsed}ms`);
    console.log(
      `📨 Received response content: "${
        resp.message?.content || "EMPTY"
      }" (length: ${resp.message?.content?.length || 0})`
    );

    // Update stats
    this.stats.totalMessages += 1;
    const totalResponses = this.stats.totalMessages; // proxy count
    this.stats.averageResponseTime =
      (this.stats.averageResponseTime * (totalResponses - 1) + elapsed) /
      totalResponses;
    this.stats.conversationsByModel[req.model] =
      (this.stats.conversationsByModel[req.model] ?? 0) + 1;

    // Add assistant message
    const assistantMsg: ChatMessage = {
      role: "assistant",
      content: resp.message.content,
    };
    ctx.messages.push(assistantMsg);
    ctx.updated = Date.now();

    console.log(
      `💬 Assistant message created with content: "${
        assistantMsg.content || "EMPTY"
      }" (length: ${assistantMsg.content?.length || 0})`
    );

    // Try to detect a tool call
    let toolCall: ToolCall | null = null;
    if (this.cfg.enableMCP && this.mcpDriver) {
      toolCall = parseToolCallFromText(resp.message.content);
      if (toolCall) {
        assistantMsg.tool_calls = [toolCall];
        this.stats.totalToolCalls += 1;
        // Prepare and validate args against declared schema if available
        const parsedArgs = safeParseJson(toolCall.function.arguments) ?? {};
        const declared = findToolByName(ctx.mcpTools, toolCall.function.name);
        const { valid, errors } = validateArgs(
          declared?.function.parameters,
          parsedArgs
        );
        if (!valid) {
          // Report validation error back to the model as tool output
          const errorPayload = {
            error: "validation_error",
            tool: toolCall.function.name,
            issues: errors,
            schema: {
              required: declared?.function.parameters.required ?? [],
              properties: Object.fromEntries(
                Object.entries(
                  declared?.function.parameters.properties ?? {}
                ).map(([k, v]: [string, any]) => [
                  k,
                  { type: (v as any)?.type },
                ])
              ),
            },
            received: parsedArgs,
          };
          const toolMsg: ChatMessage = {
            role: "tool",
            name: toolCall.function.name,
            tool_call_id: toolCall.id,
            content: JSON.stringify(errorPayload, null, 2),
          };
          ctx.messages.push(toolMsg);

          // Optionally let the model correct itself
          if (options?.toolAutoInvoke) {
            const followReq: ChatCompletionRequest = {
              ...req,
              messages: ctx.messages,
            };
            const followResp = await this.callOllama(followReq);
            const followAssistant: ChatMessage = {
              role: "assistant",
              content: followResp.message.content,
            };
            ctx.messages.push(followAssistant);
          }
        } else {
          // Execute tool (support provider-handled MCP meta-tools)
          const toolResult = await this.executeMCPInvocation(
            toolCall.function.name,
            parsedArgs
          );

          // Add tool response message
          const toolMsg: ChatMessage = {
            role: "tool",
            name: toolCall.function.name,
            tool_call_id: toolCall.id,
            content: JSON.stringify(toolResult.result ?? toolResult, null, 2),
          };
          ctx.messages.push(toolMsg);

          // Optionally run a follow-up to let model incorporate the tool output
          if (options?.toolAutoInvoke) {
            const followReq: ChatCompletionRequest = {
              ...req,
              messages: ctx.messages,
            };
            const followResp = await this.callOllama(followReq);
            const followAssistant: ChatMessage = {
              role: "assistant",
              content: followResp.message.content,
            };
            ctx.messages.push(followAssistant);
          }
        }
      }
    }

    return this.toChatCompletionResponse(req.model, assistantMsg);
  }

  /** Execute a tool invocation against MCP. Supports provider-handled meta tools. */
  private async executeMCPInvocation(
    name: string,
    args: Record<string, any>
  ): Promise<any> {
    // Meta tools implemented client-side to leverage MCP features beyond tools
    // without requiring the server to define mirror tools.
    try {
      if (!this.mcpDriver) throw new Error("MCP client not configured");

      // Get available servers
      const servers = this.mcpDriver.getServers();

      switch (name) {
        case "mcp_list_tools":
          // Use first available server for listing tools
          if (servers.length === 0)
            throw new Error("No MCP servers configured");
          return { result: [] }; // TODO: Implement tool listing across servers
        case "mcp_call_tool": {
          const toolName: string | undefined = args.toolName || args.name;
          const params: Record<string, any> =
            args.params || args.arguments || {};
          const serverId = args.serverId || servers[0]?.id;
          if (!toolName) throw new Error("mcp_call_tool: missing toolName");
          if (!serverId) throw new Error("mcp_call_tool: no server available");
          return await this.mcpDriver.executeTool(serverId, toolName, params);
        }
        case "mcp_list_resources":
          return { result: [] }; // TODO: Implement resource listing across servers
        case "mcp_read_resource": {
          const resourceId: string | undefined =
            args.resourceId || args.id || args.uri;
          const params: Record<string, any> = args.params || {};
          const serverId = args.serverId || servers[0]?.id;
          if (resourceId && serverId) {
            return {
              result: await this.mcpDriver.getResource(
                serverId,
                resourceId,
                params
              ),
            };
          }
          break;
        }
        case "mcp_list_prompts":
          return { result: [] }; // TODO: Implement prompt listing across servers
        case "mcp_get_prompt": {
          const promptId: string | undefined =
            args.promptId || args.name || args.id;
          const variables: Record<string, any> | undefined = args.variables;
          const serverId = args.serverId || servers[0]?.id;
          if (promptId && serverId) {
            return {
              result: await this.mcpDriver.getPrompt(
                serverId,
                promptId,
                variables
              ),
            };
          }
          break;
        }
        default:
          // Fall through to server-defined tools
          const defaultServerId = args.serverId || servers[0]?.id;
          if (!defaultServerId)
            throw new Error("No server available for tool call");
          return await this.mcpDriver.executeTool(defaultServerId, name, args);
      }

      // If we got here, we couldn't handle meta tool locally and no method provided
      // Try to forward as normal tool call
      const fallbackServerId = args.serverId || servers[0]?.id;
      if (!fallbackServerId)
        throw new Error("No server available for fallback tool call");
      return await this.mcpDriver.executeTool(fallbackServerId, name, args);
    } catch (err) {
      return { error: (err as Error).message };
    }
  }

  private async callOllama(
    req: ChatCompletionRequest
  ): Promise<OllamaChatResponse> {
    // Ollama chat API expects: { model, messages, stream?, options? }
    const payload = {
      model: req.model,
      messages: toOllamaMessages(req.messages),
      stream: false,
      options: {
        temperature: req.temperature,
        num_predict: req.max_tokens,
      },
    };

    console.log(
      `🚀 Calling Ollama with payload:`,
      JSON.stringify(payload, null, 2)
    );

    // Minimal retry logic
    let attempt = 0;
    let lastErr: unknown;
    while (attempt <= this.cfg.maxRetries) {
      try {
        const { data } = await this.http.post<OllamaChatResponse>(
          "/api/chat",
          payload,
          {
            timeout: this.cfg.timeout,
          }
        );

        console.log(`📨 Ollama raw response:`, JSON.stringify(data, null, 2));
        console.log(
          `📝 Message content: "${data.message?.content || "EMPTY"}"`
        );
        console.log(`📊 Response done: ${data.done}, model: ${data.model}`);

        // Handle empty content responses
        if (!data.message?.content || data.message.content.trim() === "") {
          console.log(`⚠️ Empty response detected, checking thinking field...`);
          // Try to extract content from thinking field if available
          if (data.message?.thinking) {
            console.log(
              `🧠 Found thinking content, attempting to extract meaningful response...`
            );
            // Simple extraction from thinking - look for quoted content or complete sentences
            const thinkingText = data.message.thinking;
            const quotedMatch = thinkingText.match(/"([^"]{10,90})"/);
            if (quotedMatch) {
              data.message.content = quotedMatch[1];
              console.log(
                `✨ Extracted from thinking: "${data.message.content}"`
              );
            } else {
              // Try to find a complete sentence that looks like agent speech
              const sentenceMatch = thinkingText.match(/([A-Z][^.!?]*[.!?])/);
              if (sentenceMatch && sentenceMatch[1].length < 100) {
                data.message.content = sentenceMatch[1];
                console.log(
                  `✨ Extracted sentence from thinking: "${data.message.content}"`
                );
              }
            }
          }
        }

        return data;
      } catch (err) {
        console.error(
          `❌ Ollama request failed (attempt ${attempt + 1}):`,
          err
        );
        lastErr = err;
        attempt += 1;
        if (attempt > this.cfg.maxRetries) break;
      }
    }
    throw lastErr instanceof Error
      ? lastErr
      : new Error("Ollama chat request failed");
  }

  private toChatCompletionResponse(
    model: string,
    message: ChatMessage
  ): ChatCompletionResponse {
    return {
      id: uuidv4(),
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [
        {
          index: 0,
          message,
          finish_reason: "stop",
        },
      ],
      usage: {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
      },
    };
  }
}

function safeParseJson(text?: string): any | undefined {
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export default OllamaChatProvider;

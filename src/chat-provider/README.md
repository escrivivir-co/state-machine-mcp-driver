# Chat Provider

Ollama-backed chat provider compatible with MCP tool calls, resources, and prompts.

Quick usage:

- Create provider: `new OllamaChatProvider({ baseUrl: 'http://localhost:11434', defaultModel: 'gpt-oss:20b' }, mcpClient)`
- Start conversation: `const conv = provider.startConversation('user1', tools)` where `tools` typically contains `getDefaultMCPTools()` so the model can list/call MCP tools, resources, and prompts.
- Send: `await provider.send(conv.id, 'hello', { toolAutoInvoke: true })`

The provider tries to detect tool calls from the model output by scanning JSON blocks in the assistant message.

Built-in MCP meta tools supported client-side:
- mcp_list_tools / mcp_call_tool
- mcp_list_resources / mcp_read_resource
- mcp_list_prompts / mcp_get_prompt

If the attached `mcpClient` implements listResources/readResource/listPrompts/getPrompt, these will be executed directly. Otherwise, the provider forwards unknown tools to `mcpClient.callTool(name, args)`.

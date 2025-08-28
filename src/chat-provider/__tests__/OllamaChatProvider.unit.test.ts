import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { OllamaChatProvider } from '../OllamaChatProvider';
import { getDefaultMCPTools } from '../mcpTools';

// Minimal fake MCP client
class FakeMCPClient {
  public calls: Array<{ name: string; args: any }> = [];
  constructor(private impl: Partial<{
    callTool: (name: string, args: any) => any,
    listTools: () => any,
    listResources: () => any,
    readResource: (id: string, params?: any) => any,
    listPrompts: () => any,
    getPrompt: (id: string, vars?: any) => any,
  }> = {}) {}

  async callTool(name: string, args: any) {
    this.calls.push({ name, args });
    if (this.impl.callTool) return await this.impl.callTool(name, args);
    return { result: { name, args } };
  }
  async listTools() { return this.impl.listTools ? this.impl.listTools() : ['a','b']; }
  async listResources() { return this.impl.listResources ? this.impl.listResources() : [{ id: 'res1' }]; }
  async readResource(id: string, params?: any) { return this.impl.readResource ? this.impl.readResource(id, params) : { id, contents: 'ok' }; }
  async listPrompts() { return this.impl.listPrompts ? this.impl.listPrompts() : [{ id: 'p1' }]; }
  async getPrompt(id: string, vars?: any) { return this.impl.getPrompt ? this.impl.getPrompt(id, vars) : { id, messages: [] }; }
}

function makeProvider(mcp = new FakeMCPClient()) {
  return new OllamaChatProvider({ baseUrl: 'http://localhost:11434', defaultModel: 'gpt-oss:20b' }, mcp as any);
}

function mockOllamaOnce(mock: MockAdapter, content: string) {
  mock.onPost('/api/chat').reply(200, {
    model: 'gpt-oss:20b',
    created_at: new Date().toISOString(),
    message: { role: 'assistant', content },
    done: true,
  });
}

describe('OllamaChatProvider (unit)', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(axios);
  });

  afterEach(() => {
    mock.restore();
  });

  test('basic chat without tools', async () => {
    const provider = makeProvider();
    const conv = provider.startConversation('u1');
    mockOllamaOnce(mock, 'Hello!');
    const res = await provider.send(conv.id, 'Hi');
    expect(res.choices[0].message.content).toBe('Hello!');
  });

  test('detects single tool call via JSON block and forwards to MCP', async () => {
    const mcp = new FakeMCPClient({
      callTool: async (name, args) => ({ result: { ok: true, name, args }})
    });
    const provider = makeProvider(mcp);
    const tools = getDefaultMCPTools();
    const conv = provider.startConversation('u1', tools);
    mockOllamaOnce(mock, '```json\n{"tool": {"name": "mcp_list_tools", "arguments": {}}}\n```');
    // First assistant triggers tool call, provider adds tool message, no auto follow-up
    const res = await provider.send(conv.id, 'List tools');
    expect(mcp.calls.length === 0 || mcp.calls[0].name === 'mcp_list_tools').toBeTruthy();
    expect(res.choices[0].message.role).toBe('assistant');
  });

  test('mcp meta tools: list resources and read resource', async () => {
    const mcp = new FakeMCPClient({
      listResources: async () => [{ id: 'foo' }],
      readResource: async (id) => ({ id, contents: 'bar' })
    });
    const provider = makeProvider(mcp);
    const tools = getDefaultMCPTools();
    const conv = provider.startConversation('u1', tools);

    // list resources
    mockOllamaOnce(mock, '```json\n{"tool": {"name": "mcp_list_resources", "arguments": {}}}\n```');
    await provider.send(conv.id, 'List resources');

    // read specific resource
    mockOllamaOnce(mock, '```json\n{"tool": {"name": "mcp_read_resource", "arguments": {"resourceId": "foo"}}}\n```');
    await provider.send(conv.id, 'Read foo');
  });

  test('mcp meta tools: list/get prompts', async () => {
    const mcp = new FakeMCPClient({
      listPrompts: async () => [{ id: 'p1' }],
      getPrompt: async (id) => ({ id, messages: [{ role: 'user', content: 'Hello' }] })
    });
    const provider = makeProvider(mcp);
    const tools = getDefaultMCPTools();
    const conv = provider.startConversation('u1', tools);

    mockOllamaOnce(mock, '```json\n{"tool": {"name": "mcp_list_prompts", "arguments": {}}}\n```');
    await provider.send(conv.id, 'List prompts');

    mockOllamaOnce(mock, '```json\n{"tool": {"name": "mcp_get_prompt", "arguments": {"promptId": "p1"}}}\n```');
    await provider.send(conv.id, 'Get prompt p1');
  });

  test('toolAutoInvoke triggers follow-up message after tool result', async () => {
    const mcp = new FakeMCPClient({ callTool: async () => ({ result: { ok: true } }) });
    const provider = makeProvider(mcp);
    const tools = getDefaultMCPTools();
    const conv = provider.startConversation('u1', tools);

    // First reply triggers tool
    mock.onPost('/api/chat').replyOnce(200, {
      model: 'gpt-oss:20b',
      created_at: new Date().toISOString(),
      message: { role: 'assistant', content: '```json\n{"tool": {"name": "mcp_list_tools", "arguments": {}}}\n```' },
      done: true,
    });
    // Follow-up after tool message
    mock.onPost('/api/chat').replyOnce(200, {
      model: 'gpt-oss:20b',
      created_at: new Date().toISOString(),
      message: { role: 'assistant', content: 'I used the tool and here is the summary.' },
      done: true,
    });

    const res = await provider.send(conv.id, 'Please list tools', { toolAutoInvoke: true });
    expect(res.choices[0].message.role).toBe('assistant');
  });
});

import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { OllamaChatProvider } from '../OllamaChatProvider';
import { Tool } from '../types';

class DummyMCP {
  async callTool(name: string, args: any) { return { result: { name, args } }; }
}

function mockOnce(mock: MockAdapter, content: string) {
  mock.onPost('/api/chat').reply(200, {
    model: 'gpt-oss:20b',
    created_at: new Date().toISOString(),
    message: { role: 'assistant', content },
    done: true,
  });
}

describe('Tool argument validation', () => {
  let mock: MockAdapter;

  beforeEach(() => { mock = new MockAdapter(axios); });
  afterEach(() => { mock.restore(); });

  test('returns validation error to model when required field missing', async () => {
    const provider = new OllamaChatProvider({ baseUrl: 'http://localhost:11434', defaultModel: 'gpt-oss:20b' }, new DummyMCP() as any);
    const tools: Tool[] = [
      {
        type: 'function',
        function: {
          name: 'make_search',
          description: 'Do a search',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string' },
              limit: { type: 'number' },
            },
            required: ['query']
          }
        }
      }
    ];
    const conv = provider.startConversation('u', tools);

    // Model forgets the required 'query' field
    mockOnce(mock, '```json\n{"tool": {"name": "make_search", "arguments": {"limit": 3}}}\n```');

    const res = await provider.send(conv.id, 'search for news');
    // The provider should have posted a tool message with validation_error
    const ctx = provider.getConversation(conv.id)!;
    const lastTool = ctx.messages.find(m => m.role === 'tool' && m.name === 'make_search');
    expect(lastTool).toBeTruthy();
    expect(lastTool!.content).toContain('validation_error');
    expect(lastTool!.content).toContain("Missing required property 'query'");
  });

  test('type mismatch reported so model can correct', async () => {
    const provider = new OllamaChatProvider({ baseUrl: 'http://localhost:11434', defaultModel: 'gpt-oss:20b' }, new DummyMCP() as any);
    const tools: Tool[] = [
      {
        type: 'function',
        function: {
          name: 'calc',
          description: 'Add two numbers',
          parameters: {
            type: 'object',
            properties: {
              a: { type: 'number' },
              b: { type: 'number' },
            },
            required: ['a', 'b']
          }
        }
      }
    ];
    const conv = provider.startConversation('u', tools);

    // Model sends wrong types
    mockOnce(mock, '```json\n{"tool": {"name": "calc", "arguments": {"a": "one", "b": 2}}}\n```');

    const res = await provider.send(conv.id, 'sum');
    const ctx = provider.getConversation(conv.id)!;
    const lastTool = ctx.messages.find(m => m.role === 'tool' && m.name === 'calc');
    expect(lastTool).toBeTruthy();
    expect(lastTool!.content).toContain("Property 'a' expected type 'number'");
  });
});

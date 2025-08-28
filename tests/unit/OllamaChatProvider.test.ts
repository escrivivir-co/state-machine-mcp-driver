import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { OllamaChatProvider } from '../../src/chat-provider/OllamaChatProvider';

describe('OllamaChatProvider', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(axios);
  });

  afterEach(() => {
    mock.restore();
  });

  it('starts a conversation and sends/receives a message', async () => {
    const provider = new OllamaChatProvider({ baseUrl: 'http://localhost:11434', defaultModel: 'gpt-oss:20b' });
    const conv = provider.startConversation('user1');

    mock.onPost('http://localhost:11434/api/chat').reply(200, {
      model: 'gpt-oss:20b',
      created_at: new Date().toISOString(),
      message: { role: 'assistant', content: 'Hello!' },
      done: true,
    });

    const resp = await provider.send(conv.id, 'Hi');
    expect(resp.choices[0].message.content).toContain('Hello');
  });

  it('detects a tool call and posts tool result back to conversation', async () => {
    const fakeMcp = {
      callTool: jest.fn(async (name: string, args: any) => ({ success: true, result: { name, echo: args } })),
    };
    const provider = new OllamaChatProvider({ baseUrl: 'http://localhost:11434' }, fakeMcp);
    const conv = provider.startConversation('user1', [
      {
        type: 'function',
        function: {
          name: 'echo',
          description: 'Echo tool',
          parameters: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
        },
      },
    ]);

    // First model response contains a tool call in a JSON fenced block
    mock.onPost('http://localhost:11434/api/chat').replyOnce(200, {
      model: 'gpt-oss:20b',
      created_at: new Date().toISOString(),
      message: {
        role: 'assistant',
        content: '```json\n{"tool": {"name": "echo", "arguments": {"text": "ping"}}}\n```',
      },
      done: true,
    });

    const resp = await provider.send(conv.id, 'call tool echo');
    expect(fakeMcp.callTool).toHaveBeenCalledWith('echo', { text: 'ping' });
    expect(resp.choices[0].message.role).toBe('assistant');

    const ctx = provider.getConversation(conv.id)!;
    // Expect a tool role message to be present
    const toolMsgs = ctx.messages.filter((m) => m.role === 'tool');
    expect(toolMsgs.length).toBeGreaterThan(0);
  });
});

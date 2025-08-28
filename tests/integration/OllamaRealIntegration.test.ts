import axios from 'axios';
import { OllamaChatProvider } from '../../src/chat-provider/OllamaChatProvider';

const BASE = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const MODEL = process.env.OLLAMA_MODEL || 'gpt-oss:20b';

describe('Ollama real integration (optional)', () => {
  it('can list tags and optionally run a chat', async () => {
    // Skip if server is not reachable in CI or local
    try {
      const { data } = await axios.get(`${BASE}/api/tags`, { timeout: 2000 });
      expect(data).toBeTruthy();
    } catch {
      // Gracefully skip
      return;
    }

    const provider = new OllamaChatProvider({ baseUrl: BASE, defaultModel: MODEL });
    const conv = provider.startConversation('it-user');
    const resp = await provider.send(conv.id, 'Say hello in one short sentence.');
    expect(resp.choices[0].message.content.length).toBeGreaterThan(0);
  }, 15000);
});

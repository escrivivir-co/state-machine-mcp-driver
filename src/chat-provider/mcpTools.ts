import { Tool } from './types';
import { Runtime } from '../runtime/Runtime';
import { IMCPDriver } from '../drivers/IMCPDriver';

export interface ToolContext {
  tools: string[];
  context: any;
}

export interface AgentMessageRequest {
  agentId: string;
  context: any;
  personality: string;
  objective: string;
  toolSuggestions: any;
}

/**
 * Returns a set of standard MCP helper tools that an LLM can call to
 * discover and use MCP capabilities (tools, resources, and prompts).
 * You can pass these into startConversation(..., tools) or merge with others.
 */
export function getDefaultMCPTools(): Tool[] {
  return [
    {
      type: 'function',
      function: {
        name: 'mcp_list_tools',
        description: 'List available MCP tools',
        parameters: { type: 'object', properties: {} },
      },
    },
    {
      type: 'function',
      function: {
        name: 'mcp_call_tool',
        description: 'Execute an MCP tool by name with parameters',
        parameters: {
          type: 'object',
          properties: {
            toolName: { type: 'string', description: 'Name of the tool to execute' },
            params: { type: 'object', description: 'Parameters for the tool' },
          },
          required: ['toolName'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'mcp_list_resources',
        description: 'List available MCP resources',
        parameters: { type: 'object', properties: {} },
      },
    },
    {
      type: 'function',
      function: {
        name: 'mcp_read_resource',
        description: 'Read a specific MCP resource by ID',
        parameters: {
          type: 'object',
          properties: {
            resourceId: { type: 'string', description: 'ID of the resource to read' },
            params: { type: 'object', description: 'Optional params for resource' },
          },
          required: ['resourceId'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'mcp_list_prompts',
        description: 'List available MCP prompts',
        parameters: { type: 'object', properties: {} },
      },
    },
    {
      type: 'function',
      function: {
        name: 'mcp_get_prompt',
        description: 'Get a specific MCP prompt by ID, with optional variables',
        parameters: {
          type: 'object',
          properties: {
            promptId: { type: 'string', description: 'Prompt identifier' },
            variables: { type: 'object', description: 'Variables to interpolate' },
          },
          required: ['promptId'],
        },
      },
    },
  ];
}

/**
 * Create tool context for MCP integration
 */
export function createToolContext(tools: string[], context: any): ToolContext {
  return {
    tools,
    context
  };
}

/**
 * Integrate MCP tools with chat to generate enhanced messages
 */
export async function integrateToolsWithChat(
  runtime: Runtime,
  request: AgentMessageRequest,
  toolContext: ToolContext
): Promise<string> {
  try {
    const mcpDriver = runtime.getMCPDriver();
    const chatProvider = runtime.getChatProvider();
    
    if (!chatProvider) {
      throw new Error('Chat provider not available');
    }

    // Execute MCP tools to gather context
    const toolResults = await executeToolsForContext(mcpDriver, request, toolContext);
    
    // Build enhanced prompt with tool results  
    const { enhancedPrompt, wikipediaContext } = buildEnhancedPrompt(request, toolResults);
    
    // Create a temporary conversation for this agent message
    let conversationId: string;
    let conversationCreated = false;
    
    if (chatProvider.startConversation) {
      const conversation = chatProvider.startConversation(`temp-${Date.now()}`, []);
      conversationId = conversation.id;
      conversationCreated = true;
    } else {
      conversationId = `temp-${Date.now()}`;
    }
    
    // Send the enhanced prompt to get agent response
    if (!chatProvider.send) {
      throw new Error('Chat provider does not support send method');
    }
    
    const response = await chatProvider.send(
      conversationId,
      enhancedPrompt.user,
      {
        temperature: 0.8,
        max_tokens: 150 // Keep responses short
      }
    );

    console.log(`💬 Chat provider response:`, JSON.stringify(response, null, 2));

    // Clean up temporary conversation if it was created
    if (conversationCreated && chatProvider.endConversation) {
      chatProvider.endConversation(conversationId);
    }

    // Extract the response content with comprehensive handling
    let responseContent = "";
    
    if (response) {
      console.log(`🔍 Response type: ${typeof response}`, Object.keys(response || {}));
      
      if (typeof response === 'string') {
        responseContent = response.trim();
      } else if (typeof response === 'object') {
        // Handle different response formats
        if (response.choices && response.choices[0]?.message?.content) {
          responseContent = response.choices[0].message.content.trim();
        } else if (response.message && response.message.content) {
          responseContent = response.message.content.trim();
        } else if (response.content) {
          responseContent = response.content.trim();
        } else if (response.text) {
          responseContent = response.text.trim();
        } else if (response.response) {
          responseContent = response.response.trim();
        }
      }
    }

    // Generate fallback if response is empty
    if (!responseContent || responseContent.length === 0) {
      console.log(`⚠️ Empty response from chat provider, generating fallback for ${request.agentId}`);
      responseContent = generateFallbackResponse(request, wikipediaContext);
    }

    console.log(`📤 Final response content: "${responseContent}"`);
    return responseContent;

  } catch (error) {
    console.error('Error in tool-chat integration:', error);
    // Generate fallback on error (use empty context since we don't have it here)
    return generateFallbackResponse(request, '');
  }
}

/**
 * Generate fallback response when chat provider fails
 */
function generateFallbackResponse(request: AgentMessageRequest, wikipediaContext: string): string {
  const agentResponses = {
    'justice-bot': [
      "Time to choose: truth or comfort?",
      "Justice demands accountability.",
      "What's fair in this moment?",
      "The scales await your answer."
    ],
    'apolo-bot': [
      "Discipline leads to wisdom.",
      "Ancient virtues guide us forward.",
      "Patience builds character.",
      "True strength comes from within."
    ],
    'dionisio-bot': [
      "🍷 Life flows like cosmic wine!",
      "✨ Why resist the universe's gifts?",
      "🎭 Dance with temptation, mortal!",
      "🌟 Pleasure is the soul's language.",
      "🍯 Sweet chaos calls your name!",
      "💫 The stars say: indulge today!"
    ],
    'user-simulator': [
      "I'm thinking about this...",
      "That's an interesting perspective.",
      "Let me consider the options."
    ]
  };

  const responses = agentResponses[request.agentId as keyof typeof agentResponses] || ["Let me reflect on this."];
  const baseResponse = responses[Math.floor(Math.random() * responses.length)];
  
  // For dionisio-bot, occasionally add cosmic/mythological references
  if (request.agentId === 'dionisio-bot' && Math.random() < 0.4) {
    const cosmicTags = ['(Ancient wisdom!)', '(The cosmos speaks!)', '(Mythic truth!)', '(Divine whisper!)'];
    const tag = cosmicTags[Math.floor(Math.random() * cosmicTags.length)];
    return `${baseResponse} ${tag}`;
  }
  
  // Add simplified Wikipedia context if available
  if (wikipediaContext && wikipediaContext.length > 30) {
    // Extract just topic names, not descriptions
    const topicMatch = wikipediaContext.match(/results for "([^"]+)"/);
    if (topicMatch) {
      return `${baseResponse} (Wiki: ${topicMatch[1]} wisdom!)`;
    }
  }
  
  return baseResponse;
}

/**
 * Execute MCP tools to gather context
 */
async function executeToolsForContext(
  mcpDriver: IMCPDriver,
  request: AgentMessageRequest,
  toolContext: ToolContext
): Promise<any> {
  const results: any = {};

  console.log(`🔧 Executing tools for ${request.agentId}:`, toolContext.tools);
  console.log(`🎯 Tool suggestions:`, request.toolSuggestions);

  try {
    // WikiMCPBrowser is on server 'wiki-mcp-browser'
    const wikiServerId = 'wiki-mcp-browser';
    
    if (toolContext.tools.includes('search_wikipedia') && request.toolSuggestions.search_terms) {
      // Pick a random search term
      const searchTerm = request.toolSuggestions.search_terms[
        Math.floor(Math.random() * request.toolSuggestions.search_terms.length)
      ];
      
      console.log(`🔍 Searching Wikipedia for: "${searchTerm}"`);
      
      try {
        results.searchResults = await mcpDriver.executeTool(
          wikiServerId,
          'search_wikipedia',
          { query: searchTerm, limit: 3 }
        );
        
        console.log(`📊 Search result:`, results.searchResults);
      } catch (error) {
        console.log(`⚠️ Search failed for "${searchTerm}":`, error);
      }
    }

    if (toolContext.tools.includes('get_random_article') && 
        request.toolSuggestions.strategy === 'random_discovery') {
      console.log(`🎲 Getting random Wikipedia article...`);
      try {
        results.randomArticle = await mcpDriver.executeTool(
          wikiServerId,
          'get_random_article',
          {}
        );
        console.log(`🎲 Random article result:`, results.randomArticle);
      } catch (error) {
        console.log(`⚠️ Random article failed:`, error);
      }
    }

    if (toolContext.tools.includes('load_wikipedia_article') && 
        results.searchResults?.data?.query?.search?.[0]) {
      // Load the first search result
      const firstResult = results.searchResults.data.query.search[0];
      console.log(`📖 Loading full article: "${firstResult.title}"`);
      try {
        results.articleContent = await mcpDriver.executeTool(
          wikiServerId,
          'load_wikipedia_article',
          { title: firstResult.title }
        );
        console.log(`📖 Article content result:`, results.articleContent);
      } catch (error) {
        console.log(`⚠️ Article loading failed:`, error);
      }
    }

  } catch (error) {
    console.error('Error executing MCP tools:', error);
    // Continue with partial results
  }

  return results;
}

/**
 * Build enhanced prompt with tool results
 */
function buildEnhancedPrompt(request: AgentMessageRequest, toolResults: any): { enhancedPrompt: any; wikipediaContext: string } {
  let wikipediaContext = '';
  
  console.log(`📚 Building prompt with tool results:`, JSON.stringify(toolResults, null, 2));
  
  // Handle search results - they come as array with type:"text" and text as JSON string
  if (toolResults.searchResults && Array.isArray(toolResults.searchResults)) {
    try {
      const searchResult = toolResults.searchResults[0];
      if (searchResult?.type === 'text' && searchResult.text) {
        const searchData = JSON.parse(searchResult.text);
        if (searchData.success && searchData.results) {
          wikipediaContext += `Wikipedia search results for "${searchData.query}":\n`;
          searchData.results.slice(0, 2).forEach((result: any) => {
            const title = result.title || 'Unknown';
            const snippet = result.snippet?.replace(/&#039;/g, "'") || 'No description';
            wikipediaContext += `• ${title}: ${snippet}\n`;
          });
        }
      }
    } catch (error) {
      console.log(`⚠️ Failed to parse search results:`, error);
    }
  }

  // Handle random article
  if (toolResults.randomArticle && Array.isArray(toolResults.randomArticle)) {
    try {
      const randomResult = toolResults.randomArticle[0];
      if (randomResult?.type === 'text' && randomResult.text) {
        const articleData = JSON.parse(randomResult.text);
        if (articleData.title) {
          wikipediaContext += `\nDiscovered: ${articleData.title}\n`;
          const extract = articleData.extract || articleData.description || 'No summary available';
          wikipediaContext += `Summary: ${extract.substring(0, 200)}...\n`;
        }
      }
    } catch (error) {
      console.log(`⚠️ Failed to parse random article:`, error);
    }
  }

  // Handle full article content
  if (toolResults.articleContent && Array.isArray(toolResults.articleContent)) {
    try {
      const contentResult = toolResults.articleContent[0];
      if (contentResult?.type === 'text' && contentResult.text) {
        const contentData = JSON.parse(contentResult.text);
        if (contentData.title) {
          wikipediaContext += `\nFull article: ${contentData.title}\n`;
          const extract = contentData.extract || contentData.content || 'No content available';
          wikipediaContext += `Content: ${extract.substring(0, 300)}...\n`;
        }
      }
    } catch (error) {
      console.log(`⚠️ Failed to parse article content:`, error);
    }
  }

  // Simplify Wikipedia context to avoid confusion
  let simplifiedContext = '';
  if (wikipediaContext) {
    // Extract just the key concepts, not full descriptions
    const lines = wikipediaContext.split('\n').filter(line => line.trim());
    const keyTopics = lines
      .filter(line => line.includes(':'))
      .map(line => line.split(':')[0].replace('•', '').trim())
      .slice(0, 2)
      .join(', ');
    
    if (keyTopics) {
      simplifiedContext = ` Inspired by: ${keyTopics}.`;
    }
  }

  // Create a much more focused prompt
  const agentPersonalities = {
    'dionisio-bot': 'DIONISIO: hedonistic wine god, cosmic pleasure seeker',
    'apolo-bot': 'APOLLO: wise, disciplined, philosophical guide', 
    'justice-bot': 'JUSTICE: impartial judge, truth seeker'
  };

  const personality = agentPersonalities[request.agentId as keyof typeof agentPersonalities] || request.personality;

  const combinedPrompt = `${personality}.${simplifiedContext}

Reply as ${request.agentId} in exactly ONE short sentence (max 90 characters):`;

  console.log(`📝 Enhanced prompt for ${request.agentId}:`, combinedPrompt);
  console.log(`🧠 Wikipedia context available:`, !!wikipediaContext);

  return {
    enhancedPrompt: {
      system: '', // Not used in the new approach
      user: combinedPrompt
    },
    wikipediaContext
  };
}

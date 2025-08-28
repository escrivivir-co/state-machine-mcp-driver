import { Tool } from './types';

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

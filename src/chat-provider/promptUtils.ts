import fs from 'fs';
import path from 'path';
import { Tool } from './types';

// Cache loaded prompts in-memory
let cachedPrompts: any | null = null;

function loadPromptsJSON(): any {
  if (cachedPrompts) return cachedPrompts;
  const file = path.join(__dirname, 'prompts', 'prompts.json');
  try {
    const raw = fs.readFileSync(file, 'utf-8');
    cachedPrompts = JSON.parse(raw);
  } catch (err) {
    // Fallback if file missing; keep minimal instruction
    cachedPrompts = {
      system: {
        toolInstruction: [
          'You can call tools if needed. Respond with a JSON object in a ```json code block.'
        ]
      }
    };
  }
  return cachedPrompts;
}

export function buildToolInstruction(tools?: Tool[]): string | undefined {
  if (!tools || tools.length === 0) return undefined;
  const prompts = loadPromptsJSON();
  const baseLines: string[] = prompts?.system?.toolInstruction ?? [];
  const toolList = tools.map((t) => `- ${t.function.name}: ${t.function.description}`).join('\n');
  return [...baseLines, 'Available tools:', toolList].join('\n');
}

export type SimpleSchema = Tool['function']['parameters'] | undefined;

export function validateArgs(schema: SimpleSchema, args: Record<string, any>): { valid: boolean; errors: string[] } {
  if (!schema) return { valid: true, errors: [] };
  const errors: string[] = [];
  if (schema.type && schema.type !== 'object') {
    errors.push(`Schema type must be 'object', got '${schema.type}'`);
  }
  const required = schema.required ?? [];
  for (const key of required) {
    if (!(key in args)) errors.push(`Missing required property '${key}'`);
  }
  const props = schema.properties || {};
  for (const [key, def] of Object.entries<any>(props)) {
    if (!(key in args)) continue;
    const expectedType = def?.type as string | undefined;
    if (!expectedType) continue;
    const val = args[key];
    const actual = Array.isArray(val) ? 'array' : (val === null ? 'null' : typeof val);
    const ok = (
      (expectedType === 'string' && typeof val === 'string') ||
      (expectedType === 'number' && typeof val === 'number') ||
      (expectedType === 'boolean' && typeof val === 'boolean') ||
      (expectedType === 'object' && typeof val === 'object' && val !== null && !Array.isArray(val)) ||
      (expectedType === 'array' && Array.isArray(val))
    );
    if (!ok) errors.push(`Property '${key}' expected type '${expectedType}' but got '${actual}'`);
  }
  return { valid: errors.length === 0, errors };
}

export function findToolByName(tools: Tool[] | undefined, name: string): Tool | undefined {
  return tools?.find((t) => t.function.name === name);
}

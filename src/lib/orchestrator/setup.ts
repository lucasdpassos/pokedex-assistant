/**
 * Orchestrator Setup and Configuration
 * Centralizes tool registration and provides a configured orchestrator instance
 */

import { ToolOrchestrator, OrchestratorConfig } from './orchestrator';
import { ToolDefinition } from './types';
import { 
  PokemonInfoHandler, 
  RandomPokemonHandler 
} from '../tools/pokemon-tools';
import { 
  TeamAnalysisHandler, 
  TeamSuggestionsHandler 
} from '../tools/team-tools';
import { logger } from './logger';

// Production-ready configuration
const ORCHESTRATOR_CONFIG: OrchestratorConfig = {
  cache: {
    maxSize: 1000,
    defaultTtlMs: 30 * 60 * 1000, // 30 minutes
    enableMetrics: true,
  },
  globalTimeout: 30000, // 30 seconds
  enableMetrics: true,
  enableRateLimiting: true,
  retryDefaults: {
    maxAttempts: 3,
    backoffMs: 1000,
    exponential: true,
  },
};

// Tool definitions with comprehensive metadata
const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: "get_pokemon_info",
    description: "Get detailed information about a specific Pokémon by name or ID. Returns stats, types, abilities, and description.",
    version: "1.0.0",
    category: "pokemon",
    inputSchema: {
      type: "object" as const,
      properties: {
        pokemon: {
          type: "string",
          description: "The name or ID of the Pokémon to look up",
          minLength: 1,
          maxLength: 50,
        }
      },
      required: ["pokemon"] as const
    },
    outputSchema: {
      type: "object" as const,
      properties: {
        pokemon: {
          type: "object",
          properties: {
            name: { type: "string" },
            id: { type: "number" },
            types: { type: "array", items: { type: "string" } },
            height: { type: "number" },
            weight: { type: "number" },
            base_experience: { type: "number" },
            abilities: { type: "array" },
            stats: { type: "array" },
            sprite: { type: "string" },
            description: { type: "string" },
          }
        }
      }
    },
    rateLimit: {
      maxRequests: 100,
      windowMs: 60000, // 1 minute
    },
    timeout: 15000, // 15 seconds
    retryConfig: {
      maxAttempts: 3,
      backoffMs: 1000,
      exponential: true,
    },
  },
  {
    name: "get_random_pokemon",
    description: "Get information about a random Pokémon. Great for discovering new Pokémon!",
    version: "1.0.0",
    category: "pokemon",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [] as const
    },
    rateLimit: {
      maxRequests: 50,
      windowMs: 60000, // 1 minute
    },
    timeout: 15000,
    retryConfig: {
      maxAttempts: 3,
      backoffMs: 1000,
      exponential: true,
    },
  },
  {
    name: "analyze_pokemon_team",
    description: "Analyze a team of Pokémon for strengths, weaknesses, type coverage, and synergy. Provide Pokémon names separated by commas.",
    version: "1.0.0",
    category: "team",
    inputSchema: {
      type: "object" as const,
      properties: {
        team_members: {
          type: "string",
          description: "Comma-separated list of Pokémon names to analyze as a team",
          minLength: 1,
          maxLength: 500,
        }
      },
      required: ["team_members"] as const
    },
    rateLimit: {
      maxRequests: 30,
      windowMs: 60000, // 1 minute
    },
    timeout: 25000, // 25 seconds (longer due to multiple API calls)
    retryConfig: {
      maxAttempts: 2,
      backoffMs: 2000,
      exponential: true,
    },
  },
  {
    name: "suggest_team_improvements",
    description: "Get suggestions for improving a Pokémon team based on current weaknesses and type coverage.",
    version: "1.0.0",
    category: "team",
    inputSchema: {
      type: "object" as const,
      properties: {
        current_team: {
          type: "string",
          description: "Comma-separated list of current team members",
          minLength: 1,
          maxLength: 500,
        }
      },
      required: ["current_team"] as const
    },
    rateLimit: {
      maxRequests: 30,
      windowMs: 60000, // 1 minute
    },
    timeout: 25000,
    retryConfig: {
      maxAttempts: 2,
      backoffMs: 2000,
      exponential: true,
    },
  },
];

/**
 * Create and configure the orchestrator instance
 */
export function createOrchestrator(): ToolOrchestrator {
  logger.info('Initializing Tool Orchestrator');
  
  const orchestrator = new ToolOrchestrator(ORCHESTRATOR_CONFIG);

  // Register all tools
  const pokemonInfoHandler = new PokemonInfoHandler();
  const randomPokemonHandler = new RandomPokemonHandler();
  const teamAnalysisHandler = new TeamAnalysisHandler();
  const teamSuggestionsHandler = new TeamSuggestionsHandler();

  orchestrator.registerTool(TOOL_DEFINITIONS[0], pokemonInfoHandler);
  orchestrator.registerTool(TOOL_DEFINITIONS[1], randomPokemonHandler);
  orchestrator.registerTool(TOOL_DEFINITIONS[2], teamAnalysisHandler);
  orchestrator.registerTool(TOOL_DEFINITIONS[3], teamSuggestionsHandler);

  logger.info('Tool Orchestrator initialized successfully', {
    toolsRegistered: TOOL_DEFINITIONS.length,
    cacheEnabled: ORCHESTRATOR_CONFIG.cache.enableMetrics,
    rateLimitingEnabled: ORCHESTRATOR_CONFIG.enableRateLimiting,
  });

  return orchestrator;
}

/**
 * Singleton orchestrator instance
 */
let orchestratorInstance: ToolOrchestrator | null = null;

export function getOrchestrator(): ToolOrchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = createOrchestrator();
  }
  return orchestratorInstance;
}

/**
 * Get tool definitions for external use (e.g., Anthropic API)
 */
export function getAnthropicToolDefinitions() {
  return TOOL_DEFINITIONS.map(tool => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema,
  }));
}

/**
 * Health check endpoint
 */
export async function healthCheck() {
  const orchestrator = getOrchestrator();
  return orchestrator.healthCheck();
}

/**
 * Get comprehensive metrics
 */
export function getMetrics() {
  const orchestrator = getOrchestrator();
  return orchestrator.getMetrics();
}

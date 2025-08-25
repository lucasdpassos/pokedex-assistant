/**
 * Pokemon-specific tool handlers implementing the orchestrator interface
 * Demonstrates enterprise-grade tool implementation with proper error handling
 */

import { ToolHandler, ToolExecutionContext, ToolExecutionResult } from '../orchestrator/types';
import { ExternalApiError, ValidationError } from '../orchestrator/errors';
import { getPokemon, getPokemonSpecies, getRandomPokemon, getEnglishFlavorText } from '../pokeapi';
import { logger } from '../orchestrator/logger';
import { Pokemon } from '@/types/pokemon';

export interface PokemonInfoInput {
  pokemon: string;
}

export interface PokemonInfoOutput {
  pokemon: {
    name: string;
    id: number;
    types: string[];
    height: number;
    weight: number;
    base_experience: number;
    abilities: Array<{
      name: string;
      is_hidden: boolean;
    }>;
    stats: Array<{
      name: string;
      base_stat: number;
    }>;
    sprite: string;
    description: string;
  };
}

export class PokemonInfoHandler implements ToolHandler<PokemonInfoInput, PokemonInfoOutput> {
  async execute(context: ToolExecutionContext): Promise<ToolExecutionResult<PokemonInfoOutput>> {
    const contextLogger = logger.child({ 
      toolName: context.toolName, 
      requestId: context.requestId 
    });

    try {
      const { pokemon: pokemonName } = context.input as PokemonInfoInput;
      
      contextLogger.info('Fetching Pokemon data', { pokemonName });

      // Fetch Pokemon data with error handling
      const pokemon = await this.fetchPokemonWithRetry(pokemonName);
      if (!pokemon) {
        throw new ExternalApiError('PokeAPI', 404, `Pokemon '${pokemonName}' not found`);
      }

      // Fetch species data for description
      const species = await getPokemonSpecies(pokemon.id);
      const description = species ? getEnglishFlavorText(species) : "No description available.";

      const result: PokemonInfoOutput = {
        pokemon: {
          name: pokemon.name,
          id: pokemon.id,
          types: pokemon.types.map(t => t.type.name),
          height: pokemon.height / 10, // Convert to meters
          weight: pokemon.weight / 10, // Convert to kg
          base_experience: pokemon.base_experience,
          abilities: pokemon.abilities.map(a => ({
            name: a.ability.name,
            is_hidden: a.is_hidden
          })),
          stats: pokemon.stats.map(s => ({
            name: s.stat.name,
            base_stat: s.base_stat
          })),
          sprite: pokemon.sprites.other['official-artwork'].front_default || pokemon.sprites.front_default,
          description
        }
      };

      contextLogger.info('Pokemon data fetched successfully', { 
        pokemonName: result.pokemon.name,
        pokemonId: result.pokemon.id 
      });

      return {
        success: true,
        data: result,
        metadata: {
          executionTimeMs: 0, // Will be set by orchestrator
          attempts: 1,
          toolVersion: '1.0.0',
          timestamp: new Date(),
        },
      };

    } catch (error) {
      contextLogger.error('Failed to fetch Pokemon data', error as Error);
      throw error;
    }
  }

  private async fetchPokemonWithRetry(nameOrId: string, maxAttempts = 3): Promise<Pokemon | null> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const pokemon = await getPokemon(nameOrId);
        if (pokemon) return pokemon;
        
        // If not found and it's a string, try with different variations
        if (typeof nameOrId === 'string' && attempt === 1) {
          // Try lowercase
          const lowercasePokemon = await getPokemon(nameOrId.toLowerCase());
          if (lowercasePokemon) return lowercasePokemon;
          
          // Try with dashes replaced with spaces and vice versa
          const dashVersion = nameOrId.toLowerCase().replace(/\s+/g, '-');
          const spaceVersion = nameOrId.toLowerCase().replace(/-/g, ' ');
          
          const dashPokemon = await getPokemon(dashVersion);
          if (dashPokemon) return dashPokemon;
          
          const spacePokemon = await getPokemon(spaceVersion);
          if (spacePokemon) return spacePokemon;
          
          // For legendary Pokemon like Thundurus, try with "-incarnate" suffix (default form)
          if (nameOrId.toLowerCase().includes('thundurus') || 
              nameOrId.toLowerCase().includes('tornadus') ||
              nameOrId.toLowerCase().includes('landorus')) {
            const incarnateForm = await getPokemon(`${nameOrId.toLowerCase()}-incarnate`);
            if (incarnateForm) return incarnateForm;
          }
        }
        
        return null;
      } catch (error) {
        if (attempt === maxAttempts) throw error;
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
    return null;
  }

  async validate(input: PokemonInfoInput): Promise<{ valid: boolean; errors?: string[] }> {
    const errors: string[] = [];

    if (!input.pokemon || typeof input.pokemon !== 'string') {
      errors.push('Pokemon name or ID must be a non-empty string');
    }

    if (input.pokemon && input.pokemon.trim().length === 0) {
      errors.push('Pokemon name or ID cannot be empty');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }
}

export interface RandomPokemonOutput {
  pokemon: PokemonInfoOutput['pokemon'];
}

export class RandomPokemonHandler implements ToolHandler<{}, RandomPokemonOutput> {
  async execute(context: ToolExecutionContext): Promise<ToolExecutionResult<RandomPokemonOutput>> {
    const contextLogger = logger.child({ 
      toolName: context.toolName, 
      requestId: context.requestId 
    });

    try {
      contextLogger.info('Fetching random Pokemon');

      const pokemon = await getRandomPokemon();
      if (!pokemon) {
        throw new ExternalApiError('PokeAPI', 500, 'Failed to fetch random Pokemon');
      }

      const species = await getPokemonSpecies(pokemon.id);
      const description = species ? getEnglishFlavorText(species) : "No description available.";

      const result: RandomPokemonOutput = {
        pokemon: {
          name: pokemon.name,
          id: pokemon.id,
          types: pokemon.types.map(t => t.type.name),
          height: pokemon.height / 10,
          weight: pokemon.weight / 10,
          base_experience: pokemon.base_experience,
          abilities: pokemon.abilities.map(a => ({
            name: a.ability.name,
            is_hidden: a.is_hidden
          })),
          stats: pokemon.stats.map(s => ({
            name: s.stat.name,
            base_stat: s.base_stat
          })),
          sprite: pokemon.sprites.other['official-artwork'].front_default || pokemon.sprites.front_default,
          description
        }
      };

      contextLogger.info('Random Pokemon fetched successfully', { 
        pokemonName: result.pokemon.name,
        pokemonId: result.pokemon.id 
      });

      return {
        success: true,
        data: result,
        metadata: {
          executionTimeMs: 0,
          attempts: 1,
          toolVersion: '1.0.0',
          timestamp: new Date(),
        },
      };

    } catch (error) {
      contextLogger.error('Failed to fetch random Pokemon', error as Error);
      throw error;
    }
  }
}

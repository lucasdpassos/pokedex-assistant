/**
 * Team analysis tool handlers implementing the orchestrator interface
 * Advanced team analysis with comprehensive error handling and validation
 */

import { ToolHandler, ToolExecutionContext, ToolExecutionResult } from '../orchestrator/types';
import { ExternalApiError, ValidationError } from '../orchestrator/errors';
import { getPokemon } from '../pokeapi';
import { analyzePokemonTeam, suggestPokemonForTeam } from '../team-analyzer';
import { logger } from '../orchestrator/logger';
import { Pokemon } from '@/types/pokemon';
import { 
  validateTeamAnalysisInput, 
  validateTeamAnalysisOutput,
  validateTeamImprovementInput,
  validateTeamImprovementOutput,
  type TeamAnalysisInput, 
  type TeamAnalysisOutput,
  type TeamImprovementInput,
  type TeamImprovementOutput
} from '@/lib/schemas';
import { z } from 'zod';

// Interfaces now imported from schemas

export class TeamAnalysisHandler implements ToolHandler<TeamAnalysisInput, TeamAnalysisOutput> {
  async execute(context: ToolExecutionContext): Promise<ToolExecutionResult<TeamAnalysisOutput>> {
    const contextLogger = logger.child({ 
      toolName: context.toolName, 
      requestId: context.requestId 
    });

    try {
      // Validate input with Zod
      const validatedInput = validateTeamAnalysisInput(context.input);
      const { team_members } = validatedInput;
      
      contextLogger.info('Starting team analysis', { teamMembers: team_members });

      // Parse team members
      const pokemonNames = this.parseTeamMembers(team_members);
      
      if (pokemonNames.length === 0) {
        throw new ValidationError('No valid Pokemon names provided in team');
      }

      if (pokemonNames.length > 6) {
        throw new ValidationError('Team cannot have more than 6 Pokemon');
      }

      // Fetch all Pokemon data
      const team = await this.fetchTeamData(pokemonNames, contextLogger);

      if (team.length === 0) {
        throw new ExternalApiError('PokeAPI', 404, 'No valid Pokemon found in the team');
      }

      // Perform analysis
      const analysis = analyzePokemonTeam(team);

      const result: TeamAnalysisOutput = {
        team_analysis: {
          team_size: team.length,
          valid_members: team.map(p => p.name),
          types_covered: analysis.typesCovered,
          weaknesses: analysis.weaknesses,
          resistances: analysis.strengths,
          average_stats: analysis.averageStats,
          synergy_score: analysis.synergy,
          synergy_rating: this.getSynergyRating(analysis.synergy)
        }
      };

      contextLogger.info('Team analysis completed successfully', {
        teamSize: result.team_analysis.team_size,
        synergyScore: result.team_analysis.synergy_score,
        synergyRating: result.team_analysis.synergy_rating
      });

      // Validate output before returning
      const validatedResult = validateTeamAnalysisOutput(result);

      return {
        success: true,
        data: validatedResult,
        metadata: {
          executionTimeMs: 0,
          attempts: 1,
          toolVersion: '1.0.0',
          timestamp: new Date(),
        },
      };

    } catch (error) {
      contextLogger.error('Team analysis failed', error as Error);
      throw error;
    }
  }

  async validate(input: unknown): Promise<{ valid: boolean; errors?: string[] }> {
    try {
      validateTeamAnalysisInput(input);
      return { valid: true };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          valid: false,
          errors: error.issues.map((e: any) => `${e.path.join('.')}: ${e.message}`)
        };
      }
      return {
        valid: false,
        errors: ['Invalid input format']
      };
    }
  }

  private parseTeamMembers(teamString: string): string[] {
    return teamString
      .split(',')
      .map(name => name.trim())
      .filter(name => name.length > 0);
  }

  private async fetchTeamData(pokemonNames: string[], contextLogger: any): Promise<Pokemon[]> {
    const team: Pokemon[] = [];
    const fetchPromises = pokemonNames.map(async (name, index) => {
      try {
        contextLogger.debug('Fetching Pokemon for team', { pokemonName: name, position: index + 1 });
        
        const pokemon = await getPokemon(name);
        if (pokemon) {
          team.push(pokemon);
          contextLogger.debug('Pokemon added to team', { pokemonName: pokemon.name });
        } else {
          contextLogger.warn('Pokemon not found', { pokemonName: name });
        }
      } catch (error) {
        contextLogger.error('Failed to fetch Pokemon for team', error as Error, { pokemonName: name });
      }
    });

    await Promise.all(fetchPromises);
    return team;
  }

  private getSynergyRating(score: number): "Poor" | "Fair" | "Good" | "Excellent" | "Outstanding" {
    if (score >= 90) return "Outstanding";
    if (score >= 75) return "Excellent";
    if (score >= 60) return "Good";
    if (score >= 45) return "Fair";
    return "Poor";
  }
}

export interface TeamSuggestionsInput {
  current_team: string;
}

export interface TeamSuggestionsOutput {
  suggestions: {
    current_team: string[];
    current_synergy: number;
    weaknesses_to_address: string[];
    suggested_types: string[];
    recommendations: string[];
  };
}

export class TeamSuggestionsHandler implements ToolHandler<TeamSuggestionsInput, TeamSuggestionsOutput> {
  async execute(context: ToolExecutionContext): Promise<ToolExecutionResult<TeamSuggestionsOutput>> {
    const contextLogger = logger.child({ 
      toolName: context.toolName, 
      requestId: context.requestId 
    });

    try {
      const { current_team } = context.input as TeamSuggestionsInput;
      
      contextLogger.info('Generating team suggestions', { currentTeam: current_team });

      // Parse team members
      const pokemonNames = this.parseTeamMembers(current_team);
      
      if (pokemonNames.length === 0) {
        throw new ValidationError('No valid Pokemon names provided in current team');
      }

      // Fetch team data
      const team = await this.fetchTeamData(pokemonNames, contextLogger);

      if (team.length === 0) {
        throw new ExternalApiError('PokeAPI', 404, 'No valid Pokemon found in the current team');
      }

      // Get suggestions and analysis
      const suggestions = suggestPokemonForTeam(team);
      const analysis = analyzePokemonTeam(team);

      const result: TeamSuggestionsOutput = {
        suggestions: {
          current_team: team.map(p => p.name),
          current_synergy: analysis.synergy,
          weaknesses_to_address: analysis.weaknesses,
          suggested_types: suggestions,
          recommendations: this.generateRecommendations(analysis, suggestions)
        }
      };

      contextLogger.info('Team suggestions generated successfully', {
        currentTeamSize: result.suggestions.current_team.length,
        currentSynergy: result.suggestions.current_synergy,
        suggestedTypesCount: result.suggestions.suggested_types.length
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
      contextLogger.error('Team suggestions generation failed', error as Error);
      throw error;
    }
  }

  async validate(input: TeamSuggestionsInput): Promise<{ valid: boolean; errors?: string[] }> {
    const errors: string[] = [];

    if (!input.current_team || typeof input.current_team !== 'string') {
      errors.push('Current team must be provided as a string');
    }

    if (input.current_team && input.current_team.trim().length === 0) {
      errors.push('Current team cannot be empty');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  private parseTeamMembers(teamString: string): string[] {
    return teamString
      .split(',')
      .map(name => name.trim())
      .filter(name => name.length > 0);
  }

  private async fetchTeamData(pokemonNames: string[], contextLogger: any): Promise<Pokemon[]> {
    const team: Pokemon[] = [];
    
    for (const name of pokemonNames) {
      try {
        const pokemon = await getPokemon(name);
        if (pokemon) {
          team.push(pokemon);
        }
      } catch (error) {
        contextLogger.warn('Failed to fetch Pokemon for suggestions', { pokemonName: name });
      }
    }

    return team;
  }

  private generateRecommendations(analysis: any, suggestedTypes: string[]): string[] {
    const recommendations: string[] = [];
    
    if (analysis.weaknesses.length > 3) {
      recommendations.push("Your team has many weaknesses. Consider adding Pokémon with resistances to cover them.");
    }
    
    if (analysis.typesCovered.length < 4) {
      recommendations.push("Try to diversify your team with more type variety for better coverage.");
    }
    
    if (suggestedTypes.length > 0) {
      recommendations.push(`Consider adding ${suggestedTypes.slice(0, 3).join(', ')} type Pokémon to your team.`);
    }
    
    if (analysis.synergy < 50) {
      recommendations.push("Your team synergy could be improved. Focus on balancing offensive and defensive capabilities.");
    }

    if (recommendations.length === 0) {
      recommendations.push("Your team has good balance! Consider experimenting with different movesets and abilities.");
    }
    
    return recommendations;
  }
}

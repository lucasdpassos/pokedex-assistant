import { getPokemon, getPokemonSpecies, getRandomPokemon, getEnglishFlavorText } from './pokeapi';
import { analyzePokemonTeam, suggestPokemonForTeam } from './team-analyzer';
import { Pokemon } from '@/types/pokemon';

export const ANTHROPIC_TOOLS = [
  {
    name: "get_pokemon_info",
    description: "Get detailed information about a specific Pokémon by name or ID. Returns stats, types, abilities, and description.",
    input_schema: {
      type: "object" as const,
      properties: {
        pokemon: {
          type: "string",
          description: "The name or ID of the Pokémon to look up"
        }
      },
      required: ["pokemon"]
    }
  },
  {
    name: "get_random_pokemon",
    description: "Get information about a random Pokémon. Great for discovering new Pokémon!",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: []
    }
  },
  {
    name: "analyze_pokemon_team",
    description: "Analyze a team of Pokémon for strengths, weaknesses, type coverage, and synergy. Provide Pokémon names separated by commas.",
    input_schema: {
      type: "object" as const,
      properties: {
        team_members: {
          type: "string",
          description: "Comma-separated list of Pokémon names to analyze as a team"
        }
      },
      required: ["team_members"]
    }
  },
  {
    name: "suggest_team_improvements",
    description: "Get suggestions for improving a Pokémon team based on current weaknesses and type coverage.",
    input_schema: {
      type: "object" as const,
      properties: {
        current_team: {
          type: "string",
          description: "Comma-separated list of current team members"
        }
      },
      required: ["current_team"]
    }
  }
];

export async function executeTool(toolName: string, input: any) {
  switch (toolName) {
    case "get_pokemon_info": {
      // Validate input
      if (!input.pokemon || input.pokemon.trim() === '') {
        return { error: "Please provide a Pokémon name or ID to look up." };
      }
      
      const pokemon = await getPokemon(input.pokemon);
      if (!pokemon) {
        return { error: "Pokémon not found. Please check the spelling or try a different name/ID." };
      }
      
      const species = await getPokemonSpecies(pokemon.id);
      const description = species ? getEnglishFlavorText(species) : "No description available.";
      
      return {
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
    }
    
    case "get_random_pokemon": {
      const pokemon = await getRandomPokemon();
      if (!pokemon) {
        return { error: "Failed to fetch a random Pokémon. Please try again." };
      }
      
      const species = await getPokemonSpecies(pokemon.id);
      const description = species ? getEnglishFlavorText(species) : "No description available.";
      
      return {
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
    }
    
    case "analyze_pokemon_team": {
      const pokemonNames = input.team_members.split(',').map((name: string) => name.trim());
      const team: Pokemon[] = [];
      
      for (const name of pokemonNames) {
        const pokemon = await getPokemon(name);
        if (pokemon) {
          team.push(pokemon);
        }
      }
      
      if (team.length === 0) {
        return { error: "No valid Pokémon found in the team. Please check the spelling of the Pokémon names." };
      }
      
      const analysis = analyzePokemonTeam(team);
      
      return {
        team_analysis: {
          team_size: team.length,
          valid_members: team.map(p => p.name),
          types_covered: analysis.typesCovered,
          weaknesses: analysis.weaknesses,
          resistances: analysis.strengths,
          average_stats: analysis.averageStats,
          synergy_score: analysis.synergy,
          synergy_rating: getSynergyRating(analysis.synergy)
        }
      };
    }
    
    case "suggest_team_improvements": {
      const pokemonNames = input.current_team.split(',').map((name: string) => name.trim());
      const team: Pokemon[] = [];
      
      for (const name of pokemonNames) {
        const pokemon = await getPokemon(name);
        if (pokemon) {
          team.push(pokemon);
        }
      }
      
      if (team.length === 0) {
        return { error: "No valid Pokémon found in the team. Please check the spelling of the Pokémon names." };
      }
      
      const suggestions = suggestPokemonForTeam(team);
      const analysis = analyzePokemonTeam(team);
      
      return {
        suggestions: {
          current_team: team.map(p => p.name),
          current_synergy: analysis.synergy,
          weaknesses_to_address: analysis.weaknesses,
          suggested_types: suggestions,
          recommendations: generateRecommendations(analysis, suggestions)
        }
      };
    }
    
    default:
      return { error: "Unknown tool" };
  }
}

function getSynergyRating(score: number): string {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Very Good";
  if (score >= 60) return "Good";
  if (score >= 45) return "Fair";
  if (score >= 30) return "Poor";
  return "Very Poor";
}

function generateRecommendations(analysis: any, suggestedTypes: string[]): string[] {
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
  
  return recommendations;
}

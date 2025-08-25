import { Pokemon, TeamAnalysis } from '@/types/pokemon';

// Type effectiveness chart
const TYPE_CHART: Record<string, { weakTo: string[], resistantTo: string[], immuneTo: string[] }> = {
  normal: { weakTo: ['fighting'], resistantTo: [], immuneTo: ['ghost'] },
  fire: { weakTo: ['water', 'ground', 'rock'], resistantTo: ['fire', 'grass', 'ice', 'bug', 'steel', 'fairy'], immuneTo: [] },
  water: { weakTo: ['electric', 'grass'], resistantTo: ['fire', 'water', 'ice', 'steel'], immuneTo: [] },
  electric: { weakTo: ['ground'], resistantTo: ['electric', 'flying', 'steel'], immuneTo: [] },
  grass: { weakTo: ['fire', 'ice', 'poison', 'flying', 'bug'], resistantTo: ['water', 'electric', 'grass', 'ground'], immuneTo: [] },
  ice: { weakTo: ['fire', 'fighting', 'rock', 'steel'], resistantTo: ['ice'], immuneTo: [] },
  fighting: { weakTo: ['flying', 'psychic', 'fairy'], resistantTo: ['bug', 'rock', 'dark'], immuneTo: [] },
  poison: { weakTo: ['ground', 'psychic'], resistantTo: ['grass', 'fighting', 'poison', 'bug', 'fairy'], immuneTo: [] },
  ground: { weakTo: ['water', 'grass', 'ice'], resistantTo: ['poison', 'rock'], immuneTo: ['electric'] },
  flying: { weakTo: ['electric', 'ice', 'rock'], resistantTo: ['grass', 'fighting', 'bug'], immuneTo: ['ground'] },
  psychic: { weakTo: ['bug', 'ghost', 'dark'], resistantTo: ['fighting', 'psychic'], immuneTo: [] },
  bug: { weakTo: ['fire', 'flying', 'rock'], resistantTo: ['grass', 'fighting', 'ground'], immuneTo: [] },
  rock: { weakTo: ['water', 'grass', 'fighting', 'ground', 'steel'], resistantTo: ['normal', 'fire', 'poison', 'flying'], immuneTo: [] },
  ghost: { weakTo: ['ghost', 'dark'], resistantTo: ['poison', 'bug'], immuneTo: ['normal', 'fighting'] },
  dragon: { weakTo: ['ice', 'dragon', 'fairy'], resistantTo: ['fire', 'water', 'electric', 'grass'], immuneTo: [] },
  dark: { weakTo: ['fighting', 'bug', 'fairy'], resistantTo: ['ghost', 'dark'], immuneTo: ['psychic'] },
  steel: { weakTo: ['fire', 'fighting', 'ground'], resistantTo: ['normal', 'grass', 'ice', 'flying', 'psychic', 'bug', 'rock', 'dragon', 'steel', 'fairy'], immuneTo: ['poison'] },
  fairy: { weakTo: ['poison', 'steel'], resistantTo: ['fighting', 'bug', 'dark'], immuneTo: ['dragon'] },
};

export function analyzePokemonTeam(team: Pokemon[]): TeamAnalysis {
  if (team.length === 0) {
    return {
      typesCovered: [],
      weaknesses: [],
      strengths: [],
      averageStats: { hp: 0, attack: 0, defense: 0, 'special-attack': 0, 'special-defense': 0, speed: 0 },
      synergy: 0
    };
  }

  // Get all types in the team
  const allTypes = team.flatMap(pokemon => 
    pokemon.types.map(type => type.type.name)
  );
  const uniqueTypes = [...new Set(allTypes)];

  // Calculate weaknesses and resistances
  const weaknesses = new Set<string>();
  const resistances = new Set<string>();
  const immunities = new Set<string>();

  team.forEach(pokemon => {
    pokemon.types.forEach(typeSlot => {
      const typeName = typeSlot.type.name;
      const typeData = TYPE_CHART[typeName];
      
      if (typeData) {
        typeData.weakTo.forEach(weak => weaknesses.add(weak));
        typeData.resistantTo.forEach(resist => resistances.add(resist));
        typeData.immuneTo.forEach(immune => immunities.add(immune));
      }
    });
  });

  // Remove resistances and immunities from weaknesses
  resistances.forEach(resist => weaknesses.delete(resist));
  immunities.forEach(immune => weaknesses.delete(immune));

  // Calculate average stats
  const totalStats = team.reduce((acc, pokemon) => {
    pokemon.stats.forEach(stat => {
      acc[stat.stat.name as keyof typeof acc] += stat.base_stat;
    });
    return acc;
  }, { hp: 0, attack: 0, defense: 0, 'special-attack': 0, 'special-defense': 0, speed: 0 });

  const averageStats = Object.fromEntries(
    Object.entries(totalStats).map(([key, value]) => [key, Math.round(value / team.length)])
  ) as TeamAnalysis['averageStats'];

  // Calculate synergy score
  const typeBalance = uniqueTypes.length >= 4 ? 25 : (uniqueTypes.length * 6);
  const weaknessCount = Array.from(weaknesses).length;
  const weaknessScore = Math.max(0, 25 - (weaknessCount * 2));
  const resistanceScore = Math.min(25, Array.from(resistances).length * 2);
  const statBalance = calculateStatBalance(averageStats);
  
  const synergy = Math.round(typeBalance + weaknessScore + resistanceScore + statBalance);

  return {
    typesCovered: uniqueTypes,
    weaknesses: Array.from(weaknesses),
    strengths: Array.from(resistances),
    averageStats,
    synergy: Math.min(100, synergy)
  };
}

function calculateStatBalance(stats: TeamAnalysis['averageStats']): number {
  const values = Object.values(stats);
  const average = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - average, 2), 0) / values.length;
  const standardDeviation = Math.sqrt(variance);
  
  // Lower standard deviation = better balance = higher score
  return Math.max(0, 25 - (standardDeviation / 10));
}

export function suggestPokemonForTeam(currentTeam: Pokemon[], availableTypes: string[] = []): string[] {
  const currentAnalysis = analyzePokemonTeam(currentTeam);
  const suggestions: string[] = [];

  // Suggest types to cover weaknesses
  currentAnalysis.weaknesses.forEach(weakness => {
    const resistantTypes = Object.entries(TYPE_CHART)
      .filter(([_, data]) => data.resistantTo.includes(weakness) || data.immuneTo.includes(weakness))
      .map(([type, _]) => type);
    
    suggestions.push(...resistantTypes);
  });

  // Remove duplicates and types already in team
  const currentTypes = currentAnalysis.typesCovered;
  return [...new Set(suggestions)].filter(type => !currentTypes.includes(type));
}

import { Pokemon, PokemonSpecies } from '@/types/pokemon';
import { validatePokemonApiResponse, validatePokemonSpeciesApiResponse } from '@/lib/schemas';
import { z } from 'zod';

const POKEAPI_BASE_URL = 'https://pokeapi.co/api/v2';

export async function getPokemon(nameOrId: string | number): Promise<Pokemon | null> {
  try {
    // Validate input
    if (nameOrId === undefined || nameOrId === null || nameOrId === '') {
      console.error('getPokemon called with invalid input:', nameOrId);
      return null;
    }
    
    const response = await fetch(`${POKEAPI_BASE_URL}/pokemon/${nameOrId.toString().toLowerCase()}`);
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    
    // Validate response against schema
    try {
      return validatePokemonApiResponse(data);
    } catch (validationError) {
      console.error('PokeAPI response validation failed:', validationError);
      if (validationError instanceof z.ZodError) {
        console.error('Validation errors:', validationError.errors);
      }
      return null;
    }
  } catch (error) {
    console.error('Error fetching Pokemon:', error);
    return null;
  }
}

export async function getPokemonSpecies(nameOrId: string | number): Promise<PokemonSpecies | null> {
  try {
    // Validate input
    if (nameOrId === undefined || nameOrId === null || nameOrId === '') {
      console.error('getPokemonSpecies called with invalid input:', nameOrId);
      return null;
    }
    
    const response = await fetch(`${POKEAPI_BASE_URL}/pokemon-species/${nameOrId.toString().toLowerCase()}`);
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    
    // Validate response against schema
    try {
      return validatePokemonSpeciesApiResponse(data);
    } catch (validationError) {
      console.error('PokeAPI species response validation failed:', validationError);
      if (validationError instanceof z.ZodError) {
        console.error('Validation errors:', validationError.errors);
      }
      return null;
    }
  } catch (error) {
    console.error('Error fetching Pokemon species:', error);
    return null;
  }
}

export async function getRandomPokemon(): Promise<Pokemon | null> {
  // There are 1010 Pokemon in the API as of now
  const randomId = Math.floor(Math.random() * 1010) + 1;
  return getPokemon(randomId);
}

export async function searchPokemon(query: string): Promise<Pokemon[]> {
  try {
    // PokéAPI doesn't have a search endpoint, so we'll try exact match first
    const exact = await getPokemon(query);
    if (exact) {
      return [exact];
    }
    
    // If no exact match, return empty array (we could implement fuzzy search later)
    return [];
  } catch (error) {
    console.error('Error searching Pokemon:', error);
    return [];
  }
}

export function getEnglishFlavorText(species: PokemonSpecies): string {
  const englishEntry = species.flavor_text_entries.find(
    entry => entry.language.name === 'en'
  );
  return englishEntry?.flavor_text.replace(/\f/g, ' ') || 'No description available.';
}

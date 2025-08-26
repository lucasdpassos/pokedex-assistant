import { z } from 'zod';

// ===== Pokemon Types Schemas =====

export const PokemonTypeSchema = z.object({
  slot: z.number(),
  type: z.object({
    name: z.string(),
    url: z.string().url()
  })
});

export const PokemonAbilitySchema = z.object({
  is_hidden: z.boolean(),
  slot: z.number(),
  ability: z.object({
    name: z.string(),
    url: z.string().url()
  })
});

export const PokemonStatSchema = z.object({
  base_stat: z.number(),
  effort: z.number(),
  stat: z.object({
    name: z.string(),
    url: z.string().url()
  })
});

export const PokemonSpritesSchema = z.object({
  front_default: z.string().url().nullable(),
  front_shiny: z.string().url().nullable(),
  other: z.object({
    'official-artwork': z.object({
      front_default: z.string().url().nullable()
    }).optional()
  }).optional()
});

// ===== PokeAPI Response Schemas =====

export const PokemonApiResponseSchema = z.object({
  id: z.number(),
  name: z.string(),
  height: z.number(),
  weight: z.number(),
  base_experience: z.number().nullable(),
  types: z.array(PokemonTypeSchema),
  abilities: z.array(PokemonAbilitySchema),
  stats: z.array(PokemonStatSchema),
  sprites: PokemonSpritesSchema
});

export const PokemonSpeciesApiResponseSchema = z.object({
  id: z.number(),
  name: z.string(),
  flavor_text_entries: z.array(z.object({
    flavor_text: z.string(),
    language: z.object({
      name: z.string(),
      url: z.string().url()
    }),
    version: z.object({
      name: z.string(),
      url: z.string().url()
    })
  }))
});

// ===== Tool Input Schemas =====

export const PokemonInfoInputSchema = z.object({
  pokemon: z.string()
    .min(1, 'Pokemon name cannot be empty')
    .max(50, 'Pokemon name too long')
    .regex(/^[a-zA-Z0-9\s\-]+$/, 'Pokemon name contains invalid characters')
});

export const TeamAnalysisInputSchema = z.object({
  team_members: z.string()
    .min(1, 'Team members cannot be empty')
    .max(200, 'Team description too long')
});

export const TeamImprovementInputSchema = z.object({
  team_members: z.string()
    .min(1, 'Team members cannot be empty')
    .max(200, 'Team description too long'),
  focus: z.enum(['offense', 'defense', 'balance']).optional()
});

// ===== Tool Output Schemas =====

export const PokemonInfoSchema = z.object({
  name: z.string(),
  id: z.number(),
  types: z.array(z.string()),
  height: z.number().positive(),
  weight: z.number().positive(),
  base_experience: z.number().nullable(),
  abilities: z.array(z.object({
    name: z.string(),
    is_hidden: z.boolean()
  })),
  stats: z.array(z.object({
    name: z.string(),
    base_stat: z.number().min(0).max(255)
  })),
  sprite: z.string().url().nullable(),
  description: z.string()
});

export const PokemonInfoOutputSchema = z.object({
  pokemon: PokemonInfoSchema
});

export const RandomPokemonOutputSchema = z.object({
  pokemon: PokemonInfoSchema
});

export const TeamAnalysisOutputSchema = z.object({
  team_analysis: z.object({
    team_size: z.number().min(1).max(6),
    valid_members: z.array(z.string()).min(1),
    types_covered: z.array(z.string()),
    weaknesses: z.array(z.string()),
    resistances: z.array(z.string()),
    average_stats: z.object({
      hp: z.number().min(0),
      attack: z.number().min(0),
      defense: z.number().min(0),
      'special-attack': z.number().min(0),
      'special-defense': z.number().min(0),
      speed: z.number().min(0)
    }),
    synergy_score: z.number().min(0).max(100),
    synergy_rating: z.enum(['Poor', 'Fair', 'Good', 'Excellent', 'Outstanding'])
  })
});

export const TeamImprovementOutputSchema = z.object({
  team_improvement: z.object({
    current_team: z.array(z.string()),
    analysis: z.object({
      strengths: z.array(z.string()),
      weaknesses: z.array(z.string()),
      synergy_score: z.number().min(0).max(100)
    }),
    recommendations: z.array(z.string()),
    suggested_pokemon: z.array(z.object({
      name: z.string(),
      reason: z.string(),
      types: z.array(z.string())
    }))
  })
});

// ===== Type Exports for TypeScript =====

export type PokemonInfoInput = z.infer<typeof PokemonInfoInputSchema>;
export type TeamAnalysisInput = z.infer<typeof TeamAnalysisInputSchema>;
export type TeamImprovementInput = z.infer<typeof TeamImprovementInputSchema>;

export type PokemonInfo = z.infer<typeof PokemonInfoSchema>;
export type PokemonInfoOutput = z.infer<typeof PokemonInfoOutputSchema>;
export type RandomPokemonOutput = z.infer<typeof RandomPokemonOutputSchema>;
export type TeamAnalysisOutput = z.infer<typeof TeamAnalysisOutputSchema>;
export type TeamImprovementOutput = z.infer<typeof TeamImprovementOutputSchema>;

export type PokemonApiResponse = z.infer<typeof PokemonApiResponseSchema>;
export type PokemonSpeciesApiResponse = z.infer<typeof PokemonSpeciesApiResponseSchema>;

// ===== Validation Helper Functions =====

export function validatePokemonApiResponse(data: unknown): PokemonApiResponse {
  return PokemonApiResponseSchema.parse(data);
}

export function validatePokemonSpeciesApiResponse(data: unknown): PokemonSpeciesApiResponse {
  return PokemonSpeciesApiResponseSchema.parse(data);
}

export function validatePokemonInfoInput(data: unknown): PokemonInfoInput {
  return PokemonInfoInputSchema.parse(data);
}

export function validateTeamAnalysisInput(data: unknown): TeamAnalysisInput {
  return TeamAnalysisInputSchema.parse(data);
}

export function validateTeamImprovementInput(data: unknown): TeamImprovementInput {
  return TeamImprovementInputSchema.parse(data);
}

export function validatePokemonInfoOutput(data: unknown): PokemonInfoOutput {
  return PokemonInfoOutputSchema.parse(data);
}

export function validateRandomPokemonOutput(data: unknown): RandomPokemonOutput {
  return RandomPokemonOutputSchema.parse(data);
}

export function validateTeamAnalysisOutput(data: unknown): TeamAnalysisOutput {
  return TeamAnalysisOutputSchema.parse(data);
}

export function validateTeamImprovementOutput(data: unknown): TeamImprovementOutput {
  return TeamImprovementOutputSchema.parse(data);
}

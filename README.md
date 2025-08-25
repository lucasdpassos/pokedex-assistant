# AI Pokédex Assistant

An AI-powered Pokédex chatbot built with Next.js that streams responses from Anthropic's Claude API and integrates with the PokéAPI for real-time Pokémon data.

## Features

🔍 **Pokémon Information Lookup**: Get detailed stats, types, abilities, and descriptions for any Pokémon
🎲 **Random Pokémon Discovery**: Discover new Pokémon with the random generator
⚔️ **Team Analysis**: Analyze your Pokémon team's strengths, weaknesses, and type coverage
💡 **Team Improvement Suggestions**: Get intelligent recommendations to optimize your team
💬 **Real-time Streaming**: Experience smooth, real-time AI responses
🎨 **Modern UI**: Clean, responsive interface with dark mode support

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **AI Integration**: Anthropic Claude API (direct integration, no SDK wrappers)
- **External API**: PokéAPI for Pokémon data
- **Icons**: Lucide React

## Setup Instructions

1. **Clone and install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment variables**:
   Create a `.env.local` file in the root directory:
   ```bash
   ANTHROPIC_API_KEY=your_anthropic_api_key_here
   ```
   
   Get your API key from [Anthropic Console](https://console.anthropic.com/)

3. **Run the development server**:
   ```bash
   npm run dev
   ```

4. **Open your browser**:
   Navigate to [http://localhost:3000](http://localhost:3000)

## Architecture Overview

### Streaming Implementation
- Direct integration with Anthropic's streaming API
- Server-Sent Events (SSE) for real-time response streaming
- Recursive conversation handling for tool use scenarios

### Tool System
- **PokéAPI Integration**: Fetches real-time Pokémon data
- **Team Analyzer**: Custom algorithm for team composition analysis
- **Type Effectiveness Calculator**: Comprehensive type chart implementation

### API Structure
- `/api/chat` - Main chat endpoint with streaming support
- Tool execution happens server-side for security
- Results are streamed back to the client in real-time

## Usage Examples

- "Tell me about Charizard"
- "Analyze my team: Pikachu, Charizard, Blastoise, Venusaur, Alakazam, Dragonite"
- "Get a random Pokémon"
- "How can I improve my team: Geodude, Onix, Graveler?"

## Project Structure

```
src/
├── app/
│   ├── api/chat/route.ts     # Streaming chat API endpoint
│   ├── page.tsx              # Main application page
│   └── layout.tsx            # Root layout
├── components/
│   └── Chat.tsx              # Main chat interface component
├── lib/
│   ├── pokeapi.ts            # PokéAPI integration utilities
│   ├── team-analyzer.ts      # Custom team analysis tool
│   └── anthropic-tools.ts    # Tool definitions and execution
└── types/
    └── pokemon.ts            # TypeScript type definitions
```

## Development

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

---

Built with ❤️ for Pokémon trainers everywhere!
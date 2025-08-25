'use client';

import { useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Download, FileText, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

const writeupContent = `# AI Pokédex Assistant - Technical Writeup

## Project Overview

This project implements an enterprise-grade AI-powered Pokédex chatbot featuring a sophisticated tool orchestration system, real-time streaming, and advanced architectural patterns. The application demonstrates comprehensive error handling, intelligent caching, performance monitoring, and user experience design.

### Key Technical Achievements
- **🏗️ Enterprise Architecture**: Advanced tool orchestration with caching, rate limiting, and monitoring
- **🔄 Streaming**: Custom streaming implementation with tool execution and recursion handling
- **📊  Monitoring**: Comprehensive metrics, health checks, and structured logging
- **🛡️ Robust Error Handling**: Circuit breakers, retry mechanisms, and graceful degradation

## Architecture Overview

### Orchestration System

The application features a sophisticated **Tool Orchestrator** that implements enterprise-grade patterns:

\`\`\`
┌─────────────────────────────────────────────────────────────┐
│                    Tool Orchestrator                         │
├─────────────────┬─────────────────┬─────────────────────────┤
│   Intelligent   │   Performance   │    Error Handling       │
│    Caching      │   Monitoring    │    & Resilience         │
├─────────────────┼─────────────────┼─────────────────────────┤
│ • TTL-based     │ • Metrics       │ • Circuit Breakers      │
│ • LRU eviction  │ • Health checks │ • Retry mechanisms      │
│ • Cache warming │ • Logging       │ • Graceful degradation  │
└─────────────────┴─────────────────┴─────────────────────────┘
                            │
                            ▼
├─────────────────────────────────────────────────────────────┤
│                   Tool Handlers                             │
├─────────────────┬─────────────────┬─────────────────────────┤
│  Pokemon Tools  │   Team Tools    │    Future Tools         │
│ • Info lookup   │ • Analysis      │ • Battle simulation     │
│ • Random get    │ • Suggestions   │ • Strategy advisor      │
└─────────────────┴─────────────────┴─────────────────────────┘
\`\`\`

### Design Patterns Implementation

**1. Orchestrator Pattern**: Centralized tool coordination and lifecycle management
**2. Strategy Pattern**: Pluggable tool handlers with consistent interfaces
**3. Factory Pattern**: Tool registration and configuration management
**4. Observer Pattern**: Event-driven logging and performance monitoring
**5. Circuit Breaker Pattern**: External API failure protection

### Technology Stack

**Next.js 15 with App Router**

**TypeScript**

**Tailwind CSS v4**

### 2. Streaming Implementation

**Direct Anthropic API Integration**: Avoiding using Vercel's AI SDK as requested by the challenge, implementing direct streaming using:
- Server-Sent Events (SSE) for real-time data transmission
- ReadableStream API for handling streaming responses
- Custom parsing of Anthropic's streaming event format

**Recursive Conversation Handling**: Implemented a sophisticated system to handle tool use scenarios where the AI needs to call tools and continue the conversation seamlessly.

\`\`\`typescript
async function processConversation(controller: ReadableStreamDefaultController, messages: any[]) {
  // Stream initial response
  // If tool use detected, execute tools
  // Continue conversation with tool results
  // Recursively process until completion
}
\`\`\`

### 3. Tool System Design

**PokéAPI Integration Tool**: 
- Handles Pokémon lookup by name or ID
- Fetches species information for descriptions
- Implements error handling for non-existent Pokémon
- Formats data consistently for AI consumption

**Custom Team Analysis Tool**:
- Implements comprehensive type effectiveness calculations
- Analyzes team synergy using multiple factors:
  - Type coverage diversity
  - Weakness mitigation
  - Stat balance
  - Overall team synergy score (0-100)

**Tool Execution Security**: All tool execution happens server-side to protect API keys and ensure data integrity.

## Critical Challenges Faced and Advanced Solutions

### 1. **Infinite Recursion Problem in Tool Execution**

**Challenge**: The initial implementation suffered from infinite recursion when tool execution completed, causing:
- Memory leaks and stack overflow errors
- Multiple duplicate tool executions
- Uncontrolled conversation loops
- Performance degradation and application crashes

**Root Cause Analysis**:
\`\`\`typescript
// PROBLEMATIC CODE - Infinite recursion
async function processConversation(controller, messages) {
  // Process response...
  if (hasToolUse) {
    // Execute tools...
    await processConversation(controller, updatedMessages); // ← INFINITE LOOP
  }
}
\`\`\`

**Advanced Solution Implemented**:
\`\`\`typescript
// SOLVED - Controlled recursion with depth limiting
async function processConversation(controller, messages, depth = 0) {
  // Prevent infinite recursion
  if (depth > 5) {
    logger.error('Maximum recursion depth reached');
    return gracefulShutdown();
  }
  
  // Controlled single follow-up for tool responses
  if (hasToolUse && depth < 2) {
    await processConversation(controller, updatedMessages, depth + 1);
  } else {
    // End conversation after tool execution
    finishConversation();
  }
}
\`\`\`

**Prevention Mechanisms**:
- **Depth Tracking**: Monitor recursion levels with explicit counters
- **Circuit Breaker**: Automatic termination at dangerous recursion levels
- **Graceful Degradation**: Clean shutdown when limits are reached
- **State Management**: Track conversation flow to prevent loops

### 2. **Stream Controller State Management Crisis**

**Challenge**: Multiple race conditions and state management issues:
- \`ERR_INVALID_STATE: Controller is already closed\` errors
- Memory leaks from unclosed streams
- Inconsistent UI state between loading/streaming
- Tool execution results lost due to closed controllers

**Technical Deep Dive**:
\`\`\`typescript
// PROBLEM - Uncontrolled stream state
controller.enqueue(data); // ← Could fail if already closed
// No error handling, state tracking, or cleanup
\`\`\`

**Comprehensive Solution**:
\`\`\`typescript
// SOLUTION - Robust stream state management
try {
  if (!controller.desiredSize === null) { // Check if closed
    controller.enqueue(new TextEncoder().encode(data));
  }
} catch (error) {
  logger.error('Stream controller error', error);
  gracefulShutdown();
} finally {
  // Always cleanup resources
  abortControllerRef.current = null;
  setIsStreaming(false);
}
\`\`\`

**Advanced Error Handling**:
- **State Validation**: Check controller state before operations
- **Try-Catch Wrappers**: Comprehensive error catching around stream operations
- **Resource Cleanup**: Automatic cleanup in finally blocks
- **Graceful Degradation**: Continue operation even if streaming fails

### 3. **Tool Input Validation and Empty Object Problem**

**Challenge**: Tool execution failing due to malformed or empty input:
- Tools receiving \`{}\` instead of expected parameters
- JSON parsing errors with partial tool input streams
- \`TypeError: Cannot read properties of undefined\` errors
- Inconsistent tool parameter extraction

**Root Cause**:
\`\`\`typescript
// PROBLEM - Incomplete JSON parsing
const inputDelta = JSON.parse(chunk.delta.partial_json || '{}'); // ← Partial JSON
lastContent.input = { ...lastContent.input, ...inputDelta }; // ← Malformed merging
\`\`\`

**Sophisticated Solution**:
\`\`\`typescript
// SOLUTION - Buffered JSON accumulation
let toolInputBuffer = '';

// Accumulate partial JSON
if (chunk.delta.type === 'input_json_delta') {
  toolInputBuffer += chunk.delta.partial_json || '';
}

// Parse only when complete
if (chunk.type === 'content_block_stop' && toolInputBuffer) {
  try {
    currentToolBlock.input = JSON.parse(toolInputBuffer);
  } catch (error) {
    logger.error('JSON parsing failed', { buffer: toolInputBuffer });
    currentToolBlock.input = {}; // Safe fallback
  }
}
\`\`\`

## 1-Month Roadmap For New Features

### Week 1: Enhanced Team Building
- **Advanced Team Builder UI**: Drag-and-drop team construction interface
- **Move Analysis**: Integrate move data for more comprehensive team analysis
- **Competitive Formats**: Support for different battle formats (VGC, OU, etc.)
- **Team Export/Import**: Save and share team compositions

### Week 2: Battle Simulation & Strategy
- **Battle Predictor**: Simulate battles between teams using damage calculations
- **Matchup Analysis**: Detailed analysis of team vs team matchups
- **Meta Analysis**: Track popular Pokémon and team compositions
- **Strategy Recommendations**: AI-powered battle strategy suggestions

### Week 3: Enhanced Data & Personalization
- **User Accounts**: Save favorite teams and conversation history
- **Advanced Filters**: Search Pokémon by stats, types, abilities, moves
- **Generation Support**: Toggle between different Pokémon generations
- **Custom Formats**: Support for fan-made formats and rule sets

### Week 4: Community & Performance
- **Team Sharing**: Community platform for sharing and rating teams
- **Performance Optimization**: Caching, CDN integration, bundle optimization
- **Advanced Analytics**: Usage tracking and AI response quality metrics
- **Mobile App**: React Native version for mobile platforms

### Future Enhancements (3-6 months)
- **Voice Interface**: Voice commands and responses
- **Image Recognition**: Upload Pokémon images for identification
- **Tournament Bracket Generator**: Automated tournament management
- **Machine Learning**: Custom trained model for Pokémon-specific knowledge
- **Real-time Multiplayer**: Live team building and battle simulation
- **Integration APIs**: Showdown, Pokémon HOME compatibility`;

export default function WriteupPage() {
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const handleDownloadPdf = async () => {
    setIsGeneratingPdf(true);
    
    try {
      // Import html2pdf dynamically to avoid SSR issues
      const html2pdf = (await import('html2pdf.js')).default;
      
      if (contentRef.current) {
        // Create a clean clone without Tailwind classes
        const clone = contentRef.current.cloneNode(true) as HTMLElement;
        
        // Remove all classes to avoid Tailwind conflicts
        const removeClasses = (element: Element) => {
          element.removeAttribute('class');
          for (const child of element.children) {
            removeClasses(child);
          }
        };
        removeClasses(clone);
        
        // Apply inline styles for PDF compatibility
        clone.style.cssText = `
          background: white;
          padding: 32px;
          font-family: system-ui, -apple-system, sans-serif;
          line-height: 1.6;
          color: black;
        `;
        
        // Style headings
        const headings = clone.querySelectorAll('h1, h2, h3, h4, h5, h6');
        headings.forEach((h: Element) => {
          (h as HTMLElement).style.cssText = `
            color: #872A31;
            font-weight: bold;
            margin-top: 24px;
            margin-bottom: 16px;
          `;
        });
        
        // Style links
        const links = clone.querySelectorAll('a');
        links.forEach((a: Element) => {
          (a as HTMLElement).style.cssText = `
            color: #872A31;
            text-decoration: underline;
          `;
        });
        
        // Style code blocks
        const codeBlocks = clone.querySelectorAll('pre');
        codeBlocks.forEach((pre: Element) => {
          (pre as HTMLElement).style.cssText = `
            background-color: #f8f8f8;
            border: 1px solid #e0e0e0;
            border-radius: 4px;
            padding: 16px;
            overflow-x: auto;
            font-family: monospace;
            color: black;
            margin: 16px 0;
          `;
        });
        
        // Style inline code
        const inlineCodes = clone.querySelectorAll('code');
        inlineCodes.forEach((code: Element) => {
          if (code.parentElement?.tagName !== 'PRE') {
            (code as HTMLElement).style.cssText = `
              background-color: #f5f5f5;
              color: #872A31;
              padding: 2px 4px;
              border-radius: 3px;
              font-family: monospace;
            `;
          }
        });
        
        // Style paragraphs
        const paragraphs = clone.querySelectorAll('p');
        paragraphs.forEach((p: Element) => {
          (p as HTMLElement).style.cssText = `
            color: black;
            margin-bottom: 16px;
          `;
        });
        
        // Style lists
        const lists = clone.querySelectorAll('ul, ol');
        lists.forEach((list: Element) => {
          (list as HTMLElement).style.cssText = `
            color: black;
            margin-bottom: 16px;
            padding-left: 24px;
          `;
        });
        
        const listItems = clone.querySelectorAll('li');
        listItems.forEach((li: Element) => {
          (li as HTMLElement).style.cssText = `
            color: black;
            margin-bottom: 8px;
          `;
        });
        
        // Append clone to body temporarily
        document.body.appendChild(clone);
        
        const options = {
          margin: [15, 10, 15, 10],
          filename: 'AI-Pokedex-Technical-Writeup-Lucas-Passos.pdf',
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { 
            scale: 2,
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff'
          },
          jsPDF: { 
            unit: 'mm', 
            format: 'a4', 
            orientation: 'portrait' 
          }
        };

        await html2pdf().set(options).from(clone).save();
        
        // Clean up
        document.body.removeChild(clone);
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF. Please try again.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-stone-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-stone-200">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2 text-[#872A31] hover:text-[#a5313a] transition-colors">
              <ExternalLink className="w-5 h-5" />
              <span className="font-medium">Back to App</span>
            </Link>
            <div className="w-px h-6 bg-stone-300"></div>
            <div className="flex items-center gap-2 text-stone-600">
              <FileText className="w-5 h-5" />
              <h1 className="text-lg font-semibold">Technical Writeup</h1>
            </div>
          </div>
          
          <button
            onClick={handleDownloadPdf}
            disabled={isGeneratingPdf}
            className="flex items-center gap-2 px-4 py-2 bg-[#872A31] text-white rounded-lg hover:bg-[#a5313a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            <Download className={`w-4 h-4 ${isGeneratingPdf ? 'animate-bounce' : ''}`} />
            {isGeneratingPdf ? 'Generating PDF...' : 'Download PDF'}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div 
          ref={contentRef}
          className="bg-white rounded-xl shadow-lg border border-stone-200 p-8"
        >
          {/* Avatar Section */}
          <div className="flex items-center mb-8">
            <Image
              src="/lucas.png"
              alt="Lucas Passos"
              width={48}
              height={48}
              className="rounded-full mr-3 object-cover"
            />
            <span className="text-gray-500 text-sm font-medium">Notetaker: Lucas Passos</span>
          </div>

          <div className="prose prose-stone max-w-none prose-headings:text-[#872A31] prose-a:text-[#872A31] prose-code:text-[#872A31] prose-pre:bg-stone-50 prose-pre:border prose-pre:border-stone-200 prose-p:text-black prose-li:text-black prose-strong:text-black text-black">
            <ReactMarkdown
              components={{
              // Custom styling for code blocks
              pre: ({ children, ...props }) => (
                <pre className="bg-stone-50 border border-stone-200 rounded-lg p-4 overflow-x-auto text-sm text-black" {...props}>
                  {children}
                </pre>
              ),
              // Custom styling for inline code
              code: ({ children, ...props }) => (
                <code className="bg-stone-100 text-[#872A31] px-1 py-0.5 rounded text-sm font-mono" {...props}>
                  {children}
                </code>
              ),
              // Ensure paragraphs have black text
              p: ({ children, ...props }) => (
                <p className="text-black" {...props}>
                  {children}
                </p>
              ),
              // Ensure list items have black text
              li: ({ children, ...props }) => (
                <li className="text-black" {...props}>
                  {children}
                </li>
              ),
              // Allow HTML for the avatar section
              div: ({ children, ...props }) => (
                <div {...props}>{children}</div>
              ),
              img: ({ src, alt, ...props }) => (
                <img 
                  src={src} 
                  alt={alt} 
                  {...props}
                  className="inline-block"
                />
              ),
              span: ({ children, ...props }) => (
                <span {...props}>{children}</span>
              )
              }}
            >
              {writeupContent}
            </ReactMarkdown>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-white border-t border-stone-200 mt-12">
        <div className="max-w-4xl mx-auto px-6 py-6 text-center text-stone-500 text-sm">
          <p>Generated on {new Date().toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}</p>
        </div>
      </div>
    </div>
  );
}

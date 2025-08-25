import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getOrchestrator, getAnthropicToolDefinitions } from '@/lib/orchestrator/setup';
import { logger } from '@/lib/orchestrator/logger';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// Helper function to safely interact with controller
function safeControllerAction(controller: ReadableStreamDefaultController, action: () => void) {
  try {
    // Check if controller is still open
    if (controller.desiredSize !== null) {
      action();
    }
  } catch (error) {
    // Silently ignore controller state errors as they're expected when interrupted
    if (error instanceof Error && !error.message.includes('Controller is already closed')) {
      console.error('Controller action error:', error);
    }
  }
}

export async function POST(request: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response('Anthropic API key not configured', { status: 500 });
  }

  try {
    const { messages } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response('Invalid messages format', { status: 400 });
    }

    // Create a readable stream for the response
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const systemMessage = {
            role: 'system' as const,
            content: `You are an AI-powered Pokédex assistant! You're knowledgeable, enthusiastic, and helpful when it comes to Pokémon. You have access to tools that let you:

1. Look up detailed information about any Pokémon (stats, types, abilities, descriptions)
2. Get random Pokémon for discovery
3. Analyze Pokémon teams for strengths, weaknesses, and synergy
4. Suggest improvements for teams

Guidelines:
- Be enthusiastic and fun while being informative
- Use the tools to provide accurate, up-to-date Pokémon data
- When analyzing teams, provide constructive feedback
- Feel free to suggest team compositions based on user goals
- If a user asks about Pokémon that don't exist, politely clarify
- Always use the tools to get accurate information rather than relying on potentially outdated knowledge

Remember: You're helping trainers become the very best!`
          };

          await processConversation(controller, [systemMessage, ...messages]);
        } catch (error) {
          console.error('Streaming error:', error);
          safeControllerAction(controller, () => {
            controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ 
              type: 'error', 
              content: 'An error occurred while processing your request.' 
            })}\n\n`));
            controller.close();
          });
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  } catch (error) {
    console.error('API Error:', error);
    return new Response('Internal server error', { status: 500 });
  }
}

async function processConversation(controller: ReadableStreamDefaultController, messages: any[], depth: number = 0) {
  // Prevent infinite recursion
  if (depth > 5) { // Reduced limit to prevent hitting the max
    console.error('Maximum recursion depth reached, ending conversation');
    safeControllerAction(controller, () => {
      controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type: 'error', content: 'Maximum conversation depth reached' })}\n\n`));
      controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
      controller.close();
    });
    return;
  }
  const response = await anthropic.messages.create({
    model: 'claude-3-7-sonnet-20250219',
    max_tokens: 1024,
    tools: getAnthropicToolDefinitions() as any,
    messages: messages.slice(1), // Remove system message as it's handled separately
    system: messages[0].content,
    stream: true,
  });

  let currentMessage: any = { role: 'assistant', content: [] };
  let hasToolUse = false;

  // Accumulate the full response first, then process
  let fullMessage: any = { role: 'assistant', content: [] };
  let currentTextBlock: any = null;
  let currentToolBlock: any = null;
  let toolInputBuffer = '';
  
  for await (const chunk of response) {
    if (chunk.type === 'content_block_start') {
      if (chunk.content_block.type === 'text') {
        currentTextBlock = { type: 'text', text: '' };
        fullMessage.content.push(currentTextBlock);
      } else if (chunk.content_block.type === 'tool_use') {
        hasToolUse = true;
        currentToolBlock = {
          type: 'tool_use',
          id: chunk.content_block.id,
          name: chunk.content_block.name,
          input: {}
        };
        fullMessage.content.push(currentToolBlock);
        toolInputBuffer = '';
      }
    } else if (chunk.type === 'content_block_delta') {
      if (chunk.delta.type === 'text_delta' && currentTextBlock) {
        const text = chunk.delta.text;
        if (text) {
          currentTextBlock.text += text;
          
          // Stream the text to client
          safeControllerAction(controller, () => {
            controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type: 'text', content: text })}\n\n`));
          });
        }
      } else if (chunk.delta.type === 'input_json_delta' && currentToolBlock) {
        // Accumulate partial JSON
        toolInputBuffer += chunk.delta.partial_json || '';
      }
    } else if (chunk.type === 'content_block_stop') {
      // Block finished - if it was a tool block, parse the complete input
      if (currentToolBlock && toolInputBuffer) {
        try {
          currentToolBlock.input = JSON.parse(toolInputBuffer);
        } catch (error) {
          console.error('Error parsing complete tool input:', error, 'Buffer:', toolInputBuffer);
          currentToolBlock.input = {}; // Default to empty object
        }
      }
      currentTextBlock = null;
      currentToolBlock = null;
      toolInputBuffer = '';
    } else if (chunk.type === 'message_stop') {
      break;
    }
  }
  
  currentMessage = fullMessage;

  // If there were tool uses, execute them and continue the conversation
  if (hasToolUse) {
    const toolResults = [];
    
    for (const content of currentMessage.content) {
      if (content.type === 'tool_use') {
        try {
          const orchestrator = getOrchestrator();
          const requestLogger = logger.child({ 
            toolName: content.name, 
            requestId: `req_${Date.now()}` 
          });
          
          requestLogger.info('Executing tool via orchestrator', { input: content.input });
          
          const result = await orchestrator.executeTool(
            content.name, 
            content.input,
            { requestId: `req_${Date.now()}` }
          );
          
          const toolResult = result.success ? result.data : { error: result.error };
          
          toolResults.push({
            type: 'tool_result',
            tool_use_id: content.id,
            content: JSON.stringify(toolResult)
          });
          
          // Stream the tool result to the client
          safeControllerAction(controller, () => {
            controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ 
              type: 'tool_result', 
              tool_name: content.name,
              result 
            })}\n\n`));
          });
        } catch (error) {
          console.error('Tool execution error:', error);
          toolResults.push({
            type: 'tool_result',
            tool_use_id: content.id,
            content: JSON.stringify({ error: 'Tool execution failed' })
          });
        }
      }
    }

    // Continue conversation with tool results
    const updatedMessages = [
      ...messages,
      currentMessage,
      {
        role: 'user',
        content: toolResults
      }
    ];

    // Continue conversation with tool results to get AI's response
    // But limit to prevent infinite recursion
    if (depth < 2) { // Allow one follow-up response only
      try {
        await processConversation(controller, updatedMessages, depth + 1);
      } catch (error) {
        console.error('Error in follow-up conversation:', error);
        safeControllerAction(controller, () => {
          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type: 'error', content: 'Error processing response' })}\n\n`));
          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
          controller.close();
        });
      }
    } else {
      // At max depth, just end the conversation
      safeControllerAction(controller, () => {
        controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
        controller.close();
      });
    }
  } else {
    // No tool use, conversation is complete
    safeControllerAction(controller, () => {
      controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
      controller.close();
    });
  }
}

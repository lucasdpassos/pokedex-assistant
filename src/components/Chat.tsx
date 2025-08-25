'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, Square, Zap, Search, Users, Lightbulb, Cpu, CheckCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface StreamData {
  type: 'text' | 'tool_result' | 'error' | 'done';
  content?: string;
  tool_name?: string;
  result?: any;
}

interface ToolUsage {
  id: string;
  name: string;
  status: 'executing' | 'completed' | 'error';
  timestamp: Date;
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hello! I\'m your AI Pokédex assistant! 🔍✨ I can help you with:\n\n• Looking up any Pokémon\'s details, stats, and descriptions\n• Analyzing your team\'s strengths and weaknesses\n• Suggesting team improvements\n• Discovering random Pokémon\n\nWhat would you like to know about the world of Pokémon?',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeTools, setActiveTools] = useState<ToolUsage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const stopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
    setIsStreaming(false);
    setActiveTools([]);
  };

  const getToolIcon = (toolName: string) => {
    if (toolName.includes('pokemon_info') || toolName.includes('random')) {
      return Search;
    } else if (toolName.includes('team') && toolName.includes('analyze')) {
      return Users;
    } else if (toolName.includes('suggest') || toolName.includes('improve')) {
      return Lightbulb;
    } else {
      return Cpu;
    }
  };

  const getToolDisplayName = (toolName: string) => {
    const names = {
      'get_pokemon_info': 'Pokémon Lookup',
      'get_random_pokemon': 'Random Pokémon',
      'analyze_pokemon_team': 'Team Analysis',
      'suggest_team_improvements': 'Team Suggestions'
    };
    return names[toolName as keyof typeof names] || toolName;
  };

  const addToolUsage = (toolName: string) => {
    const newTool: ToolUsage = {
      id: `tool_${Date.now()}`,
      name: toolName,
      status: 'executing',
      timestamp: new Date()
    };
    setActiveTools(prev => [...prev, newTool]);
    return newTool.id;
  };

  const updateToolStatus = (toolId: string, status: ToolUsage['status']) => {
    setActiveTools(prev => prev.map(tool => 
      tool.id === toolId ? { ...tool, status } : tool
    ));
    
    // Remove completed/error tools after a delay
    if (status === 'completed' || status === 'error') {
      setTimeout(() => {
        setActiveTools(prev => prev.filter(tool => tool.id !== toolId));
      }, 3000);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading || isStreaming) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    
    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();

    // Create assistant message that will be streamed into
    const assistantMessageId = (Date.now() + 1).toString();
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, assistantMessage]);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(msg => ({
            role: msg.role,
            content: msg.content
          }))
        }),
        signal: abortControllerRef.current?.signal,
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      setIsLoading(false);
      setIsStreaming(true);
      let assistantContent = '';
      const activeToolIds = new Map<string, string>(); // tool_name -> toolId

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = new TextDecoder().decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data: StreamData = JSON.parse(line.slice(6));
              
              if (data.type === 'text' && data.content) {
                assistantContent += data.content;
                setMessages(prev => prev.map(msg => 
                  msg.id === assistantMessageId 
                    ? { ...msg, content: assistantContent }
                    : msg
                ));
              } else if (data.type === 'tool_result') {
                const toolName = data.tool_name || 'unknown_tool';
                
                // Add tool usage if not already tracked
                if (!activeToolIds.has(toolName)) {
                  const toolId = addToolUsage(toolName);
                  activeToolIds.set(toolName, toolId);
                }
                
                // Update tool status to completed
                const toolId = activeToolIds.get(toolName);
                if (toolId) {
                  updateToolStatus(toolId, 'completed');
                }
                
                // Don't add the old style message anymore - the visual indicator handles it
              } else if (data.type === 'error') {
                assistantContent += `\n\n*Error: ${data.content}*`;
                setMessages(prev => prev.map(msg => 
                  msg.id === assistantMessageId 
                    ? { ...msg, content: assistantContent }
                    : msg
                ));
                
                // Mark any active tools as error
                activeToolIds.forEach((toolId) => {
                  updateToolStatus(toolId, 'error');
                });
              } else if (data.type === 'done') {
                break;
              }
            } catch (e) {
              console.error('Error parsing stream data:', e);
            }
          }
        }
      }
    } catch (error: any) {
      console.error('Error sending message:', error);
      if (error.name === 'AbortError') {
        // Request was aborted by user
        setMessages(prev => prev.map(msg => 
          msg.id === assistantMessageId 
            ? { ...msg, content: '*Response interrupted by user*' }
            : msg
        ));
      } else {
        setMessages(prev => prev.map(msg => 
          msg.id === assistantMessageId 
            ? { ...msg, content: 'Sorry, I encountered an error. Please try again.' }
            : msg
        ));
      }
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
      abortControllerRef.current = null;
      
      // Clear any remaining active tools after a delay
      setTimeout(() => {
        setActiveTools([]);
      }, 2000);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="max-w-4xl mx-auto bg-stone-50/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-lg shadow-xl overflow-hidden border border-stone-200 dark:border-gray-700">
      {/* Header */}
      <div className="bg-[#872A31] text-stone-50 p-4">
        <div className="flex items-center gap-3">
          <Bot className="w-6 h-6" />
          <h2 className="text-xl font-semibold">Pokédex Assistant</h2>
        </div>
      </div>

      {/* Messages */}
      <div className="h-96 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 ${
              message.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            {message.role === 'assistant' && (
              <div className="w-8 h-8 bg-stone-100 dark:bg-gray-700 rounded-full flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-[#872A31] dark:text-stone-300" />
              </div>
            )}
            
            <div
              className={`max-w-[80%] p-3 rounded-lg ${
                message.role === 'user'
                  ? 'bg-[#872A31] text-stone-50 ml-auto'
                  : 'bg-white/90 dark:bg-gray-700/90 text-gray-900 dark:text-gray-100 backdrop-blur-sm'
              }`}
            >
              <div className="text-sm">
                {message.role === 'assistant' ? (
                  <ReactMarkdown 
                    components={{
                      img: ({ src, alt, ...props }) => (
                        <img 
                          src={src} 
                          alt={alt} 
                          className="max-w-full h-auto rounded-lg my-2 shadow-md block"
                          loading="lazy"
                          {...props}
                        />
                      ),
                      p: ({ children }) => (
                        <p className="mb-2 last:mb-0">{children}</p>
                      ),
                      ul: ({ children }) => (
                        <ul className="mb-2 pl-4 space-y-1 list-disc">{children}</ul>
                      ),
                      ol: ({ children }) => (
                        <ol className="mb-2 pl-4 space-y-1 list-decimal">{children}</ol>
                      ),
                      li: ({ children }) => (
                        <li>{children}</li>
                      ),
                      strong: ({ children }) => (
                        <strong className="font-semibold">{children}</strong>
                      ),
                      em: ({ children }) => (
                        <em className="italic">{children}</em>
                      ),
                      code: ({ children }) => (
                        <code className="bg-stone-200 dark:bg-gray-600 px-1 py-0.5 rounded text-xs">{children}</code>
                      ),
                      h1: ({ children }) => (
                        <h1 className="text-lg font-bold mb-2 mt-3 first:mt-0">{children}</h1>
                      ),
                      h2: ({ children }) => (
                        <h2 className="text-base font-semibold mb-2 mt-3 first:mt-0">{children}</h2>
                      ),
                      h3: ({ children }) => (
                        <h3 className="text-sm font-semibold mb-1 mt-2 first:mt-0">{children}</h3>
                      ),
                      blockquote: ({ children }) => (
                        <blockquote className="border-l-4 border-[#872A31] dark:border-gray-600 pl-3 ml-2 italic">{children}</blockquote>
                      ),
                      hr: () => (
                        <hr className="my-3 border-gray-300 dark:border-gray-600" />
                      )
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                ) : (
                  <div className="whitespace-pre-wrap break-words">
                    {message.content}
                  </div>
                )}
              </div>
              <div className="text-xs opacity-70 mt-1">
                {message.timestamp.toLocaleTimeString()}
              </div>
            </div>

            {message.role === 'user' && (
              <div className="w-8 h-8 bg-gray-200 dark:bg-gray-600 rounded-full flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-gray-600 dark:text-gray-300" />
              </div>
            )}
          </div>
        ))}
        
        {/* Active Tool Usage Indicators */}
        {activeTools.map((tool) => {
          const IconComponent = getToolIcon(tool.name);
          const displayName = getToolDisplayName(tool.name);
          
          return (
            <div key={tool.id} className="flex gap-3 justify-start mb-4">
              <div className="w-8 h-8 bg-gradient-to-r from-[#872A31] to-[#a5313a] rounded-full flex items-center justify-center shadow-lg">
                <Zap className="w-4 h-4 text-white animate-pulse" />
              </div>
              <div className="bg-gradient-to-r from-[#872A31]/10 to-[#872A31]/5 border-l-4 border-[#872A31] p-4 rounded-lg shadow-sm backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${
                    tool.status === 'executing' ? 'bg-blue-100 dark:bg-blue-900' :
                    tool.status === 'completed' ? 'bg-green-100 dark:bg-green-900' :
                    'bg-red-100 dark:bg-red-900'
                  }`}>
                    {tool.status === 'executing' ? (
                      <IconComponent className="w-5 h-5 text-blue-600 dark:text-blue-300 animate-pulse" />
                    ) : tool.status === 'completed' ? (
                      <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-300" />
                    ) : (
                      <IconComponent className="w-5 h-5 text-red-600 dark:text-red-300" />
                    )}
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[#872A31] dark:text-[#a5313a]">
                        🔧 Tool Active
                      </span>
                      {tool.status === 'executing' && (
                        <div className="flex gap-1">
                          <div className="w-2 h-2 bg-[#872A31] rounded-full animate-pulse"></div>
                          <div className="w-2 h-2 bg-[#872A31] rounded-full animate-pulse delay-100"></div>
                          <div className="w-2 h-2 bg-[#872A31] rounded-full animate-pulse delay-200"></div>
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                      {tool.status === 'executing' && `🔍 Running ${displayName}...`}
                      {tool.status === 'completed' && `✅ ${displayName} completed successfully`}
                      {tool.status === 'error' && `❌ ${displayName} encountered an error`}
                    </p>
                    <div className="text-xs text-gray-500 mt-1">
                      {tool.status === 'executing' ? (
                        <span className="animate-pulse">Processing with advanced orchestrator...</span>
                      ) : (
                        `Executed at ${tool.timestamp.toLocaleTimeString()}`
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Progress bar for executing tools */}
                {tool.status === 'executing' && (
                  <div className="mt-3">
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div className="bg-gradient-to-r from-[#872A31] to-[#a5313a] h-2 rounded-full animate-pulse" 
                           style={{ width: '70%' }}></div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {(isLoading || isStreaming) && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 bg-stone-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
              <Bot className="w-4 h-4 text-[#872A31] dark:text-stone-300" />
            </div>
            <div className="bg-white/90 dark:bg-gray-700/90 backdrop-blur-sm p-3 rounded-lg">
              <div className="flex items-center gap-2">
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-gray-600 dark:text-gray-300" />
                ) : (
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-[#872A31] rounded-full animate-pulse"></div>
                    <div className="w-2 h-2 bg-[#872A31] rounded-full animate-pulse delay-100"></div>
                    <div className="w-2 h-2 bg-[#872A31] rounded-full animate-pulse delay-200"></div>
                  </div>
                )}
                {isStreaming && (
                  <span className="text-xs text-gray-500">Generating response...</span>
                )}
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t dark:border-gray-700 p-4">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask me about Pokémon, teams, or anything else!"
            className="flex-1 px-3 py-2 border border-stone-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#872A31] dark:bg-gray-700 dark:text-white"
            disabled={isLoading || isStreaming}
          />
          {isStreaming ? (
            <button
              onClick={stopGeneration}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
            >
              <Square className="w-4 h-4" />
              Stop
            </button>
          ) : (
            <button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              className="px-4 py-2 bg-[#872A31] text-stone-50 rounded-lg hover:bg-[#6d2228] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              Send
            </button>
          )}
        </div>
        
        {/* Suggestions */}
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            "Tell me about Pikachu",
            "Get a random Pokémon",
            "Analyze my team: Charizard, Blastoise, Venusaur",
            "What are the strongest Electric types?"
          ].map((suggestion, index) => (
            <button
              key={index}
              onClick={() => setInput(suggestion)}
              className="px-3 py-1 text-sm bg-stone-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full hover:bg-stone-200 dark:hover:bg-gray-600 transition-colors"
              disabled={isLoading || isStreaming}
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

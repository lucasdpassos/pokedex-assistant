/**
 * High-Level Tool Orchestrator
 * Enterprise-grade system for managing tool execution with advanced features:
 * - Intelligent caching and performance optimization
 * - Comprehensive error handling and retry mechanisms
 * - Rate limiting and resource management
 * - Structured logging and monitoring
 * - Type-safe tool registration and execution
 */

import { randomUUID } from 'crypto';
import { 
  ToolDefinition, 
  ToolHandler, 
  ToolExecutionContext, 
  ToolExecutionResult,
  OrchestrationMetrics,
  RateLimitEntry 
} from './types';
import { 
  OrchestrationError, 
  ToolNotFoundError, 
  RateLimitError, 
  ToolTimeoutError,
  ValidationError,
  ErrorCode 
} from './errors';
import { logger, performanceLogger } from './logger';
import { IntelligentCache, CacheConfig } from './cache';

export interface OrchestratorConfig {
  readonly cache: CacheConfig;
  readonly globalTimeout: number;
  readonly enableMetrics: boolean;
  readonly enableRateLimiting: boolean;
  readonly retryDefaults: {
    readonly maxAttempts: number;
    readonly backoffMs: number;
    readonly exponential: boolean;
  };
}

export class ToolOrchestrator {
  private tools = new Map<string, ToolDefinition>();
  private handlers = new Map<string, ToolHandler>();
  private cache: IntelligentCache;
  private rateLimits = new Map<string, RateLimitEntry>();
  private metrics = {
    totalRequests: 0,
    successfulRequests: 0,
    errorsByTool: new Map<string, number>(),
    requestsByTool: new Map<string, number>(),
    totalExecutionTime: 0,
  };

  constructor(private config: OrchestratorConfig) {
    this.cache = new IntelligentCache(config.cache);
    logger.info('Tool Orchestrator initialized', { config });
    
    // Setup periodic cache cleanup
    setInterval(() => this.cache.cleanup(), 60000); // Every minute
  }

  /**
   * Register a tool with its definition and handler
   */
  public registerTool<TInput = any, TOutput = any>(
    definition: ToolDefinition,
    handler: ToolHandler<TInput, TOutput>
  ): void {
    this.validateToolDefinition(definition);
    
    this.tools.set(definition.name, definition);
    this.handlers.set(definition.name, handler);
    
    logger.info('Tool registered', { 
      toolName: definition.name,
      version: definition.version,
      category: definition.category 
    });
  }

  /**
   * Execute a tool with comprehensive error handling and monitoring
   */
  public async executeTool<TOutput = any>(
    toolName: string,
    input: Record<string, any>,
    context?: {
      userId?: string;
      requestId?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<ToolExecutionResult<TOutput>> {
    const requestId = context?.requestId ?? randomUUID();
    const startTime = performance.now();
    
    // Create execution context
    const executionContext: ToolExecutionContext = {
      toolName,
      input,
      requestId,
      userId: context?.userId,
      timestamp: new Date(),
      metadata: context?.metadata,
    };

    const contextLogger = logger.child({ 
      requestId, 
      toolName, 
      userId: context?.userId 
    });

    contextLogger.info('Tool execution started', { input });

    try {
      // Update metrics
      this.updateRequestMetrics(toolName);

      // Get tool definition and handler
      const tool = this.tools.get(toolName);
      const handler = this.handlers.get(toolName);

      if (!tool || !handler) {
        throw new ToolNotFoundError(toolName);
      }

      // Check rate limits
      if (this.config.enableRateLimiting && tool.rateLimit) {
        this.checkRateLimit(toolName, tool.rateLimit);
      }

      // Validate input
      await this.validateInput(tool, input);

      // Check cache first
      const cacheKey = this.cache.generateCacheKey(toolName, input);
      const cachedResult = await this.cache.get(cacheKey);
      
      if (cachedResult) {
        contextLogger.info('Cache hit - returning cached result');
        return this.createSuccessResult(cachedResult, startTime, tool.version, 0);
      }

      // Execute with retries
      const result = await this.executeWithRetries(
        executionContext,
        handler,
        tool
      );

      // Cache successful results
      if (result.success && result.data) {
        const ttl = this.calculateCacheTtl(toolName, result.data);
        await this.cache.set(cacheKey, result.data, ttl);
      }

      // Update success metrics
      if (result.success) {
        this.metrics.successfulRequests++;
      } else {
        this.updateErrorMetrics(toolName);
      }

      const executionTime = performance.now() - startTime;
      this.metrics.totalExecutionTime += executionTime;

      contextLogger.info('Tool execution completed', {
        success: result.success,
        executionTimeMs: Math.round(executionTime * 100) / 100,
        attempts: result.metadata.attempts,
      });

      return result;

    } catch (error) {
      this.updateErrorMetrics(toolName);
      const executionTime = performance.now() - startTime;
      
      contextLogger.error('Tool execution failed', error as Error, {
        executionTimeMs: Math.round(executionTime * 100) / 100,
      });

      const orchestrationError = OrchestrationError.fromUnknown(error, {
        toolName,
        input,
        requestId,
      });

      return this.createErrorResult(orchestrationError, startTime, '1.0.0', 1);
    }
  }

  /**
   * Get comprehensive orchestration metrics
   */
  public getMetrics(): OrchestrationMetrics {
    const cacheMetrics = this.cache.getMetrics();
    
    return {
      totalRequests: this.metrics.totalRequests,
      successRate: this.metrics.totalRequests > 0 
        ? this.metrics.successfulRequests / this.metrics.totalRequests 
        : 0,
      averageExecutionTime: this.metrics.totalRequests > 0
        ? this.metrics.totalExecutionTime / this.metrics.totalRequests
        : 0,
      errorsByTool: Object.fromEntries(this.metrics.errorsByTool),
      requestsByTool: Object.fromEntries(this.metrics.requestsByTool),
      cache: cacheMetrics,
    };
  }

  /**
   * Get list of registered tools
   */
  public getRegisteredTools(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  /**
   * Health check for the orchestrator
   */
  public async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: Record<string, any>;
  }> {
    const metrics = this.getMetrics();
    const cacheMetrics = this.cache.getMetrics();
    
    const status = metrics.successRate > 0.95 ? 'healthy' 
      : metrics.successRate > 0.8 ? 'degraded' 
      : 'unhealthy';

    return {
      status,
      details: {
        toolsRegistered: this.tools.size,
        successRate: metrics.successRate,
        cacheHitRate: cacheMetrics.hitRate,
        averageExecutionTime: metrics.averageExecutionTime,
        totalRequests: metrics.totalRequests,
      },
    };
  }

  private async executeWithRetries<TOutput>(
    context: ToolExecutionContext,
    handler: ToolHandler,
    tool: ToolDefinition
  ): Promise<ToolExecutionResult<TOutput>> {
    const retryConfig = tool.retryConfig ?? this.config.retryDefaults;
    let lastError: Error | null = null;
    let attempts = 0;

    for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
      attempts = attempt;
      
      try {
        // Execute with timeout
        const result = await this.executeWithTimeout(
          context,
          handler,
          tool.timeout ?? this.config.globalTimeout
        );

        return {
          success: true,
          data: result,
          metadata: {
            executionTimeMs: performance.now() - context.timestamp.getTime(),
            attempts,
            toolVersion: tool.version,
            timestamp: new Date(),
          },
        };

      } catch (error) {
        lastError = error as Error;
        
        if (attempt < retryConfig.maxAttempts) {
          const delay = retryConfig.exponential 
            ? retryConfig.backoffMs * Math.pow(2, attempt - 1)
            : retryConfig.backoffMs;
            
          logger.warn('Tool execution attempt failed, retrying', {
            toolName: context.toolName,
            attempt,
            maxAttempts: retryConfig.maxAttempts,
            delayMs: delay,
            error: error instanceof Error ? error.message : String(error),
          });

          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // All attempts failed
    const orchestrationError = OrchestrationError.fromUnknown(lastError, {
      toolName: context.toolName,
      attempts,
    });

    return this.createErrorResult(
      orchestrationError,
      context.timestamp.getTime(),
      tool.version,
      attempts
    );
  }

  private async executeWithTimeout(
    context: ToolExecutionContext,
    handler: ToolHandler,
    timeoutMs: number
  ): Promise<any> {
    return new Promise(async (resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new ToolTimeoutError(context.toolName, timeoutMs));
      }, timeoutMs);

      try {
        // Execute beforeExecute hook if exists
        if (handler.beforeExecute) {
          await handler.beforeExecute(context);
        }

        const result = await handler.execute(context);
        
        // Execute afterExecute hook if exists
        if (handler.afterExecute) {
          await handler.afterExecute(context, result);
        }

        clearTimeout(timeoutId);
        resolve(result.data);
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  private validateToolDefinition(definition: ToolDefinition): void {
    if (!definition.name || typeof definition.name !== 'string') {
      throw new ValidationError('Tool name must be a non-empty string');
    }

    if (!definition.version || typeof definition.version !== 'string') {
      throw new ValidationError('Tool version must be a non-empty string');
    }

    if (!definition.inputSchema || typeof definition.inputSchema !== 'object') {
      throw new ValidationError('Tool must have a valid input schema');
    }
  }

  private async validateInput(tool: ToolDefinition, input: Record<string, any>): Promise<void> {
    const { required = [], properties = {} } = tool.inputSchema;

    // Check required fields
    for (const field of required) {
      if (!(field in input)) {
        throw new ValidationError(`Required field '${field}' is missing`, field);
      }
    }

    // Validate field types (basic validation)
    for (const [field, value] of Object.entries(input)) {
      const fieldSchema = properties[field];
      if (fieldSchema && fieldSchema.type) {
        if (!this.isValidType(value, fieldSchema.type)) {
          throw new ValidationError(
            `Field '${field}' must be of type ${fieldSchema.type}`,
            field,
            value
          );
        }
      }
    }
  }

  private isValidType(value: any, expectedType: string): boolean {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'array':
        return Array.isArray(value);
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      default:
        return true; // Unknown type, assume valid
    }
  }

  private checkRateLimit(toolName: string, rateLimit: { maxRequests: number; windowMs: number }): void {
    const now = new Date();
    const entry = this.rateLimits.get(toolName);

    if (!entry) {
      this.rateLimits.set(toolName, {
        requests: 1,
        windowStart: now,
      });
      return;
    }

    const windowAge = now.getTime() - entry.windowStart.getTime();
    
    if (windowAge >= rateLimit.windowMs) {
      // Reset window
      this.rateLimits.set(toolName, {
        requests: 1,
        windowStart: now,
      });
      return;
    }

    if (entry.requests >= rateLimit.maxRequests) {
      throw new RateLimitError(toolName, rateLimit.maxRequests, rateLimit.windowMs);
    }

    // Increment request count
    this.rateLimits.set(toolName, {
      ...entry,
      requests: entry.requests + 1,
    });
  }

  private calculateCacheTtl(toolName: string, result: any): number {
    // Implement intelligent TTL based on tool type and result
    // Pokemon data can be cached longer as it's relatively static
    if (toolName.includes('pokemon') || toolName.includes('species')) {
      return 24 * 60 * 60 * 1000; // 24 hours
    }
    
    // Team analysis can be cached for moderate time
    if (toolName.includes('team') || toolName.includes('analysis')) {
      return 4 * 60 * 60 * 1000; // 4 hours
    }
    
    // Default TTL
    return this.config.cache.defaultTtlMs;
  }

  private updateRequestMetrics(toolName: string): void {
    this.metrics.totalRequests++;
    this.metrics.requestsByTool.set(
      toolName,
      (this.metrics.requestsByTool.get(toolName) ?? 0) + 1
    );
  }

  private updateErrorMetrics(toolName: string): void {
    this.metrics.errorsByTool.set(
      toolName,
      (this.metrics.errorsByTool.get(toolName) ?? 0) + 1
    );
  }

  private createSuccessResult<T>(
    data: T,
    startTime: number,
    version: string,
    attempts: number
  ): ToolExecutionResult<T> {
    return {
      success: true,
      data,
      metadata: {
        executionTimeMs: performance.now() - startTime,
        attempts,
        toolVersion: version,
        timestamp: new Date(),
      },
    };
  }

  private createErrorResult(
    error: OrchestrationError,
    startTime: number,
    version: string,
    attempts: number
  ): ToolExecutionResult<never> {
    return {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
      metadata: {
        executionTimeMs: performance.now() - startTime,
        attempts,
        toolVersion: version,
        timestamp: new Date(),
      },
    };
  }
}

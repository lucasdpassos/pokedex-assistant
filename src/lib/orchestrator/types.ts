/**
 * Core types for the Tool Orchestration System
 * Provides type safety and clear contracts for tool execution
 */

export interface ToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly version: string;
  readonly category: 'pokemon' | 'team' | 'analysis' | 'utility';
  readonly inputSchema: {
    readonly type: 'object';
    readonly properties: Record<string, any>;
    readonly required: readonly string[];
  };
  readonly outputSchema?: {
    readonly type: 'object';
    readonly properties: Record<string, any>;
  };
  readonly rateLimit?: {
    readonly maxRequests: number;
    readonly windowMs: number;
  };
  readonly timeout?: number;
  readonly retryConfig?: {
    readonly maxAttempts: number;
    readonly backoffMs: number;
    readonly exponential: boolean;
  };
}

export interface ToolExecutionContext {
  readonly toolName: string;
  readonly input: Record<string, any>;
  readonly requestId: string;
  readonly userId?: string;
  readonly timestamp: Date;
  readonly metadata?: Record<string, any>;
}

export interface ToolExecutionResult<T = any> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: {
    readonly code: string;
    readonly message: string;
    readonly details?: Record<string, any>;
  };
  readonly metadata: {
    readonly executionTimeMs: number;
    readonly attempts: number;
    readonly toolVersion: string;
    readonly timestamp: Date;
  };
}

export interface ToolHandler<TInput = any, TOutput = any> {
  execute(context: ToolExecutionContext): Promise<ToolExecutionResult<TOutput>>;
  validate?(input: TInput): Promise<ValidationResult>;
  beforeExecute?(context: ToolExecutionContext): Promise<void>;
  afterExecute?(context: ToolExecutionContext, result: ToolExecutionResult<TOutput>): Promise<void>;
}

export interface ValidationResult {
  readonly valid: boolean;
  readonly errors?: readonly string[];
}

export interface OrchestrationMetrics {
  readonly totalRequests: number;
  readonly successRate: number;
  readonly averageExecutionTime: number;
  readonly errorsByTool: Record<string, number>;
  readonly requestsByTool: Record<string, number>;
}

export interface CacheEntry<T = any> {
  readonly data: T;
  readonly timestamp: Date;
  readonly ttlMs: number;
  readonly hits: number;
}

export interface RateLimitEntry {
  readonly requests: number;
  readonly windowStart: Date;
}

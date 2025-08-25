/**
 * Comprehensive error handling system for tool orchestration
 * Provides structured error types with proper error codes and context
 */

export enum ErrorCode {
  // Validation Errors
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_FIELD_TYPE = 'INVALID_FIELD_TYPE',
  
  // Tool Errors
  TOOL_NOT_FOUND = 'TOOL_NOT_FOUND',
  TOOL_EXECUTION_FAILED = 'TOOL_EXECUTION_FAILED',
  TOOL_TIMEOUT = 'TOOL_TIMEOUT',
  
  // Rate Limiting
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  
  // External API Errors
  EXTERNAL_API_ERROR = 'EXTERNAL_API_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  API_UNAVAILABLE = 'API_UNAVAILABLE',
  
  // System Errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  RESOURCE_EXHAUSTED = 'RESOURCE_EXHAUSTED',
}

export class OrchestrationError extends Error {
  public readonly code: ErrorCode;
  public readonly details: Record<string, any>;
  public readonly timestamp: Date;
  public readonly context?: Record<string, any>;

  constructor(
    code: ErrorCode,
    message: string,
    details: Record<string, any> = {},
    context?: Record<string, any>
  ) {
    super(message);
    this.name = 'OrchestrationError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date();
    this.context = context;
    
    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, OrchestrationError);
    }
  }

  public toJSON(): Record<string, any> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
      timestamp: this.timestamp.toISOString(),
      context: this.context,
      stack: this.stack,
    };
  }

  public static fromUnknown(error: unknown, context?: Record<string, any>): OrchestrationError {
    if (error instanceof OrchestrationError) {
      return error;
    }

    if (error instanceof Error) {
      return new OrchestrationError(
        ErrorCode.INTERNAL_ERROR,
        error.message,
        { originalError: error.name },
        context
      );
    }

    return new OrchestrationError(
      ErrorCode.INTERNAL_ERROR,
      'An unknown error occurred',
      { originalError: String(error) },
      context
    );
  }
}

export class ValidationError extends OrchestrationError {
  constructor(message: string, field?: string, value?: any) {
    super(
      ErrorCode.INVALID_INPUT,
      message,
      { field, value }
    );
    this.name = 'ValidationError';
  }
}

export class ToolNotFoundError extends OrchestrationError {
  constructor(toolName: string) {
    super(
      ErrorCode.TOOL_NOT_FOUND,
      `Tool '${toolName}' not found`,
      { toolName }
    );
    this.name = 'ToolNotFoundError';
  }
}

export class RateLimitError extends OrchestrationError {
  constructor(toolName: string, limit: number, windowMs: number) {
    super(
      ErrorCode.RATE_LIMIT_EXCEEDED,
      `Rate limit exceeded for tool '${toolName}': ${limit} requests per ${windowMs}ms`,
      { toolName, limit, windowMs }
    );
    this.name = 'RateLimitError';
  }
}

export class ToolTimeoutError extends OrchestrationError {
  constructor(toolName: string, timeoutMs: number) {
    super(
      ErrorCode.TOOL_TIMEOUT,
      `Tool '${toolName}' timed out after ${timeoutMs}ms`,
      { toolName, timeoutMs }
    );
    this.name = 'ToolTimeoutError';
  }
}

export class ExternalApiError extends OrchestrationError {
  constructor(apiName: string, statusCode?: number, responseBody?: any) {
    super(
      ErrorCode.EXTERNAL_API_ERROR,
      `External API '${apiName}' returned an error`,
      { apiName, statusCode, responseBody }
    );
    this.name = 'ExternalApiError';
  }
}

/**
 * Structured logging system for tool orchestration
 * Provides comprehensive logging with levels, context, and performance metrics
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LogEntry {
  readonly timestamp: Date;
  readonly level: LogLevel;
  readonly message: string;
  readonly context?: Record<string, any>;
  readonly requestId?: string;
  readonly toolName?: string;
  readonly userId?: string;
  readonly executionTimeMs?: number;
  readonly error?: {
    readonly name: string;
    readonly message: string;
    readonly stack?: string;
    readonly code?: string;
  };
}

export interface Logger {
  debug(message: string, context?: Record<string, any>): void;
  info(message: string, context?: Record<string, any>): void;
  warn(message: string, context?: Record<string, any>): void;
  error(message: string, error?: Error, context?: Record<string, any>): void;
  setContext(context: Record<string, any>): void;
  child(additionalContext: Record<string, any>): Logger;
}

class StructuredLogger implements Logger {
  private baseContext: Record<string, any> = {};
  private minLevel: LogLevel = LogLevel.INFO;

  constructor(minLevel: LogLevel = LogLevel.INFO) {
    this.minLevel = minLevel;
  }

  public setLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  public setContext(context: Record<string, any>): void {
    this.baseContext = { ...context };
  }

  public child(additionalContext: Record<string, any>): Logger {
    const childLogger = new StructuredLogger(this.minLevel);
    childLogger.baseContext = { ...this.baseContext, ...additionalContext };
    return childLogger;
  }

  public debug(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  public info(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, context);
  }

  public warn(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, context);
  }

  public error(message: string, error?: Error, context?: Record<string, any>): void {
    const errorInfo = error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: (error as any).code,
    } : undefined;

    this.log(LogLevel.ERROR, message, { ...context, error: errorInfo });
  }

  private log(level: LogLevel, message: string, context?: Record<string, any>): void {
    if (level < this.minLevel) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      context: { ...this.baseContext, ...context },
    };

    // In production, you would send this to your logging service
    // For now, we'll use structured console logging
    this.writeToConsole(entry);
  }

  private writeToConsole(entry: LogEntry): void {
    const levelName = LogLevel[entry.level];
    const timestamp = entry.timestamp.toISOString();
    
    const logData = {
      timestamp,
      level: levelName,
      message: entry.message,
      ...entry.context,
    };

    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(`[${timestamp}] DEBUG: ${entry.message}`, logData);
        break;
      case LogLevel.INFO:
        console.info(`[${timestamp}] INFO: ${entry.message}`, logData);
        break;
      case LogLevel.WARN:
        console.warn(`[${timestamp}] WARN: ${entry.message}`, logData);
        break;
      case LogLevel.ERROR:
        console.error(`[${timestamp}] ERROR: ${entry.message}`, logData);
        break;
    }
  }
}

// Export singleton logger instance
export const logger = new StructuredLogger(
  process.env.NODE_ENV === 'development' ? LogLevel.DEBUG : LogLevel.INFO
);

// Performance logging utilities
export class PerformanceLogger {
  private startTimes = new Map<string, number>();

  public start(operationId: string): void {
    this.startTimes.set(operationId, performance.now());
  }

  public end(operationId: string, context?: Record<string, any>): number {
    const startTime = this.startTimes.get(operationId);
    if (!startTime) {
      logger.warn('Performance measurement ended without start', { operationId });
      return 0;
    }

    const duration = performance.now() - startTime;
    this.startTimes.delete(operationId);

    logger.info('Operation completed', {
      operationId,
      durationMs: Math.round(duration * 100) / 100,
      ...context,
    });

    return duration;
  }

  public measure<T>(operationId: string, operation: () => Promise<T>, context?: Record<string, any>): Promise<T> {
    this.start(operationId);
    return operation().finally(() => {
      this.end(operationId, context);
    });
  }
}

export const performanceLogger = new PerformanceLogger();

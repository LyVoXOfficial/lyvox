/**
 * Centralized Error Logger
 * 
 * Provides structured logging with context and optional monitoring integration
 */

export enum LogLevel {
  DEBUG = "debug",
  INFO = "info",
  WARN = "warn",
  ERROR = "error",
  FATAL = "fatal",
}

export interface LogContext {
  component?: string;
  action?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
  error?: unknown;
}

interface LogEntry {
  level: LogLevel;
  message: string;
  context?: LogContext;
  timestamp: string;
}

class ErrorLogger {
  private isDevelopment = process.env.NODE_ENV === "development";
  private isClient = typeof window !== "undefined";

  /**
   * Log a debug message (only in development)
   */
  debug(message: string, context?: LogContext): void {
    if (this.isDevelopment) {
      this.log(LogLevel.DEBUG, message, context);
    }
  }

  /**
   * Log an informational message
   */
  info(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, message, context);
  }

  /**
   * Log a warning
   */
  warn(message: string, context?: LogContext): void {
    this.log(LogLevel.WARN, message, context);
  }

  /**
   * Log an error
   */
  error(message: string, context?: LogContext): void {
    this.log(LogLevel.ERROR, message, context);
    this.sendToMonitoring(LogLevel.ERROR, message, context);
  }

  /**
   * Log a fatal error (critical)
   */
  fatal(message: string, context?: LogContext): void {
    this.log(LogLevel.FATAL, message, context);
    this.sendToMonitoring(LogLevel.FATAL, message, context);
  }

  /**
   * Internal logging method
   */
  private log(level: LogLevel, message: string, context?: LogContext): void {
    const entry: LogEntry = {
      level,
      message,
      context,
      timestamp: new Date().toISOString(),
    };

    // Format output for console
    const prefix = this.getLogPrefix(level);
    const contextStr = context ? JSON.stringify(this.sanitizeContext(context), null, 2) : "";

    switch (level) {
      case LogLevel.DEBUG:
        console.debug(prefix, message, contextStr);
        break;
      case LogLevel.INFO:
        console.info(prefix, message, contextStr);
        break;
      case LogLevel.WARN:
        console.warn(prefix, message, contextStr);
        break;
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        console.error(prefix, message, contextStr);
        if (context?.error) {
          console.error("Error details:", context.error);
        }
        break;
    }

    // Store in sessionStorage for debugging (client-side only)
    if (this.isClient && this.isDevelopment) {
      this.storeLog(entry);
    }
  }

  /**
   * Get formatted prefix for console output
   */
  private getLogPrefix(level: LogLevel): string {
    const timestamp = new Date().toLocaleTimeString();
    return `[${timestamp}] [${level.toUpperCase()}]`;
  }

  /**
   * Sanitize context to remove sensitive data
   */
  private sanitizeContext(context: LogContext): LogContext {
    const sanitized = { ...context };

    // Remove sensitive fields from metadata
    if (sanitized.metadata) {
      const { password, token, secret, apiKey, ...safeMetadata } = sanitized.metadata as Record<
        string,
        unknown
      >;
      sanitized.metadata = safeMetadata;
    }

    // Sanitize error objects
    if (sanitized.error instanceof Error) {
      sanitized.error = {
        name: sanitized.error.name,
        message: sanitized.error.message,
        stack: this.isDevelopment ? sanitized.error.stack : undefined,
      };
    }

    return sanitized;
  }

  /**
   * Store logs in sessionStorage for debugging
   */
  private storeLog(entry: LogEntry): void {
    try {
      const key = "app_logs";
      const existing = sessionStorage.getItem(key);
      const logs = existing ? JSON.parse(existing) : [];
      
      // Keep only last 100 logs
      logs.push(entry);
      if (logs.length > 100) {
        logs.shift();
      }
      
      sessionStorage.setItem(key, JSON.stringify(logs));
    } catch (err) {
      // Ignore storage errors
    }
  }

  /**
   * Send critical errors to monitoring service
   * 
   * TODO: Integrate with monitoring service (e.g., Sentry, LogRocket)
   */
  private sendToMonitoring(level: LogLevel, message: string, context?: LogContext): void {
    // Only send errors and fatal logs
    if (level !== LogLevel.ERROR && level !== LogLevel.FATAL) {
      return;
    }

    // Skip in development
    if (this.isDevelopment) {
      return;
    }

    // TODO: Implement actual monitoring integration
    // Example integrations:
    // - Sentry: Sentry.captureException(context?.error, { level, extra: context })
    // - LogRocket: LogRocket.captureException(context?.error)
    // - Custom endpoint: fetch('/api/logs', { method: 'POST', body: JSON.stringify({ level, message, context }) })

    // Placeholder for future integration
    if (this.isClient && typeof window !== "undefined") {
      // Browser-based monitoring could go here
    }
  }

  /**
   * Get all stored logs (for debugging)
   */
  getLogs(): LogEntry[] {
    if (!this.isClient) return [];
    
    try {
      const logs = sessionStorage.getItem("app_logs");
      return logs ? JSON.parse(logs) : [];
    } catch {
      return [];
    }
  }

  /**
   * Clear all stored logs
   */
  clearLogs(): void {
    if (this.isClient) {
      sessionStorage.removeItem("app_logs");
    }
  }
}

// Export singleton instance
export const logger = new ErrorLogger();

// Export helper functions for common patterns
export const logError = (message: string, error: unknown, context?: Omit<LogContext, "error">) => {
  logger.error(message, { ...context, error });
};

export const logWarn = (message: string, context?: LogContext) => {
  logger.warn(message, context);
};

export const logInfo = (message: string, context?: LogContext) => {
  logger.info(message, context);
};



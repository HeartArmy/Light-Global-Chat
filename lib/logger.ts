import Log from '@/models/Log';
import connectDB from '@/lib/mongodb';

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

export interface LogMeta {
  [key: string]: any;
}

export interface LogOptions {
  route?: string;
  userId?: string;
  sessionId?: string;
  meta?: LogMeta;
}

class Logger {
  private async ensureConnection() {
    if (!Log.db) {
      await connectDB();
    }
  }

  private async sendToLogflare(level: LogLevel, message: string, options: LogOptions = {}): Promise<void> {
    const logflareApiKey = process.env.LOGFLARE_API_KEY;
    const logflareSourceId = process.env.LOGFLARE_SOURCE_ID;

    if (!logflareApiKey || !logflareSourceId) {
      return; // Skip Logflare if not configured
    }

    try {
      const logEntry = {
        source: logflareSourceId,
        log_entry: message,
        metadata: {
          level,
          route: options.route || 'unknown',
          userId: options.userId || null,
          sessionId: options.sessionId || null,
          ...options.meta,
          timestamp: new Date().toISOString(),
        },
      };

      const response = await fetch('https://api.logflare.app/logs/json', {
        method: 'POST',
        headers: {
          'X-API-KEY': logflareApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([logEntry]), // Logflare expects an array of log entries
      });

      if (!response.ok) {
        console.error('Failed to send log to Logflare:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Error sending log to Logflare:', error);
    }
  }

  async log(
    level: LogLevel,
    message: string,
    options: LogOptions = {}
  ): Promise<void> {
    // Send to Logflare first (async, don't wait for it)
    this.sendToLogflare(level, message, options).catch(() => {
      // Logflare logging failure shouldn't break the application
    });

    // MongoDB logging is currently disabled
    /*
    try {
      await this.ensureConnection();
      
      const logEntry = {
        level,
        message,
        route: options.route || 'unknown',
        userId: options.userId || null,
        sessionId: options.sessionId || null,
        meta: options.meta || {},
        timestamp: new Date(),
      };

      await Log.create(logEntry);
    } catch (error) {
      // Fallback to console if MongoDB logging fails
      console.error('Failed to log to MongoDB:', error);
      console.log(`[${level.toUpperCase()}] ${message}`, options.meta || '');
    }
    */
  }

  async error(message: string, options: LogOptions = {}): Promise<void> {
    await this.log('error', message, options);
  }

  async warn(message: string, options: LogOptions = {}): Promise<void> {
    await this.log('warn', message, options);
  }

  async info(message: string, options: LogOptions = {}): Promise<void> {
    await this.log('info', message, options);
  }

  async debug(message: string, options: LogOptions = {}): Promise<void> {
    await this.log('debug', message, options);
  }
}

// Create singleton instance
const logger = new Logger();

// Export convenience functions
export const logError = (message: string, options?: LogOptions) => logger.error(message, options);
export const logWarn = (message: string, options?: LogOptions) => logger.warn(message, options);
export const logInfo = (message: string, options?: LogOptions) => logger.info(message, options);
export const logDebug = (message: string, options?: LogOptions) => logger.debug(message, options);

export default logger;
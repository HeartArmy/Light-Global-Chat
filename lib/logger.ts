import pino from 'pino';

// Custom Logflare transport for Pino (server-side)
class LogflareTransport {
  private apiKey: string;
  private sourceToken: string;

  constructor(apiKey: string, sourceToken: string) {
    this.apiKey = apiKey;
    this.sourceToken = sourceToken;
  }

  write(log: any): void {
    if (!this.apiKey || !this.sourceToken) {
      return;
    }

    try {
      const logEntry = {
        source: this.sourceToken,
        log_entry: log.msg,
        metadata: {
          level: log.level,
          timestamp: log.time,
          ...log.obj,
        },
      };

      // Use the correct Logflare API endpoint from the docs
      fetch('https://api.logflare.app/logs/json?api_key=' + this.apiKey + '&source=' + this.sourceToken, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([logEntry]),
      }).catch(error => {
        // Don't let logging failures break the application
        console.error('Failed to send logs to Logflare:', error);
      });
    } catch (error) {
      // Don't let logging failures break the application
      console.error('Failed to send logs to Logflare:', error);
    }
  }
}

// Create Logflare transport instance
const logflareApiKey = process.env.LOGFLARE_API_KEY;
const logflareSourceId = process.env.LOGFLARE_SOURCE_ID;

const logflareTransport = new LogflareTransport(
  logflareApiKey || '',
  logflareSourceId || ''
);

// Create Pino logger with Logflare transport (server-side)
const logger = pino(
  {
    level: 'info',
    transport: {
      target: 'pino-pretty',
      options: {
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    },
  },
  pino.multistream([
    { level: 'info', stream: logflareTransport },
    { level: 'info', stream: process.stdout }, // Also log to console for debugging
  ])
);

// Console.log interception
const originalLog = console.log;
console.log = (...args) => {
  logger.info(args);
  originalLog(...args);
};

const originalError = console.error;
console.error = (...args) => {
  logger.error(args);
  originalError(...args);
};

const originalWarn = console.warn;
console.warn = (...args) => {
  logger.warn(args);
  originalWarn(...args);
};

const originalInfo = console.info;
console.info = (...args) => {
  logger.info(args);
  originalInfo(...args);
};

const originalDebug = console.debug;
console.debug = (...args) => {
  logger.debug(args);
  originalDebug(...args);
};

export default logger;
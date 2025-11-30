import pino from 'pino';

// Custom Logflare transport for Pino
class LogflareTransport {
  private apiKey: string;
  private sourceToken: string;

  constructor(apiKey: string, sourceToken: string) {
    this.apiKey = apiKey;
    this.sourceToken = sourceToken;
  }

  async send(logs: any[]): Promise<void> {
    if (!this.apiKey || !this.sourceToken) {
      return;
    }

    try {
      const logEntries = logs.map(log => ({
        source: this.sourceToken,
        log_entry: log.msg,
        metadata: {
          level: log.level,
          timestamp: log.time,
          ...log.obj,
        },
      }));

      await fetch('https://api.logflare.app/logs/json', {
        method: 'POST',
        headers: {
          'X-API-KEY': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(logEntries),
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

// Create Pino logger with Logflare transport
const logger = pino(
  {
    level: 'info',
    browser: {
      transmit: {
        level: 'info',
        send: (level, log) => {
          logflareTransport.send([log]);
        },
      },
    },
  },
  pino.transport({
    target: 'pino/file',
    options: { destination: './logs/app.log' },
  })
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
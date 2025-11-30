import pino from 'pino';
import { logflarePinoVercel } from 'pino-logflare';

// Create pino-logflare console stream for serverless functions and send function for browser logs
const { stream, send } = logflarePinoVercel({
  apiKey: process.env.LOGFLARE_API_KEY!,
  sourceToken: process.env.LOGFLARE_SOURCE_ID!,
});

// Create Pino logger with official Logflare transport
const logger = pino(
  {
    browser: {
      transmit: {
        level: 'info',
        send: send,
      },
    },
    level: 'info',
    base: {
      env: process.env.VERCEL_ENV,
      revision: process.env.VERCEL_GITHUB_COMMIT_SHA,
    },
  },
  stream
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
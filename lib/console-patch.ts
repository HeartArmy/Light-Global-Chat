import { logInfo, logError, logWarn, logDebug } from './logger';

// Store original console methods
const originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn,
  info: console.info,
  debug: console.debug,
};

// Helper function to extract route from call stack
function extractRouteFromStack(): string {
  const stack = new Error().stack;
  if (!stack) return 'unknown';
  
  // Look for the first file path that looks like an API route or component
  const lines = stack.split('\n');
  for (const line of lines) {
    const match = line.match(/\/(app|pages)\/([^/]+)/);
    if (match) {
      const [, type, path] = match;
      if (type === 'app') {
        // For app router, look for API routes or specific components
        if (path.startsWith('api/')) {
          return `/api/${path.split('/')[1]}`;
        }
        return `/${path}`;
      }
    }
  }
  return 'unknown';
}

// Helper function to convert arguments to string
function argsToString(args: any[]): string {
  return args.map(arg => {
    if (typeof arg === 'string') return arg;
    if (arg instanceof Error) return arg.stack || arg.message;
    return JSON.stringify(arg);
  }).join(' ');
}

// Patch console.log
console.log = (...args: any[]) => {
  originalConsole.log(...args);
  const message = argsToString(args);
  const route = extractRouteFromStack();
  
  logInfo(message, {
    route,
    meta: {
      originalArgs: args,
      timestamp: new Date().toISOString(),
    }
  });
};

// Patch console.error
console.error = (...args: any[]) => {
  originalConsole.error(...args);
  const message = argsToString(args);
  const route = extractRouteFromStack();
  
  logError(message, {
    route,
    meta: {
      originalArgs: args,
      timestamp: new Date().toISOString(),
    }
  });
};

// Patch console.warn
console.warn = (...args: any[]) => {
  originalConsole.warn(...args);
  const message = argsToString(args);
  const route = extractRouteFromStack();
  
  logWarn(message, {
    route,
    meta: {
      originalArgs: args,
      timestamp: new Date().toISOString(),
    }
  });
};

// Patch console.info
console.info = (...args: any[]) => {
  originalConsole.info(...args);
  const message = argsToString(args);
  const route = extractRouteFromStack();
  
  logInfo(message, {
    route,
    meta: {
      originalArgs: args,
      timestamp: new Date().toISOString(),
    }
  });
};

// Patch console.debug
console.debug = (...args: any[]) => {
  originalConsole.debug(...args);
  const message = argsToString(args);
  const route = extractRouteFromStack();
  
  logDebug(message, {
    route,
    meta: {
      originalArgs: args,
      timestamp: new Date().toISOString(),
    }
  });
};

// Export the original console methods for cases where you need to bypass the patch
export { originalConsole as console };

// Export a utility to temporarily disable the patch
export function withConsolePatch<T>(callback: () => T): T {
  return callback();
}

// Export a utility to temporarily disable the patch
export function withoutConsolePatch<T>(callback: () => T): T {
  const { log, error, warn, info, debug } = originalConsole;
  try {
    console.log = log;
    console.error = error;
    console.warn = warn;
    console.info = info;
    console.debug = debug;
    return callback();
  } finally {
    console.log = log;
    console.error = error;
    console.warn = warn;
    console.info = info;
    console.debug = debug;
  }
}
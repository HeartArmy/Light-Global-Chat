import { registerOTel } from '@vercel/otel';
import Log from '@/models/Log';
import connectDB from '@/lib/mongodb';

// Helper function to convert arguments to string
function argsToString(args: any[]): string {
  return args.map(arg => {
    if (typeof arg === 'string') return arg;
    if (arg instanceof Error) return arg.stack || arg.message;
    return JSON.stringify(arg);
  }).join(' ');
}

// Helper function to extract route from call stack
function extractRouteFromStack(): string {
  const stack = new Error().stack;
  if (!stack) return 'unknown';
  
  const lines = stack.split('\n');
  for (const line of lines) {
    const match = line.match(/\/(app|pages)\/([^/]+)/);
    if (match) {
      const [, type, path] = match;
      if (type === 'app') {
        if (path.startsWith('api/')) {
          return `/api/${path.split('/')[1]}`;
        }
        return `/${path}`;
      }
    }
  }
  return 'unknown';
}

// Save log to MongoDB
async function saveToMongoDB(level: string, message: string, args: any[] = []) {
  try {
    await connectDB();
    
    const logEntry = new Log({
      level,
      message,
      meta: {
        originalArgs: args,
        timestamp: new Date(),
      },
      route: extractRouteFromStack(),
    });

    await logEntry.save();
    console.log('Log saved to MongoDB:', level, message);
  } catch (error) {
    console.error('Failed to save log to MongoDB:', error);
  }
}

export function register() {
  registerOTel({
    serviceName: process.env.OTEL_SERVICE_NAME || 'globalchat',
  });

  // Console.log interception for server-side
  const originalLog = console.log;
  console.log = (...args) => {
    const message = argsToString(args);
    saveToMongoDB('info', message, args);
    originalLog(...args);
  };

  const originalError = console.error;
  console.error = (...args) => {
    const message = argsToString(args);
    saveToMongoDB('error', message, args);
    originalError(...args);
  };

  const originalWarn = console.warn;
  console.warn = (...args) => {
    const message = argsToString(args);
    saveToMongoDB('warn', message, args);
    originalWarn(...args);
  };

  const originalInfo = console.info;
  console.info = (...args) => {
    const message = argsToString(args);
    saveToMongoDB('info', message, args);
    originalInfo(...args);
  };

  const originalDebug = console.debug;
  console.debug = (...args) => {
    const message = argsToString(args);
    saveToMongoDB('debug', message, args);
    originalDebug(...args);
  };
}

// OpenTelemetry configuration for Kubiks
// The @vercel/otel package will automatically use these environment variables:
// - OTEL_EXPORTER_OTLP_ENDPOINT: https://ingest.kubiks.app
// - OTEL_EXPORTER_OTLP_PROTOCOL: http/protobuf
// - OTEL_EXPORTER_OTLP_HEADERS: x-kubiks-key=YOUR_API_KEY
// - OTEL_SERVICE_NAME: globalchat
//
// Make sure these are set in your .env.local or deployment environment variables